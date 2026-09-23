import json
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
MANIFEST_PATH = ROOT / "src" / "data" / "songs.json"
AUDIO_DIR = ROOT / "public" / "audio"
AUDIO_EXTS = {".mp3", ".ogg", ".m4a", ".wav"}
HARNESS = ROOT / "tests" / "js" / "harness.mjs"


def audio_files() -> list[str]:
    """Audio file names in public/audio/, with their exact on-disk casing."""
    if not AUDIO_DIR.is_dir():
        return []
    return sorted(p.name for p in AUDIO_DIR.iterdir() if p.is_file() and p.suffix.lower() in AUDIO_EXTS)


@pytest.fixture(scope="session")
def manifest() -> list[dict]:
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


@pytest.fixture(scope="session")
def audio() -> list[str]:
    return audio_files()


@pytest.fixture(scope="session")
def node() -> str:
    exe = shutil.which("node")
    if exe is None:
        pytest.skip("node is not installed")
    return exe


@pytest.fixture(scope="session")
def call(node):
    """Call a function exported from src/logic/search.ts: call("sortSongs", songs)."""

    def _call(fn: str, *args):
        result = subprocess.run(
            [node, "--experimental-strip-types", "--no-warnings", str(HARNESS)],
            input=json.dumps({"fn": fn, "args": list(args)}),
            capture_output=True,
            text=True,
            encoding="utf-8",
            cwd=ROOT,
            timeout=30,
        )
        assert result.returncode == 0, result.stderr
        return json.loads(result.stdout)

    return _call


def make_song(title: str, artists=("Kanye West",), features=(), tier="1b", **extra) -> dict:
    slug = "".join(c if c.isalnum() else "-" for c in title.lower())
    song = {
        "title": title,
        "artists": list(artists),
        "album": "Test Album",
        "file": f"audio/{slug}.mp3",
        "tier": tier,
        **extra,
    }
    if features:
        song["features"] = list(features)
    return song
