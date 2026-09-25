"""Fill src/data/songs.json from Spotify (title, artists, features, album, cover art) and kworb.net (stream counts).

Usage:
    python scripts/sync_songs.py            # update songs.json
    python scripts/sync_songs.py --dry-run  # show what would change

Reads src/data/spotify_links.txt (one "<audio file>  <spotify track link>" per line) and Spotify
credentials from .env (SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET). Standard library only.

Fields you set by hand in songs.json (start, aliases) are kept on every run. Entries that aren't
in the links file are left untouched.
"""

from __future__ import annotations

import argparse
import base64
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LINKS_PATH = ROOT / "src" / "data" / "spotify_links.txt"
MANIFEST_PATH = ROOT / "src" / "data" / "songs.json"
ENV_PATH = ROOT / ".env"

USER_AGENT = "KanyeGuess-sync/1.0 (+https://github.com/guacboy/kanye-song-guesser)"
KWORB_URL = "https://kworb.net/spotify/artist/{artist_id}_songs.html"

# Album covers are saved here (served as assets/albums/<album id>.jpg). A cover is downloaded once per album.
COVERS_SUBDIR = Path("public") / "assets" / "albums"
# Smallest cover at least this wide is used (150 layout px shown at up to 3x render scale).
COVER_MIN_PX = 450

# Fields the script owns (refreshed every run) vs. fields only a human sets (always preserved).
PRESERVED_FIELDS = ("start", "aliases")

TIER_THRESHOLDS = [("1b", 1_000_000_000), ("100m", 100_000_000), ("1m", 1_000_000)]

TRACK_ID = re.compile(r"^[A-Za-z0-9]{22}$")


class SyncError(Exception):
    pass


# ---------- parsing (pure, unit-tested) ----------

def parse_track_id(link: str) -> str:
    """Accepts open.spotify.com/track/<id>?si=..., spotify:track:<id>, or a bare 22-char id."""
    link = link.strip()
    if link.startswith("spotify:track:"):
        candidate = link.split(":")[2]
    elif "open.spotify.com" in link:
        path = urllib.parse.urlparse(link if "://" in link else f"https://{link}").path
        parts = [p for p in path.split("/") if p]
        if "track" not in parts or parts.index("track") + 1 >= len(parts):
            raise SyncError(f"not a Spotify track link: {link}")
        candidate = parts[parts.index("track") + 1]
    else:
        candidate = link
    if not TRACK_ID.match(candidate):
        raise SyncError(f"not a Spotify track link or id: {link}")
    return candidate


def parse_links(text: str) -> list[tuple[str, str]]:
    """Returns [(file name, track id)] from the links file. Lines: '<file> <link>', '#' comments allowed."""
    entries: list[tuple[str, str]] = []
    seen: set[str] = set()
    for n, raw in enumerate(text.splitlines(), start=1):
        line = raw.split("#", 1)[0].strip()
        if not line:
            continue
        parts = line.split()
        if len(parts) != 2:
            raise SyncError(f"spotify_links.txt line {n}: expected '<audio file> <spotify link>', got: {raw.strip()}")
        name, link = parts
        name = name.removeprefix("audio/")
        if name in seen:
            raise SyncError(f"spotify_links.txt line {n}: {name} is listed twice")
        seen.add(name)
        entries.append((name, parse_track_id(link)))
    return entries


_KWORB_ROW = re.compile(
    r'<a href="https://open\.spotify\.com/track/([A-Za-z0-9]{22})"[^>]*>(.*?)</a>.*?</td>\s*<td>([\d,]+)</td>',
    re.S,
)


def parse_kworb(page: str) -> dict[str, tuple[str, int]]:
    """kworb artist 'songs' page -> {track id: (title, total streams)}."""
    return {tid: (html.unescape(title), int(streams.replace(",", ""))) for tid, title, streams in _KWORB_ROW.findall(page)}


def tier_for_streams(streams: int) -> str | None:
    for tier, minimum in TIER_THRESHOLDS:
        if streams > minimum:
            return tier
    return None


def normalize(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower().replace("&", "and"))


