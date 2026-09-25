import Phaser from 'phaser';
import { getVolume } from './settings';

/** Game sound effects in public/assets/audio/, loaded once in BootScene. */
export const SFX = {
  correct: 'assets/audio/ding.mp3',
  click: 'assets/audio/peggle-peg-pop.mp3',
  start: 'assets/audio/menu-hit.mp3',
  incorrect: 'assets/audio/osu-combo-break.wav',
  lifeLost: 'assets/audio/roblox-oof.mp3',
  win: 'assets/audio/roblox-victory.mp3',
  lose: 'assets/audio/sad-trombone.mp3',
} as const;

export type SfxName = keyof typeof SFX;

const key = (name: SfxName) => `sfx-${name}`;

export function loadSfx(scene: Phaser.Scene): void {
  for (const name of Object.keys(SFX) as SfxName[]) scene.load.audio(key(name), SFX[name]);
}

/** Fire-and-forget; a missing file is silently skipped. */
export function playSfx(scene: Phaser.Scene, name: SfxName): void {
  if (scene.cache.audio.exists(key(name))) scene.sound.play(key(name), { volume: getVolume('sfx') });
}
