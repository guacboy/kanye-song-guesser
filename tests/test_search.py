"""Tests src/logic/search.ts (run through Node) - answer checking, credits, sorting and dropdown filtering."""

import pytest

from conftest import make_song

STRONGER = make_song("Stronger")
FLASHING = make_song("Flashing Lights", features=["Dwele"])
FATHER = make_song("Father Stretch My Hands Pt. 1", aliases=["Father Stretch My Hands"])
OTIS = make_song("Otis", artists=["JAY-Z", "Kanye West"], features=["Otis Redding"])
CANT = make_song("Can't Tell Me Nothing", tier="100m")
BOUND = make_song("bound 2", tier="100m")
DRUNK = make_song("Drunk and Hot Girls", features=["Mos Def"], tier="1m")
POOL = [STRONGER, FLASHING, FATHER, OTIS, CANT, BOUND, DRUNK]


def titles(songs):
    return [s["title"] for s in songs]


# ---------- answers ----------

@pytest.mark.parametrize("guess", ["Stronger", "stronger", "  STRONGER ", "Stronger!"])
def test_is_correct_ignores_case_whitespace_and_punctuation(call, guess):
    assert call("isCorrect", STRONGER, guess) is True


@pytest.mark.parametrize("guess", ["Heartless", "Strong", "", "Stronger 2"])
def test_is_correct_rejects_other_titles(call, guess):
    assert call("isCorrect", STRONGER, guess) is False


def test_is_correct_accepts_aliases(call):
    assert call("isCorrect", FATHER, "father stretch my hands") is True


def test_ampersand_matches_and(call):
    song = make_song("Drunk & Hot Girls")
    assert call("isCorrect", song, "Drunk and Hot Girls") is True


# ---------- credits (second line of each dropdown row) ----------

def test_credits_solo(call):
    assert call("formatCredits", STRONGER) == "Kanye West"


def test_credits_with_feature(call):
    assert call("formatCredits", FLASHING) == "Kanye West feat. Dwele"


def test_credits_multiple_artists_and_features(call):
    song = make_song("X", artists=["JAY-Z", "Kanye West"], features=["Frank Ocean", "The-Dream"])
    assert call("formatCredits", song) == "JAY-Z, Kanye West feat. Frank Ocean, The-Dream"


# ---------- sorting ----------

def test_sort_is_alphabetical_by_title(call):
    assert titles(call("sortSongs", POOL)) == [
        "bound 2",
        "Can't Tell Me Nothing",
        "Drunk and Hot Girls",
        "Father Stretch My Hands Pt. 1",
        "Flashing Lights",
        "Otis",
        "Stronger",
    ]


def test_sort_breaks_title_ties_by_credits(call):
    a = make_song("Monster", artists=["Kanye West"])
    b = make_song("Monster", artists=["Big Sean"])
    assert [s["artists"] for s in call("sortSongs", [a, b])] == [["Big Sean"], ["Kanye West"]]


# ---------- which songs are available ----------

def test_filter_playable_keeps_only_songs_with_audio(call):
    kept = call("filterPlayable", POOL, ["stronger.mp3", "otis.mp3", "unrelated.mp3"])
    assert titles(kept) == ["Stronger", "Otis"]


def test_filter_playable_is_case_sensitive(call):
    assert call("filterPlayable", [STRONGER], ["Stronger.mp3"]) == []


def test_filter_playable_with_no_audio(call):
    assert call("filterPlayable", POOL, []) == []


@pytest.mark.parametrize(
    ("tier", "expected"),
    [("1b", 4), ("100m", 6), ("1m", 7), ("100k", 7)],
)
def test_tiers_are_cumulative(call, tier, expected):
    assert len(call("songsForTier", POOL, tier)) == expected


# ---------- dropdown search ----------

def test_search_empty_query_returns_nothing(call):
    assert call("searchSongs", POOL, "") == []
    assert call("searchSongs", POOL, "   ") == []


def test_search_matches_title_substring(call):
    assert titles(call("searchSongs", POOL, "light")) == ["Flashing Lights"]


def test_search_matches_featured_artist(call):
    assert titles(call("searchSongs", POOL, "dwele")) == ["Flashing Lights"]


def test_search_results_are_alphabetical(call):
    # "t" matches every song; the result must be sorted, not in input order.
    result = titles(call("searchSongs", POOL, "t"))
    assert result == titles(call("sortSongs", [s for s in POOL if s["title"] in result]))
    assert result[0] == "bound 2"


def test_search_ignores_punctuation(call):
    assert titles(call("searchSongs", POOL, "cant tell")) == ["Can't Tell Me Nothing"]


def test_dropdown_only_offers_songs_in_public_audio(call, manifest, audio):
    """End to end with the real manifest and the real audio folder."""
    playable = call("sortSongs", call("filterPlayable", manifest, audio))
    offered = {s["file"] for s in playable}
    assert offered == {s["file"] for s in manifest if s["file"].removeprefix("audio/") in audio}
