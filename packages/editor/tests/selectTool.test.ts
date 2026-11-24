import { describe, it, expect } from 'vitest';
import { makeToolHarness } from './toolHarness';
import { cellQuad } from '@rgm/engine';
import { pruneSelection } from '../src/tools/selection';
import { MAX_TILES_PER_OP } from '../src/tools/tool';
import { t } from '../src/strings/de';
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
  it('Rückgängig nach dem Verschieben einer Ecke: die Auswahl geht mit zurück, kein Phantom', () => {
    const h = makeToolHarness('paint'); h.clickCell(0, 0); h.useTool('select');
    h.state.selectMode.value = 'vertices';
    h.state.selection.value = { mode: 'vertices', positions: [new Float32Array([0, 0, 0])] };
    h.key('PageUp');
    const maxY = () => Math.max(...h.onlyTile().corners.filter((_, i) => i % 3 === 1));
    expect(maxY()).toBe(1);
    h.history.undo();
    expect(maxY()).toBe(0);
    const sel = h.state.selection.value;
    expect(sel.mode === 'vertices' ? sel.positions.map((p) => [...p]) : null).toEqual([[0, 0, 0]]);
    h.key('PageUp');
    expect(maxY()).toBe(1);
    h.history.undo(); h.history.redo();
    const again = h.state.selection.value;
    expect(again.mode === 'vertices' ? again.positions.map((p) => [...p]) : null).toEqual([[0, 1, 0]]);
  });
  it('pruneSelection entfernt gelöschte Kacheln und verwaiste Ecken', () => {
    const h = makeToolHarness('paint'); h.clickCell(0, 0); h.clickCell(1, 0);
    const [a, b] = h.tileIds();
    expect(pruneSelection({ mode: 'tiles', ids: new Set([a, b]) }, h.world)).toBeNull();
    h.world.removeTile(b);
    expect(pruneSelection({ mode: 'tiles', ids: new Set([a, b]) }, h.world)).toEqual({ mode: 'tiles', ids: new Set([a]) });
    const v = pruneSelection({ mode: 'vertices', positions: [new Float32Array([0, 0, 0]), new Float32Array([5, 5, 5])] }, h.world);
    expect(v && v.mode === 'vertices' ? v.positions.map((p) => [...p]) : null).toEqual([[0, 0, 0]]);
  });
  it('eine zu große Auswahl wird schon beim Ziehen abgelehnt, nicht erst beim Loslassen (Review Focus 5)', () => {
    const h = makeToolHarness('select');
    const ids = new Set<number>();
    for (let i = 0; i <= MAX_TILES_PER_OP; i++) {
      ids.add(h.world.addTile({ layer: 1, tileset: 0, tx: 0, ty: 0, rot: 0, flipX: false, flipY: false, doubleSided: false, ghost: false, corners: cellQuad({ axis: 'y', offset: 0, facing: 1 }, i % 300, Math.floor(i / 300)) }));
    }
    h.state.selection.value = { mode: 'tiles', ids };
    h.pressCell(0, 0, { onTile: true });
    h.hoverCell(3, 0, { onTile: true });
    expect(h.lastNotice).toBe(t.status.zuGross);
    expect(h.preview).toBeNull();
    h.hoverCell(5, 0, { onTile: true });
    h.releaseCell(5, 0, { onTile: true });
    expect(h.history.canUndo).toBe(false);
  });
  it('Strg+E extrudiert', () => { const h = makeToolHarness('paint'); h.clickCell(0, 0); h.useTool('select'); h.clickCell(0, 0, { onTile: true }); h.key('e', { ctrl: true }); expect(h.world.tileCount()).toBe(5); });
});
