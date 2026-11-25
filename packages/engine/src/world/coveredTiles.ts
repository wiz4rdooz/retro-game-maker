import { quadNormal } from '../geometry/quad';
import type { TileData } from './types';
import type { World } from './world';

/** Raster der Eckenschlüssel: 1 mm. */
const Q = 1000;
const na = new Float32Array(3);
const nb = new Float32Array(3);

function cornerKey(c: ArrayLike<number>, base: number): string {
  const pts: string[] = [];
  for (let k = 0; k < 4; k++) {
    const o = base + k * 3;
    pts.push(`${Math.round(c[o] * Q)},${Math.round(c[o + 1] * Q)},${Math.round(c[o + 2] * Q)}`);
  }
  return pts.sort().join('|');
}

/**
 * ids der Kacheln, die von einer der `tiles` exakt verdeckt würden: gleiche vier Ecken (beliebige
 * Reihenfolge, 1 mm), gleiche Ebene, gleiche Blickrichtung oder eine von beiden beidseitig.
 * Kacheln aus `exclude` (z. B. die gerade bewegten) zählen nicht. Ein Index je betroffenem Chunk.
 */
export function coveredTiles(world: World, tiles: readonly TileData[], exclude: ReadonlySet<number>): number[] {
  const byChunk = new Map<number, TileData[]>();
  for (const t of tiles) {
    const key = world.chunkKeyForCorners(t.corners);
    const list = byChunk.get(key);
    if (list) list.push(t);
    else byChunk.set(key, [t]);
  }
  const out = new Set<number>();
  for (const [key, list] of byChunk) {
    const chunk = world.chunks.get(key);
    if (!chunk) continue;
    const index = new Map<string, number[]>();
    for (let i = 0; i < chunk.count; i++) {
      if (exclude.has(chunk.ids[i])) continue;
      const k = cornerKey(chunk.corners, i * 12);
      const at = index.get(k);
      if (at) at.push(i);
      else index.set(k, [i]);
    }
    for (const t of list) {
      const candidates = index.get(cornerKey(t.corners, 0));
      if (!candidates) continue;
      quadNormal(t.corners, na);
      for (const i of candidates) {
        if (chunk.layer[i] !== t.layer) continue;
        if (!t.doubleSided && (chunk.bits[i] & 16) === 0) {
          quadNormal(chunk.corners, nb, i * 12);
          if (na[0] * nb[0] + na[1] * nb[1] + na[2] * nb[2] <= 0.99) continue;
        }
        out.add(chunk.ids[i]);
      }
    }
  }
  return [...out];
}
