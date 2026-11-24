import { describe, it, expect } from 'vitest';
import { World, buildChunkMesh, faceShade, tileUVs, chunkKeyForPoint, type TileData } from '../src';

const ts = new Map([[0, { id: 0, tileSize: 16, imageWidth: 64, imageHeight: 32 }], [1, { id: 1, tileSize: 16, imageWidth: 32, imageHeight: 32 }]]);
const tile = (p: Partial<TileData> = {}): TileData => ({ layer: 1, tileset: 0, tx: 1, ty: 1, rot: 0, flipX: false, flipY: false, doubleSided: false, ghost: false,
  corners: new Float32Array([0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0]), ...p });
const mesh = (tiles: TileData[], visible: (layer: number) => boolean = () => true) => {
  const w = new World(); w.addLayer('a'); w.addLayer('b'); tiles.forEach((t) => w.addTile(t));
  return buildChunkMesh(w.chunks.get(chunkKeyForPoint(0.5, 0, 0.5))!, ts, visible);
};

describe('faceShade (K6)', () => {
  it('oben hell, unten auf 0,4 begrenzt, Seite dazwischen', () => {
    expect(faceShade(0, 1, 0)).toBeCloseTo(0.91958, 4);
    expect(faceShade(0, -1, 0)).toBeCloseTo(0.4, 6);
    expect(faceShade(1, 0, 0)).toBeCloseTo(0.67936, 4);
  });
});

describe('buildChunkMesh', () => {
  it('eine Bodenkachel: 4 Ecken, 6 Indizes, UVs und Schattierung', () => {
    const [p] = mesh([tile()]);
    expect(p.positions.length).toBe(12); expect(Array.from(p.indices)).toEqual([0, 1, 2, 0, 2, 3]);
    expect(Array.from(p.uvs)).toEqual(Array.from(tileUVs(1, 1, 0, false, false, ts.get(0)!, new Float32Array(8))));
    expect(p.shades[0]).toBeCloseTo(faceShade(0, 1, 0), 6);
  });
  it('beidseitig: zweite, umgedrehte Kopie', () => {
    const [p] = mesh([tile({ doubleSided: true })]);
    expect(p.positions.length).toBe(24); expect(p.triangles).toBe(4);
    expect(p.shades[4]).toBeCloseTo(faceShade(0, -1, 0), 6);
  });
  it('ein Teil pro Tileset, verborgene Ebenen fehlen', () => {
    expect(mesh([tile(), tile({ tileset: 1, layer: 2 })]).length).toBe(2);
    expect(mesh([tile(), tile({ tileset: 1, layer: 2 })], (l) => l !== 2).length).toBe(1);
  });
  it('NaN- und entartete Kacheln werden übersprungen (Review Focus 4)', () => {
    const bad = tile({ corners: new Float32Array([NaN, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0]) });
    const line = tile({ corners: new Float32Array([0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0]) });
    const parts = mesh([tile(), bad, line]);
    expect(parts[0].triangles).toBe(2);
    expect(parts[0].positions.every(Number.isFinite)).toBe(true);
  });
});
