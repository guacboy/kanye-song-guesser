import Phaser from 'phaser';
import { RENDER_SCALE } from './theme';
import { hideDim, showDim } from './ui/backdrop';

/** How small a scene gets while fading out / starts while fading in (1 = full size). */
const SHRUNK = 0.9;
const OUT_MS = 220;
const IN_MS = 280;

const leaving = new WeakSet<Phaser.Scene>();

/** Call at the end of a scene's create(): the scene grows from slightly small and fades in. */
export function enterScene(scene: Phaser.Scene): void {
  leaving.delete(scene);
  const cam = scene.cameras.main;
  cam.setZoom(RENDER_SCALE * SHRUNK).setAlpha(0);
  scene.tweens.add({ targets: cam, zoom: RENDER_SCALE, alpha: 1, duration: IN_MS, ease: 'Cubic.easeOut' });
}

/**
 * Switch scenes with a transition: the current scene shrinks and fades out, then the next one
 * starts (and plays enterScene). Input is off meanwhile so nothing is clicked twice.
 */
export function goTo(scene: Phaser.Scene, key: string, data?: object): void {
  if (leaving.has(scene)) return;
  leaving.add(scene);
  scene.input.enabled = false;
  const cam = scene.cameras.main;
  scene.tweens.killTweensOf(cam);
  scene.tweens.add({
    targets: cam,
    zoom: RENDER_SCALE * SHRUNK,
    alpha: 0,
    duration: OUT_MS,
    ease: 'Cubic.easeIn',
    onComplete: () => {
      scene.input.enabled = true; // scene objects are reused on the next start
      scene.scene.start(key, data);
    },
  });
}

/** How visible a scene stays behind a pop-up. */
const DIMMED_ALPHA = 0.3;

/** Dim + freeze a scene behind a pop-up (Results, Settings), or bring it back. */
export function dimScene(scene: Phaser.Scene, dim: boolean): void {
  scene.input.enabled = !dim;
  const cam = scene.cameras.main;
  scene.tweens.killTweensOf(cam);
  scene.tweens.add({ targets: cam, alpha: dim ? DIMMED_ALPHA : 1, zoom: RENDER_SCALE, duration: 300, ease: 'Cubic.easeOut' });
  if (dim) showDim();
  else hideDim();
}
