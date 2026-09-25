"""Validates src/data/songs.json, the song manifest."""

import re

import pytest

VALID_TIERS = {"1b", "100m", "1m"}
REQUIRED = {"title": str, "artists": list, "album": str, "file": str, "tier": str}
OPTIONAL = {"features": list, "start": (int, float), "aliases": list, "streams": int, "spotifyId": str, "cover": str}
FILE_PATTERN = re.compile(r"^audio/[^/\\]+\.(mp3|ogg|m4a|wav)$", re.IGNORECASE)


def label(song: dict) -> str:
    return song.get("title", repr(song))


def test_manifest_is_non_empty_list(manifest):
    assert isinstance(manifest, list)
    assert manifest, "songs.json has no songs"


def test_required_fields_and_types(manifest):
    for song in manifest:
        for key, typ in REQUIRED.items():
            assert key in song, f"{label(song)}: missing '{key}'"
            assert isinstance(song[key], typ), f"{label(song)}: '{key}' should be {typ.__name__}"
        for key, typ in OPTIONAL.items():
            if key in song:
                assert isinstance(song[key], typ), f"{label(song)}: '{key}' has the wrong type"


def test_no_unknown_fields(manifest):
    """Catches typos like 'feature' or 'artist' that would otherwise be silently ignored."""
    allowed = REQUIRED.keys() | OPTIONAL.keys()
    for song in manifest:
        unknown = song.keys() - allowed
        assert not unknown, f"{label(song)}: unknown field(s) {sorted(unknown)}"


def test_text_fields_not_blank(manifest):
    for song in manifest:
        assert song["title"].strip(), f"{song}: blank title"
        assert song["album"].strip(), f"{label(song)}: blank album"


@pytest.mark.parametrize("key", ["artists", "features", "aliases"])
def test_name_lists_hold_non_blank_strings(manifest, key):
    for song in manifest:
        values = song.get(key, [])
        assert all(isinstance(v, str) and v.strip() for v in values), f"{label(song)}: bad {key} {values}"


def test_every_song_has_an_artist(manifest):
    for song in manifest:
        assert song["artists"], f"{label(song)}: 'artists' is empty"


def test_features_do_not_repeat_main_artists(manifest):
    for song in manifest:
        overlap = set(song["artists"]) & set(song.get("features", []))
        assert not overlap, f"{label(song)}: {sorted(overlap)} listed as both artist and feature"


def test_tiers_are_valid(manifest):
    for song in manifest:
        assert song["tier"] in VALID_TIERS, f"{label(song)}: tier '{song['tier']}' not in {sorted(VALID_TIERS)}"


def test_file_paths_point_into_public_audio(manifest):
    for song in manifest:
        assert FILE_PATTERN.match(song["file"]), f"{label(song)}: file '{song['file']}' should look like audio/name.mp3"


def test_start_offset_is_non_negative(manifest):
    for song in manifest:
        assert song.get("start", 0) >= 0, f"{label(song)}: negative start"


def test_files_are_unique(manifest):
    files = [s["file"].lower() for s in manifest]
    dupes = {f for f in files if files.count(f) > 1}
    assert not dupes, f"audio file used by more than one song: {sorted(dupes)}"


def test_title_and_artist_pairs_are_unique(manifest):
    seen = set()
    for song in manifest:
        key = (song["title"].lower(), tuple(a.lower() for a in song["artists"]))
        assert key not in seen, f"duplicate song entry: {label(song)}"
        seen.add(key)


def test_tier_matches_stream_count(manifest):
    """Synced entries carry a stream count; their tier must agree with it."""
    from sync_songs import tier_for_streams

    for song in manifest:
        if "streams" in song:
            assert song["tier"] == tier_for_streams(song["streams"]), (
                f"{label(song)}: {song['streams']:,} streams should be tier '{tier_for_streams(song['streams'])}'"
            )


def test_cover_images_exist(manifest):
    from conftest import ROOT

    for song in manifest:
        if "cover" in song:
            assert (ROOT / "public" / song["cover"]).is_file(), f"{label(song)}: missing public/{song['cover']}"
