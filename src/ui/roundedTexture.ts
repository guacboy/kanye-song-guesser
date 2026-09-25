import Phaser from 'phaser';
import { RADIUS, RENDER_SCALE } from '../theme';

/**
 * Bakes a loaded image into a rounded square texture at render resolution, scaled to cover and
 * center-cropped (like CSS background-size: cover). Display it with setScale(1 / RENDER_SCALE).
 * Returns the new texture key; repeated calls reuse it.
 */
export function roundedCoverTexture(scene: Phaser.Scene, key: string, size: number): string {
  const outKey = `${key}-rounded-${size}`;
  if (scene.textures.exists(outKey)) return outKey;
  const px = size * RENDER_SCALE;
  const src = scene.textures.get(key).getSourceImage() as CanvasImageSource & { width: number; height: number };
  const scale = Math.max(px / src.width, px / src.height);
  const w = src.width * scale;
  const h = src.height * scale;

  const tex = scene.textures.createCanvas(outKey, px, px)!;
  const ctx = tex.getContext();
  ctx.beginPath();
  ctx.roundRect(0, 0, px, px, RADIUS * RENDER_SCALE);
  ctx.clip();
  ctx.drawImage(src, (px - w) / 2, (px - h) / 2, w, h);
  tex.refresh();
  return outKey;
}
