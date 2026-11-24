import * as vec3 from '../math/vec3';
import type { TileData } from '../world/types';
import type { World } from '../world/world';
import { quadCentroid, quadNormal } from './quad';

const EDGE_EPS = 1e-4;

/**
 * Breitensuche über Kacheln derselben Ebene (Normalen-dot > 0,999, Ebenenabstand < 1e-3), die
 * eine Kante teilen (zwei verschiedene Ecken gleich, 1e-4). Kandidaten kommen über queryAabb aus
 * dem um 0,01 vergrößerten AABB der aktuellen Kachel. Höchstens cap Kacheln; capped = es gäbe mehr.
 */
export function floodCoplanar(
  world: World,
  startId: number,
  accept: (id: number, t: TileData) => boolean,
  cap: number,
): { ids: number[]; capped: boolean } {
  const start = world.getTile(startId);
  if (!start || cap <= 0) return { ids: [], capped: false };
  const n = quadNormal(start.corners, vec3.create());
  if (vec3.length(n) === 0 || !accept(startId, start)) return { ids: [], capped: false };
  vec3.normalize(n, n);
  const d = vec3.dot(n, quadCentroid(start.corners, vec3.create()));

  const ids: number[] = [startId];
  const seen = new Set<number>([startId]);
  const queue: Float32Array[] = [start.corners];
  const tn = vec3.create();
  const tc = vec3.create();
  const min = new Float32Array(3);
  const max = new Float32Array(3);
  let capped = false;

  for (let qi = 0; qi < queue.length && !capped; qi++) {
    const cur = queue[qi];
    aabb(cur, min, max);
    world.queryAabb(min, max, (id, chunk, i) => {
      if (capped || seen.has(id)) return;
      const base = i * 12;
      const c = chunk.corners;
      quadNormal(c, tn, base);
      const len = vec3.length(tn);
      if (!(len > 0) || vec3.dot(tn, n) / len <= 0.999) return;
      quadCentroid(c, tc, base);
      if (Math.abs(vec3.dot(n, tc) - d) >= 1e-3) return;
      if (!sharesEdge(cur, c, base)) return;
      seen.add(id);
      const t = chunk.read(i);
      if (!accept(id, t)) return;
      if (ids.length >= cap) {
        capped = true;
        return;
      }
      ids.push(id);
      queue.push(t.corners);
    });
  }
  return { ids, capped };
}

function aabb(c: Float32Array, min: Float32Array, max: Float32Array): void {
  for (let a = 0; a < 3; a++) {
    let lo = Infinity, hi = -Infinity;
    for (let k = 0; k < 4; k++) {
      const v = c[k * 3 + a];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    min[a] = lo - 0.01;
    max[a] = hi + 0.01;
  }
}

/** Zwei verschiedene Ecken von a kommen auch in b (ab base) vor. */
function sharesEdge(a: Float32Array, b: Float32Array, base: number): boolean {
  let matched = 0;
  let firstX = NaN, firstY = NaN, firstZ = NaN;
  for (let i = 0; i < 4; i++) {
    const ax = a[i * 3], ay = a[i * 3 + 1], az = a[i * 3 + 2];
    if (matched === 1 && near(ax, firstX) && near(ay, firstY) && near(az, firstZ)) continue; // doppelte Ecke
    for (let k = 0; k < 4; k++) {
      const o = base + k * 3;
      if (near(ax, b[o]) && near(ay, b[o + 1]) && near(az, b[o + 2])) {
        if (++matched >= 2) return true;
        firstX = ax;
        firstY = ay;
        firstZ = az;
        break;
      }
    }
  }
  return false;
}

function near(x: number, y: number): boolean {
  return Math.abs(x - y) <= EDGE_EPS;
}
