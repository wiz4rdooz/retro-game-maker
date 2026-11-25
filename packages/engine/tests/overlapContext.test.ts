import { describe, it, expect } from 'vitest';
import { World, buildChunkMesh, overlapContext, withOverlapNeighbors, type TileData, type TilesetInfo } from '../src';

/** Bodenkachel x0..x0+1, z 0..1, y = 0, nach oben. */
const floor = (x0: number, layer = 1): TileData => ({
  layer, tileset: 0, tx: 0, ty: 0, rot: 0, flipX: false, flipY: false, doubleSided: false, ghost: false,
  corners: new Float32Array([x0, 0, 1, x0 + 1, 0, 1, x0 + 1, 0, 0, x0, 0, 0]),
});
const tilesets = new Map<number, TilesetInfo>([[0, { id: 0, tileSize: 16, imageWidth: 64, imageHeight: 64 }]]);

/** Rangstufe der einzigen sichtbaren Kachel ihres Chunks, vernetzt wie in der Ansicht (mit Nachbarn). */
const rankOf = (w: World, id: number, visible: (layer: number) => boolean = () => true): number => {
  const chunk = w.chunks.get(w.chunkKeyOf(id)!)!;
  const parts = buildChunkMesh(chunk, tilesets, visible, (l) => l, overlapContext(w, chunk, visible));
  return parts[0].ranks[0];
};

describe('Rangstufen über Chunk-Grenzen (Review)', () => {
  it('halb versetzt über die Grenze x = 32: verschiedene Stufen, die neuere vorn', () => {
    const w = new World(); w.addLayer('a');
    const a = w.addTile(floor(31)); // Schwerpunkt 31,5 → Chunk 0
    const b = w.addTile(floor(31.5)); // Schwerpunkt 32 → Chunk 1
    expect(w.chunkKeyOf(a)).not.toBe(w.chunkKeyOf(b));
    expect([rankOf(w, a), rankOf(w, b)]).toEqual([0, 1]);
  });
  it('rasterbündig an der Grenze: Nachbarn werden gar nicht verglichen', () => {
    const w = new World(); w.addLayer('a');
    const a = w.addTile(floor(31));
    const c = w.addTile(floor(32));
    expect(overlapContext(w, w.chunks.get(w.chunkKeyOf(a)!)!, () => true)).toBeNull();
    expect([...withOverlapNeighbors(w, [w.chunkKeyOf(c)!])]).toEqual([w.chunkKeyOf(c)]);
  });
  it('eine neue Kachel über der Grenze vernetzt den Nachbar-Chunk mit', () => {
    const w = new World(); w.addLayer('a');
    const a = w.addTile(floor(31));
    w.takeRenderDirty();
    const b = w.addTile(floor(31.5));
    const dirty = withOverlapNeighbors(w, w.takeRenderDirty());
    expect(dirty.has(w.chunkKeyOf(a)!)).toBe(true);
    expect(dirty.has(w.chunkKeyOf(b)!)).toBe(true);
  });
  it('ausgeblendete Ebenen zählen bei den Stufen nicht mit (sonst passten die Chunks nicht zusammen)', () => {
    const w = new World(); w.addLayer('a'); w.addLayer('b');
    w.addTile(floor(31.5, 1)); // ausgeblendet, älter
    const v = w.addTile(floor(31, 2));
    expect(rankOf(w, v, (l) => l !== 1)).toBe(0);
  });
});
