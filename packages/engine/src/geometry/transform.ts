import type { TileData } from '../world/types';
import type { World } from '../world/world';

type V = ArrayLike<number>;

/** Änderung einer Kachel (für Rückgängig-Befehle). */
export interface TileChange {
  id: number;
  before: TileData;
  after: TileData;
}

/** Wendet f auf alle Ecken der vorhandenen Kacheln an; die Welt selbst bleibt unverändert. */
function mapCorners(world: World, ids: Iterable<number>, f: (c: Float32Array, o: number) => void): TileChange[] {
  const out: TileChange[] = [];
  const seen = new Set<number>();
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const before = world.getTile(id);
    if (!before) continue;
    const corners = new Float32Array(before.corners);
    for (let k = 0; k < 4; k++) f(corners, k * 3);
    out.push({ id, before, after: { ...before, corners } });
  }
  return out;
}

export function translateTiles(world: World, ids: Iterable<number>, delta: V): TileChange[] {
  const dx = delta[0], dy = delta[1], dz = delta[2];
  if (![dx, dy, dz].every(Number.isFinite)) return [];
  return mapCorners(world, ids, (c, o) => {
    c[o] += dx;
    c[o + 1] += dy;
    c[o + 2] += dz;
  });
}

/**
 * Dreht um 90° um die Achse durch pivot: Winkel = −turns · 90° nach der Rechte-Hand-Regel.
 * turns = 1 um Y: (dx, dz) → (−dz, dx). Die Ecken behalten ihre Reihenfolge, die Textur dreht mit.
 */
export function rotateTiles90(world: World, ids: Iterable<number>, axis: 'x' | 'y' | 'z', turns: 1 | -1, pivot: V): TileChange[] {
  const px = pivot[0], py = pivot[1], pz = pivot[2];
  if (![px, py, pz].every(Number.isFinite)) return [];
  const s = turns === 1 ? 1 : -1;
  return mapCorners(world, ids, (c, o) => {
    const dx = c[o] - px, dy = c[o + 1] - py, dz = c[o + 2] - pz;
    if (axis === 'y') {
      c[o] = px - s * dz;
      c[o + 2] = pz + s * dx;
    } else if (axis === 'x') {
      c[o + 1] = py + s * dz;
      c[o + 2] = pz - s * dy;
    } else {
      c[o] = px + s * dy;
      c[o + 1] = py - s * dx;
    }
  });
}

/**
 * Dreht um einen beliebigen Winkel um die Achse durch pivot (Rechte-Hand-Regel: positiv = gegen den
 * Uhrzeigersinn, von der Achsenspitze aus gesehen; −π/2 entspricht rotateTiles90(…, 1, …)).
 * Ecken werden auf 1e-6 gerundet, damit Vielfache von 90° glatt bleiben.
 */
export function rotateTiles(world: World, ids: Iterable<number>, axis: 'x' | 'y' | 'z', radians: number, pivot: V): TileChange[] {
  const px = pivot[0], py = pivot[1], pz = pivot[2];
  if (!Number.isFinite(radians) || ![px, py, pz].every(Number.isFinite)) return [];
  const cos = Math.cos(radians), sin = Math.sin(radians);
  const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
  return mapCorners(world, ids, (c, o) => {
    const dx = c[o] - px, dy = c[o + 1] - py, dz = c[o + 2] - pz;
    if (axis === 'y') {
      c[o] = r6(px + dx * cos + dz * sin);
      c[o + 2] = r6(pz - dx * sin + dz * cos);
    } else if (axis === 'x') {
      c[o + 1] = r6(py + dy * cos - dz * sin);
      c[o + 2] = r6(pz + dy * sin + dz * cos);
    } else {
      c[o] = r6(px + dx * cos - dy * sin);
      c[o + 1] = r6(py + dx * sin + dy * cos);
    }
  });
}

