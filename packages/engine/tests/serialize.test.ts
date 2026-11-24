import { describe, it, expect } from 'vitest';
import { World, encodeChunk, decodeChunkInto, encodeWorldMeta, decodeWorldMeta, chunkFileName, chunkKey, cellQuad, FormatError } from '../src';
const msg = { newerVersion: 'neuer', broken: 'kaputt' };
describe('Serialisierung', () => {
  it('Chunk-Rundreise erhält alle Felder', () => {
    const w = new World(); w.addLayer('a');
    const id = w.addTile({ layer: 1, tileset: 2, tx: 3, ty: 4, rot: 3, flipX: true, flipY: false, doubleSided: true, ghost: true, corners: cellQuad({ axis: 'x', offset: 1.25, facing: -1 }, 2, 0) });
    const w2 = new World(); w2.layers = decodeWorldMeta(encodeWorldMeta(w), msg).layers;
    for (const c of w.chunks.values()) decodeChunkInto(w2, encodeChunk(c), msg);
    expect(w2.getTile(id)).toEqual(w.getTile(id));
  });
  it('Dateiname mit negativen Koordinaten; neuere Version wird abgelehnt', () => {
    expect(chunkFileName(chunkKey(-1, 0, -2))).toBe('-1_0_-2.json');
    expect(() => decodeWorldMeta('{"format":"rgm-welt","version":2}', msg)).toThrow(FormatError);
  });
});
