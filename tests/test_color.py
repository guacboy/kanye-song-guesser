"""Tests src/logic/color.ts (run through Node): the album backdrop color."""

import pytest


def pixels(*runs):
    """RGBA data from (count, (r, g, b[, a])) runs."""
    data = []
    for count, rgba in runs:
        r, g, b, *a = rgba
        data += [r, g, b, a[0] if a else 255] * count
    return data


def test_dominant_color_picks_the_majority(call):
    data = pixels((60, (200, 30, 30)), (40, (20, 20, 200)))
    assert call("dominantColor", data) == [200, 30, 30]


def test_dominant_color_averages_similar_shades(call):
    # 200 and 206 share a bucket (16 levels per channel), so they're one color
    data = pixels((10, (200, 100, 50)), (10, (206, 100, 50)), (15, (0, 0, 0)))
    assert call("dominantColor", data) == [203, 100, 50]


def test_dominant_color_ignores_transparent_pixels(call):
    data = pixels((90, (255, 255, 255, 0)), (10, (10, 150, 10)))
    assert call("dominantColor", data) == [10, 150, 10]


def test_dominant_color_prefers_artwork_over_white_border(call):
    # e.g. The College Dropout: mostly white frame, gold artwork
    data = pixels((70, (250, 250, 250)), (20, (200, 150, 40)), (10, (20, 20, 20)))
    assert call("dominantColor", data) == [200, 150, 40]


def test_dominant_color_black_and_white_cover_stays_grey(call):
    data = pixels((60, (30, 30, 30)), (38, (240, 240, 240)), (2, (200, 30, 30)))  # 2% color: too little
    assert call("dominantColor", data) == [30, 30, 30]


def test_dominant_color_of_nothing_is_none(call):
    assert call("dominantColor", []) is None
    assert call("dominantColor", pixels((5, (1, 2, 3, 0)))) is None


@pytest.mark.parametrize("rgb", [[255, 0, 0], [12, 200, 90], [128, 128, 128], [0, 0, 0], [255, 255, 255]])
def test_hsl_round_trip(call, rgb):
    assert call("hslToRgb", call("rgbToHsl", rgb)) == rgb


def test_backdrop_darkens_light_colors_keeping_hue(call):
    light = [250, 220, 120]  # pale gold
    out = call("backdropColor", light)
    h_in, s_in, _ = call("rgbToHsl", light)
    h_out, s_out, l_out = call("rgbToHsl", out)
    assert l_out <= 0.33
    assert h_out == pytest.approx(h_in, abs=0.02)
    assert s_out == pytest.approx(s_in, abs=0.05)


def test_backdrop_keeps_dark_colors(call):
    assert call("backdropColor", [40, 20, 60]) == [40, 20, 60]


def test_backdrop_white_becomes_grey(call):
    r, g, b = call("backdropColor", [255, 255, 255])
    assert r == g == b and r < 90
