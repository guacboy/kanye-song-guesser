// Pure song logic, no Phaser/DOM imports - the pytest suite runs this file directly under Node.
import type { Song, Tier } from '../data/types';

export const TIER_RANK: Record<Tier, number> = { '1b': 0, '100m': 1, '1m': 2 };

/** Letters that don't split into a plain letter + accent under Unicode NFD. */
const SPECIAL_LETTERS: Record<string, string> = {
  æ: 'ae', œ: 'oe', ø: 'o', ß: 'ss', đ: 'd', ð: 'd', ł: 'l', þ: 'th', ı: 'i', ħ: 'h', ŧ: 't',
};

/**
 * Lowercase letters and digits only, for matching guesses and searches. Accented and special
 * letters count as their plain ones ("JAŸ-Z" -> "jayz", "Beyoncé" -> "beyonce").
 */
export function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // accents split off by NFD
    .replace(/[æœøßđðłþıħŧ]/g, (c) => SPECIAL_LETTERS[c])
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '');
}

export function isCorrect(song: Song, guess: string): boolean {
  const g = normalizeTitle(guess);
  return [song.title, ...(song.aliases ?? [])].some((t) => normalizeTitle(t) === g);
}

/** "Kanye West ft. Dwele" / "JAY-Z, Kanye West ft. Frank Ocean, The-Dream" */
export function formatCredits(song: Song): string {
  const main = song.artists.join(', ');
  return song.features?.length ? `${main} ft. ${song.features.join(', ')}` : main;
}

/** Credits and album, for under a song title: "Kanye West ft. Dwele  •  Graduation" */
export function creditLine(song: Song): string {
  return `${formatCredits(song)}  •  ${song.album}`;
}

/** Case- and punctuation-insensitive alphabetical comparison. */
const compareText = (a: string, b: string) => a.localeCompare(b, 'en', { sensitivity: 'base', ignorePunctuation: true });

/** Alphabetical by title (case/punctuation-insensitive), ties broken by album, then credits. */
export function sortSongs(songs: Song[]): Song[] {
  return [...songs].sort(
    (a, b) => compareText(a.title, b.title) || compareText(a.album, b.album) || compareText(formatCredits(a), formatCredits(b)),
  );
}

/** Alphabetical by album, then by title within each album. */
export function sortByAlbum(songs: Song[]): Song[] {
  return sortSongs(songs).sort((a, b) => compareText(a.album, b.album)); // sort is stable: titles stay in order
}

/** Only songs whose audio file actually exists. `audioFiles` are bare file names from public/audio/. */
export function filterPlayable(songs: Song[], audioFiles: string[]): Song[] {
  const present = new Set(audioFiles.map((f) => `audio/${f}`));
  return songs.filter((s) => present.has(s.file));
}

/** Songs in a stream bracket. Brackets are cumulative: "> 1M" also includes "> 100M" and "> 1B". */
export function songsForTier(songs: Song[], tier: Tier): Song[] {
  return songs.filter((s) => TIER_RANK[s.tier] <= TIER_RANK[tier]);
}

/**
 * Dropdown matches: title, alias, album, or any credited artist contains the query. Songs whose
 * title (or alias) matches come first (alphabetical), then album/artist matches (by album, then title).
 */
export function searchSongs(songs: Song[], query: string): Song[] {
  const q = normalizeTitle(query);
  if (!q) return [];
  const matches = (texts: string[]) => texts.some((t) => normalizeTitle(t).includes(q));
  const byTitle = songs.filter((s) => matches([s.title, ...(s.aliases ?? [])]));
  const byOther = songs.filter(
    (s) => !byTitle.includes(s) && matches([s.album, ...s.artists, ...(s.features ?? [])]),
  );
  return [...sortSongs(byTitle), ...sortByAlbum(byOther)];
}
