import type { Chunk } from '../world/chunk';
import { chunkCoords } from '../world/keys';
import type { World } from '../world/world';
import type { RankTiles } from './overlapRanks';

/** Dünner gelten Schnitt-Boxen als bloße Berührung. */
const TOUCH = 1e-4;

/**
 * Können Kacheln der beiden Chunks einander in einer Fläche überdecken? Dazu müssen sich ihre Boxen
 * schneiden – und auf jeder Achse, auf der die Chunks in verschiedenen Zellen liegen, mit echter Dicke:
 * Berühren sich die Boxen dort nur, läge die Überdeckung in der Grenzfläche, und Kacheln genau in
 * dieser Fläche gehören (über den Schwerpunkt) alle zur selben Zelle. Raster-bündige Welten
 * vergleichen so keine Nachbarn.
 */
function canOverlap(a: Chunk, b: Chunk): boolean {
  if (a.count === 0 || b.count === 0) return false;
  const ca = chunkCoords(a.key), cb = chunkCoords(b.key);
  for (let axis = 0; axis < 3; axis++) {
    const lo = Math.max(a.min[axis], b.min[axis]);
    const hi = Math.min(a.max[axis], b.max[axis]);
    if (!(hi >= lo)) return false;
    if (ca[axis] !== cb[axis] && hi - lo <= TOUCH) return false;
  }
  return true;
}

/**
 * Kacheln anderer Chunks, die mit Kacheln dieses Chunks in einer Fläche überlappen können (Box
 * schneidet die Box des Chunks, Ebene sichtbar). Mit ihnen bekommt jeder Chunk dieselben Rangstufen
 * für Überlappungen über seine Grenze wie der Nachbar – sonst flackerte es genau dort. null = keine.
 */
export function overlapContext(world: World, chunk: Chunk, include: (layer: number) => boolean): RankTiles | null {
  const ids: number[] = [];
  const layer: number[] = [];
  const corners: number[] = [];
  const min = chunk.min, max = chunk.max;
  for (const other of world.chunks.values()) {
    if (other === chunk || !canOverlap(chunk, other)) continue;
    const c = other.corners;
    for (let i = 0; i < other.count; i++) {
      if (!include(other.layer[i])) continue;
      const b = i * 12;
      let hit = true;
      for (let axis = 0; axis < 3 && hit; axis++) {
        const v0 = c[b + axis], v1 = c[b + 3 + axis], v2 = c[b + 6 + axis], v3 = c[b + 9 + axis];
        if (Math.max(v0, v1, v2, v3) < min[axis] || Math.min(v0, v1, v2, v3) > max[axis]) hit = false;
      }
      if (!hit) continue;
      ids.push(other.ids[i]);
      layer.push(other.layer[i]);
      for (let k = 0; k < 12; k++) corners.push(c[b + k]);
    }
  }
  return ids.length > 0 ? { count: ids.length, ids, layer, corners: new Float32Array(corners) } : null;
}

/** Die Chunks zu keys plus alle Nachbarn, deren Rangstufen von ihnen abhängen können (zum Neu-Vernetzen). */
export function withOverlapNeighbors(world: World, keys: Iterable<number>): Set<number> {
  const out = new Set<number>(keys);
  const changed: Chunk[] = [];
  for (const k of out) {
    const c = world.chunks.get(k);
    if (c && c.count > 0) changed.push(c);
  }
  if (changed.length === 0) return out;
  for (const other of world.chunks.values()) {
    if (out.has(other.key)) continue;
    for (const c of changed) {
      if (canOverlap(c, other)) {
        out.add(other.key);
        break;
      }
    }
  }
  return out;
}
