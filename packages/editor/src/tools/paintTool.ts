import {
  cellQuad,
  planeOfQuad,
  planeToWorld,
  worldToPlane,
  type DrawPlane,
  type RayHit,
  type TileData,
  type World,
} from '@rgm/engine';
import { editTilesCmd, updateTilesCmd, type TileChange } from '../commands/tileCommands';
import { t } from '../strings/de';
import { brushTile, stampCells, type BrushState, type StampCell } from './brush';
import { cellAt, planeKey, samePlane } from './drawPlane';
import { outlineHovered, pickBrush } from './eyedropperTool';
import type { ToolId } from './registry';
import {
  MAX_GHOSTS,
  MAX_TILES_PER_OP,
  hitIsSlanted,
  pointOnPlane,
  pointerTarget,
  quadOutline,
  type Tool,
  type ToolContext,
  type ToolPointer,
} from './tool';

type Cell = [number, number];

/** R dreht den Pinsel, X spiegelt horizontal, Shift+X vertikal. */
export function brushKey(e: KeyboardEvent, c: ToolContext): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  const k = e.key.toLowerCase();
  const b = c.state.brush.value;
  if (k === 'r') {
    c.state.brush.value = { ...b, rot: ((b.rot + 1) & 3) as BrushState['rot'] };
    return true;
  }
  if (k === 'x') {
    c.state.brush.value = e.shiftKey ? { ...b, flipY: !b.flipY } : { ...b, flipX: !b.flipX };
    return true;
  }
  return false;
}

const cellKey = (u: number, v: number) => `${Math.round(u * 1e4)},${Math.round(v * 1e4)}`;

/**
 * Bestehende Kacheln, die genau eine Zelle der Größe s auf der Ebene belegen (gleiche Richtung),
 * im Bereich [u0, u1+s] × [v0, v1+s]; Schlüssel = Zellecke.
 */
export function cellIndex(world: World, plane: DrawPlane, s: number, u0: number, v0: number, u1: number, v1: number): Map<string, number> {
  const a = planeToWorld(plane, u0, v0);
  const b = planeToWorld(plane, u1 + s, v1 + s);
  const min = [0, 1, 2].map((i) => Math.min(a[i], b[i]) - 1e-3);
  const max = [0, 1, 2].map((i) => Math.max(a[i], b[i]) + 1e-3);
  const out = new Map<string, number>();
  const corner = new Float32Array(3);
  world.queryAabb(min, max, (id, chunk, i) => {
    const base = i * 12;
    const p = planeOfQuad(chunk.corners, base);
    if (!p || !samePlane(p, plane)) return;
    let mu = Infinity, mv = Infinity, Mu = -Infinity, Mv = -Infinity;
    for (let k = 0; k < 4; k++) {
      corner[0] = chunk.corners[base + k * 3];
      corner[1] = chunk.corners[base + k * 3 + 1];
      corner[2] = chunk.corners[base + k * 3 + 2];
      const [u, v] = worldToPlane(plane, corner);
      mu = Math.min(mu, u);
      mv = Math.min(mv, v);
      Mu = Math.max(Mu, u);
      Mv = Math.max(Mv, v);
    }
    if (Math.abs(Mu - mu - s) > 1e-4 || Math.abs(Mv - mv - s) > 1e-4) return;
    out.set(cellKey(mu, mv), id);
  });
  return out;
}

/** Zellen der Strecke a → b (ohne a, mit b), gerastert oder frei. */
function lineCells(a: Cell, b: Cell, snap: number, free: boolean): Cell[] {
  const n = Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / snap - 1e-9);
  const out: Cell[] = [];
  for (let k = 1; k <= n; k++) {
    let u = a[0] + ((b[0] - a[0]) * k) / n;
    let v = a[1] + ((b[1] - a[1]) * k) / n;
    if (!free) {
      u = Math.round(u / snap) * snap;
      v = Math.round(v / snap) * snap;
    }
    out.push([u, v]);
  }
  return out;
}

/**
 * Kachel malen: Klick stempelt den Pinsel, Ziehen malt weiter (ein Undo-Schritt je Strich,
 * jede Zelle einmal), Shift + Ziehen füllt ein Rechteck. Gleich ausgerichtete Kacheln an
 * derselben Stelle werden umgemalt statt gestapelt. Auf schrägen Kacheln wird nur umgefärbt.
 */
export class PaintTool implements Tool {
  readonly id: ToolId = 'paint';
  private stroke: { plane: DrawPlane; done: Set<string>; last: Cell; free: boolean } | null = null;
  private rect: { plane: DrawPlane; start: Cell; end: Cell } | null = null;

