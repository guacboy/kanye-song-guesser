"""Tests scripts/sync_songs.py without touching the network."""

import json
import urllib.error

import pytest

import sync_songs as s
from conftest import ROOT

KANYE = {"id": "5K4W6rqBFWDnAN6FQUkS6x", "name": "Kanye West"}
JAYZ = {"id": "3nFkdlSjzX9mRTtwJOzDYB", "name": "JAY-Z"}
OTIS_REDDING = {"id": "60df5JBRRPcnSpsIMxxwQm", "name": "Otis Redding"}
DWELE = {"id": "1HDn3GhnDqsBmWYYkjBHbP", "name": "Dwele"}

KWORB_PAGE = """
<table class="addpos sortable"><tbody>
<tr><td class="text"><div><a href="https://open.spotify.com/track/0j2T0R9dR9qdJYsB7ciXhf" target="_blank">Stronger</a></div></td><td>1,892,923,303</td><td>911,839</td></tr>
<tr><td class="text"><div>* <a href="https://open.spotify.com/track/14I61w6cyYUHiV2n28IYdP" target="_blank">Otis</a></div></td><td>341,241,603</td><td>132,493</td></tr>
<tr><td class="text"><div><a href="https://open.spotify.com/track/5TRPicyLGbAF2LGBFbHGvO" target="_blank">Flashing Lights</a></div></td><td>1,910,797,108</td><td>1</td></tr>
<tr><td class="text"><div><a href="https://open.spotify.com/track/6giHsGo1eSYZSXKdNwTC62" target="_blank">Can&#39;t Stop</a></div></td><td>99,999</td><td>1</td></tr>
</tbody></table>
"""


def track(tid, name, artists, album_artists, album="Graduation"):
    return {"id": tid, "name": name, "artists": artists, "album": {"name": album, "artists": album_artists}}


STRONGER = track("0j2T0R9dR9qdJYsB7ciXhf", "Stronger", [KANYE], [KANYE])
FLASHING = track("5TRPicyLGbAF2LGBFbHGvO", "Flashing Lights", [KANYE, DWELE], [KANYE])
OTIS = track("14I61w6cyYUHiV2n28IYdP", "Otis (feat. Otis Redding)", [JAYZ, KANYE, OTIS_REDDING], [JAYZ, KANYE], "Watch The Throne")


# ---------- links file ----------

@pytest.mark.parametrize(
    "link",
    [
        "https://open.spotify.com/track/0j2T0R9dR9qdJYsB7ciXhf",
        "https://open.spotify.com/track/0j2T0R9dR9qdJYsB7ciXhf?si=abc123",
        "https://open.spotify.com/intl-de/track/0j2T0R9dR9qdJYsB7ciXhf",
        "open.spotify.com/track/0j2T0R9dR9qdJYsB7ciXhf",
        "spotify:track:0j2T0R9dR9qdJYsB7ciXhf",
        "0j2T0R9dR9qdJYsB7ciXhf",
    ],
)
def test_parse_track_id_accepts_common_link_forms(link):
    assert s.parse_track_id(link) == "0j2T0R9dR9qdJYsB7ciXhf"


@pytest.mark.parametrize(
    "link",
    ["https://open.spotify.com/album/0j2T0R9dR9qdJYsB7ciXhf", "https://open.spotify.com/track/", "stronger", ""],
)
def test_parse_track_id_rejects_non_tracks(link):
    with pytest.raises(s.SyncError):
        s.parse_track_id(link)


def test_parse_links_skips_comments_and_blanks():
    text = "# header\n\nstronger.mp3  https://open.spotify.com/track/0j2T0R9dR9qdJYsB7ciXhf  # the hit\n"
    assert s.parse_links(text) == [("stronger.mp3", "0j2T0R9dR9qdJYsB7ciXhf")]


def test_parse_links_strips_audio_prefix():
    assert s.parse_links("audio/stronger.mp3 0j2T0R9dR9qdJYsB7ciXhf")[0][0] == "stronger.mp3"


def test_parse_links_rejects_malformed_line():
    with pytest.raises(s.SyncError, match="line 2"):
        s.parse_links("a.mp3 0j2T0R9dR9qdJYsB7ciXhf\njust-a-file.mp3\n")


def test_parse_links_rejects_duplicate_file():
    with pytest.raises(s.SyncError, match="twice"):
        s.parse_links("a.mp3 0j2T0R9dR9qdJYsB7ciXhf\na.mp3 5TRPicyLGbAF2LGBFbHGvO\n")


def test_real_links_file_parses():
    """Catches typos in src/data/spotify_links.txt before they're pushed."""
    s.parse_links((ROOT / "src" / "data" / "spotify_links.txt").read_text(encoding="utf-8"))


# ---------- kworb ----------

