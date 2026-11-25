import { axisIndex, mat4, rotateTiles, vec3, type DrawPlane, type TileChange } from '@rgm/engine';
import type { SelectMode } from '../state/editorState';
import { t } from '../strings/de';
import { outlineHovered } from './eyedropperTool';
import type { ToolId } from './registry';
import {
  convertSelection,
  cornersInRect,
  edgeKey,
  edgesInRect,
  commitSelectionEdit,
  emptySelection,
  moveSelection,
  pickEdge,
  pickVertex,
  posKey,
  runSelectionAction,
  selectedTileIds,
  selectionCenter,
  selectionMoveChanges,
  shifted,
  tilesInRect,
  type Selection,
} from './selection';
import { MAX_GHOSTS, MAX_TILES_PER_OP, pointOnPlane, pointerTarget, quadOutline, type Tool, type ToolContext, type ToolPointer } from './tool';
import { axisDragDelta, gizmoLayout, hitGizmo, planeDragDelta, ringDragAngle, type GizmoHandle, type GizmoLayout } from './gizmo';

type Element = { kind: 'tile'; id: number } | { kind: 'vertex'; p: Float32Array } | { kind: 'edge'; a: Float32Array; b: Float32Array };

interface MoveDrag {
  kind: 'move';
  x0: number;
  y0: number;
  plane: DrawPlane;
  start: Float32Array;
  active: boolean;
  delta: [number, number, number];
  changes: TileChange[];
}

interface RectDrag {
  kind: 'rect';
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  ndc0: [number, number];
  ndc1: [number, number];
  additive: boolean;
}

interface GizmoDrag {
  kind: 'gizmo';
  handle: GizmoHandle;
  pivot: Float32Array;
  o0: Float32Array;
  d0: Float32Array;
  active: boolean;
  delta: [number, number, number];
  angle: number;
  changes: TileChange[];
}

/** Drehringe rasten in 15°-Schritten ein. */
const RING_SNAP = (15 * Math.PI) / 180;
const AXIS_NAMES = ['x', 'y', 'z'] as const;
const metres = (v: number) => `${(Math.round(v * 100) / 100).toLocaleString('de-DE')} m`;

const VIEW_DISTANCE = 160;
const DRAG_PX = 4;
const MODE_KEYS: Record<string, SelectMode> = { '1': 'vertices', '2': 'edges', '3': 'tiles' };

function contains(sel: Selection, el: Element): boolean {
  if (sel.mode === 'tiles' && el.kind === 'tile') return sel.ids.has(el.id);
  if (sel.mode === 'vertices' && el.kind === 'vertex') return sel.positions.some((p) => posKey(p) === posKey(el.p));
  if (sel.mode === 'edges' && el.kind === 'edge') return sel.edges.some(([a, b]) => edgeKey(a, b) === edgeKey(el.a, el.b));
  return false;
}

function single(el: Element): Selection {
  if (el.kind === 'tile') return { mode: 'tiles', ids: new Set([el.id]) };
  if (el.kind === 'vertex') return { mode: 'vertices', positions: [el.p] };
  return { mode: 'edges', edges: [[el.a, el.b]] };
}

function toggle(sel: Selection, el: Element): Selection {
  if (sel.mode === 'tiles' && el.kind === 'tile') {
    const ids = new Set(sel.ids);
    if (!ids.delete(el.id)) ids.add(el.id);
    return { mode: 'tiles', ids };
  }
  if (sel.mode === 'vertices' && el.kind === 'vertex') {
    const k = posKey(el.p);
    const rest = sel.positions.filter((p) => posKey(p) !== k);
    return { mode: 'vertices', positions: rest.length === sel.positions.length ? [...rest, el.p] : rest };
  }
  if (sel.mode === 'edges' && el.kind === 'edge') {
    const k = edgeKey(el.a, el.b);
    const rest = sel.edges.filter(([a, b]) => edgeKey(a, b) !== k);
    return { mode: 'edges', edges: rest.length === sel.edges.length ? [...rest, [el.a, el.b]] : rest };
  }
  return single(el);
}

