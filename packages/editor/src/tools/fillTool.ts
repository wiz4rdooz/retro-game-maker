import { floodCoplanar, quadNormal, vec3, worldToPlane, type DrawPlane, type TileData } from '@rgm/engine';
import { updateTilesCmd, type TileChange } from '../commands/tileCommands';
import { t } from '../strings/de';
import { brushTile, stampCells } from './brush';
import { outlineHovered, pickBrush } from './eyedropperTool';
import { PaintTool, brushKey } from './paintTool';
import type { ToolId } from './registry';
import { MAX_TILES_PER_OP, type Tool, type ToolContext, type ToolPointer } from './tool';

const mod = (a: number, n: number) => ((a % n) + n) % n;

/** Achsen-Ebene, die einer Normalen am nächsten liegt (für Ebenen-Koordinaten schräger Flächen). */
function dominantPlane(n: ArrayLike<number>): DrawPlane {
  let a = 0;
  for (let i = 1; i < 3; i++) if (Math.abs(n[i]) > Math.abs(n[a])) a = i;
  return { axis: (['x', 'y', 'z'] as const)[a], offset: 0, facing: n[a] >= 0 ? 1 : -1 };
}

/**
 * Füllen: Klick auf eine bearbeitbare Kachel malt alle zusammenhängenden, gleich aussehenden
 * Kacheln derselben Ebene um (höchstens 65.536). Mehrteilige Pinsel: jede Kachel nimmt die
 * Musterzelle (floor(u0) mod W', floor(v0) mod H'). Ziehen auf freier Fläche = Rechteck wie beim Malen.
 */
export class FillTool implements Tool {
  readonly id: ToolId = 'fill';
  private readonly painter = new PaintTool();
  private painting = false;

  pointerDown(p: ToolPointer, c: ToolContext): void {
    if (p.button === 2) {
      pickBrush(p, c);
      return;
    }
    const hit = c.raycast(p.ndcX, p.ndcY);
    if (!hit) {
      // freie Fläche: Rechteck wie bei „Kachel malen“
      this.painting = true;
      this.painter.pointerDown({ ...p, shift: true }, c);
      return;
    }
    const start = c.world.getTile(hit.tileId);
    if (!start) return;
    if (!c.editable(start.layer)) {
      c.notify(t.status.ebeneGesperrt);
      return;
    }
    const same = (tile: TileData) =>
      tile.tileset === start.tileset && tile.tx === start.tx && tile.ty === start.ty && c.editable(tile.layer);
    const { ids, capped } = floodCoplanar(c.world, hit.tileId, (_id, tile) => same(tile), MAX_TILES_PER_OP);
    if (capped) {
      c.notify(t.status.zuGross);
      return;
    }
    const brush = c.state.brush.value;
    const plane = dominantPlane(quadNormal(start.corners, vec3.create()));
    const pattern = stampCells({ ...brush, size: 1 }, plane);
    const W = Math.max(...pattern.map((x) => x.du)) + 1;
    const H = Math.max(...pattern.map((x) => x.dv)) + 1;
    const byPos = new Map(pattern.map((x) => [`${x.du},${x.dv}`, x]));
    const changes: TileChange[] = [];
    const corner = new Float32Array(3);
    for (const id of ids) {
      const before = c.world.getTile(id)!;
      let u0 = Infinity, v0 = Infinity;
      for (let k = 0; k < 4; k++) {
        corner.set(before.corners.subarray(k * 3, k * 3 + 3));
        const [u, v] = worldToPlane(plane, corner);
        u0 = Math.min(u0, u);
        v0 = Math.min(v0, v);
      }
      const cell = byPos.get(`${mod(Math.floor(u0 + 1e-6), W)},${mod(Math.floor(v0 + 1e-6), H)}`) ?? pattern[0];
      const after = brushTile(brush, cell, before.corners, before.layer);
      changes.push({ id, before, after });
    }
    if (changes.length > 0) c.exec(updateTilesCmd(changes, t.werkzeug.fill));
  }

  pointerMove(p: ToolPointer, c: ToolContext): void {
    if (this.painting) {
      this.painter.pointerMove(p, c);
      return;
    }
    outlineHovered(p, c);
  }

  pointerUp(p: ToolPointer, c: ToolContext): void {
    if (!this.painting) return;
    this.painting = false;
    this.painter.pointerUp(p, c);
  }

  key(e: KeyboardEvent, c: ToolContext): boolean {
    return brushKey(e, c);
  }

  deactivate(c: ToolContext): void {
    this.painting = false;
    this.painter.deactivate(c);
  }
}
