import { BlockFace, axisIndex, blockQuads, type DrawPlane, type TileData } from '@rgm/engine';
import { editTilesCmd, type TileChange } from '../commands/tileCommands';
import { t } from '../strings/de';
import { brushTile, type BrushState } from './brush';
import { pickBrush } from './eyedropperTool';
import { brushKey } from './paintTool';
import type { ToolId } from './registry';
import { pointOnPlane, pointerTarget, quadOutline, type Tool, type ToolContext, type ToolPointer } from './tool';

/** Höchstzahl Blöcke pro Aktion. */
export const MAX_BLOCKS = 4_096;

type V3 = [number, number, number];

/** Zielblock und die beiden Achsen der Fläche, auf der Blöcke nebeneinander liegen. */
interface BlockTarget {
  cell: V3;
  /** Normalen-Achse (0/1/2) und die zwei Flächen-Achsen (K2: y → x,z; z → x,y; x → z,y). */
  axis: number;
  uAxis: number;
  vAxis: number;
}

const AXES = ['x', 'y', 'z'] as const;
const UV: Record<number, [number, number]> = { 0: [2, 1], 1: [0, 2], 2: [0, 1] };

/**
 * Zielzelle: bei Treffer floor(Trefferpunkt + Normale·0,5) je Achse, sonst auf der Zeichenebene
 * direkt vor ihr (facing +1 → Zelle ab offset, facing −1 → Zelle bis offset).
 */
export function blockTarget(p: ToolPointer, c: ToolContext): BlockTarget | null {
  const tgt = pointerTarget(p, c);
  if (tgt.hit) {
    const h = tgt.hit;
    const cell: V3 = [0, 1, 2].map((a) => Math.floor(h.point[a] + h.normal[a] * 0.5)) as V3;
    if (!cell.every(Number.isFinite)) return null;
    let axis = 0;
    for (let a = 1; a < 3; a++) if (Math.abs(h.normal[a]) > Math.abs(h.normal[axis])) axis = a;
    return { cell, axis, uAxis: UV[axis][0], vAxis: UV[axis][1] };
  }
  return planeTarget(tgt.plane, tgt.point);
}

function planeTarget(plane: DrawPlane, point: ArrayLike<number> | null): BlockTarget | null {
  if (!point) return null;
  const axis = axisIndex(plane.axis);
  const cell: V3 = [Math.floor(point[0]), Math.floor(point[1]), Math.floor(point[2])];
  cell[axis] = plane.facing === 1 ? Math.floor(plane.offset + 1e-9) : Math.ceil(plane.offset - 1e-9) - 1;
  if (!cell.every(Number.isFinite)) return null;
  return { cell, axis, uAxis: UV[axis][0], vAxis: UV[axis][1] };
}

/** Blöcke von a bis b (beide eingeschlossen) auf der Fläche von a. */
function blockArea(a: BlockTarget, b: V3): V3[] {
  const out: V3[] = [];
  const u0 = Math.min(a.cell[a.uAxis], b[a.uAxis]), u1 = Math.max(a.cell[a.uAxis], b[a.uAxis]);
  const v0 = Math.min(a.cell[a.vAxis], b[a.vAxis]), v1 = Math.max(a.cell[a.vAxis], b[a.vAxis]);
  if ((u1 - u0 + 1) * (v1 - v0 + 1) > MAX_BLOCKS) return [];
  for (let v = v0; v <= v1; v++) {
    for (let u = u0; u <= u1; u++) {
      const cell: V3 = [a.cell[0], a.cell[1], a.cell[2]];
      cell[a.uAxis] = u;
      cell[a.vAxis] = v;
      out.push(cell);
    }
  }
  return out;
}

function areaCount(a: BlockTarget, b: V3): number {
  return (Math.abs(b[a.uAxis] - a.cell[a.uAxis]) + 1) * (Math.abs(b[a.vAxis] - a.cell[a.vAxis]) + 1);
}

/**
 * Block setzen: je Blockfläche wird eine deckungsgleiche Kachel mit Gegenrichtung (bearbeitbar)
 * samt Fläche entfernt (verdeckte Innenfläche), eine mit gleicher Richtung umgemalt, sonst eine
 * neue angelegt. Deckel = brush.topTile ?? (tx, ty). Mehrere Blöcke = ein Undo-Schritt.
 */
export class BlockTool implements Tool {
  readonly id: ToolId = 'block';
  private rect: { start: BlockTarget; end: V3 } | null = null;

  pointerDown(p: ToolPointer, c: ToolContext): void {
    if (p.button === 2) {
      pickBrush(p, c);
      return;
    }
    if (this.rect) return;
    if (!c.editable(c.state.activeLayer.value)) {
      c.notify(t.status.ebeneGesperrt);
      return;
    }
    const target = blockTarget(p, c);
    if (!target) return;
    if (p.shift) {
      this.rect = { start: target, end: target.cell };
      this.preview(c, blockArea(target, target.cell));
      return;
    }
    this.place(c, this.sizeArea(target, c.state.brush.value.size));
  }

