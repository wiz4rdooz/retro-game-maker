import { describe, it, expect } from 'vitest';
import { World, collectTriangles, resolveCapsule, closestPointOnTriangle, closestSegmentTriangle, cellQuad, vec3, type TileData } from '../src';

const T = (corners: Float32Array, ghost = false): TileData => ({ layer: 1, tileset: 0, tx: 0, ty: 0, rot: 0, flipX: false, flipY: false, doubleSided: false, ghost, corners });

describe('nächste Punkte', () => {
  const a = [0, 0, 0], b = [2, 0, 0], c = [0, 0, -2];
  it('Punkt über dem Dreieck → Fußpunkt; Punkt außerhalb → nächste Ecke', () => {
    expect(Array.from(closestPointOnTriangle([0.5, 3, -0.5], a, b, c, vec3.create()))).toEqual([0.5, 0, -0.5]);
    expect(Array.from(closestPointOnTriangle([-1, 0, 1], a, b, c, vec3.create()))).toEqual([0, 0, 0]);
  });
  it('senkrechte Strecke über dem Dreieck: Abstand² = 1', () => {
    const s = vec3.create(), t = vec3.create();
    expect(closestSegmentTriangle([0.5, 1, -0.5], [0.5, 3, -0.5], a, b, c, s, t)).toBeCloseTo(1, 6);
    expect(closestSegmentTriangle([0.5, -1, -0.5], [0.5, 3, -0.5], a, b, c, s, t)).toBeCloseTo(0, 6);
  });
});

describe('Kapsel', () => {
  it('drückt eine eingesunkene Kapsel aus dem Boden', () => {
    const w = new World(); w.addLayer('a');
    for (let x = -2; x < 2; x++) for (let z = -2; z < 2; z++) w.addTile(T(cellQuad({ axis: 'y', offset: 0, facing: 1 }, x, z)));
    const tris: number[] = []; const n = collectTriangles(w, [-3, -3, -3], [3, 3, 3], tris);
    expect(n).toBe(32);
    const feet = vec3.create(0, -0.1, 0); const r = resolveCapsule(feet, 0.3, 1.7, tris, n);
    expect(feet[1]).toBeCloseTo(0, 2); expect(r.groundNy).toBeCloseTo(1, 3);
  });
  it('Geist-Kacheln liefern keine Dreiecke', () => {
    const w = new World(); w.addLayer('a'); w.addTile(T(cellQuad({ axis: 'y', offset: 0, facing: 1 }, 0, 0), true));
    expect(collectTriangles(w, [-1, -1, -1], [2, 2, 2], [])).toBe(0);
  });
});
