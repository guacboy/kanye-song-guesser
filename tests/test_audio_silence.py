"""Tests src/logic/audio.ts (run through Node): skipping silence at the start of a song."""

import pytest

RATE = 1000  # samples per second; one 10 ms window = 10 samples


def signal(silent_sec, loud_sec, level=0.5, quiet=0.0):
    return [quiet] * int(silent_sec * RATE) + [level, -level] * int(loud_sec * RATE / 2)


def test_audible_from_the_start(call):
    assert call("firstAudible", [signal(0, 1)], RATE) == 0


def test_skips_leading_silence(call):
    assert call("firstAudible", [signal(1.5, 1)], RATE) == pytest.approx(1.5)


def test_skips_near_silent_hiss(call):
    assert call("firstAudible", [signal(0.8, 1, quiet=0.005)], RATE) == pytest.approx(0.8)


def test_any_channel_counts(call):
    left = signal(2, 1)
    right = signal(0.3, 2.7)
    assert call("firstAudible", [left, right], RATE) == pytest.approx(0.3)


def test_searches_from_manual_start(call):
    # Loud at 0, then silent until 3s: a manual start of 1s should land on 3s.
    samples = [0.5] * RATE + [0.0] * (2 * RATE) + [0.5] * RATE
    assert call("firstAudible", [samples], RATE, 1) == pytest.approx(3)


def test_all_silent_keeps_start(call):
    assert call("firstAudible", [[0.0] * RATE], RATE, 0.25) == 0.25
