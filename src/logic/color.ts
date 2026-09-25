// Pure color helpers for the album backdrop, no DOM imports (the pytest suite runs this under Node).

export type RGB = [number, number, number];

type Bucket = { n: number; r: number; g: number; b: number };

/** Below this share of colorful pixels, the cover counts as black-and-white and greys are allowed. */
const MIN_COLORFUL_SHARE = 0.05;

/**
 * The album's majority color: pixels are grouped into buckets (16 levels per channel), the most
 * common bucket wins, and its pixels are averaged. `data` is RGBA (canvas ImageData.data).
 * Colorful pixels are preferred, so a white border or black background doesn't beat the artwork;
 * greys only win when the cover has almost no color. Mostly-transparent pixels are ignored.
 * Returns null if there's nothing to measure.
 */
export function dominantColor(data: ArrayLike<number>): RGB | null {
  const all = new Map<number, Bucket>();
  const colorful = new Map<number, Bucket>();
  let opaque = 0;
  let colorfulCount = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    opaque++;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    addTo(all, key, r, g, b);
    if (isColorful(r, g, b)) {
      colorfulCount++;
      addTo(colorful, key, r, g, b);
    }
  }
  if (opaque === 0) return null;
  const buckets = colorfulCount >= opaque * MIN_COLORFUL_SHARE ? colorful : all;
  let best: Bucket | undefined;
  for (const bucket of buckets.values()) if (!best || bucket.n > best.n) best = bucket;
  return [Math.round(best!.r / best!.n), Math.round(best!.g / best!.n), Math.round(best!.b / best!.n)];
}

function addTo(buckets: Map<number, Bucket>, key: number, r: number, g: number, b: number): void {
  const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
  bucket.n++;
  bucket.r += r;
  bucket.g += g;
  bucket.b += b;
  buckets.set(key, bucket);
}

/** Not near-grey, near-black or near-white. */
function isColorful(r: number, g: number, b: number): boolean {
  const [, s, l] = rgbToHsl([r, g, b]);
  return s >= 0.25 && l > 0.1 && l < 0.9;
}

/** Same hue and saturation, but lightness capped so white text on top stays readable. */
export function backdropColor(rgb: RGB, maxLightness = 0.32): RGB {
  const [h, s, l] = rgbToHsl(rgb);
  return hslToRgb([h, s, Math.min(l, maxLightness)]);
}

export function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h / 6, s, l];
}

export function hslToRgb([h, s, l]: [number, number, number]): RGB {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [Math.round(channel(h + 1 / 3) * 255), Math.round(channel(h) * 255), Math.round(channel(h - 1 / 3) * 255)];
}