  pointerDown(p: ToolPointer, c: ToolContext): void {
    if (p.button === 2) {
      pickBrush(p, c);
      return;
    }
    if (this.stroke || this.rect) return;
    if (!c.editable(c.state.activeLayer.value)) {
      c.notify(t.status.ebeneGesperrt);
      return;
    }
    const tgt = pointerTarget(p, c);
    if (hitIsSlanted(tgt.hit, c.world)) {
      this.repaintSlanted(tgt.hit!, c);
      return;
    }
    if (!tgt.point) return;
    const cell = cellAt(tgt.plane, tgt.point, c.state.snap.value, p.alt);
    if (p.shift) {
      this.rect = { plane: tgt.plane, start: cell, end: cell };
      this.previewRect(c);
      return;
    }
    c.history.begin(t.werkzeug.paint);
    this.stroke = { plane: tgt.plane, done: new Set(), last: cell, free: p.alt };
    this.stamp([cell], c);
    this.previewStamp(tgt.plane, cell, c);
  }

  pointerMove(p: ToolPointer, c: ToolContext): void {
    const snap = c.state.snap.value;
    if (this.rect) {
      const pt = pointOnPlane(p, c, this.rect.plane);
      if (pt) {
        this.rect.end = cellAt(this.rect.plane, pt, snap, p.alt);
        this.previewRect(c);
      }
      return;
    }
    if (this.stroke) {
      const pt = pointOnPlane(p, c, this.stroke.plane);
      if (!pt) return;
      const cell = cellAt(this.stroke.plane, pt, snap, this.stroke.free);
      this.stamp(lineCells(this.stroke.last, cell, snap, this.stroke.free), c);
      this.stroke.last = cell;
      this.previewStamp(this.stroke.plane, cell, c);
      return;
    }
    const tgt = pointerTarget(p, c);
    if (hitIsSlanted(tgt.hit, c.world)) {
      outlineHovered(p, c);
      return;
    }
    if (!tgt.point) {
      c.setPreview(null);
      return;
    }
    this.previewStamp(tgt.plane, cellAt(tgt.plane, tgt.point, snap, p.alt), c);
  }

  pointerUp(_p: ToolPointer, c: ToolContext): void {
    if (this.rect) {
      this.placeRect(c);
      this.rect = null;
      c.setPreview(null);
    }
    if (this.stroke) {
      this.stroke = null;
      c.history.end();
    }
  }

  key(e: KeyboardEvent, c: ToolContext): boolean {
    return brushKey(e, c);
  }

  deactivate(c: ToolContext): void {
    if (this.stroke) c.history.end();
    this.stroke = null;
    this.rect = null;
    c.setPreview(null);
  }

  /** Stempelt den Pinsel an den Zellen (je Strich jede Zelle nur einmal). */
  private stamp(cells: Cell[], c: ToolContext): void {
    const s = this.stroke;
    if (!s) return;
    const brush = c.state.brush.value;
    const snap = c.state.snap.value;
    const pattern = stampCells(brush, s.plane);
    const layer = c.state.activeLayer.value;
    const add: TileData[] = [];
    const update: TileChange[] = [];
    for (const [u, v] of cells) {
      for (const sc of pattern) {
        const cu = u + sc.du * snap;
        const cv = v + sc.dv * snap;
        const key = `${planeKey(s.plane)}|${cellKey(cu, cv)}`;
        if (s.done.has(key)) continue;
        s.done.add(key);
        const corners = cellQuad(s.plane, cu, cv, snap);
        this.placeOrRepaint(c, brush, sc, corners, layer, c.world.findCoincident(corners, 'same'), add, update);
      }
    }
    if (add.length > 0 || update.length > 0) c.exec(editTilesCmd({ add, remove: [], update }, t.werkzeug.paint));
  }

  private placeOrRepaint(
    c: ToolContext,
    brush: BrushState,
    sc: Pick<StampCell, 'tx' | 'ty'>,
    corners: Float32Array,
    layer: number,
    existing: number | null,
    add: TileData[],
    update: TileChange[],
  ): void {
    if (existing !== null) {
      const before = c.world.getTile(existing);
      if (before && c.editable(before.layer)) {
        const after = brushTile(brush, sc, before.corners, before.layer);
        if (!sameLook(before, after)) update.push({ id: existing, before, after });
        return;
      }
    }
    add.push(brushTile(brush, sc, corners, layer));
  }

