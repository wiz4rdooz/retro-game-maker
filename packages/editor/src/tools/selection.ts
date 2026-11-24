import {
  extrudeTiles,
  extractFrustum,
  mergeVertices,
  moveVertices,
  quadCentroid,
  rotateTiles90,
  scaleTiles,
  selectVisibleChunks,
  selectionPivot,
  translateTiles,
  vec3,
  type TileChange,
  type World,
} from '@rgm/engine';
import type { Command, DocCtx } from '../commands/command';
import { editTilesCmd, removeTilesCmd, updateTilesCmd } from '../commands/tileCommands';
import type { SelectMode } from '../state/editorState';
import { t } from '../strings/de';
import { MAX_TILES_PER_OP, type ToolContext } from './tool';

export type Selection =
  | { mode: 'tiles'; ids: Set<number> }
  | { mode: 'vertices'; positions: Float32Array[] }
  | { mode: 'edges'; edges: [Float32Array, Float32Array][] };

export type SelectionAction = 'rotate' | 'rotateX' | 'rotateZ' | 'scaleUp' | 'scaleDown' | 'extrude' | 'merge' | 'delete' | 'all' | 'clear';

const PICK_PX = 12;

export function emptySelection(mode: SelectMode = 'tiles'): Selection {
  if (mode === 'vertices') return { mode, positions: [] };
  if (mode === 'edges') return { mode, edges: [] };
  return { mode, ids: new Set() };
}

export function selectionSize(sel: Selection): number {
  return sel.mode === 'tiles' ? sel.ids.size : sel.mode === 'vertices' ? sel.positions.length : sel.edges.length;
}

/**
 * Führt cmd aus und setzt dabei die Auswahl auf after. Rückgängig stellt auch die Auswahl davor her,
 * Wiederholen die danach – Ecken und Kanten folgen so ihren Kacheln statt als Phantom stehen zu bleiben.
 */
export function execWithSelection(c: ToolContext, cmd: Command<DocCtx>, after: Selection): void {
  const before = c.state.selection.value;
  const state = c.state;
  c.exec({
    label: cmd.label,
    get bytes() {
      return cmd.bytes;
    },
    do(d) {
      cmd.do(d);
      state.selection.value = after;
    },
    undo(d) {
      cmd.undo(d);
      state.selection.value = before;
    },
  });
}

/** Größere Auswahlen werden nicht bei jeder Änderung nachgeprüft (sie filtern beim Benutzen ohnehin). */
const PRUNE_LIMIT = 20_000;

/**
 * Auswahl ohne gelöschte Kacheln bzw. ohne Ecken/Kanten, an denen keine Kachel-Ecke mehr liegt;
 * null, wenn nichts zu entfernen ist (oder die Auswahl zu groß zum Nachprüfen).
 */
export function pruneSelection(sel: Selection, world: World): Selection | null {
  const size = selectionSize(sel);
  if (size === 0 || size > PRUNE_LIMIT) return null;
  if (sel.mode === 'tiles') {
    const ids = new Set([...sel.ids].filter((id) => world.hasTile(id)));
    return ids.size === sel.ids.size ? null : { mode: 'tiles', ids };
  }
  const eps = 1e-4;
  const hasCorner = (p: ArrayLike<number>) => {
    let found = false;
    world.queryAabb([p[0] - eps, p[1] - eps, p[2] - eps], [p[0] + eps, p[1] + eps, p[2] + eps], (_id, chunk, i) => {
      if (found) return;
      for (let k = 0; k < 4; k++) {
        const o = i * 12 + k * 3;
        if (Math.abs(chunk.corners[o] - p[0]) <= eps && Math.abs(chunk.corners[o + 1] - p[1]) <= eps && Math.abs(chunk.corners[o + 2] - p[2]) <= eps) {
          found = true;
          return;
        }
      }
    });
    return found;
  };
  if (sel.mode === 'vertices') {
    const positions = sel.positions.filter(hasCorner);
    return positions.length === sel.positions.length ? null : { mode: 'vertices', positions };
  }
  const edges = sel.edges.filter(([a, b]) => hasCorner(a) && hasCorner(b));
  return edges.length === sel.edges.length ? null : { mode: 'edges', edges };
}

export const posKey = (p: ArrayLike<number>) => `${Math.round(p[0] * 1e4)},${Math.round(p[1] * 1e4)},${Math.round(p[2] * 1e4)}`;
export const edgeKey = (a: ArrayLike<number>, b: ArrayLike<number>) => {
  const ka = posKey(a), kb = posKey(b);
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
};

const screen = new Float32Array(2);

