import { describe, it, expect } from 'vitest';
import { World, cellQuad, floodCoplanar, type TileData } from '../src';
const T = (x: number, z: number, tx = 0): TileData => ({ layer: 1, tileset: 0, tx, ty: 0, rot: 0, flipX: false, flipY: false, doubleSided: false, ghost: false, corners: cellQuad({ axis: 'y', offset: 0, facing: 1 }, x, z) });
describe('floodCoplanar', () => {
  it('5×5 gleiche Kacheln, umrandet von anderen', () => {
    const w = new World(); w.addLayer('a'); let start = 0;
    for (let x = -1; x <= 5; x++) for (let z = -1; z <= 5; z++) { const inner = x >= 0 && x < 5 && z >= 0 && z < 5; const id = w.addTile(T(x, z, inner ? 0 : 1)); if (x === 2 && z === 2) start = id; }
    const r = floodCoplanar(w, start, (_, t) => t.tx === 0, 65536); expect(r.ids.length).toBe(25); expect(r.capped).toBe(false);
  });
  it('bricht an der Obergrenze ab', () => {
    const w = new World(); w.addLayer('a'); const s = w.addTile(T(0, 0)); for (let x = 1; x < 20; x++) w.addTile(T(x, 0));
    expect(floodCoplanar(w, s, () => true, 10)).toMatchObject({ capped: true });
  });
});
