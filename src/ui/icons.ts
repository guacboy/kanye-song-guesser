import Phaser from 'phaser';

type Point = { x: number; y: number };

/**
 * Gear icon centered on (0, 0), radius r. Drawn with shapes so it looks the same everywhere.
 * `filled` fills the gear body in `color`, keeping the center hole see-through.
 */
export function drawGear(g: Phaser.GameObjects.Graphics, color: number, r = 11, filled = false): void {
  const teeth = 8;
  const inner = r * 0.72;
  const hole = r * 0.32;
  const half = (Math.PI / teeth) * 0.55; // half the angular width of a tooth tip
  const at = (radius: number, angle: number): Point => ({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });

  const outline: Point[] = [];
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    outline.push(at(inner, a - half * 1.4), at(r, a - half * 0.8), at(r, a + half * 0.8), at(inner, a + half * 1.4));
  }

  if (filled) {
    // One "keyhole" polygon: around the gear, in along a zero-width slit, around the hole the
    // other way, and back out. Graphics can't cut holes, but this shape leaves one.
    const start = Math.atan2(outline[0].y, outline[0].x);
    const ring: Point[] = [];
    for (let k = 0; k <= 32; k++) ring.push(at(hole, start - (k / 32) * Math.PI * 2));
    g.fillStyle(color).fillPoints([...outline, outline[0], ...ring], true);
  }
  g.lineStyle(2, color).strokePoints(outline, true).strokeCircle(0, 0, hole);
}
