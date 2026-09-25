/** Window RMS a clip has to reach to count as audible (0.02 is about -34 dBFS). */
export const AUDIBLE_RMS = 0.02;
/** Loudness is measured in windows of this many seconds. */
export const WINDOW_SEC = 0.01;

/**
 * Seconds into the audio where sound first becomes audible, searching from `from` seconds.
 * `channels` holds each channel's samples (-1..1). Returns `from` if nothing is loud enough,
 * so an all-quiet song still plays from its usual start.
 */
export function firstAudible(channels: ArrayLike<number>[], sampleRate: number, from = 0): number {
  const length = Math.min(...channels.map((c) => c.length));
  const win = Math.max(1, Math.round(WINDOW_SEC * sampleRate));
  for (let start = Math.max(0, Math.round(from * sampleRate)); start < length; start += win) {
    const end = Math.min(start + win, length);
    for (const samples of channels) {
      let sum = 0;
      for (let i = start; i < end; i++) sum += samples[i] * samples[i];
      if (Math.sqrt(sum / (end - start)) >= AUDIBLE_RMS) return start / sampleRate;
    }
  }
  return from;
}
