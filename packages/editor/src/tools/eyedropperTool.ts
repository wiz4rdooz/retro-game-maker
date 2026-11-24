import type { ToolId } from './registry';
import { quadOutline, type Tool, type ToolContext, type ToolPointer } from './tool';

/** Übernimmt Kachel, Drehung und Spiegelung der getroffenen Kachel in den Pinsel; true bei Treffer. */
export function pickBrush(p: ToolPointer, c: ToolContext): boolean {
  const hit = c.raycast(p.ndcX, p.ndcY);
  const tile = hit ? c.world.getTile(hit.tileId) : null;
  if (!tile) return false;
  c.state.brush.value = {
    ...c.state.brush.value,
    tileset: tile.tileset,
    tx: tile.tx,
    ty: tile.ty,
    w: 1,
    h: 1,
    rot: tile.rot,
    flipX: tile.flipX,
    flipY: tile.flipY,
  };
  return true;
}

/** Umriss der Kachel unter dem Zeiger als Vorschau. */
export function outlineHovered(p: ToolPointer, c: ToolContext): void {
  const hit = c.raycast(p.ndcX, p.ndcY);
  const tile = hit ? c.world.getTile(hit.tileId) : null;
  if (!tile) {
    c.setPreview(null);
    return;
  }
  const lines: number[] = [];
  quadOutline(tile.corners, lines);
  c.setPreview({ ghosts: [], lines: new Float32Array(lines), points: new Float32Array(0) });
}

/** Pipette: Klick nimmt Kachel, Drehung und Spiegelung auf. */
export class EyedropperTool implements Tool {
  readonly id: ToolId = 'eyedropper';

  pointerDown(p: ToolPointer, c: ToolContext): void {
    pickBrush(p, c);
  }

  pointerMove(p: ToolPointer, c: ToolContext): void {
    outlineHovered(p, c);
  }

  pointerUp(): void {}

  key(): boolean {
    return false;
  }

  deactivate(c: ToolContext): void {
    c.setPreview(null);
  }
}
