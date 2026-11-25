import type { Camera } from '@rgm/engine';
import { GIZMO_COLORS, GIZMO_HOVER, type GizmoHandle, type GizmoLayout, type Rgba } from '../tools/gizmo';

/** Dreiecke einer Farbe. */
export interface GizmoBatch {
  tris: Float32Array;
  rgba: Rgba;
}

const SHAFT_HALF_PX = 1.5;
const HEAD_LEN_PX = 16;
const HEAD_HALF_PX = 6;
const RING_HALF_PX = 1.25;
const HOVER_EXTRA_PX = 1;
const SQUARE_ALPHA = 0.45;

const same = (h: GizmoHandle | null, kind: GizmoHandle['kind'], axis: number) => h !== null && h.kind === kind && h.axis === axis;

/**
 * Pfeile, Quadrate und Ringe als Dreiecke in Weltkoordinaten: Schäfte und Ringe sind zur Kamera
 * gedrehte Bänder mit fester Breite in Pixeln. Reihenfolge: Ringe, Quadrate, Pfeile (oben).
 */
export function gizmoTriangles(l: GizmoLayout, camera: Camera, hovered: GizmoHandle | null): GizmoBatch[] {
  const wpp = l.worldPerPx;
  const forward = camera.forward(new Float32Array(3));
  const toCam = (x: number, y: number, z: number): [number, number, number] => {
    if (camera.view !== 'perspective') return [-forward[0], -forward[1], -forward[2]];
    const d = [camera.position[0] - x, camera.position[1] - y, camera.position[2] - z];
    const n = Math.hypot(d[0], d[1], d[2]) || 1;
    return [d[0] / n, d[1] / n, d[2] / n];
  };
  /** Band von a nach b mit halber Breite hw (Welt); false, wenn es genau zur Kamera zeigt. */
  const band = (out: number[], a: ArrayLike<number>, b: ArrayLike<number>, hw: number): boolean => {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const c = toCam((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    let sx = dy * c[2] - dz * c[1], sy = dz * c[0] - dx * c[2], sz = dx * c[1] - dy * c[0];
    const sl = Math.hypot(sx, sy, sz);
    if (!(sl > 1e-9)) return false;
    sx = (sx / sl) * hw;
    sy = (sy / sl) * hw;
    sz = (sz / sl) * hw;
    out.push(
      a[0] - sx, a[1] - sy, a[2] - sz, a[0] + sx, a[1] + sy, a[2] + sz, b[0] + sx, b[1] + sy, b[2] + sz,
      a[0] - sx, a[1] - sy, a[2] - sz, b[0] + sx, b[1] + sy, b[2] + sz, b[0] - sx, b[1] - sy, b[2] - sz,
    );
    return true;
  };
  const batches: GizmoBatch[] = [];
  const color = (kind: GizmoHandle['kind'], axis: number, alpha = 1): Rgba => {
    const c = same(hovered, kind, axis) ? GIZMO_HOVER : GIZMO_COLORS[axis];
    return [c[0], c[1], c[2], alpha];
  };

  l.rings.forEach((r, axis) => {
    if (!r.visible) return;
    const hw = (RING_HALF_PX + (same(hovered, 'ring', axis) ? HOVER_EXTRA_PX : 0)) * wpp;
    const out: number[] = [];
    const n = r.points.length / 3;
    for (let k = 0; k < n; k++) band(out, r.points.subarray(k * 3, k * 3 + 3), r.points.subarray(((k + 1) % n) * 3, ((k + 1) % n) * 3 + 3), hw);
    batches.push({ tris: new Float32Array(out), rgba: color('ring', axis) });
  });

  l.planes.forEach((pl, axis) => {
    if (!pl.visible) return;
    const c = pl.corners;
    const out: number[] = [];
    for (const k of [0, 1, 2, 0, 2, 3]) out.push(c[k * 3], c[k * 3 + 1], c[k * 3 + 2]);
    batches.push({ tris: new Float32Array(out), rgba: color('plane', axis, same(hovered, 'plane', axis) ? 0.7 : SQUARE_ALPHA) });
  });

  l.axes.forEach((a, axis) => {
    if (!a.visible) return;
    const p = l.pivot, tip = a.tip;
    const len = Math.hypot(tip[0] - p[0], tip[1] - p[1], tip[2] - p[2]);
    if (!(len > 0)) return;
    const e = [(tip[0] - p[0]) / len, (tip[1] - p[1]) / len, (tip[2] - p[2]) / len];
    const head = Math.min(len, HEAD_LEN_PX * wpp);
    const base = [tip[0] - e[0] * head, tip[1] - e[1] * head, tip[2] - e[2] * head];
    const hover = same(hovered, 'axis', axis) ? HOVER_EXTRA_PX : 0;
    const out: number[] = [];
    if (!band(out, p, base, (SHAFT_HALF_PX + hover) * wpp)) return;
    // Spitze: Dreieck quer zur Blickrichtung
    const side: number[] = [];
    band(side, base, tip, (HEAD_HALF_PX + hover) * wpp);
    // side[0..2] = base − s, side[3..5] = base + s
    out.push(side[0], side[1], side[2], side[3], side[4], side[5], tip[0], tip[1], tip[2]);
    batches.push({ tris: new Float32Array(out), rgba: color('axis', axis) });
  });
  return batches;
}
