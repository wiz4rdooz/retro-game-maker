import { describe, it, expect } from 'vitest';
import { makeToolHarness } from './toolHarness';
describe('Auswahl-Werkzeug', () => {
  it('Klick wählt, Pfeil rechts verschiebt um 1, Entf löscht, undo stellt her', () => {
    const h = makeToolHarness('paint'); h.clickCell(0, 0); h.useTool('select'); h.clickCell(0, 0, { onTile: true });
    h.key('ArrowRight'); expect(h.onlyTile().corners[0]).toBe(1);
    h.key('Delete'); expect(h.world.tileCount()).toBe(0); h.history.undo(); expect(h.world.tileCount()).toBe(1);
  });
  it('Kanten-Modus: Bild↑ hebt die Kante zur Rampe', () => {
    const h = makeToolHarness('paint'); h.clickCell(0, 0); h.useTool('select'); h.key('2'); h.clickEdgeOf(0, 0, 'north');
    h.key('PageUp'); expect(Math.max(...h.onlyTile().corners.filter((_, i) => i % 3 === 1))).toBe(1);
  });
  it('Strg+E extrudiert', () => { const h = makeToolHarness('paint'); h.clickCell(0, 0); h.useTool('select'); h.clickCell(0, 0, { onTile: true }); h.key('e', { ctrl: true }); expect(h.world.tileCount()).toBe(5); });
});