def clean_title(title: str) -> str:
    """'Otis (feat. Otis Redding)' -> 'Otis'; 'Stronger - 2011 Remaster' -> 'Stronger'."""
    title = re.sub(r"\s*[(\[](?:feat\.?|ft\.?|with)\s[^)\]]*[)\]]", "", title, flags=re.I)
    title = re.sub(r"\s+-\s+(?:\d{4}\s+)?Remaster(?:ed)?(?:\s+\d{4})?$", "", title, flags=re.I)
    return title.strip()


def split_artists(track: dict) -> tuple[list[str], list[str]]:
    """Main artists = track artists also credited on the album; everyone else is a feature."""
    album_ids = {a["id"] for a in track["album"]["artists"]}
    main = [a["name"] for a in track["artists"] if a["id"] in album_ids]
    features = [a["name"] for a in track["artists"] if a["id"] not in album_ids]
    if not main:  # compilations / label-credited albums: fall back to "first artist is the lead"
        main, features = features[:1], features[1:]
    return main, features


def pick_cover_url(images: list[dict]) -> str | None:
    """Smallest image that's at least COVER_MIN_PX wide, else the largest available."""
    if not images:
        return None
    by_size = sorted(images, key=lambda i: i.get("width") or 0)
    big_enough = [i for i in by_size if (i.get("width") or 0) >= COVER_MIN_PX]
    return (big_enough[0] if big_enough else by_size[-1])["url"]


def build_entry(
    file_name: str, track: dict, streams: int | None, previous: dict | None, cover: str | None = None
) -> dict:
    main, features = split_artists(track)
    entry: dict = {
        "title": clean_title(track["name"]),
        "artists": main,
    }
    if features:
        entry["features"] = features
    entry["album"] = track["album"]["name"]
    entry["file"] = f"audio/{file_name}"
    cover = cover or (previous or {}).get("cover")
    if cover:
        entry["cover"] = cover

    if streams is None and previous and "streams" in previous:
        streams = previous["streams"]  # kworb didn't have it this time; keep the last known count
    tier = tier_for_streams(streams) if streams is not None else (previous or {}).get("tier")
    if tier is None:
        raise SyncError(
            f"{file_name}: no stream count found and no previous tier. "
            'Add "tier" to its songs.json entry by hand.'
            if streams is None
            else f"{file_name}: only {streams:,} streams, below the lowest playlist (1M)"
        )
    entry["tier"] = tier
    if streams is not None:
        entry["streams"] = streams
    entry["spotifyId"] = track["id"]

    for key in PRESERVED_FIELDS:
        if previous and key in previous:
            entry[key] = previous[key]
    return entry


def merge(manifest: list[dict], synced: list[dict]) -> list[dict]:
    """Replace entries with the same file, append new ones, keep everything else in place."""
    by_file = {e["file"]: e for e in synced}
    merged = [by_file.pop(e["file"], e) for e in manifest]
    return merged + [e for e in synced if e["file"] in by_file]


# ---------- network ----------

def load_env(path: Path = ENV_PATH) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def http(url: str, *, data: bytes | None = None, headers: dict | None = None, retries: int = 3) -> bytes:
    req = urllib.request.Request(url, data=data, headers={"User-Agent": USER_AGENT, **(headers or {})})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                return resp.read()
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < retries - 1:
                time.sleep(int(e.headers.get("Retry-After", "2")) + 1)
                continue
            raise
    raise AssertionError("unreachable")


def spotify_token() -> str:
    client_id = os.environ.get("SPOTIFY_CLIENT_ID")
    secret = os.environ.get("SPOTIFY_CLIENT_SECRET")
    if not client_id or not secret:
        raise SyncError("set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env (see .env.example)")
    auth = base64.b64encode(f"{client_id}:{secret}".encode()).decode()
    try:
        body = http(
            "https://accounts.spotify.com/api/token",
            data=b"grant_type=client_credentials",
            headers={"Authorization": f"Basic {auth}", "Content-Type": "application/x-www-form-urlencoded"},
        )
    except urllib.error.HTTPError as e:
        raise SyncError(f"Spotify rejected the credentials ({e.code}). Check the values in .env.") from e
    return json.loads(body)["access_token"]


