import { describe, it, expect } from 'vitest';
import { makeToolHarness } from './toolHarness';
describe('Block setzen', () => {
  it('ein Block = 6 Kacheln, zwei Nachbarn = 10, undo = 0', () => {
    const h = makeToolHarness('block'); h.clickCell(0, 0); expect(h.world.tileCount()).toBe(6);
    h.clickCell(1, 0); expect(h.world.tileCount()).toBe(10);
    h.history.undo(); h.history.undo(); expect(h.world.tileCount()).toBe(0);
  });
  it('Block auf eine Bodenkachel entfernt die verdeckte Bodenkachel', () => {
    const h = makeToolHarness('paint'); h.dragCells([0, 0], [2, 0], { shift: true }); h.useTool('block'); h.clickCell(1, 0, { onTile: true });
    expect(h.world.tileCount()).toBe(3 - 1 + 5);
  });
  it('Deckel-Kachel', () => {
    const h = makeToolHarness('block'); h.state.brush.value = { ...h.state.brush.value, tx: 1, topTile: { tx: 3, ty: 0 } }; h.clickCell(0, 0);
    expect(h.tilesFacing([0, 1, 0])[0].tx).toBe(3); expect(h.tilesFacing([1, 0, 0])[0].tx).toBe(1);
  });
});
describe('Füllen', () => {
  it('malt eine zusammenhängende gleiche Fläche um, Nachbarn bleiben', () => {
    const h = makeToolHarness('paint'); h.dragCells([0, 0], [4, 4], { shift: true });
    h.state.brush.value = { ...h.state.brush.value, tx: 1 }; h.dragCells([5, 0], [5, 4], { shift: true });
    h.state.brush.value = { ...h.state.brush.value, tx: 2 }; h.useTool('fill'); h.clickCell(2, 2, { onTile: true });
    expect(h.countWhere((t) => t.tx === 2)).toBe(25); expect(h.countWhere((t) => t.tx === 1)).toBe(5);
  });
});
