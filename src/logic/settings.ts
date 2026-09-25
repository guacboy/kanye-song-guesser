// Pure settings helpers, no DOM imports (the pytest suite runs this under Node).

export function clampVolume(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

/** A volume read back from storage: null, blank or garbage falls back; anything else is clamped to 0..1. */
export function parseVolume(raw: string | null, fallback: number): number {
  if (raw === null || raw.trim() === '') return fallback;
  const v = Number(raw);
  return Number.isFinite(v) ? clampVolume(v) : fallback;
}

/** "80%" style label for a 0..1 volume. */
export function volumeLabel(v: number): string {
  return `${Math.round(clampVolume(v) * 100)}%`;
}
