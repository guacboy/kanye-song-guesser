"""Checks that public/audio/ and the manifest agree."""

from conftest import AUDIO_DIR


def test_every_audio_file_has_a_manifest_entry(manifest, audio):
    """A file without an entry would never show up in the game or the dropdown."""
    listed = {s["file"] for s in manifest}
    orphans = [f for f in audio if f"audio/{f}" not in listed]
    assert not orphans, f"add these to src/data/songs.json: {orphans}"


def test_manifest_file_names_match_disk_casing(manifest, audio):
    """Windows ignores case but itch.io's servers don't: 'Stronger.mp3' != 'stronger.mp3'."""
    on_disk = {f.lower(): f for f in audio}
    for song in manifest:
        name = song["file"].removeprefix("audio/")
        actual = on_disk.get(name.lower())
        assert actual is None or actual == name, f"{song['title']}: manifest says '{name}', disk has '{actual}'"


def test_audio_files_are_not_empty(audio):
    empty = [f for f in audio if (AUDIO_DIR / f).stat().st_size == 0]
    assert not empty, f"empty audio files: {empty}"
