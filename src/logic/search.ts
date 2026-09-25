// Pure song logic, no Phaser/DOM imports - the pytest suite runs this file directly under Node.
import type { Song, Tier } from '../data/types';

export const TIER_RANK: Record<Tier, number> = { '1b': 0, '100m': 1, '1m': 2, '100k': 3 };

export function normalizeTitle(s: string): string {
  return s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
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

/** Alphabetical by title (case/punctuation-insensitive), ties broken by credits. */
export function sortSongs(songs: Song[]): Song[] {
  const cmp = (a: string, b: string) => a.localeCompare(b, 'en', { sensitivity: 'base', ignorePunctuation: true });
  return [...songs].sort((a, b) => cmp(a.title, b.title) || cmp(formatCredits(a), formatCredits(b)));
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

/** Dropdown matches: title, alias, album, or any credited artist contains the query. Sorted alphabetically. */
export function searchSongs(songs: Song[], query: string): Song[] {
  const q = normalizeTitle(query);
  if (!q) return [];
  return sortSongs(
    songs.filter((s) =>
      [s.title, ...(s.aliases ?? []), s.album, ...s.artists, ...(s.features ?? [])].some((t) => normalizeTitle(t).includes(q)),
    ),
  );
}