def test_parse_kworb_rows():
    rows = s.parse_kworb(KWORB_PAGE)
    assert rows["0j2T0R9dR9qdJYsB7ciXhf"] == ("Stronger", 1_892_923_303)
    assert rows["14I61w6cyYUHiV2n28IYdP"] == ("Otis", 341_241_603)  # '*' feature marker is ignored
    assert rows["6giHsGo1eSYZSXKdNwTC62"][0] == "Can't Stop"  # HTML entities decoded


@pytest.mark.parametrize(
    ("streams", "tier"),
    [
        (1_892_923_303, "1b"),
        (1_000_000_001, "1b"),
        (1_000_000_000, "100m"),  # playlists are "> N", so exactly N falls to the next one down
        (341_241_603, "100m"),
        (80_034_288, "1m"),
        (1_000_001, "1m"),
        (250_000, "100k"),
        (100_000, None),
        (5, None),
    ],
)
def test_tier_for_streams(streams, tier):
    assert s.tier_for_streams(streams) == tier


# ---------- Spotify track → entry ----------

@pytest.mark.parametrize(
    ("raw", "clean"),
    [
        ("Stronger", "Stronger"),
        ("Otis (feat. Otis Redding)", "Otis"),
        ("Track [with Someone]", "Track"),
        ("Stronger - 2011 Remaster", "Stronger"),
        ("Father Stretch My Hands, Pt. 1", "Father Stretch My Hands, Pt. 1"),
        ("Stronger - A-Trak Remix", "Stronger - A-Trak Remix"),  # remixes are different songs
    ],
)
def test_clean_title(raw, clean):
    assert s.clean_title(raw) == clean


def test_split_artists_solo():
    assert s.split_artists(STRONGER) == (["Kanye West"], [])


def test_split_artists_feature_is_whoever_is_not_on_the_album():
    assert s.split_artists(FLASHING) == (["Kanye West"], ["Dwele"])


def test_split_artists_joint_album():
    assert s.split_artists(OTIS) == (["JAY-Z", "Kanye West"], ["Otis Redding"])


def test_split_artists_falls_back_to_first_artist_on_compilations():
    label_album = [{"id": "label", "name": "GOOD Music"}]
    t = track("x" * 22, "Mercy", [KANYE, JAYZ], label_album)
    assert s.split_artists(t) == (["Kanye West"], ["JAY-Z"])


def test_build_entry_fields():
    entry = s.build_entry("otis.mp3", OTIS, 341_241_603, None)
    assert entry == {
        "title": "Otis",
        "artists": ["JAY-Z", "Kanye West"],
        "features": ["Otis Redding"],
        "album": "Watch The Throne",
        "file": "audio/otis.mp3",
        "tier": "100m",
        "streams": 341_241_603,
        "spotifyId": "14I61w6cyYUHiV2n28IYdP",
    }


def test_build_entry_keeps_hand_set_fields_and_drops_stale_ones():
    previous = {"title": "Old", "tier": "1m", "start": 12.5, "aliases": ["strong"], "features": ["Stale"]}
    entry = s.build_entry("stronger.mp3", STRONGER, 1_892_923_303, previous)
    assert entry["start"] == 12.5
    assert entry["aliases"] == ["strong"]
    assert entry["title"] == "Stronger"
    assert entry["tier"] == "1b"
    assert "features" not in entry


def test_build_entry_reuses_last_stream_count_when_kworb_misses():
    entry = s.build_entry("stronger.mp3", STRONGER, None, {"streams": 1_500_000_000, "tier": "1b"})
    assert (entry["streams"], entry["tier"]) == (1_500_000_000, "1b")


def test_build_entry_reuses_hand_set_tier_when_no_streams_known():
    entry = s.build_entry("stronger.mp3", STRONGER, None, {"tier": "100m"})
    assert entry["tier"] == "100m" and "streams" not in entry


def test_build_entry_fails_without_any_stream_info():
    with pytest.raises(s.SyncError, match="no stream count"):
        s.build_entry("stronger.mp3", STRONGER, None, None)


def test_build_entry_fails_below_lowest_playlist():
    with pytest.raises(s.SyncError, match="below the lowest"):
        s.build_entry("stronger.mp3", STRONGER, 50_000, None)


def test_merge_replaces_appends_and_keeps_unlisted():
    manifest = [{"file": "audio/a.mp3", "v": 1}, {"file": "audio/manual.mp3", "v": 1}]
    synced = [{"file": "audio/a.mp3", "v": 2}, {"file": "audio/new.mp3", "v": 2}]
    assert s.merge(manifest, synced) == [
        {"file": "audio/a.mp3", "v": 2},
        {"file": "audio/manual.mp3", "v": 1},
        {"file": "audio/new.mp3", "v": 2},
    ]


# ---------- stream lookup + full run (network faked) ----------