/** Skaliert um pivot; nur endliche Faktoren > 0. */
export function scaleTiles(world: World, ids: Iterable<number>, factor: number, pivot: V): TileChange[] {
  if (!(factor > 0) || !Number.isFinite(factor)) return [];
  const px = pivot[0], py = pivot[1], pz = pivot[2];
  if (![px, py, pz].every(Number.isFinite)) return [];
  return mapCorners(world, ids, (c, o) => {
    c[o] = px + (c[o] - px) * factor;
    c[o + 1] = py + (c[o + 1] - py) * factor;
    c[o + 2] = pz + (c[o + 2] - pz) * factor;
  });
}

/** Kacheln bearbeitbarer Ebenen mit einer Ecke an einer der Positionen; je Kachel die Maske der Ecken. */
function cornersAt(world: World, positions: ArrayLike<number>[], editable: (layer: number) => boolean, eps: number): Map<number, number> {
  const hits = new Map<number, number>();
  for (const p of positions) {
    if (![p[0], p[1], p[2]].every(Number.isFinite)) continue;
    world.queryAabb([p[0] - eps, p[1] - eps, p[2] - eps], [p[0] + eps, p[1] + eps, p[2] + eps], (id, chunk, i) => {
      if (!editable(chunk.layer[i])) return;
      const c = chunk.corners;
      for (let k = 0; k < 4; k++) {
        const o = i * 12 + k * 3;
        if (Math.abs(c[o] - p[0]) <= eps && Math.abs(c[o + 1] - p[1]) <= eps && Math.abs(c[o + 2] - p[2]) <= eps) {
          hits.set(id, (hits.get(id) ?? 0) | (1 << k));
        }
      }
    });
  }
  return hits;
}

/** Alle Ecken bearbeitbarer Kacheln an diesen Positionen bewegen sich gemeinsam um delta. */
export function moveVertices(
  world: World,
  positions: ArrayLike<number>[],
  delta: V,
  editable: (layer: number) => boolean,
  eps = 1e-4,
): TileChange[] {
  if (![delta[0], delta[1], delta[2]].every(Number.isFinite)) return [];
  const hits = cornersAt(world, positions, editable, eps);
  const out: TileChange[] = [];
  for (const [id, mask] of hits) {
    const before = world.getTile(id)!;
    const corners = new Float32Array(before.corners);
    for (let k = 0; k < 4; k++) {
      if (!(mask & (1 << k))) continue;
      corners[k * 3] += delta[0];
      corners[k * 3 + 1] += delta[1];
      corners[k * 3 + 2] += delta[2];
    }
    out.push({ id, before, after: { ...before, corners } });
  }
  return out;
}

/** Führt alle Ecken an diesen Positionen auf target zusammen (aus einem Viereck kann ein Dreieck werden). */
export function mergeVertices(world: World, positions: ArrayLike<number>[], target: V, editable: (layer: number) => boolean, eps = 1e-4): TileChange[] {
  if (![target[0], target[1], target[2]].every(Number.isFinite)) return [];
  const hits = cornersAt(world, positions, editable, eps);
  const out: TileChange[] = [];
  for (const [id, mask] of hits) {
    const before = world.getTile(id)!;
    const corners = new Float32Array(before.corners);
    for (let k = 0; k < 4; k++) {
      if (!(mask & (1 << k))) continue;
      corners[k * 3] = target[0];
      corners[k * 3 + 1] = target[1];
      corners[k * 3 + 2] = target[2];
    }
    out.push({ id, before, after: { ...before, corners } });
  }
  return out;
}

/** Mitte des AABB der Kacheln, auf snap/2 gerastert. */
export function selectionPivot(world: World, ids: Iterable<number>, snap: number): Float32Array {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const id of ids) {
    const t = world.getTile(id);
    if (!t) continue;
    for (let k = 0; k < 4; k++) {
      for (let a = 0; a < 3; a++) {
        const v = t.corners[k * 3 + a];
        if (!Number.isFinite(v)) continue;
        if (v < min[a]) min[a] = v;
        if (v > max[a]) max[a] = v;
      }
    }
  }
  const out = new Float32Array(3);
  const step = snap > 0 ? snap / 2 : 0.5;
  for (let a = 0; a < 3; a++) out[a] = min[a] <= max[a] ? Math.round((min[a] + max[a]) / 2 / step) * step : 0;
  return out;
}