function union(a: Selection, b: Selection): Selection {
  if (a.mode === 'tiles' && b.mode === 'tiles') return { mode: 'tiles', ids: new Set([...a.ids, ...b.ids]) };
  if (a.mode === 'vertices' && b.mode === 'vertices') {
    const m = new Map([...a.positions, ...b.positions].map((p) => [posKey(p), p]));
    return { mode: 'vertices', positions: [...m.values()] };
  }
  if (a.mode === 'edges' && b.mode === 'edges') {
    const m = new Map([...a.edges, ...b.edges].map((e) => [edgeKey(e[0], e[1]), e]));
    return { mode: 'edges', edges: [...m.values()] };
  }
  return b;
}

/**
 * Auswählen: Klick wählt, Shift + Klick schaltet um, Ziehen auf freier Fläche = Rechteck-Auswahl,
 * Ziehen auf Ausgewähltem verschiebt auf der Zeichenebene (gerastert, Alt = frei, Shift = nur
 * senkrecht). Tasten: Pfeile/Bild↑↓ bewegen, 1/2/3 Modus, R/Shift+R/Alt+R drehen, +/− skalieren,
 * Strg+E extrudieren, Strg+M zusammenführen, Entf löschen, Strg+A alles, Esc nichts.
 */
export class SelectTool implements Tool {
  readonly id: ToolId = 'select';
  private drag: MoveDrag | RectDrag | GizmoDrag | null = null;
  private centerKey: { sel: Selection; doc: number; snap: number } | null = null;
  private centerValue: Float32Array | null = null;

  pointerDown(p: ToolPointer, c: ToolContext): void {
    if (p.button !== 0 || this.drag) return;
    // Gizmo-Griffe gehen vor
    const layout = this.layout(c);
    const handle = layout ? hitGizmo(layout, p.px, p.py) : null;
    if (layout && handle) {
      if (selectedTileIds(c.state.selection.value, c).length > MAX_TILES_PER_OP) {
        c.notify(t.status.zuGross);
        return;
      }
      const o0 = vec3.create(), d0 = vec3.create();
      c.screenRay(p.ndcX, p.ndcY, o0, d0);
      this.drag = { kind: 'gizmo', handle, pivot: layout.pivot, o0, d0, active: false, delta: [0, 0, 0], angle: 0, changes: [] };
      c.state.gizmoHandle.value = handle;
      return;
    }
    const mode = c.state.selectMode.value;
    const hit = c.raycast(p.ndcX, p.ndcY);
    const el = hit ? this.pick(mode, hit.tileId, p, c) : null;
    if (!hit || !el) {
      this.drag = { kind: 'rect', x0: p.px, y0: p.py, x1: p.px, y1: p.py, ndc0: [p.ndcX, p.ndcY], ndc1: [p.ndcX, p.ndcY], additive: p.shift };
      return;
    }
    let sel = c.state.selection.value;
    if (sel.mode !== mode) sel = emptySelection(mode);
    if (p.shift) {
      c.state.selection.value = toggle(sel, el);
      return;
    }
    if (!contains(sel, el)) c.state.selection.value = single(el);
    const tgt = pointerTarget(p, c);
    const plane: DrawPlane = { ...tgt.plane, offset: hit.point[axisIndex(tgt.plane.axis)] };
    this.drag = { kind: 'move', x0: p.px, y0: p.py, plane, start: new Float32Array(hit.point), active: false, delta: [0, 0, 0], changes: [] };
  }

