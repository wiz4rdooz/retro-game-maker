import { quadIsDegenerate } from '../geometry/quad';
import type { World } from '../world/world';

type V = ArrayLike<number>;

const GHOST_BIT = 1 << 5;

/**
 * Sammelt die Kollisions-Dreiecke (je 9 Zahlen) aller Kacheln im AABB – über alle Ebenen,
 * ohne Geist-Kacheln, ohne entartete Kacheln und ohne flächenlose Einzeldreiecke
 * (eine zum Dreieck zusammengezogene Kachel liefert ihr eines echtes Dreieck).
 * out wird vorher geleert. Rückgabe: Anzahl der Dreiecke.
 */
export function collectTriangles(world: World, min: V, max: V, out: number[]): number {
  out.length = 0;
  world.queryAabb(min, max, (_id, chunk, i) => {
    if ((chunk.bits[i] & GHOST_BIT) !== 0) return;
    const c = chunk.corners;
    const base = i * 12;
    if (quadIsDegenerate(c, base)) return;
    pushTri(out, c, base, base + 3, base + 6);
    pushTri(out, c, base, base + 6, base + 9);
  });
  return out.length / 9;
}

function pushTri(out: number[], c: Float32Array, a: number, b: number, d: number): void {
  const ux = c[b] - c[a], uy = c[b + 1] - c[a + 1], uz = c[b + 2] - c[a + 2];
  const vx = c[d] - c[a], vy = c[d + 1] - c[a + 1], vz = c[d + 2] - c[a + 2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  if (nx * nx + ny * ny + nz * nz < 1e-16) return;
  out.push(c[a], c[a + 1], c[a + 2], c[b], c[b + 1], c[b + 2], c[d], c[d + 1], c[d + 2]);
}
