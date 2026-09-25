import Phaser from 'phaser';
import { backdropColor, dominantColor, type RGB } from '../logic/color';

const SAMPLE_PX = 48;
const cache = new Map<string, RGB | null>();

/** Majority color of a loaded texture (sampled at 48x48), darkened for use behind white text. */
export function albumColor(scene: Phaser.Scene, key: string): RGB | null {
  if (cache.has(key)) return cache.get(key)!;
  let color: RGB | null = null;
  try {
    const src = scene.textures.get(key).getSourceImage() as CanvasImageSource;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SAMPLE_PX;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(src, 0, 0, SAMPLE_PX, SAMPLE_PX);
    const found = dominantColor(ctx.getImageData(0, 0, SAMPLE_PX, SAMPLE_PX).data);
    color = found && backdropColor(found);
  } catch {
    // unreadable image: keep the plain background
  }
  cache.set(key, color);
  return color;
}

/** Fade in a gradient from `rgb` at the top of the page down into the plain background. */
export function showBackdrop([r, g, b]: RGB): void {
  const el = document.getElementById('backdrop');
  if (!el) return;
  el.style.background = `linear-gradient(180deg, rgb(${r}, ${g}, ${b}) 0%, rgba(${r}, ${g}, ${b}, 0.35) 55%, rgba(${r}, ${g}, ${b}, 0) 100%)`;
  el.style.opacity = '1';
}

export function hideBackdrop(): void {
  const el = document.getElementById('backdrop');
  if (el) el.style.opacity = '0';
}
