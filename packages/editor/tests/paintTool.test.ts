import { describe, it, expect } from 'vitest';
import { makeToolHarness } from './toolHarness'; // Helfer: Welt, History, Zustand, Kamera über dem Ursprung (Blick senkrecht nach unten), pointer(ndc→Zelle)
describe('Kachel malen', () => {
  it('Klick auf freien Boden setzt eine Kachel; zweiter Klick malt um statt zu stapeln', () => {
    const h = makeToolHarness('paint'); h.clickCell(2, 3);
    expect(h.world.tileCount()).toBe(1);
    h.state.brush.value = { ...h.state.brush.value, tx: 3 }; h.clickCell(2, 3);
    expect(h.world.tileCount()).toBe(1); expect(h.onlyTile().tx).toBe(3);
  });
  it('Ziehen über 3 Zellen = 3 Kacheln = ein Undo-Schritt', () => {
    const h = makeToolHarness('paint'); h.dragCells([0, 0], [2, 0]);
    expect(h.world.tileCount()).toBe(3); h.history.undo(); expect(h.world.tileCount()).toBe(0);
  });
  it('Shift + Ziehen 4×3 = 12 Kacheln; 300×300 wird abgelehnt (Review Focus 5)', () => {
    const h = makeToolHarness('paint'); h.dragCells([0, 0], [3, 2], { shift: true }); expect(h.world.tileCount()).toBe(12);
    h.dragCells([0, 10], [299, 309], { shift: true });
    expect(h.world.tileCount()).toBe(12); expect(h.lastNotice).toBe('Zu groß: höchstens 65.536 Kacheln auf einmal.');
  });
  it('Rechtsklick übernimmt Kachel, Drehung und Spiegelung', () => {
    const h = makeToolHarness('paint'); h.state.brush.value = { ...h.state.brush.value, tx: 2, rot: 3, flipX: true }; h.clickCell(0, 0);
    h.state.brush.value = { ...h.state.brush.value, tx: 0, rot: 0, flipX: false }; h.clickCell(0, 0, { button: 2 });
    expect(h.state.brush.value).toMatchObject({ tx: 2, rot: 3, flipX: true });
  });
  it('gesperrte Ebene: nichts passiert, Meldung erscheint', () => {
    const h = makeToolHarness('paint'); h.world.layers[0].locked = true; h.clickCell(0, 0);
    expect(h.world.tileCount()).toBe(0); expect(h.lastNotice).toBe('Diese Ebene ist gesperrt oder ausgeblendet.');
  });
  it('Radieren entfernt die getroffene Kachel', () => {
    const h = makeToolHarness('paint'); h.clickCell(1, 1); h.useTool('erase'); h.clickCell(1, 1); expect(h.world.tileCount()).toBe(0);
  });
  it('auf eine Rampe malen: nur umfärben, keine neue Kachel', () => {
    const h = makeToolHarness('paint'); h.clickCell(0, 0);
    const id = h.tileIds()[0]; const t = h.world.getTile(id)!; t.corners[7] = 1; t.corners[10] = 1; h.world.setTile(id, t);
    h.state.brush.value = { ...h.state.brush.value, tx: 3 }; h.clickCell(0, 0, { onTile: true });
    expect(h.world.tileCount()).toBe(1); expect(h.onlyTile().tx).toBe(3);
  });
});