  pointerMove(p: ToolPointer, c: ToolContext): void {
    const d = this.drag;
    if (!d) {
      const layout = this.layout(c);
      const handle = layout ? hitGizmo(layout, p.px, p.py) : null;
      const cur = c.state.gizmoHandle.value;
      if (handle?.kind !== cur?.kind || handle?.axis !== cur?.axis) c.state.gizmoHandle.value = handle;
      this.hover(p, c);
      return;
    }
    if (d.kind === 'gizmo') {
      this.gizmoMove(p, c, d);
      return;
    }
    if (d.kind === 'rect') {
      d.x1 = p.px;
      d.y1 = p.py;
      d.ndc1 = [p.ndcX, p.ndcY];
      c.setPreview({ ghosts: [], lines: new Float32Array(0), points: new Float32Array(0), rect: [d.x0, d.y0, d.x1, d.y1] });
      return;
    }
    if (!d.active && Math.hypot(p.px - d.x0, p.py - d.y0) < DRAG_PX) return;
    if (!d.active && selectedTileIds(c.state.selection.value, c).length > MAX_TILES_PER_OP) {
      // Grenze prüfen, bevor die teure Vorschau entsteht (Review Focus 5): gleich ablehnen
      c.notify(t.status.zuGross);
      this.drag = null;
      c.setPreview(null);
      return;
    }
    d.active = true;
    const delta = this.moveDelta(p, c, d);
    if (!delta || (delta[0] === d.delta[0] && delta[1] === d.delta[1] && delta[2] === d.delta[2])) return;
    d.delta = delta;
    d.changes = delta.every((v) => v === 0) ? [] : selectionMoveChanges(c, delta);
    const ghosts = d.changes.slice(0, MAX_GHOSTS).map((ch) => ch.after);
    const lines: number[] = [];
    for (const g of ghosts.slice(0, 2000)) quadOutline(g.corners, lines);
    c.setPreview({ ghosts, lines: new Float32Array(lines), points: new Float32Array(0) });
  }

  pointerUp(_p: ToolPointer, c: ToolContext): void {
    const d = this.drag;
    this.drag = null;
    c.setPreview(null);
    if (!d) return;
    if (d.kind === 'gizmo') {
      c.state.gizmoHandle.value = null;
      c.state.status.value = null;
      if (!d.active || d.changes.length === 0) return;
      if (d.changes.length > MAX_TILES_PER_OP) {
        c.notify(t.status.zuGross);
        return;
      }
      const sel = c.state.selection.value;
      if (d.handle.kind === 'ring') commitSelectionEdit(c, { add: [], remove: [], update: d.changes }, t.auswahl.drehen, sel);
      else commitSelectionEdit(c, { add: [], remove: [], update: d.changes }, t.auswahl.verschieben, shifted(sel, d.delta));
      return;
    }
    if (d.kind === 'rect') {
      this.finishRect(d, c);
      return;
    }
    if (!d.active || d.changes.length === 0) return;
    if (d.changes.length > MAX_TILES_PER_OP) {
      c.notify(t.status.zuGross);
      return;
    }
    commitSelectionEdit(c, { add: [], remove: [], update: d.changes }, t.auswahl.verschieben, shifted(c.state.selection.value, d.delta));
  }

  key(e: KeyboardEvent, c: ToolContext): boolean {
    const snap = c.state.snap.value;
    if (e.ctrlKey || e.metaKey) {
      const k = e.key.toLowerCase();
      if (k === 'e') return runSelectionAction('extrude', c);
      if (k === 'm') return runSelectionAction('merge', c);
      if (k === 'a') return runSelectionAction('all', c);
      return false;
    }
    switch (e.key) {
      case 'ArrowRight':
        return moveSelection(c, [snap, 0, 0]);
      case 'ArrowLeft':
        return moveSelection(c, [-snap, 0, 0]);
      case 'ArrowUp':
        return moveSelection(c, [0, 0, -snap]);
      case 'ArrowDown':
        return moveSelection(c, [0, 0, snap]);
      case 'PageUp':
        return moveSelection(c, [0, snap, 0]);
      case 'PageDown':
        return moveSelection(c, [0, -snap, 0]);
      case 'r':
      case 'R':
        return runSelectionAction(e.shiftKey ? 'rotateX' : e.altKey ? 'rotateZ' : 'rotate', c);
      case '+':
        return runSelectionAction('scaleUp', c);
      case '-':
        return runSelectionAction('scaleDown', c);
      case 'Delete':
      case 'Backspace':
        return runSelectionAction('delete', c);
      case 'Escape':
        if (this.drag) {
          // laufendes Ziehen abbrechen, Auswahl bleibt
          this.drag = null;
          c.setPreview(null);
          c.state.gizmoHandle.value = null;
          c.state.status.value = null;
          return true;
        }
        return runSelectionAction('clear', c);
    }
    const mode = MODE_KEYS[e.key];
    if (mode) {
      c.state.selectMode.value = mode;
      c.state.selection.value = convertSelection(c.state.selection.value, mode, c);
      return true;
    }
    return false;
  }

