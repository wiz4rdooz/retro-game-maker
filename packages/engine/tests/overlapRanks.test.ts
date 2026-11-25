import { describe, it, expect } from 'vitest';
import { World, chunkKeyForPoint, overlapRanks, buildChunkMesh, type TileData } from '../src';

/** Bodenkachel x0..x0+w, z 0..1, y = h, nach oben (oder unten) zeigend. */
const floor = (x0: number, opts: { w?: number; h?: number; down?: boolean; layer?: number } = {}): TileData => {
  const w = opts.w ?? 1, h = opts.h ?? 0;
  const c = [x0, h, 1, x0 + w, h, 1, x0 + w, h, 0, x0, h, 0];
  const corners = opts.down ? [...c.slice(9, 12), ...c.slice(6, 9), ...c.slice(3, 6), ...c.slice(0, 3)] : c;
  return { layer: opts.layer ?? 1, tileset: 0, tx: 0, ty: 0, rot: 0, flipX: false, flipY: false, doubleSided: false, ghost: false, corners: new Float32Array(corners) };
};
const ranksOf = (tiles: TileData[], order: (layer: number) => number = (l) => l) => {
  const w = new World(); w.addLayer('a'); w.addLayer('b');
  tiles.forEach((t) => w.addTile(t));
  return Array.from(overlapRanks(w.chunks.get(chunkKeyForPoint(0.5, 0, 0.5))!, order));
};

describe('overlapRanks (kein Flackern)', () => {
  it('zwei gleiche Kacheln einer Ebene → [0, 1] (neuere oben)', () => {
    expect(ranksOf([floor(0), floor(0)])).toEqual([0, 1]);
  });
  it('halb versetzt in derselben Fläche → [0, 1]', () => {
    expect(ranksOf([floor(0), floor(0.5)])).toEqual([0, 1]);
  });
  it('nur Kante an Kante → [0, 0]', () => {
    expect(ranksOf([floor(0), floor(1)])).toEqual([0, 0]);
  });
  it('übereinander gestapelte Böden y = 0 / y = 1 → [0, 0]', () => {
    expect(ranksOf([floor(0), floor(0, { h: 1 })])).toEqual([0, 0]);
  });
  it('gegenüberliegende Blickrichtung, gleiche Fläche → [0, 1]', () => {
    expect(ranksOf([floor(0), floor(0, { down: true })])).toEqual([0, 1]);
  });
  it('höhere Ebene schlägt neuere Kachel', () => {
    const order = (l: number) => (l === 2 ? 1 : 0);
    expect(ranksOf([floor(0, { layer: 2 }), floor(0, { layer: 1 })], order)).toEqual([1, 0]);
  });
  it('Kette A–B–C → [0, 1, 2]', () => {
    expect(ranksOf([floor(0), floor(0.5), floor(1.2)])).toEqual([0, 1, 2]);
  });
  it('4.000 deckungsgleiche Kacheln in einem Chunk: schnell, Stufe nach Alter (Review)', () => {
    for (const reversed of [false, true]) {
      const w = new World(); w.addLayer('a');
      for (let i = 0; i < 4000; i++) w.addTile(floor(0), reversed ? 4000 - i : i + 1);
      const chunk = w.chunks.get(chunkKeyForPoint(0.5, 0, 0.5))!;
      const t0 = performance.now();
      const r = overlapRanks(chunk, (l) => l);
      expect(performance.now() - t0).toBeLessThan(300);
      for (let i = 0; i < chunk.count; i++) expect(r[i]).toBe(Math.min(3, chunk.ids[i] - 1));
    }
  });
  it('fünf gleiche → [0, 1, 2, 3, 3]', () => {
    expect(ranksOf([floor(0), floor(0), floor(0), floor(0), floor(0)])).toEqual([0, 1, 2, 3, 3]);
  });
  it('kaputte Kacheln (NaN, Fläche 0) → Rang 0, kein Wurf (Review Focus 1)', () => {
    const nan = floor(0); nan.corners[3] = Number.NaN;
    const flat = floor(0); flat.corners.fill(0.5);
    expect(ranksOf([floor(0), nan, flat])).toEqual([0, 0, 0]);
  });
  it('der Vernetzer schreibt die Rangstufe je Ecke', () => {
    const w = new World(); w.addLayer('a');
    w.addTile(floor(0)); w.addTile(floor(0));
    const ts = new Map([[0, { id: 0, tileSize: 16, imageWidth: 16, imageHeight: 16 }]]);
    const [p] = buildChunkMesh(w.chunks.get(chunkKeyForPoint(0.5, 0, 0.5))!, ts, () => true, (l) => l);
    expect(Array.from(p.ranks)).toEqual([0, 0, 0, 0, 1, 1, 1, 1]);
  });
});
