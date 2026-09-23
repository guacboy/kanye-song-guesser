"""Type-checks and builds the game, and checks the output is uploadable to itch.io."""

import re
import shutil
import subprocess

import pytest

from conftest import ROOT, audio_files


@pytest.fixture(scope="module")
def npx():
    exe = shutil.which("npx")
    if exe is None:
        pytest.skip("npm/npx is not installed")
    if not (ROOT / "node_modules").is_dir():
        pytest.skip("run `npm install` first")
    return exe


def run(cmd):
    return subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, encoding="utf-8", timeout=300)


def test_typescript_compiles(npx):
    result = run([npx, "tsc", "--noEmit"])
    assert result.returncode == 0, result.stdout + result.stderr


@pytest.fixture(scope="module")
def build_dir(npx, tmp_path_factory):
    out = tmp_path_factory.mktemp("dist")
    result = run([npx, "vite", "build", "--outDir", str(out), "--emptyOutDir"])
    assert result.returncode == 0, result.stdout + result.stderr
    return out


def test_build_has_index_html(build_dir):
    assert (build_dir / "index.html").is_file()


def test_asset_paths_are_relative(build_dir):
    """itch.io serves the game from a subfolder, so absolute '/assets/...' paths would 404."""
    html = (build_dir / "index.html").read_text(encoding="utf-8")
    refs = re.findall(r'(?:src|href)="([^"]+)"', html)
    assert refs
    assert all(not r.startswith("/") for r in refs), refs


def test_audio_files_are_copied_into_build(build_dir):
    for name in audio_files():
        assert (build_dir / "audio" / name).is_file(), f"{name} missing from build"
