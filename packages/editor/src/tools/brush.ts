import type { DrawPlane, TileData } from '@rgm/engine';

/** Was der Pinsel gerade setzt. tileset −1 = eingebaute Prüftextur. */
export interface BrushState {
  tileset: number;
  tx: number;
  ty: number;
  /** Ausschnitt in Kacheln (Rechteck aus dem Tileset). */
  w: number;
  h: number;
  rot: 0 | 1 | 2 | 3;
  flipX: boolean;
  flipY: boolean;
  size: 1 | 2 | 3;
  doubleSided: boolean;
  ghost: boolean;
  /** Deckel-Kachel für Blöcke; null = wie die Seiten. */
  topTile: { tx: number; ty: number } | null;
}

export const DEFAULT_BRUSH: Readonly<BrushState> = Object.freeze({
  tileset: -1,
  tx: 0,
  ty: 0,
  w: 1,
  h: 1,
  rot: 0,
  flipX: false,
  flipY: false,
  size: 1,
  doubleSided: false,
  ghost: false,
  topTile: null,
});

/** Eine Zelle eines Stempels: Versatz auf der Ebene (in Zellen) und Kachel im Tileset. */
export interface StampCell {
  du: number;
  dv: number;
  tx: number;
  ty: number;
}

/**
 * Zellen eines Pinselabdrucks. Das Muster w×h (i rechts, j unten im Tileset) wird erst gespiegelt
 * (flipX/flipY), dann rot-mal im Uhrzeigersinn gedreht ((i, j) → (h−1−j, i), Maße tauschen),
 * nach K2 auf (du, dv) abgebildet und size × size-mal wiederholt.
 */
export function stampCells(brush: BrushState, plane: DrawPlane): StampCell[] {
  const w0 = Math.max(1, Math.floor(brush.w));
  const h0 = Math.max(1, Math.floor(brush.h));
  let cells: { i: number; j: number; tx: number; ty: number }[] = [];
  for (let j = 0; j < h0; j++) {
    for (let i = 0; i < w0; i++) {
      cells.push({
        i: brush.flipX ? w0 - 1 - i : i,
        j: brush.flipY ? h0 - 1 - j : j,
        tx: brush.tx + i,
        ty: brush.ty + j,
      });
    }
  }
  let w = w0, h = h0;
  for (let r = 0; r < (brush.rot & 3); r++) {
    const hh = h;
    cells = cells.map((c) => ({ ...c, i: hh - 1 - c.j, j: c.i }));
    [w, h] = [h, w];
  }
  const mirrorU = (plane.axis === 'z' && plane.facing === -1) || (plane.axis === 'x' && plane.facing === 1);
  const downIsV = plane.axis === 'y' && plane.facing === 1;
  const base = cells.map((c) => ({
    du: mirrorU ? w - 1 - c.i : c.i,
    dv: downIsV ? c.j : h - 1 - c.j,
    tx: c.tx,
    ty: c.ty,
  }));
  const size = Math.max(1, Math.floor(brush.size));
  if (size === 1) return base;
  const out: StampCell[] = [];
  for (let sy = 0; sy < size; sy++) {
    for (let sx = 0; sx < size; sx++) {
      for (const c of base) out.push({ du: c.du + sx * w, dv: c.dv + sy * h, tx: c.tx, ty: c.ty });
    }
  }
  return out;
}

/** Kachel aus Pinsel und Stempelzelle (übernimmt rot/flip/doubleSided/ghost). */
export function brushTile(brush: BrushState, cell: Pick<StampCell, 'tx' | 'ty'>, corners: Float32Array, layer: number): TileData {
  return {
    layer,
    tileset: brush.tileset,
    tx: cell.tx,
    ty: cell.ty,
    rot: brush.rot,
    flipX: brush.flipX,
    flipY: brush.flipY,
    doubleSided: brush.doubleSided,
    ghost: brush.ghost,
    corners,
  };
}
