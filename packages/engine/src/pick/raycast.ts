import { axisIndex, type DrawPlane } from '../geometry/plane';
import { quadIsDegenerate, quadNormal } from '../geometry/quad';
import { rayAabb, rayTriangle } from '../math/intersect';
import type { Chunk } from '../world/chunk';
import type { World } from '../world/world';

type V = ArrayLike<number>;

export interface RayHit {
  tileId: number;
  t: number;
  point: Float32Array;
  /** Normale der Vorderseite der getroffenen Kachel. */
  normal: Float32Array;
  /** true, wenn die Vorderseite getroffen wurde. */
  front: boolean;
}

const A = new Float32Array(3);
const B = new Float32Array(3);
const C = new Float32Array(3);
const N = new Float32Array(3);

/**
 * Nächste Kachel entlang des Strahls (dir normiert erwartet, t in Metern).
 * Rückseiten zählen nur bei beidseitigen Kacheln; entartete Kacheln werden übersprungen.
 */
export function raycastWorld(
  world: World,
  origin: V,
  dir: V,
  maxDist: number,
  layerFilter: (layer: number) => boolean,
): RayHit | null {
  const inv = [1 / dir[0], 1 / dir[1], 1 / dir[2]];
  const candidates: { t: number; chunk: Chunk }[] = [];
  for (const chunk of world.chunks.values()) {
    if (chunk.count === 0) continue;
    const t = rayAabb(origin, inv, chunk.min, chunk.max);
    if (t >= 0 && t <= maxDist) candidates.push({ t, chunk });
  }
  candidates.sort((a, b) => a.t - b.t);

  let bestT = maxDist;
  let bestChunk: Chunk | null = null;
  let bestIndex = -1;
  let bestFront = true;
  for (const { t: entry, chunk } of candidates) {
    if (entry > bestT) break;
    const c = chunk.corners;
    for (let i = 0; i < chunk.count; i++) {
      if (!layerFilter(chunk.layer[i])) continue;
      const base = i * 12;
      if (quadIsDegenerate(c, base)) continue;
      const t = hitQuad(origin, dir, c, base);
      if (t < 0 || t >= bestT) continue;
      quadNormal(c, N, base);
      const front = dir[0] * N[0] + dir[1] * N[1] + dir[2] * N[2] < 0;
      if (!front && (chunk.bits[i] & 16) === 0) continue;
      bestT = t;
      bestChunk = chunk;
      bestIndex = i;
      bestFront = front;
    }
  }
  if (!bestChunk) return null;
  const point = new Float32Array([origin[0] + dir[0] * bestT, origin[1] + dir[1] * bestT, origin[2] + dir[2] * bestT]);
  const normal = quadNormal(bestChunk.corners, new Float32Array(3), bestIndex * 12);
  return { tileId: bestChunk.ids[bestIndex], t: bestT, point, normal, front: bestFront };
}

/** Kleinster Treffer-t der beiden Dreiecke (c0,c1,c2) und (c0,c2,c3), beidseitig, oder −1. */
function hitQuad(o: V, d: V, c: Float32Array, base: number): number {
  load(A, c, base);
  load(B, c, base + 3);
  load(C, c, base + 6);
  const t1 = rayTriangle(o, d, A, B, C, false);
  load(B, c, base + 9);
  const t2 = rayTriangle(o, d, A, C, B, false);
  if (t1 < 0) return t2;
  if (t2 < 0) return t1;
  return Math.min(t1, t2);
}

function load(out: Float32Array, c: Float32Array, i: number): void {
  out[0] = c[i];
  out[1] = c[i + 1];
  out[2] = c[i + 2];
}

/** Schnittpunkt mit einer achsparallelen Ebene; null bei parallelem Strahl oder Schnitt hinter dem Ursprung. */
export function rayPlane(origin: V, dir: V, plane: DrawPlane): Float32Array | null {
  const a = axisIndex(plane.axis);
  const d = dir[a];
  if (Math.abs(d) < 1e-12) return null;
  const t = (plane.offset - origin[a]) / d;
  if (!(t >= 0) || !Number.isFinite(t)) return null;
  const p = new Float32Array([origin[0] + dir[0] * t, origin[1] + dir[1] * t, origin[2] + dir[2] * t]);
  p[a] = plane.offset;
  return p;
}
