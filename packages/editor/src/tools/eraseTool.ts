import { axisIndex, planeToWorld, quadCentroid, vec3, worldToPlane, type DrawPlane } from '@rgm/engine';
import { removeTilesCmd } from '../commands/tileCommands';
import { t } from '../strings/de';
import { cellAt } from './drawPlane';
import { outlineHovered } from './eyedropperTool';
import { rectCells, rectQuad } from './paintTool';
import type { ToolId } from './registry';
import {
  MAX_TILES_PER_OP,
  pointOnPlane,
  pointerTarget,
  quadOutline,
  type Tool,
  type ToolContext,
  type ToolPointer,
} from './tool';

type Cell = [number, number];

/**
 * Radieren: Klick oder Ziehen entfernt getroffene, bearbeitbare Kacheln (ein Undo-Schritt je
 * Strich). Shift + Ziehen entfernt alle bearbeitbaren Kacheln, deren Schwerpunkt im Rechteck auf
 * der Zeichenebene liegt (Abstand zur Ebene < 0,01; höchstens 65.536).
 */
export class EraseTool implements Tool {
  readonly id: ToolId = 'erase';
  private stroke: { done: Set<number>; warned: boolean } | null = null;
  private rect: { plane: DrawPlane; start: Cell; end: Cell } | null = null;

  pointerDown(p: ToolPointer, c: ToolContext): void {
    if (p.button !== 0 || this.stroke || this.rect) return;
    if (p.shift) {
      const tgt = pointerTarget(p, c);
      if (!tgt.point) return;
      const cell = cellAt(tgt.plane, tgt.point, c.state.snap.value, false);
      this.rect = { plane: tgt.plane, start: cell, end: cell };
      this.previewRect(c);
      return;
    }
    c.history.begin(t.werkzeug.erase);
    this.stroke = { done: new Set(), warned: false };
    this.eraseAt(p, c);
  }

  pointerMove(p: ToolPointer, c: ToolContext): void {
    if (this.rect) {
      const pt = pointOnPlane(p, c, this.rect.plane);
      if (pt) {
        this.rect.end = cellAt(this.rect.plane, pt, c.state.snap.value, false);
        this.previewRect(c);
      }
      return;
    }
    if (this.stroke) this.eraseAt(p, c);
    outlineHovered(p, c);
  }

  pointerUp(_p: ToolPointer, c: ToolContext): void {
    if (this.rect) {
      this.eraseRect(c);
      this.rect = null;
      c.setPreview(null);
    }
    if (this.stroke) {
      this.stroke = null;
      c.history.end();
    }
  }

  key(): boolean {
    return false;
  }

  deactivate(c: ToolContext): void {
    if (this.stroke) c.history.end();
    this.stroke = null;
    this.rect = null;
    c.setPreview(null);
  }

  private eraseAt(p: ToolPointer, c: ToolContext): void {
    const s = this.stroke!;
    const hit = c.raycast(p.ndcX, p.ndcY);
    if (!hit || s.done.has(hit.tileId)) return;
    const tile = c.world.getTile(hit.tileId);
    if (!tile) return;
    s.done.add(hit.tileId);
    if (!c.editable(tile.layer)) {
      if (!s.warned) c.notify(t.status.ebeneGesperrt);
      s.warned = true;
      return;
    }
    c.exec(removeTilesCmd([hit.tileId], t.werkzeug.erase));
  }

  private eraseRect(c: ToolContext): void {
    const r = this.rect!;
    const snap = c.state.snap.value;
    const { u0, v0, nu, nv } = rectCells(r.start, r.end, snap);
    const u1 = u0 + nu * snap, v1 = v0 + nv * snap;
    const a = planeToWorld(r.plane, u0, v0);
    const b = planeToWorld(r.plane, u1, v1);
    const min = [0, 1, 2].map((i) => Math.min(a[i], b[i]) - 0.02);
    const max = [0, 1, 2].map((i) => Math.max(a[i], b[i]) + 0.02);
    const axis = axisIndex(r.plane.axis);
    const centroid = vec3.create();
    const ids: number[] = [];
    let tooMany = false;
    c.world.queryAabb(min, max, (id, chunk, i) => {
      if (tooMany || !c.editable(chunk.layer[i])) return;
      quadCentroid(chunk.corners, centroid, i * 12);
      if (Math.abs(centroid[axis] - r.plane.offset) >= 0.01) return;
      const [u, v] = worldToPlane(r.plane, centroid);
      if (u < u0 || u > u1 || v < v0 || v > v1) return;
      ids.push(id);
      if (ids.length > MAX_TILES_PER_OP) tooMany = true;
    });
    if (tooMany) {
      c.notify(t.status.zuGross);
      return;
    }
    if (ids.length > 0) c.exec(removeTilesCmd(ids, t.werkzeug.erase));
  }

  private previewRect(c: ToolContext): void {
    const r = this.rect!;
    const snap = c.state.snap.value;
    const { u0, v0, nu, nv } = rectCells(r.start, r.end, snap);
    const lines: number[] = [];
    quadOutline(rectQuad(r.plane, u0, v0, nu * snap, nv * snap), lines);
    c.setPreview({ ghosts: [], lines: new Float32Array(lines), points: new Float32Array(0) });
  }
}
