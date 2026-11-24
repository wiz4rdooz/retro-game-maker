import { describe, it, expect } from 'vitest';
import { World, raycastWorld, rayPlane, cellQuad, type TileData } from '../src';

const T = (corners: Float32Array, p: Partial<TileData> = {}): TileData => ({ layer: 1, tileset: 0, tx: 0, ty: 0, rot: 0, flipX: false, flipY: false, doubleSided: false, ghost: false, corners, ...p });
const all = () => true;
const setup = () => { const w = new World(); w.addLayer('a'); w.addLayer('b'); return w; };

describe('raycastWorld', () => {
  it('trifft die Bodenkachel von oben', () => {
    const w = setup(); const id = w.addTile(T(cellQuad({ axis: 'y', offset: 0, facing: 1 }, 2, 3)));
    const h = raycastWorld(w, [2.5, 10, 3.5], [0, -1, 0], 100, all)!;
    expect(h.tileId).toBe(id); expect(h.t).toBeCloseTo(10, 5); expect(h.front).toBe(true);
    expect(Array.from(h.point).map((v) => +v.toFixed(3) + 0)).toEqual([2.5, 0, 3.5]);
  });
  it('Rückseite nur bei beidseitigen Kacheln', () => {
    const w = setup(); w.addTile(T(cellQuad({ axis: 'y', offset: 0, facing: 1 }, 0, 0)));
    expect(raycastWorld(w, [0.5, -5, 0.5], [0, 1, 0], 100, all)).toBeNull();
    const w2 = setup(); w2.addTile(T(cellQuad({ axis: 'y', offset: 0, facing: 1 }, 0, 0), { doubleSided: true }));
    expect(raycastWorld(w2, [0.5, -5, 0.5], [0, 1, 0], 100, all)!.front).toBe(false);
  });
  it('nimmt den nächsten Treffer und beachtet den Ebenen-Filter', () => {
    const w = setup();
    const low = w.addTile(T(cellQuad({ axis: 'y', offset: 0, facing: 1 }, 0, 0)));
    const high = w.addTile(T(cellQuad({ axis: 'y', offset: 2, facing: 1 }, 0, 0), { layer: 2 }));
    expect(raycastWorld(w, [0.5, 9, 0.5], [0, -1, 0], 100, all)!.tileId).toBe(high);
    expect(raycastWorld(w, [0.5, 9, 0.5], [0, -1, 0], 100, (l) => l !== 2)!.tileId).toBe(low);
  });
  it('trifft eine gestreckte Kachel weit außerhalb ihres Chunks', () => {
    const w = setup(); const id = w.addTile(T(cellQuad({ axis: 'y', offset: 0, facing: 1 }, 0, 0, 100)));
    expect(raycastWorld(w, [95, 3, 95], [0, -1, 0], 100, all)!.tileId).toBe(id);
  });
  it('überspringt entartete Kacheln ohne Fehler (Review Focus 4)', () => {
    const w = setup(); w.addTile(T(new Float32Array([0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0])));
    expect(raycastWorld(w, [0.5, 5, 0], [0, -1, 0], 100, all)).toBeNull();
  });
  it('maxDist begrenzt die Suche', () => {
    const w = setup(); w.addTile(T(cellQuad({ axis: 'y', offset: 0, facing: 1 }, 0, 0)));
    expect(raycastWorld(w, [0.5, 50, 0.5], [0, -1, 0], 20, all)).toBeNull();
  });
});

describe('rayPlane', () => {
  it('Schnitt, parallel, dahinter', () => {
    const p = { axis: 'y' as const, offset: 1, facing: 1 as const };
    expect(Array.from(rayPlane([0, 5, 0], [0, -1, 0], p)!)).toEqual([0, 1, 0]);
    expect(rayPlane([0, 5, 0], [1, 0, 0], p)).toBeNull();
    expect(rayPlane([0, 5, 0], [0, 1, 0], p)).toBeNull();
  });
});
