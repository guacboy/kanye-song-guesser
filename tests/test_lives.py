"""Checks the life icon images exist (the game falls back to a drawn heart without them)."""

import pytest

from conftest import ROOT


@pytest.mark.parametrize("name", ["alive-kanye.png", "dead-kanye.png"])
def test_life_image_exists(name):
    assert (ROOT / "public" / "assets" / "lives" / name).is_file()