  /** Rechteck von Start- bis Endzelle setzen; das Pinselmuster wird gekachelt. */
  private placeRect(c: ToolContext): void {
    const r = this.rect!;
    const snap = c.state.snap.value;
    const { u0, v0, nu, nv } = rectCells(r.start, r.end, snap);
    if (nu * nv > MAX_TILES_PER_OP) {
      c.notify(t.status.zuGross);
      return;
    }
    const brush = c.state.brush.value;
    const pattern = stampCells({ ...brush, size: 1 }, r.plane);
    const pw = Math.max(...pattern.map((x) => x.du)) + 1;
    const ph = Math.max(...pattern.map((x) => x.dv)) + 1;
    const byPos = new Map(pattern.map((x) => [`${x.du},${x.dv}`, x]));
    const index = cellIndex(c.world, r.plane, snap, u0, v0, u0 + (nu - 1) * snap, v0 + (nv - 1) * snap);
    const layer = c.state.activeLayer.value;
    const add: TileData[] = [];
    const update: TileChange[] = [];
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const cu = u0 + i * snap, cv = v0 + j * snap;
        const sc = byPos.get(`${i % pw},${j % ph}`) ?? pattern[0];
        const corners = cellQuad(r.plane, cu, cv, snap);
        this.placeOrRepaint(c, brush, sc, corners, layer, index.get(cellKey(cu, cv)) ?? null, add, update);
      }
    }
    if (add.length > 0 || update.length > 0) c.exec(editTilesCmd({ add, remove: [], update }, t.werkzeug.paint));
  }

  /** Schräge Kachel (z. B. Rampe): nur umfärben mit der oberen linken Pinsel-Kachel. */
  private repaintSlanted(hit: RayHit, c: ToolContext): void {
    const before = c.world.getTile(hit.tileId);
    if (!before) return;
    if (!c.editable(before.layer)) {
      c.notify(t.status.ebeneGesperrt);
      return;
    }
    const b = c.state.brush.value;
    const after: TileData = { ...before, tileset: b.tileset, tx: b.tx, ty: b.ty, rot: b.rot, flipX: b.flipX, flipY: b.flipY };
    if (!sameLook(before, after)) c.exec(updateTilesCmd([{ id: hit.tileId, before, after }], t.werkzeug.paint));
  }

  private previewStamp(plane: DrawPlane, cell: Cell, c: ToolContext): void {
    const brush = c.state.brush.value;
    const snap = c.state.snap.value;
    const ghosts: TileData[] = [];
    for (const sc of stampCells(brush, plane)) {
      if (ghosts.length >= MAX_GHOSTS) break;
      ghosts.push(brushTile(brush, sc, cellQuad(plane, cell[0] + sc.du * snap, cell[1] + sc.dv * snap, snap), 0));
    }
    c.setPreview({ ghosts, lines: new Float32Array(0), points: new Float32Array(0) });
  }

  private previewRect(c: ToolContext): void {
    const r = this.rect!;
    const snap = c.state.snap.value;
    const { u0, v0, nu, nv } = rectCells(r.start, r.end, snap);
    const ghosts: TileData[] = [];
    if (nu * nv <= MAX_GHOSTS) {
      const brush = c.state.brush.value;
      const pattern = stampCells({ ...brush, size: 1 }, r.plane);
      const pw = Math.max(...pattern.map((x) => x.du)) + 1;
      const ph = Math.max(...pattern.map((x) => x.dv)) + 1;
      const byPos = new Map(pattern.map((x) => [`${x.du},${x.dv}`, x]));
      for (let j = 0; j < nv; j++) {
        for (let i = 0; i < nu; i++) {
          const sc = byPos.get(`${i % pw},${j % ph}`) ?? pattern[0];
          ghosts.push(brushTile(brush, sc, cellQuad(r.plane, u0 + i * snap, v0 + j * snap, snap), 0));
        }
      }
    }
    const lines: number[] = [];
    quadOutline(rectQuad(r.plane, u0, v0, nu * snap, nv * snap), lines);
    c.setPreview({ ghosts, lines: new Float32Array(lines), points: new Float32Array(0) });
  }
}

/** Rechteck aus zwei Zellen (beide eingeschlossen). */
export function rectCells(a: Cell, b: Cell, snap: number): { u0: number; v0: number; nu: number; nv: number } {
  const u0 = Math.min(a[0], b[0]), v0 = Math.min(a[1], b[1]);
  return {
    u0,
    v0,
    nu: Math.round(Math.abs(b[0] - a[0]) / snap) + 1,
    nv: Math.round(Math.abs(b[1] - a[1]) / snap) + 1,
  };
}

/** Viereck der Größe w × h ab (u0, v0) auf der Ebene (für Umrisse). */
export function rectQuad(plane: DrawPlane, u0: number, v0: number, w: number, h: number): Float32Array {
  const out = new Float32Array(12);
  const pts: Cell[] = [[u0, v0], [u0 + w, v0], [u0 + w, v0 + h], [u0, v0 + h]];
  pts.forEach(([u, v], k) => out.set(planeToWorld(plane, u, v), k * 3));
  return out;
}

function sameLook(a: TileData, b: TileData): boolean {
  return (
    a.tileset === b.tileset &&
    a.tx === b.tx &&
    a.ty === b.ty &&
    a.rot === b.rot &&
    a.flipX === b.flipX &&
    a.flipY === b.flipY &&
    a.doubleSided === b.doubleSided &&
    a.ghost === b.ghost
  );
}