def fetch_track(track_id: str, token: str) -> dict:
    try:
        body = http(f"https://api.spotify.com/v1/tracks/{track_id}", headers={"Authorization": f"Bearer {token}"})
    except urllib.error.HTTPError as e:
        hint = " (Development Mode apps need the app owner to have Spotify Premium)" if e.code == 403 else ""
        raise SyncError(f"Spotify error {e.code} for track {track_id}{hint}") from e
    return json.loads(body)


def download_cover(track: dict) -> str | None:
    """Saves the album cover (once per album) and returns its path relative to public/, or None."""
    url = pick_cover_url(track["album"].get("images") or [])
    if url is None:
        return None
    rel = f"assets/albums/{track['album']['id']}.jpg"
    path = ROOT / COVERS_SUBDIR / f"{track['album']['id']}.jpg"
    if not path.is_file():
        path.parent.mkdir(parents=True, exist_ok=True)
        try:
            path.write_bytes(http(url))
        except urllib.error.URLError as e:
            print(f"    (couldn't download cover for {track['album']['name']}: {e})")
            return None
    return rel


class Kworb:
    """Looks up total streams by track id, fetching each artist's kworb page at most once."""

    def __init__(self) -> None:
        self.pages: dict[str, dict[str, tuple[str, int]]] = {}

    def page(self, artist_id: str) -> dict[str, tuple[str, int]]:
        if artist_id not in self.pages:
            try:
                self.pages[artist_id] = parse_kworb(http(KWORB_URL.format(artist_id=artist_id)).decode("utf-8"))
            except urllib.error.HTTPError:
                self.pages[artist_id] = {}  # artist has no kworb page
            time.sleep(0.5)  # be polite
        return self.pages[artist_id]

    def streams(self, track: dict) -> tuple[int | None, str]:
        for artist in track["artists"]:
            rows = self.page(artist["id"])
            if track["id"] in rows:
                return rows[track["id"]][1], "exact"
        # Same song under another release id (deluxe, explicit/clean): match the title on the lead's page.
        want = normalize(clean_title(track["name"]))
        rows = self.page(track["artists"][0]["id"])
        matches = [s for title, s in rows.values() if normalize(clean_title(title)) == want]
        return (max(matches), "title match") if matches else (None, "not found")


# ---------- main ----------

def sync(dry_run: bool) -> int:
    if not LINKS_PATH.is_file():
        raise SyncError(f"{LINKS_PATH.relative_to(ROOT)} not found")
    links = parse_links(LINKS_PATH.read_text(encoding="utf-8"))
    if not links:
        print("spotify_links.txt has no entries - nothing to do.")
        return 0

    load_env()
    token = spotify_token()
    kworb = Kworb()
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    previous = {e["file"]: e for e in manifest}

    synced, failures = [], []
    for file_name, track_id in links:
        try:
            track = fetch_track(track_id, token)
            streams, how = kworb.streams(track)
            cover = None if dry_run else download_cover(track)
            entry = build_entry(file_name, track, streams, previous.get(f"audio/{file_name}"), cover)
        except SyncError as e:
            failures.append(str(e))
            print(f"  ✗ {file_name}: {e}")
            continue
        synced.append(entry)
        note = "" if how == "exact" else f"  [{how}]"
        count = f"{entry['streams']:,}" if "streams" in entry else "?"
        print(f"  ✓ {file_name}: {entry['title']} - {count} streams -> {entry['tier']}{note}")

    merged = merge(manifest, synced)
    if dry_run:
        print("\n--dry-run: songs.json not written.")
    else:
        MANIFEST_PATH.write_text(json.dumps(merged, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"\nWrote {len(synced)} song(s) to {MANIFEST_PATH.relative_to(ROOT)}.")
    if failures:
        print(f"{len(failures)} song(s) failed; fix them and re-run.", file=sys.stderr)
        return 1
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="print results without writing songs.json")
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")  # ✓/✗ on Windows consoles
    try:
        return sync(args.dry_run)
    except SyncError as e:
        print(f"error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