  pointerMove(p: ToolPointer, c: ToolContext): void {
    if (this.rect) {
      const s = this.rect.start;
      const plane: DrawPlane = { axis: AXES[s.axis], offset: s.cell[s.axis] + 0.5, facing: 1 };
      const pt = pointOnPlane(p, c, plane);
      if (pt) {
        const end: V3 = [Math.floor(pt[0]), Math.floor(pt[1]), Math.floor(pt[2])];
        end[s.axis] = s.cell[s.axis];
        this.rect.end = end;
      }
      const n = areaCount(s, this.rect.end);
      this.preview(c, n <= MAX_BLOCKS ? blockArea(s, this.rect.end) : [], n > MAX_BLOCKS ? [s.cell, this.rect.end] : null);
      return;
    }
    const target = blockTarget(p, c);
    this.preview(c, target ? this.sizeArea(target, c.state.brush.value.size) : []);
  }

  pointerUp(_p: ToolPointer, c: ToolContext): void {
    if (!this.rect) return;
    const { start, end } = this.rect;
    this.rect = null;
    if (areaCount(start, end) > MAX_BLOCKS) {
      c.notify(t.status.zuVieleBloecke);
      c.setPreview(null);
      return;
    }
    this.place(c, blockArea(start, end));
  }

  key(e: KeyboardEvent, c: ToolContext): boolean {
    return brushKey(e, c);
  }

  deactivate(c: ToolContext): void {
    this.rect = null;
    c.setPreview(null);
  }

  private sizeArea(target: BlockTarget, size: number): V3[] {
    const end: V3 = [target.cell[0], target.cell[1], target.cell[2]];
    end[target.uAxis] += Math.max(1, size) - 1;
    end[target.vAxis] += Math.max(1, size) - 1;
    return blockArea(target, end);
  }

  /** Setzt die Blöcke nacheinander (je ein editTilesCmd) als einen Undo-Schritt. */
  private place(c: ToolContext, cells: V3[]): void {
    if (cells.length === 0) return;
    const brush = c.state.brush.value;
    const layer = c.state.activeLayer.value;
    c.history.begin(t.werkzeug.block);
    try {
      for (const cell of cells) {
        const add: TileData[] = [];
        const remove: number[] = [];
        const update: TileChange[] = [];
        const quads = blockQuads(cell[0], cell[1], cell[2], 1);
        quads.forEach((corners, face) => {
          const look = face === BlockFace.Top && brush.topTile ? brush.topTile : { tx: brush.tx, ty: brush.ty };
          const opposite = c.world.findCoincident(corners, 'opposite');
          if (opposite !== null && c.editable(c.world.getTile(opposite)!.layer)) {
            remove.push(opposite);
            return;
          }
          const same = c.world.findCoincident(corners, 'same');
          const before = same !== null ? c.world.getTile(same) : null;
          if (before && c.editable(before.layer)) {
            update.push({ id: same!, before, after: brushTile(brush, look, before.corners, before.layer) });
            return;
          }
          add.push(brushTile(brush, look, corners, layer));
        });
        c.exec(editTilesCmd({ add, remove, update }, t.werkzeug.block));
      }
    } finally {
      c.history.end();
    }
    c.setPreview(null);
  }

  /** Geister der Blöcke (bis 64 Blöcke), sonst nur der Umriss der Fläche. */
  private preview(c: ToolContext, cells: V3[], outline: [V3, V3] | null = null): void {
    const brush: BrushState = c.state.brush.value;
    const ghosts: TileData[] = [];
    const lines: number[] = [];
    if (cells.length <= 64) {
      for (const cell of cells) {
        blockQuads(cell[0], cell[1], cell[2], 1).forEach((corners, face) => {
          const look = face === BlockFace.Top && brush.topTile ? brush.topTile : { tx: brush.tx, ty: brush.ty };
          ghosts.push(brushTile(brush, look, corners, 0));
        });
      }
    } else if (cells.length > 0) {
      outline = [cells[0], cells[cells.length - 1]];
    }
    if (outline) {
      const [a, b] = outline;
      const lo = [0, 1, 2].map((i) => Math.min(a[i], b[i]));
      const hi = [0, 1, 2].map((i) => Math.max(a[i], b[i]) + 1);
      const top = new Float32Array([lo[0], hi[1], hi[2], hi[0], hi[1], hi[2], hi[0], hi[1], lo[2], lo[0], hi[1], lo[2]]);
      quadOutline(top, lines);
    }
    c.setPreview(cells.length === 0 && !outline ? null : { ghosts, lines: new Float32Array(lines), points: new Float32Array(0) });
  }
}
