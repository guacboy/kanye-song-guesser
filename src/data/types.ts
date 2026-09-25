export type Tier = '1b' | '100m' | '1m';

export interface Song {
  title: string;
  /** Main credited artists, e.g. ["Kanye West"] or ["JAY-Z", "Kanye West"]. */
  artists: string[];
  /** Featured artists. */
  features?: string[];
  album: string;
  /** Path relative to /public, e.g. 'audio/stronger.mp3'. */
  file: string;
  /** Stream bracket the song falls in (its *highest* bracket). */
  tier: Tier;
  /** Second in the file where the clip starts. Defaults to 0. */
  start?: number;
  /** Extra accepted spellings for the answer. */
  aliases?: string[];
  /** Total Spotify streams when last synced (scripts/sync_songs.py). */
  streams?: number;
  /** Spotify track id the entry was synced from. */
  spotifyId?: string;
  /** Album cover path relative to /public, e.g. 'assets/albums/<album id>.jpg'. */
  cover?: string;
}