/** Nächste Ecke der Kachel innerhalb von 12 px auf dem Bildschirm. */
export function pickVertex(c: ToolContext, tileId: number, px: number, py: number): Float32Array | null {
  const tile = c.world.getTile(tileId);
  if (!tile) return null;
  let best: Float32Array | null = null;
  let bestD = PICK_PX;
  for (let k = 0; k < 4; k++) {
    const p = tile.corners.slice(k * 3, k * 3 + 3);
    if (!c.project(p, screen)) continue;
    const d = Math.hypot(screen[0] - px, screen[1] - py);
    if (d <= bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

/** Nächste Kante der Kachel innerhalb von 12 px auf dem Bildschirm. */
export function pickEdge(c: ToolContext, tileId: number, px: number, py: number): [Float32Array, Float32Array] | null {
  const tile = c.world.getTile(tileId);
  if (!tile) return null;
  let best: [Float32Array, Float32Array] | null = null;
  let bestD = PICK_PX;
  const sa = new Float32Array(2), sb = new Float32Array(2);
  for (let k = 0; k < 4; k++) {
    const a = tile.corners.slice(k * 3, k * 3 + 3);
    const b = tile.corners.slice(((k + 1) % 4) * 3, ((k + 1) % 4) * 3 + 3);
    if (posKey(a) === posKey(b) || !c.project(a, sa) || !c.project(b, sb)) continue;
    const d = segDist(px, py, sa[0], sa[1], sb[0], sb[1]);
    if (d <= bestD) {
      bestD = d;
      best = [a, b];
    }
  }
  return best;
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax, vy = by - ay;
  const len = vx * vx + vy * vy;
  const s = len > 0 ? Math.min(1, Math.max(0, ((px - ax) * vx + (py - ay) * vy) / len)) : 0;
  return Math.hypot(px - (ax + vx * s), py - (ay + vy * s));
}

/** Projiziert p mit viewProj; null hinter der Kamera. */
function ndcOf(m: ArrayLike<number>, x: number, y: number, z: number): [number, number] | null {
  const w = m[3] * x + m[7] * y + m[11] * z + m[15];
  if (!(w > 1e-6)) return null;
  return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w];
}

const inRect = (q: [number, number] | null, r: ArrayLike<number>) =>
  !!q && q[0] >= Math.min(r[0], r[2]) && q[0] <= Math.max(r[0], r[2]) && q[1] >= Math.min(r[1], r[3]) && q[1] <= Math.max(r[1], r[3]);

function* visibleTiles(world: World, viewProj: ArrayLike<number>, camPos: ArrayLike<number>, viewDistance: number) {
  const planes = extractFrustum(viewProj, new Float32Array(24));
  const bounds = [...world.chunks.values()].map((ch) => ({ key: ch.key, min: ch.min, max: ch.max }));
  for (const key of selectVisibleChunks(bounds, planes, camPos, viewDistance)) {
    const chunk = world.chunks.get(key);
    if (chunk) for (let i = 0; i < chunk.count; i++) yield { chunk, i };
  }
}

/** Kacheln, deren Schwerpunkt im NDC-Rechteck liegt (nur sichtbare Chunks). */
export function tilesInRect(
  world: World,
  viewProj: ArrayLike<number>,
  rectNdc: ArrayLike<number>,
  filter: (layer: number) => boolean,
  camPos: ArrayLike<number>,
  viewDistance: number,
): number[] {
  const out: number[] = [];
  const cen = vec3.create();
  for (const { chunk, i } of visibleTiles(world, viewProj, camPos, viewDistance)) {
    if (!filter(chunk.layer[i])) continue;
    quadCentroid(chunk.corners, cen, i * 12);
    if (inRect(ndcOf(viewProj, cen[0], cen[1], cen[2]), rectNdc)) out.push(chunk.ids[i]);
  }
  return out;
}

/** Eck-Positionen (eindeutig) im NDC-Rechteck. */
export function cornersInRect(
  world: World,
  viewProj: ArrayLike<number>,
  rectNdc: ArrayLike<number>,
  filter: (layer: number) => boolean,
  camPos: ArrayLike<number>,
  viewDistance: number,
): Float32Array[] {
  const seen = new Map<string, Float32Array>();
  for (const { chunk, i } of visibleTiles(world, viewProj, camPos, viewDistance)) {
    if (!filter(chunk.layer[i])) continue;
    for (let k = 0; k < 4; k++) {
      const o = i * 12 + k * 3;
      const c = chunk.corners;
      if (!inRect(ndcOf(viewProj, c[o], c[o + 1], c[o + 2]), rectNdc)) continue;
      const p = c.slice(o, o + 3);
      seen.set(posKey(p), p);
    }
  }
  return [...seen.values()];
}

/** Kanten, deren beide Enden im NDC-Rechteck liegen. */
export function edgesInRect(
  world: World,
  viewProj: ArrayLike<number>,
  rectNdc: ArrayLike<number>,
  filter: (layer: number) => boolean,
  camPos: ArrayLike<number>,
  viewDistance: number,
): [Float32Array, Float32Array][] {
  const seen = new Map<string, [Float32Array, Float32Array]>();
  for (const { chunk, i } of visibleTiles(world, viewProj, camPos, viewDistance)) {
    if (!filter(chunk.layer[i])) continue;
    const c = chunk.corners;
    for (let k = 0; k < 4; k++) {
      const a = c.slice(i * 12 + k * 3, i * 12 + k * 3 + 3);
      const b = c.slice(i * 12 + ((k + 1) % 4) * 3, i * 12 + ((k + 1) % 4) * 3 + 3);
      if (posKey(a) === posKey(b)) continue;
      if (inRect(ndcOf(viewProj, a[0], a[1], a[2]), rectNdc) && inRect(ndcOf(viewProj, b[0], b[1], b[2]), rectNdc)) seen.set(edgeKey(a, b), [a, b]);
    }
  }
  return [...seen.values()];
}

/** Eindeutige Eck-Positionen der Auswahl (Ecken bzw. Kanten-Enden). */
export function selectionPositions(sel: Selection): Float32Array[] {
  if (sel.mode === 'vertices') return sel.positions;
  if (sel.mode === 'edges') {
    const m = new Map<string, Float32Array>();
    for (const [a, b] of sel.edges) {
      m.set(posKey(a), a);
      m.set(posKey(b), b);
    }
    return [...m.values()];
  }
  return [];
}

/** Bearbeitbare Kacheln der Auswahl (bei Ecken/Kanten: alle, die eine ausgewählte Ecke haben). */
export function selectedTileIds(sel: Selection, c: ToolContext): number[] {
  if (sel.mode === 'tiles') {
    return [...sel.ids].filter((id) => {
      const tile = c.world.getTile(id);
      return !!tile && c.editable(tile.layer);
    });
  }
  const ids = new Set<number>();
  const eps = 1e-4;
  for (const p of selectionPositions(sel)) {
    c.world.queryAabb([p[0] - eps, p[1] - eps, p[2] - eps], [p[0] + eps, p[1] + eps, p[2] + eps], (id, chunk, i) => {
      if (!c.editable(chunk.layer[i])) return;
      for (let k = 0; k < 4; k++) {
        const o = i * 12 + k * 3;
        if (Math.abs(chunk.corners[o] - p[0]) <= eps && Math.abs(chunk.corners[o + 1] - p[1]) <= eps && Math.abs(chunk.corners[o + 2] - p[2]) <= eps) {
          ids.add(id);
          return;
        }
      }
    });
  }
  return [...ids];
}

/** Auswahl in einen anderen Modus übertragen (Kacheln → ihre Ecken/Kanten, sonst → berührte Kacheln). */
export function convertSelection(sel: Selection, mode: SelectMode, c: ToolContext): Selection {
  if (sel.mode === mode) return sel;
  if (mode === 'tiles') return { mode, ids: new Set(selectedTileIds(sel, c)) };
  const ids = sel.mode === 'tiles' ? [...sel.ids] : selectedTileIds(sel, c);
  if (mode === 'vertices') {
    const m = new Map<string, Float32Array>();
    for (const id of ids) {
      const tile = c.world.getTile(id);
      if (tile) for (let k = 0; k < 4; k++) m.set(posKey(tile.corners.subarray(k * 3, k * 3 + 3)), tile.corners.slice(k * 3, k * 3 + 3));
    }
    return { mode, positions: [...m.values()] };
  }
  const m = new Map<string, [Float32Array, Float32Array]>();
  for (const id of ids) {
    const tile = c.world.getTile(id);
    if (!tile) continue;
    for (let k = 0; k < 4; k++) {
      const a = tile.corners.slice(k * 3, k * 3 + 3);
      const b = tile.corners.slice(((k + 1) % 4) * 3, ((k + 1) % 4) * 3 + 3);
      if (posKey(a) !== posKey(b)) m.set(edgeKey(a, b), [a, b]);
    }
  }
  return { mode, edges: [...m.values()] };
}

function tooBig(n: number, c: ToolContext): boolean {
  if (n <= MAX_TILES_PER_OP) return false;
  c.notify(t.status.zuGross);
  return true;
}

/** Bewegt die Auswahl um delta (ein Undo-Schritt); Ecken/Kanten wandern in der Auswahl mit. */
export function selectionMoveChanges(c: ToolContext, delta: ArrayLike<number>): TileChange[] {
  const sel = c.state.selection.value;
  if (sel.mode === 'tiles') return translateTiles(c.world, selectedTileIds(sel, c), delta);
  return moveVertices(c.world, selectionPositions(sel), delta, c.editable);
}

export function moveSelection(c: ToolContext, delta: ArrayLike<number>): boolean {
  const sel = c.state.selection.value;
  if (selectionSize(sel) === 0) return false;
  const changes = selectionMoveChanges(c, delta);
  if (tooBig(changes.length, c)) return true;
  if (changes.length > 0) execWithSelection(c, updateTilesCmd(changes, t.auswahl.verschieben), shifted(sel, delta));
  return true;
}

/** Auswahl mit verschobenen Ecken/Kanten (Kachel-ids bleiben). */
export function shifted(sel: Selection, d: ArrayLike<number>): Selection {
  const mv = (p: Float32Array) => new Float32Array([p[0] + d[0], p[1] + d[1], p[2] + d[2]]);
  if (sel.mode === 'vertices') return { mode: 'vertices', positions: sel.positions.map(mv) };
  if (sel.mode === 'edges') return { mode: 'edges', edges: sel.edges.map(([a, b]) => [mv(a), mv(b)] as [Float32Array, Float32Array]) };
  return sel;
}

/** Aktionen der Auswahl (Tasten und Knöpfe); true = verarbeitet. */
export function runSelectionAction(action: SelectionAction, c: ToolContext): boolean {
  const sel = c.state.selection.value;
  const snap = c.state.snap.value;
  switch (action) {
    case 'clear':
      c.state.selection.value = emptySelection(c.state.selectMode.value);
      return true;
    case 'all': {
      const ids = new Set<number>();
      for (const chunk of c.world.chunks.values()) for (let i = 0; i < chunk.count; i++) if (c.editable(chunk.layer[i])) ids.add(chunk.ids[i]);
      c.state.selectMode.value = 'tiles';
      c.state.selection.value = { mode: 'tiles', ids };
      return true;
    }
    case 'delete': {
      const ids = selectedTileIds(sel, c);
      if (ids.length === 0 || tooBig(ids.length, c)) return true;
      execWithSelection(c, removeTilesCmd(ids, t.auswahl.loeschen), emptySelection(sel.mode));
      return true;
    }
    case 'rotate':
    case 'rotateX':
    case 'rotateZ':
    case 'scaleUp':
    case 'scaleDown': {
      if (selectionSize(sel) === 0) return true;
      if (sel.mode !== 'tiles') {
        c.notify(t.auswahl.nurKacheln);
        return true;
      }
      const ids = selectedTileIds(sel, c);
      if (tooBig(ids.length, c)) return true;
      const pivot = selectionPivot(c.world, ids, snap);
      const changes =
        action === 'scaleUp' || action === 'scaleDown'
          ? scaleTiles(c.world, ids, action === 'scaleUp' ? 2 : 0.5, pivot)
          : rotateTiles90(c.world, ids, action === 'rotate' ? 'y' : action === 'rotateX' ? 'x' : 'z', 1, pivot);
      if (changes.length > 0) execWithSelection(c, updateTilesCmd(changes, action.startsWith('scale') ? t.auswahl.mal2 : t.auswahl.drehen), sel);
      return true;
    }
    case 'extrude': {
      if (selectionSize(sel) === 0) return true;
      if (sel.mode !== 'tiles') {
        c.notify(t.auswahl.nurKacheln);
        return true;
      }
      const ids = selectedTileIds(sel, c);
      if (tooBig(ids.length * 5, c)) return true;
      const { update, add } = extrudeTiles(c.world, ids, snap);
      if (update.length > 0 || add.length > 0) execWithSelection(c, editTilesCmd({ add, remove: [], update }, t.auswahl.extrudieren), sel);
      return true;
    }
    case 'merge': {
      if (sel.mode !== 'vertices') {
        if (selectionSize(sel) > 0) c.notify(t.auswahl.nurEcken);
        return true;
      }
      if (sel.positions.length < 2) return true;
      const mid = [0, 1, 2].map((a) => Math.round(sel.positions.reduce((s, p) => s + p[a], 0) / sel.positions.length / snap) * snap);
      const changes = mergeVertices(c.world, sel.positions, mid, c.editable);
      if (tooBig(changes.length, c)) return true;
      if (changes.length > 0) execWithSelection(c, updateTilesCmd(changes, t.auswahl.zusammenfuehren), { mode: 'vertices', positions: [new Float32Array(mid)] });
      return true;
    }
  }
}
