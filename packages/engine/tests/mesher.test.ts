import { describe, it, expect } from 'vitest';
import { World, buildChunkMesh, faceShade, tileUVs, tileLocalUVs, chunkKeyForPoint, type ChunkMeshPart, type TileData } from '../src';

const ts = new Map([[0, { id: 0, tileSize: 16, imageWidth: 64, imageHeight: 32 }], [1, { id: 1, tileSize: 16, imageWidth: 32, imageHeight: 32 }]]);
const tile = (p: Partial<TileData> = {}): TileData => ({ layer: 1, tileset: 0, tx: 1, ty: 1, rot: 0, flipX: false, flipY: false, doubleSided: false, ghost: false,
  corners: new Float32Array([0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0]), ...p });
const mesh = (tiles: TileData[], visible: (layer: number) => boolean = () => true) => {
  const w = new World(); w.addLayer('a'); w.addLayer('b'); tiles.forEach((t) => w.addTile(t));
  return buildChunkMesh(w.chunks.get(chunkKeyForPoint(0.5, 0, 0.5))!, ts, visible);
};

/** Welche Kachel-Ecke steht an Ecke k des Netzes? */
function cornerOf(p: ChunkMeshPart, k: number, corners: Float32Array): number {
  for (let i = 0; i < 4; i++) {
    if ([0, 1, 2].every((j) => Math.abs(p.positions[k * 3 + j] - corners[i * 3 + j]) < 1e-6)) return i;
  }
  throw new Error('Ecke nicht gefunden');
}

/** Texel wie im Shader: Zelle · Größe + floor(fract(lokal) · Größe), begrenzt auf die Zelle. */
function newTexel(local: [number, number], cell: [number, number], size: number): [number, number] {
  const f = (x: number) => Math.min(size - 1, Math.max(0, Math.floor((x - Math.floor(x)) * size)));
  return [cell[0] * size + f(local[0]), cell[1] * size + f(local[1])];
}

describe('faceShade (K6)', () => {
  it('oben hell, unten auf 0,4 begrenzt, Seite dazwischen', () => {
    expect(faceShade(0, 1, 0)).toBeCloseTo(0.91958, 4);
    expect(faceShade(0, -1, 0)).toBeCloseTo(0.4, 6);
    expect(faceShade(1, 0, 0)).toBeCloseTo(0.67936, 4);
  });
});

describe('buildChunkMesh', () => {
  it('Kacheln mit fehlendem Tileset erscheinen mit der Prüftextur (−1), statt unsichtbar zu sein', () => {
    const checker = { id: -1, tileSize: 16, imageWidth: 32, imageHeight: 32 };
    const w = new World(); w.addLayer('a'); w.addTile(tile({ tileset: 7, tx: 3, ty: 2 }));
    const parts = buildChunkMesh(w.chunks.get(chunkKeyForPoint(0.5, 0, 0.5))!, new Map([...ts, [-1, checker]]), () => true);
    expect(parts.map((p) => [p.tileset, p.triangles])).toEqual([[-1, 2]]);
    expect(Array.from(parts[0].cells)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    // ohne Prüftextur in der Liste bleibt es beim Überspringen
    expect(buildChunkMesh(w.chunks.get(chunkKeyForPoint(0.5, 0, 0.5))!, ts, () => true)).toEqual([]);
  });
  it('eine Bodenkachel: 4 Ecken, 6 Indizes, UVs und Schattierung', () => {
    const [p] = mesh([tile()]);
    expect(p.positions.length).toBe(12); expect(Array.from(p.indices)).toEqual([0, 1, 2, 0, 2, 3]);
    expect(Array.from(p.cells)).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
    expect(Array.from(p.ranks)).toEqual([0, 0, 0, 0]);
    const want = tileLocalUVs(tile().corners, 0, 0, false, false, new Float32Array(8));
    for (let k = 0; k < 4; k++) {
      const src = cornerOf(p, k, tile().corners);
      expect(p.locals[k * 2]).toBeCloseTo(want[src * 2], 6);
      expect(p.locals[k * 2 + 1]).toBeCloseTo(want[src * 2 + 1], 6);
    }
    expect(p.shades[0]).toBeCloseTo(faceShade(0, 1, 0), 6);
  });
  it('1×1-Kacheln pixelgleich zu vorher (alle Drehungen und Spiegelungen)', () => {
    const info = ts.get(0)!;
    const bil = (q: ArrayLike<number>, s: number, t: number, j: number) =>
      (1 - s) * (1 - t) * q[j] + s * (1 - t) * q[2 + j] + s * t * q[4 + j] + (1 - s) * t * q[6 + j];
    for (const rot of [0, 1, 2, 3] as const) for (const flipX of [false, true]) for (const flipY of [false, true]) {
      const tl = tile({ tx: 2, ty: 1, rot, flipX, flipY });
      const [p] = mesh([tl]);
      // lokale Werte je Kachel-Ecke aus dem Netz zurückholen
      const local = new Float32Array(8);
      for (let k = 0; k < 4; k++) {
        const src = cornerOf(p, k, tl.corners);
        local[src * 2] = p.locals[k * 2];
        local[src * 2 + 1] = p.locals[k * 2 + 1];
      }
      const old = tileUVs(2, 1, rot, flipX, flipY, info, new Float32Array(8));
      for (const s of [0.23, 0.51, 0.77]) for (const t of [0.23, 0.51, 0.77]) {
        const was = [Math.floor(bil(old, s, t, 0) * info.imageWidth), Math.floor(bil(old, s, t, 1) * info.imageHeight)];
        expect(newTexel([bil(local, s, t, 0), bil(local, s, t, 1)], [p.cells[0], p.cells[1]], info.tileSize)).toEqual(was);
      }
    }
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
