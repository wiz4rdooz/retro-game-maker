import { describe, it, expect } from 'vitest';
import { World, cellQuad, quadNormal, vec3, translateTiles, rotateTiles, rotateTiles90, scaleTiles, moveVertices, mergeVertices, extrudeTiles, buildChunkMesh, raycastWorld, type TileData } from '../src';
const T = (x: number, z: number, layer = 1): TileData => ({ layer, tileset: 0, tx: 0, ty: 0, rot: 0, flipX: false, flipY: false, doubleSided: false, ghost: false, corners: cellQuad({ axis: 'y', offset: 0, facing: 1 }, x, z) });
const apply = (w: World, ch: { id: number; after: TileData }[]) => ch.forEach((c) => w.setTile(c.id, c.after));
const r = (a: ArrayLike<number>) => Array.from(a).map((v) => +v.toFixed(4) + 0);
const W = () => { const w = new World(); w.addLayer('a'); w.addLayer('b'); return w; };

describe('Transformationen', () => {
  it('verschieben ändert Ecken und Chunk', () => { const w = W(); const id = w.addTile(T(0, 0)); apply(w, translateTiles(w, [id], [40, 0, 0])); expect(w.getTile(id)!.corners[0]).toBe(40); });
  it('drehen um Y: +X wird zu +Z', () => {
    const w = W(); const id = w.addTile(T(1, 0)); apply(w, rotateTiles90(w, [id], 'y', 1, [0, 0, 0]));
    expect(r(w.getTile(id)!.corners.slice(0, 3))).toEqual([-1, 0, 1]);
  });
  it('skalieren × 2 um den Pivot', () => { const w = W(); const id = w.addTile(T(0, 0)); apply(w, scaleTiles(w, [id], 2, [0, 0, 0])); expect(r(w.getTile(id)!.corners.slice(3, 6))).toEqual([2, 0, 2]); });
  it('Kante anheben ergibt eine Rampe; gesperrte Ebenen bleiben', () => {
    const w = W(); const id = w.addTile(T(0, 0)); const other = w.addTile(T(0, -1, 2));
    apply(w, moveVertices(w, [[0, 0, 0], [1, 0, 0]], [0, 1, 0], (l) => l === 1));
    expect(quadNormal(w.getTile(id)!.corners, vec3.create())[1]).toBeCloseTo(Math.SQRT1_2, 4);
    expect(w.getTile(other)!.corners[1]).toBe(0);
  });
  it('zusammengeführte Ecken: Dreieck bleibt zeichen- und treffbar (Review Focus 4)', () => {
    const w = W(); const id = w.addTile(T(0, 0)); apply(w, mergeVertices(w, [[0, 0, 0], [1, 0, 0]], [0.5, 0, 0], () => true));
    const [part] = buildChunkMesh(w.chunks.values().next().value!, new Map([[0, { id: 0, tileSize: 16, imageWidth: 16, imageHeight: 16 }]]), () => true);
    expect(part.positions.every(Number.isFinite)).toBe(true);
    expect(raycastWorld(w, [0.5, 5, 0.7], [0, -1, 0], 50, () => true)!.tileId).toBe(id);
  });
  it('Extrudieren einer Kachel: Deckel auf y = 1 und 4 Seiten nach außen', () => {
    const w = W(); const id = w.addTile(T(0, 0)); const res = extrudeTiles(w, [id], 1);
    expect(res.add.length).toBe(4); expect(res.update[0].after.corners[1]).toBe(1);
    const normals = res.add.map((t) => r(quadNormal(t.corners, vec3.create()))).sort();
    expect(normals).toEqual([[-1, 0, 0], [0, 0, -1], [0, 0, 1], [1, 0, 0]].sort());
  });
  it('Extrudieren von 2×1: innere Kante bleibt ohne Seite', () => { const w = W(); const a = w.addTile(T(0, 0)); const b = w.addTile(T(1, 0)); expect(extrudeTiles(w, [a, b], 1).add.length).toBe(6); });
  it('freies Drehen: 90° = rotateTiles90 (alle drei Achsen)', () => {
    for (const axis of ['x', 'y', 'z'] as const) {
      const w = W(); const id = w.addTile(T(1, 2));
      const free = rotateTiles(w, [id], axis, -Math.PI / 2, [0.5, 0, 0.5])[0].after.corners;
      const quarter = rotateTiles90(w, [id], axis, 1, [0.5, 0, 0.5])[0].after.corners;
      Array.from(free).forEach((v, i) => expect(Math.abs(v - quarter[i])).toBeLessThan(1e-6));
    }
  });
  it('15° um Y dreht (1, 0, 0) nach (cos 15°, 0, −sin 15°)', () => {
    const w = W(); const id = w.addTile({ ...T(0, 0), corners: new Float32Array([1, 0, 0, 1, 0, -1, 0, 0, -1, 0, 0, 0]) });
    const c = rotateTiles(w, [id], 'y', (15 * Math.PI) / 180, [0, 0, 0])[0].after.corners;
    expect(c[0]).toBeCloseTo(Math.cos((15 * Math.PI) / 180), 5);
    expect(c[1]).toBeCloseTo(0, 6);
    expect(c[2]).toBeCloseTo(-Math.sin((15 * Math.PI) / 180), 5);
  });
  it('360° lässt alles gleich, NaN-Winkel ändert nichts', () => {
    const w = W(); const id = w.addTile(T(3, -2));
    const full = rotateTiles(w, [id], 'z', 2 * Math.PI, [1, 1, 1])[0].after.corners;
    Array.from(full).forEach((v, i) => expect(Math.abs(v - w.getTile(id)!.corners[i])).toBeLessThan(1e-6));
    expect(rotateTiles(w, [id], 'y', Number.NaN, [0, 0, 0])).toEqual([]);
    expect(rotateTiles(w, [id], 'y', 0.3, [Number.NaN, 0, 0])).toEqual([]);
  });
});
