"""Tests src/logic/score.ts (run through Node): points per clip and the results breakdown."""

import re

import pytest

from conftest import ROOT


@pytest.mark.parametrize(("attempt", "points"), [(0, 300), (1, 150), (2, 75), (3, 25), (4, 0)])
def test_points_per_clip(call, attempt, points):
    assert call("pointsFor", attempt) == points


def test_one_point_value_per_clip_length():
    """CLIP_POINTS lines up with CLIP_LENGTHS in theme.ts (0.1s, 0.5s, 2s, 8s)."""
    theme = (ROOT / "src" / "theme.ts").read_text(encoding="utf-8")
    lengths = re.search(r"CLIP_LENGTHS = \[([^\]]*)\]", theme).group(1).split(",")
    score = (ROOT / "src" / "logic" / "score.ts").read_text(encoding="utf-8")
    points = re.search(r"CLIP_POINTS = \[([^\]]*)\]", score).group(1).split(",")
    assert len(points) == len(lengths)


def test_total_score(call):
    assert call("totalScore", [2, 1, 0, 3]) == 2 * 300 + 150 + 3 * 25
    assert call("totalScore", [0, 0, 0, 0]) == 0


def test_breakdown_lines(call):
    assert call("breakdownLines", [2, 0, 1, 0]) == [
        "300 x 2 = 600 pts",
        "150 x 0 = 0 pts",
        "75 x 1 = 75 pts",
        "25 x 0 = 0 pts",
    ]


def test_songs_guessed(call):
    assert call("songsGuessed", [2, 1, 0, 3]) == 6
    assert call("songsGuessed", [0, 0, 0, 0]) == 0
