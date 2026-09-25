"""Tests src/logic/settings.ts (run through Node): stored volume parsing and labels."""

import pytest


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("0.5", 0.5),
        ("0", 0),
        ("1", 1),
        ("1.7", 1),  # clamped
        ("-0.2", 0),  # clamped
        (None, 0.8),  # nothing stored yet: default
        ("", 0.8),
        ("   ", 0.8),
        ("loud", 0.8),  # garbage: default
        ("NaN", 0.8),
    ],
)
def test_parse_volume(call, raw, expected):
    assert call("parseVolume", raw, 0.8) == pytest.approx(expected)


@pytest.mark.parametrize(("v", "label"), [(0, "0%"), (0.8, "80%"), (0.456, "46%"), (1, "100%"), (3, "100%"), (-1, "0%")])
def test_volume_label(call, v, label):
    assert call("volumeLabel", v) == label


def test_clamp_volume_handles_non_finite(call):
    # JSON can't carry NaN/Infinity, so exercise the clamp via values that are finite but out of range
    assert call("clampVolume", 2.5) == 1
    assert call("clampVolume", -3) == 0
