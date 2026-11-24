import * as vec3 from '../math/vec3';
import type { TileData } from '../world/types';
import type { World } from '../world/world';
import { quadNormal } from './quad';
import type { TileChange } from './transform';

const key = (c: ArrayLike<number>, o: number) =>
  `${Math.round(c[o] * 1e4)},${Math.round(c[o + 1] * 1e4)},${Math.round(c[o + 2] * 1e4)}`;

/**
 * Extrudiert die Kacheln um distance entlang n (normalisierte Summe ihrer Normalen). Randkanten
 * (nur in einer ausgewählten Kachel) bekommen je eine Seitenkachel [a, b, b + n·d, a + n·d] mit
 * Textur, Ebene und Flags der Ursprungskachel, rot = 0, ohne Spiegelung. Die Welt bleibt unverändert.
 */
export function extrudeTiles(world: World, ids: number[], distance: number): { update: TileChange[]; add: TileData[] } {
  const tiles: { id: number; t: TileData }[] = [];
  const n = vec3.create();
  const tn = vec3.create();
  for (const id of new Set(ids)) {
    const t = world.getTile(id);
    if (!t) continue;
    tiles.push({ id, t });
    quadNormal(t.corners, tn);
    vec3.add(n, n, tn);
  }
  if (tiles.length === 0 || !Number.isFinite(distance) || distance === 0 || vec3.length(n) === 0) return { update: [], add: [] };
  vec3.normalize(n, n);
  const off = vec3.scale(vec3.create(), n, distance);

  // Kanten zählen (ungerichtet), Richtung aus der Eckreihenfolge merken
  const edges = new Map<string, { count: number; a: Float32Array; b: Float32Array; src: TileData }>();
  for (const { t } of tiles) {
    for (let k = 0; k < 4; k++) {
      const o1 = k * 3, o2 = ((k + 1) % 4) * 3;
      const ka = key(t.corners, o1), kb = key(t.corners, o2);
      if (ka === kb) continue; // zusammengefallene Ecken
      const k2 = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      const e = edges.get(k2);
      if (e) e.count++;
      else edges.set(k2, { count: 1, a: t.corners.slice(o1, o1 + 3), b: t.corners.slice(o2, o2 + 3), src: t });
    }
  }

  const update: TileChange[] = tiles.map(({ id, t }) => {
    const corners = new Float32Array(t.corners);
    for (let k = 0; k < 4; k++) for (let a = 0; a < 3; a++) corners[k * 3 + a] += off[a];
    return { id, before: t, after: { ...t, corners } };
  });

  const add: TileData[] = [];
  for (const e of edges.values()) {
    if (e.count !== 1) continue;
    const { a, b, src } = e;
    add.push({
      layer: src.layer,
      tileset: src.tileset,
      tx: src.tx,
      ty: src.ty,
      rot: 0,
      flipX: false,
      flipY: false,
      doubleSided: src.doubleSided,
      ghost: src.ghost,
      corners: new Float32Array([
        a[0], a[1], a[2],
        b[0], b[1], b[2],
        b[0] + off[0], b[1] + off[1], b[2] + off[2],
        a[0] + off[0], a[1] + off[1], a[2] + off[2],
      ]),
    });
  }
  return { update, add };
}
