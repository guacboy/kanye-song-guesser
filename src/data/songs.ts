import manifest from './songs.json';
import type { Song, Tier } from './types';
import { filterPlayable, songsForTier as filterTier, sortSongs } from '../logic/search';

export type { Song, Tier };

export const TIERS: { id: Tier; label: string }[] = [
  { id: '1b', label: '> 1B streams' },
  { id: '100m', label: '> 100M streams' },
  { id: '1m', label: '> 1M streams' },
  { id: '100k', label: '> 100K streams' },
];

/**
 * Playable songs: manifest entries (songs.json) whose audio file exists in public/audio/,
 * sorted alphabetically. __AUDIO_FILES__ is filled in at build time by vite.config.ts.
 */
export const SONGS: Song[] = sortSongs(filterPlayable(manifest as Song[], __AUDIO_FILES__));

export function songsForTier(tier: Tier): Song[] {
  return filterTier(SONGS, tier);
}
