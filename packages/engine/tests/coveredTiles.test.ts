import { describe, it, expect } from 'vitest';
import { World, coveredTiles, type TileData } from '../src';

const floor = (opts: { x?: number; layer?: number; down?: boolean; doubleSided?: boolean } = {}): TileData => {
  const x = opts.x ?? 0;
  const c = [x, 0, 1, x + 1, 0, 1, x + 1, 0, 0, x, 0, 0];
  const corners = opts.down ? [...c.slice(9, 12), ...c.slice(6, 9), ...c.slice(3, 6), ...c.slice(0, 3)] : c;
  return { layer: opts.layer ?? 1, tileset: 0, tx: 0, ty: 0, rot: 0, flipX: false, flipY: false, doubleSided: opts.doubleSided ?? false, ghost: false, corners: new Float32Array(corners) };
};
const world = () => { const w = new World(); w.addLayer('a'); w.addLayer('b'); return w; };

describe('coveredTiles (nichts liegt doppelt)', () => {
  it('deckungsgleich in derselben Ebene → id', () => {
    const w = world(); const id = w.addTile(floor());
    expect(coveredTiles(w, [floor()], new Set())).toEqual([id]);
  });
  it('Ecken in anderer Reihenfolge zählen auch', () => {
    const w = world(); const id = w.addTile(floor());
    const t = floor(); const c = t.corners;
    t.corners = new Float32Array([...c.slice(3, 12), ...c.slice(0, 3)]); // gleiche Richtung, anderer Start
    expect(coveredTiles(w, [t], new Set())).toEqual([id]);
  });
  it('andere Ebene → []', () => {
    const w = world(); w.addTile(floor({ layer: 2 }));
    expect(coveredTiles(w, [floor({ layer: 1 })], new Set())).toEqual([]);
  });
  it('entgegengesetzte Blickrichtung → []', () => {
    const w = world(); w.addTile(floor({ down: true }));
    expect(coveredTiles(w, [floor()], new Set())).toEqual([]);
  });
  it('eine von beiden beidseitig → id', () => {
    const w = world(); const id = w.addTile(floor({ down: true, doubleSided: true }));
    expect(coveredTiles(w, [floor()], new Set())).toEqual([id]);
  });
  it('ausgeschlossene ids und nur benachbarte Kacheln → []', () => {
    const w = world(); const id = w.addTile(floor()); w.addTile(floor({ x: 1 }));
    expect(coveredTiles(w, [floor()], new Set([id]))).toEqual([]);
  });
});