  deactivate(c: ToolContext): void {
    this.drag = null;
    c.setPreview(null);
    c.state.gizmoHandle.value = null;
  }

  /** Gizmo an der aktuellen Auswahl (null ohne Auswahl); Drehringe nur im Kachel-Modus. */
  private layout(c: ToolContext, offset?: ArrayLike<number>): GizmoLayout | null {
    const sel = c.state.selection.value;
    let center = this.center(c);
    if (center && offset) center = Float32Array.from([center[0] + offset[0], center[1] + offset[1], center[2] + offset[2]]);
    return center ? gizmoLayout(center, c.camera, c.viewportHeight(), (q, out) => c.project(q, out), sel.mode === 'tiles') : null;
  }

  /** Mitte der Auswahl, zwischengespeichert: bei vielen Kacheln dauert sie zu lange für jedes Bild. */
  private center(c: ToolContext): Float32Array | null {
    const sel = c.state.selection.value, doc = c.state.docVersion.value, snap = c.state.snap.value;
    const k = this.centerKey;
    if (!k || k.sel !== sel || k.doc !== doc || k.snap !== snap) {
      this.centerValue = selectionCenter(sel, c);
      this.centerKey = { sel, doc, snap };
    }
    return this.centerValue;
  }

  /** Beim Ziehen eines Pfeils oder Quadrats wandert das Gizmo mit. */
  gizmo(c: ToolContext): GizmoLayout | null {
    const d = this.drag;
    if (d?.kind === 'gizmo' && d.active && d.handle.kind !== 'ring') return this.layout(c, d.delta);
    if (d && d.kind !== 'gizmo') return null;
    return this.layout(c);
  }

  private gizmoMove(p: ToolPointer, c: ToolContext, d: GizmoDrag): void {
    const o = vec3.create(), dir = vec3.create();
    c.screenRay(p.ndcX, p.ndcY, o, dir);
    const snap = p.alt ? null : c.state.snap.value;
    const { kind, axis } = d.handle;
    const sel = c.state.selection.value;
    let text: string;
    if (kind === 'ring') {
      const angle = ringDragAngle(d.pivot, axis, d.o0, d.d0, o, dir, p.alt ? null : RING_SNAP);
      if (angle === d.angle && d.active) return;
      d.angle = angle;
      d.changes = angle === 0 ? [] : rotateTiles(c.world, selectedTileIds(sel, c), AXIS_NAMES[axis], angle, d.pivot);
      text = `${Math.round((angle * 180) / Math.PI)}°`;
    } else {
      let delta: [number, number, number];
      if (kind === 'axis') {
        const s = axisDragDelta(d.pivot, axis, d.o0, d.d0, o, dir, snap);
        delta = [0, 0, 0];
        delta[axis] = s;
        text = metres(s);
      } else {
        delta = planeDragDelta(d.pivot, axis, d.o0, d.d0, o, dir, snap);
        text = [0, 1, 2].filter((k) => k !== axis).map((k) => metres(delta[k])).join(' · ');
      }
      if (delta[0] === d.delta[0] && delta[1] === d.delta[1] && delta[2] === d.delta[2] && d.active) return;
      d.delta = delta;
      d.changes = delta.every((v) => v === 0) ? [] : selectionMoveChanges(c, delta);
    }
    d.active = true;
    const ghosts = d.changes.slice(0, MAX_GHOSTS).map((ch) => ch.after);
    const lines: number[] = [];
    for (const g of ghosts.slice(0, 2000)) quadOutline(g.corners, lines);
    c.setPreview({ ghosts, lines: new Float32Array(lines), points: new Float32Array(0), label: { x: p.px + 16, y: p.py - 18, text } });
    c.state.status.value = text;
  }

