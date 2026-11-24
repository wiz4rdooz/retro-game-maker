import { describe, it, expect } from 'vitest';
import { World, chunkKey, chunkCoords, chunkKeyForPoint, type TileData } from '../src';

const floor = (x: number, y: number, z: number, layer = 1): TileData => ({
  layer, tileset: 0, tx: 1, ty: 2, rot: 0, flipX: false, flipY: false, doubleSided: false, ghost: false,
  corners: new Float32Array([x, y, z + 1, x + 1, y, z + 1, x + 1, y, z, x, y, z]),
});

describe('Chunk-Schlüssel', () => {
  it('negative Koordinaten runden nach unten', () => {
    expect(chunkCoords(chunkKeyForPoint(-0.5, 0, -0.5))).toEqual([-1, 0, -1]);
    expect(chunkCoords(chunkKey(511, -512, 3))).toEqual([511, -512, 3]);
    expect(() => chunkKey(512, 0, 0)).toThrow(RangeError);
  });
});

describe('World', () => {
  it('add/get/remove mit stabilen ids', () => {
    const w = new World(); w.addLayer('Ebene 1');
    const id = w.addTile(floor(2, 0, 3));
    expect(id).toBe(1);
    expect(w.getTile(id)!.tx).toBe(1);
    expect(Array.from(w.getTile(id)!.corners)).toEqual(Array.from(floor(2, 0, 3).corners));
    expect(w.removeTile(id)!.ty).toBe(2);
    expect(w.hasTile(id)).toBe(false);
    expect(w.addTile(floor(0, 0, 0), 7)).toBe(7);
    expect(w.nextTileId).toBe(8);
    expect(() => w.addTile(floor(1, 0, 0), 7)).toThrow();
  });
  it('Kachel liegt im Chunk ihres Schwerpunkts und wandert bei setTile', () => {
    const w = new World(); w.addLayer('Ebene 1');
    const id = w.addTile(floor(40, 0, 5));
    expect(chunkCoords(w.chunkKeyOf(id)!)).toEqual([1, 0, 0]);
    w.setTile(id, floor(-3, 0, 5));
    expect(chunkCoords(w.chunkKeyOf(id)!)).toEqual([-1, 0, 0]);
    expect(w.chunks.get(chunkKey(1, 0, 0))?.count ?? 0).toBe(0);
  });
  it('findCoincident erkennt gleiche Ecken in anderer Reihenfolge und Richtung', () => {
    const w = new World(); w.addLayer('Ebene 1');
    const id = w.addTile(floor(0, 0, 0));
    const c = floor(0, 0, 0).corners;
    const rotated = new Float32Array([...c.slice(3), ...c.slice(0, 3)]);
    const reversed = new Float32Array([c[9], c[10], c[11], c[6], c[7], c[8], c[3], c[4], c[5], c[0], c[1], c[2]]);
    expect(w.findCoincident(rotated, 'same')).toBe(id);
    expect(w.findCoincident(reversed, 'opposite')).toBe(id);
    expect(w.findCoincident(reversed, 'same')).toBeNull();
  });
  it('Dirty-Mengen und queryAabb', () => {
    const w = new World(); w.addLayer('Ebene 1');
    const id = w.addTile(floor(5, 0, 5));
    expect(w.takeRenderDirty().size).toBe(1);
    expect(w.takeRenderDirty().size).toBe(0);
    expect(w.takeSaveDirty().size).toBe(1);
    const hits: number[] = [];
    w.queryAabb([4.5, -1, 4.5], [5.5, 1, 5.5], (i) => hits.push(i));
    expect(hits).toEqual([id]);
  });
  it('Ebene mit Kacheln lässt sich nicht entfernen', () => {
    const w = new World(); const l = w.addLayer('Ebene 1'); w.addTile(floor(0, 0, 0, l.id));
    expect(() => w.removeLayer(l.id)).toThrow();
  });
  it('200.000 Kacheln ohne quadratische Laufzeit', () => {
    const w = new World(); w.addLayer('Ebene 1');
    for (let x = 0; x < 500; x++) for (let z = 0; z < 400; z++) w.addTile(floor(x, 0, z));
    expect(w.tileCount()).toBe(200_000);
  });
});
