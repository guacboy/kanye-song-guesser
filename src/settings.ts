import { clampVolume, parseVolume } from './logic/settings';

/** music = the song clips, sfx = game sound effects. */
export type VolumeKind = 'music' | 'sfx';

const STORAGE_KEYS: Record<VolumeKind, string> = { music: 'ksg-music-volume', sfx: 'ksg-sfx-volume' };
/** Starting volumes for a new player (nothing saved yet). */
const DEFAULT_VOLUME: Record<VolumeKind, number> = { music: 0.25, sfx: 0.5 };

const volumes: Record<VolumeKind, number> = { music: load('music'), sfx: load('sfx') };
const listeners = new Set<() => void>();

function load(kind: VolumeKind): number {
  try {
    return parseVolume(localStorage.getItem(STORAGE_KEYS[kind]), DEFAULT_VOLUME[kind]);
  } catch {
    return DEFAULT_VOLUME[kind]; // storage blocked (private mode / sandboxed iframe)
  }
}

export function getVolume(kind: VolumeKind): number {
  return volumes[kind];
}

export function setVolume(kind: VolumeKind, value: number): void {
  volumes[kind] = clampVolume(value);
  try {
    localStorage.setItem(STORAGE_KEYS[kind], String(volumes[kind]));
  } catch {
    // not saved, but still applies for this session
  }
  listeners.forEach((fn) => fn());
}

/** Called after any volume change; returns an unsubscribe function. */
export function onVolumeChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