  private pick(mode: SelectMode, tileId: number, p: ToolPointer, c: ToolContext): Element | null {
    if (mode === 'tiles') return { kind: 'tile', id: tileId };
    if (mode === 'vertices') {
      const v = pickVertex(c, tileId, p.px, p.py);
      return v ? { kind: 'vertex', p: v } : null;
    }
    const e = pickEdge(c, tileId, p.px, p.py);
    return e ? { kind: 'edge', a: e[0], b: e[1] } : null;
  }

  /** Versatz seit dem Greifen: auf der Ebene (Shift: nur senkrecht), gerastert außer mit Alt. */
  private moveDelta(p: ToolPointer, c: ToolContext, d: MoveDrag): [number, number, number] | null {
    let delta: [number, number, number];
    if (p.shift) {
      const f = c.camera.forward(vec3.create());
      const axis = Math.abs(f[0]) > Math.abs(f[2]) ? 'x' : 'z';
      const pt = pointOnPlane(p, c, { axis, offset: d.start[axisIndex(axis)], facing: 1 });
      if (!pt) return null;
      delta = [0, pt[1] - d.start[1], 0];
    } else {
      const pt = pointOnPlane(p, c, d.plane);
      if (!pt) return null;
      delta = [pt[0] - d.start[0], pt[1] - d.start[1], pt[2] - d.start[2]];
    }
    if (!p.alt) {
      const s = c.state.snap.value;
      delta = delta.map((v) => Math.round(v / s) * s + 0) as [number, number, number];
    }
    return delta.every(Number.isFinite) ? delta : null;
  }

  private finishRect(d: RectDrag, c: ToolContext): void {
    const mode = c.state.selectMode.value;
    const current = c.state.selection.value.mode === mode ? c.state.selection.value : emptySelection(mode);
    if (Math.hypot(d.x1 - d.x0, d.y1 - d.y0) < 3) {
      if (!d.additive) c.state.selection.value = emptySelection(mode);
      return;
    }
    const vp = c.camera.viewProj(mat4.create(), c.aspect());
    const rect = [d.ndc0[0], d.ndc0[1], d.ndc1[0], d.ndc1[1]];
    const dist = c.camera.view === 'perspective' ? VIEW_DISTANCE : Infinity;
    const filter = (layer: number) => c.editable(layer);
    const found: Selection =
      mode === 'tiles'
        ? { mode, ids: new Set(tilesInRect(c.world, vp, rect, filter, c.camera.position, dist)) }
        : mode === 'vertices'
          ? { mode, positions: cornersInRect(c.world, vp, rect, filter, c.camera.position, dist) }
          : { mode, edges: edgesInRect(c.world, vp, rect, filter, c.camera.position, dist) };
    c.state.selection.value = d.additive ? union(current, found) : found;
  }

  /** Hervorhebung unter dem Zeiger: Kachel-Umriss, nächste Ecke oder Kante. */
  private hover(p: ToolPointer, c: ToolContext): void {
    const mode = c.state.selectMode.value;
    if (mode === 'tiles') {
      outlineHovered(p, c);
      return;
    }
    const hit = c.raycast(p.ndcX, p.ndcY);
    const el = hit ? this.pick(mode, hit.tileId, p, c) : null;
    if (!el) {
      c.setPreview(null);
      return;
    }
    if (el.kind === 'vertex') c.setPreview({ ghosts: [], lines: new Float32Array(0), points: new Float32Array(el.p) });
    else if (el.kind === 'edge') c.setPreview({ ghosts: [], lines: new Float32Array([...el.a, ...el.b]), points: new Float32Array(0) });
  }
}