@pytest.fixture
def fake_net(monkeypatch):
    """Fake kworb (Kanye's page only) and Spotify; records requested URLs."""
    tracks = {t["id"]: t for t in (STRONGER, FLASHING, OTIS)}
    calls = []

    def http(url, **kwargs):
        calls.append(url)
        if "accounts.spotify.com" in url:
            return json.dumps({"access_token": "tok"}).encode()
        if "api.spotify.com/v1/tracks/" in url:
            tid = url.rsplit("/", 1)[1]
            if tid not in tracks:
                raise urllib.error.HTTPError(url, 404, "nf", {}, None)
            return json.dumps(tracks[tid]).encode()
        if "kworb.net" in url:
            if KANYE["id"] in url:
                return KWORB_PAGE.encode()
            raise urllib.error.HTTPError(url, 404, "nf", {}, None)
        raise AssertionError(f"unexpected request {url}")

    monkeypatch.setattr(s, "http", http)
    monkeypatch.setattr(s.time, "sleep", lambda _: None)
    monkeypatch.setenv("SPOTIFY_CLIENT_ID", "id")
    monkeypatch.setenv("SPOTIFY_CLIENT_SECRET", "secret")
    return calls


def test_kworb_finds_feature_on_second_artists_page(fake_net):
    # JAY-Z is first on Otis but has no page in the fake; Kanye's page has it.
    assert s.Kworb().streams(OTIS) == (341_241_603, "exact")


def test_kworb_falls_back_to_title_match(fake_net):
    deluxe = dict(STRONGER, id="z" * 22)
    assert s.Kworb().streams(deluxe) == (1_892_923_303, "title match")


def test_kworb_fetches_each_artist_page_once(fake_net):
    k = s.Kworb()
    k.streams(STRONGER)
    k.streams(FLASHING)
    assert sum("kworb.net" in u for u in fake_net) == 1


def test_sync_end_to_end(fake_net, tmp_path, monkeypatch):
    links = tmp_path / "links.txt"
    links.write_text(
        "stronger.mp3 0j2T0R9dR9qdJYsB7ciXhf\notis.mp3 https://open.spotify.com/track/14I61w6cyYUHiV2n28IYdP\n",
        encoding="utf-8",
    )
    manifest = tmp_path / "songs.json"
    manifest.write_text(
        json.dumps(
            [
                {"title": "Stronger", "artists": ["Kanye West"], "album": "G", "file": "audio/stronger.mp3", "tier": "1m", "start": 3},
                {"title": "Manual", "artists": ["Kanye West"], "album": "M", "file": "audio/manual.mp3", "tier": "1m"},
            ]
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(s, "LINKS_PATH", links)
    monkeypatch.setattr(s, "MANIFEST_PATH", manifest)
    monkeypatch.setattr(s, "ENV_PATH", tmp_path / "missing.env")
    monkeypatch.setattr(s, "ROOT", tmp_path)

    assert s.sync(dry_run=False) == 0
    result = {e["file"]: e for e in json.loads(manifest.read_text(encoding="utf-8"))}
    assert result["audio/stronger.mp3"]["tier"] == "1b"
    assert result["audio/stronger.mp3"]["start"] == 3
    assert result["audio/manual.mp3"]["title"] == "Manual"
    assert result["audio/otis.mp3"]["features"] == ["Otis Redding"]


def test_sync_dry_run_does_not_write(fake_net, tmp_path, monkeypatch):
    links = tmp_path / "links.txt"
    links.write_text("stronger.mp3 0j2T0R9dR9qdJYsB7ciXhf\n", encoding="utf-8")
    manifest = tmp_path / "songs.json"
    manifest.write_text("[]", encoding="utf-8")
    monkeypatch.setattr(s, "LINKS_PATH", links)
    monkeypatch.setattr(s, "MANIFEST_PATH", manifest)
    monkeypatch.setattr(s, "ENV_PATH", tmp_path / "missing.env")
    monkeypatch.setattr(s, "ROOT", tmp_path)

    assert s.sync(dry_run=True) == 0
    assert manifest.read_text(encoding="utf-8") == "[]"


def test_sync_reports_failures_but_writes_the_rest(fake_net, tmp_path, monkeypatch):
    links = tmp_path / "links.txt"
    links.write_text("stronger.mp3 0j2T0R9dR9qdJYsB7ciXhf\ngone.mp3 " + "q" * 22 + "\n", encoding="utf-8")
    manifest = tmp_path / "songs.json"
    manifest.write_text("[]", encoding="utf-8")
    monkeypatch.setattr(s, "LINKS_PATH", links)
    monkeypatch.setattr(s, "MANIFEST_PATH", manifest)
    monkeypatch.setattr(s, "ENV_PATH", tmp_path / "missing.env")
    monkeypatch.setattr(s, "ROOT", tmp_path)

    assert s.sync(dry_run=False) == 1
    assert [e["file"] for e in json.loads(manifest.read_text(encoding="utf-8"))] == ["audio/stronger.mp3"]


def test_missing_credentials_is_a_clear_error(monkeypatch):
    monkeypatch.delenv("SPOTIFY_CLIENT_ID", raising=False)
    monkeypatch.delenv("SPOTIFY_CLIENT_SECRET", raising=False)
    with pytest.raises(s.SyncError, match="SPOTIFY_CLIENT_ID"):
        s.spotify_token()
