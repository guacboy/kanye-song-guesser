/** Points for a correct guess on each clip (same order as CLIP_LENGTHS: 0.1s, 0.5s, 2s, 8s). */
export const CLIP_POINTS = [300, 150, 75, 25];

/** Points for a correct guess on clip `attempt` (0-based). */
export function pointsFor(attempt: number): number {
  return CLIP_POINTS[attempt] ?? 0;
}

/** `hits[i]` = songs guessed on clip i. */
export function totalScore(hits: number[]): number {
  return hits.reduce((sum, n, i) => sum + n * pointsFor(i), 0);
}

/** Results breakdown, one line per clip: "300 x 2 = 600 pts". */
export function breakdownLines(hits: number[]): string[] {
  return CLIP_POINTS.map((pts, i) => {
    const n = hits[i] ?? 0;
    return `${pts} x ${n} = ${pts * n} pts`;
  });
}
