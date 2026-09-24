import Phaser from 'phaser';

// Keep these in sync with the CSS variables in style.css.
export const COLORS = {
  text: '#e6e6e6',
  textNum: 0xe6e6e6,
  // Used as the "background color" for inverted (hovered) buttons.
  bg: '#0e0e0e',
  bgNum: 0x0e0e0e,
  muted: '#8a8a8a',
  mutedNum: 0x8a8a8a,
  dim: 0x3a3a3a,
  accent: '#3cd470',
};

export const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';

/** Layout size. All scene coordinates are in this space. */
export const WIDTH = 800;
export const HEIGHT = 600;

/**
 * The canvas renders at WIDTH/HEIGHT × RENDER_SCALE so it isn't upscaled (blurry) on large or
 * high-DPI screens. Each scene zooms its camera by the same factor via fitCamera().
 */
export const RENDER_SCALE = Math.min(
  3,
  Math.max(1, Math.ceil(Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT) * window.devicePixelRatio)),
);

export function fitCamera(scene: Phaser.Scene): void {
  scene.cameras.main.setZoom(RENDER_SCALE).centerOn(WIDTH / 2, HEIGHT / 2);
}

/** Clip length (seconds) for each attempt. */
export const CLIP_LENGTHS = [0.5, 1, 4, 8];
export const MAX_LIVES = 3;

export function makeText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size = 20,
  color = COLORS.text,
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, color, resolution: RENDER_SCALE })
    .setOrigin(0.5);
}
