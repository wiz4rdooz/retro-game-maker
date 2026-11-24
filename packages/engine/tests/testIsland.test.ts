import { describe, it, expect } from 'vitest';
import { World, generateTestIsland } from '../src';
describe('generateTestIsland', () => {
  it('ist reproduzierbar und hat die Zielgröße', () => {
    const a = new World(); a.addLayer('a'); const b = new World(); b.addLayer('a');
    const o = { layer: 1, tileset: 0, columns: 8, rows: 4 };
    const ra = generateTestIsland(a, o); const rb = generateTestIsland(b, o);
    expect(ra).toEqual(rb); expect(ra.tiles).toBeGreaterThan(240_000); expect(ra.tiles).toBeLessThan(360_000);
  });
});
