export interface TilesetInfo {
  id: number;
  tileSize: number;
  imageWidth: number;
  imageHeight: number;
}

/** u nach rechts, v nach unten innerhalb einer Kachel; Ecke c0 = unten links (Konvention K3). */
const BASE = [0, 1, 1, 1, 1, 0, 0, 0];
const INSET_PX = 0.01;

/**
 * Texturkoordinaten der vier Ecken (u0, v0, …, u3, v3) für Kachel (tx, ty).
 * rot = k bedeutet k × 90° im Uhrzeigersinn; danach wird gespiegelt.
 */
export function tileUVs(
  tx: number,
  ty: number,
  rot: 0 | 1 | 2 | 3,
  flipX: boolean,
  flipY: boolean,
  ts: TilesetInfo,
  out: Float32Array,
): Float32Array {
  const s = ts.tileSize;
  const lo = INSET_PX;
  const hi = s - INSET_PX;
  for (let i = 0; i < 4; i++) {
    const j = ((i + rot) & 3) * 2;
    let u = BASE[j];
    let v = BASE[j + 1];
    if (flipX) u = 1 - u;
    if (flipY) v = 1 - v;
    const pu = Math.min(hi, Math.max(lo, u * s));
    const pv = Math.min(hi, Math.max(lo, v * s));
    out[i * 2] = (tx * s + pu) / ts.imageWidth;
    out[i * 2 + 1] = (ty * s + pv) / ts.imageHeight;
  }
  return out;
}
