import { describe, it, expect } from 'vitest';
import { makeToolHarness } from './toolHarness';
import { cellQuad } from '@rgm/engine';
import { pruneSelection, selectionSize as selectionSizeOf } from '../src/tools/selection';
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
  it('Kachel auf eine andere schieben ersetzt sie, Rückgängig holt beide zurück', () => {
    const h = makeToolHarness('paint'); h.clickCell(0, 0); h.clickCell(1, 0);
    const [moved] = h.tileIds();
    h.useTool('select'); h.clickCell(0, 0, { onTile: true });
    h.key('ArrowRight');
    expect(h.tileIds()).toEqual([moved]);
    expect(h.onlyTile().corners[0]).toBe(1);
    h.history.undo();
    expect(h.world.tileCount()).toBe(2);
    expect(h.tileIds().map((id) => h.world.getTile(id)!.corners[0]).sort()).toEqual([0, 1]);
  });
  it('auf Kachel einer anderen Ebene oder mit Gegenrichtung schieben löscht nichts (Review Focus 3)', () => {
    const h = makeToolHarness('paint'); h.clickCell(0, 0);
    const other = h.world.addLayer('Andere');
    const base = h.onlyTile();
    h.world.addTile({ ...base, layer: other.id, corners: base.corners.map((v, i) => (i % 3 === 0 ? v + 1 : v)) });
    const flipped = base.corners.map((v, i) => (i % 3 === 0 ? v + 1 : v));
    const rev = new Float32Array([...flipped.slice(9, 12), ...flipped.slice(6, 9), ...flipped.slice(3, 6), ...flipped.slice(0, 3)]);
    h.world.addTile({ ...base, corners: rev });
    h.useTool('select'); h.clickCell(0, 0, { onTile: true });
    h.key('ArrowRight');
    expect(h.world.tileCount()).toBe(3);
  });
  it('Extrudieren neben vorhandener Wand legt keine doppelte Seitenfläche an', () => {
    const h = makeToolHarness('paint'); h.clickCell(0, 0); h.useTool('select'); h.clickCell(0, 0, { onTile: true });
    const before = new Set(h.tileIds());
    h.key('e', { ctrl: true });
    const side = h.tileIds().filter((id) => !before.has(id)).map((id) => h.world.getTile(id)!)[0];
    h.history.undo();
    h.world.addTile({ ...side }); // die Wand steht schon da
    h.state.selection.value = { mode: 'tiles', ids: new Set(before) };
    h.key('e', { ctrl: true });
    const same = h.tileIds().filter((id) => {
      const c = h.world.getTile(id)!.corners;
      return c.every((v, i) => Math.abs(v - side.corners[i]) < 1e-6);
    });
    expect(same).toHaveLength(1);
  });
  describe('Gizmo', () => {
    const setup = () => {
      const h = makeToolHarness('paint'); h.clickCell(0, 0); h.useTool('select'); h.clickCell(0, 0, { onTile: true });
      const l = h.gizmo()!;
      const [cx, cy] = l.centerPx; const [tx, ty] = l.axes[0].tipPx;
      return { h, mx: (cx + tx) / 2, my: (cy + ty) / 2 };
    };
    it('X-Pfeil ziehen verschiebt genau im Raster, ein Rückgängig-Schritt, Auswahl geht mit', () => {
      const { h, mx, my } = setup();
      h.movePx(mx, my);
      expect(h.state.gizmoHandle.value).toEqual({ kind: 'axis', axis: 0 });
      h.pressPx(mx, my); h.movePx(mx + 60, my); h.releasePx(mx + 60, my); // 60 px · 0,04 m = 2,4 m → 2 m
      expect(h.onlyTile().corners[0]).toBe(2);
      const sel = h.state.selection.value;
      expect(sel.mode === 'tiles' && sel.ids.has(h.tileIds()[0])).toBe(true);
      h.history.undo();
      expect(h.onlyTile().corners[0]).toBe(0);
    });
    it('Alt ziehen ist frei', () => {
      const { h, mx, my } = setup();
      h.pressPx(mx, my, { alt: true }); h.movePx(mx + 60, my, { alt: true }); h.releasePx(mx + 60, my, { alt: true });
      expect(h.onlyTile().corners[0]).toBeCloseTo(2.4, 4);
    });
    it('zu große Auswahl am Pfeil → Meldung beim Ansetzen (Review Focus 4)', () => {
      const { h } = setup();
      const ids = new Set<number>(h.tileIds());
      const base = h.onlyTile();
      for (let i = 0; i < MAX_TILES_PER_OP; i++) {
        ids.add(h.world.addTile({ ...base, corners: cellQuad({ axis: 'y', offset: 0, facing: 1 }, 2 + (i % 300), Math.floor(i / 300)) }));
      }
      h.state.selection.value = { mode: 'tiles', ids };
      const l = h.gizmo()!;
      const mx = (l.centerPx[0] + l.axes[0].tipPx[0]) / 2, my = (l.centerPx[1] + l.axes[0].tipPx[1]) / 2;
      h.pressPx(mx, my);
      expect(h.lastNotice).toBe(t.status.zuGross);
      h.movePx(mx + 60, my); h.releasePx(mx + 60, my);
      expect(h.history.canUndo).toBe(true); // nur das Malen von vorhin
      h.history.undo();
      expect(h.history.canUndo).toBe(false);
    });
    it('Y-Ring ziehen dreht in 15°-Schritten um die Auswahlmitte, ein Rückgängig-Schritt', () => {
      const h = makeToolHarness('paint'); h.clickCell(0, 0); h.clickCell(1, 0); h.useTool('select');
      // (Shift+Klick auf die zweite Kachel träfe hier den X-Pfeil – der Gizmo geht vor)
      h.state.selection.value = { mode: 'tiles', ids: new Set(h.tileIds()) };
      const ring = h.gizmo()!.rings[1];
      expect(ring.visible).toBe(true);
      const at = (k: number) => [ring.pointsPx[k * 2], ring.pointsPx[k * 2 + 1]] as const;
      const [x0, y0] = at(0), [xa, ya] = at(11), [xb, yb] = at(12);
      const x1 = xa + 0.6 * (xb - xa), y1 = ya + 0.6 * (yb - ya); // ≈ 87° → rastet auf 90°
      h.movePx(x0, y0);
      expect(h.state.gizmoHandle.value).toEqual({ kind: 'ring', axis: 1 });
      h.pressPx(x0, y0); h.movePx(x1, y1); h.releasePx(x1, y1);
      const xs: number[] = [], zs: number[] = [];
      for (const id of h.tileIds()) { const c = h.world.getTile(id)!.corners; for (let k = 0; k < 4; k++) { xs.push(c[k * 3]); zs.push(c[k * 3 + 2]); } }
      // 2 × 1 m um (1; 0,5) gedreht → 1 × 2 m
      expect([Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]).toEqual([0.5, 1.5, -0.5, 1.5]);
      h.history.undo();
      expect(h.world.getTile(h.tileIds()[1])!.corners[0]).not.toBe(0.5);
      const xs2: number[] = [];
      for (const id of h.tileIds()) { const c = h.world.getTile(id)!.corners; for (let k = 0; k < 4; k++) xs2.push(c[k * 3]); }
      expect([Math.min(...xs2), Math.max(...xs2)]).toEqual([0, 2]);
    });
    it('Esc bricht das Ziehen ab, nichts geändert', () => {
      const { h, mx, my } = setup();
      h.pressPx(mx, my); h.movePx(mx + 60, my);
      expect(h.preview).not.toBeNull();
      h.key('Escape');
      expect(h.preview).toBeNull();
      h.releasePx(mx + 60, my);
      expect(h.onlyTile().corners[0]).toBe(0);
      expect(selectionSizeOf(h.state.selection.value)).toBe(1);
    });
  });
  it('Strg+E extrudiert', () => { const h = makeToolHarness('paint'); h.clickCell(0, 0); h.useTool('select'); h.clickCell(0, 0, { onTile: true }); h.key('e', { ctrl: true }); expect(h.world.tileCount()).toBe(5); });
});
