import type { Camera } from '@rgm/engine';

/** Griff des Gizmos; bei 'plane' ist axis die Normalen-Achse des Quadrats. */
export interface GizmoHandle {
  kind: 'axis' | 'plane' | 'ring';
  axis: 0 | 1 | 2;
}

export type Rgba = [number, number, number, number];

const hex = (h: number, a = 1): Rgba => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255, a];
/** X rot, Y grün, Z blau (wie in Unity). */
export const GIZMO_COLORS: readonly [Rgba, Rgba, Rgba] = [hex(0xe24b4a), hex(0x63b32e), hex(0x378add)];
export const GIZMO_HOVER: Rgba = hex(0xf2c94c);

export const ARROW_PX = 90;
export const HIT_PX = 8;
const SQUARE_PX = 22;
const SQUARE_OFFSET_PX = 18;
const RING_PX = 110;
const RING_SEGMENTS = 48;
/** Kürzer bzw. flacher projiziert wird ein Griff ausgeblendet (er zeigt auf die Kamera). */
const MIN_VISIBLE_PX = 12;

const AXES: readonly (readonly [number, number, number])[] = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

export interface GizmoLayout {
  pivot: Float32Array;
  centerPx: [number, number];
  /** Welt-Meter je CSS-Pixel am Drehpunkt. */
  worldPerPx: number;
  axes: { visible: boolean; tip: Float32Array; tipPx: [number, number] }[];
  /** Index = Normalen-Achse; Quadrat zwischen den beiden anderen Pfeilen. */
  planes: { visible: boolean; corners: Float32Array; cornersPx: number[] }[];
  /** Index = Drehachse; Kreis in der Ebene senkrecht dazu. */
  rings: { visible: boolean; points: Float32Array; pointsPx: number[] }[];
}

type Project = (p: ArrayLike<number>, out: Float32Array) => boolean;

/**
 * Lage aller Griffe für die aktuelle Kamera: gleich groß auf dem Bildschirm (Pfeile 90 px).
 * null, wenn der Drehpunkt nicht endlich ist oder hinter der Kamera liegt.
 */
export function gizmoLayout(pivot: ArrayLike<number>, camera: Camera, heightPx: number, project: Project, rings: boolean): GizmoLayout | null {
  const p = Float32Array.from([pivot[0], pivot[1], pivot[2]]);
  if (!p.every(Number.isFinite) || !(heightPx > 0)) return null;
  const f = camera.forward(new Float32Array(3));
  let worldPerPx: number;
  if (camera.view === 'perspective') {
    const depth = (p[0] - camera.position[0]) * f[0] + (p[1] - camera.position[1]) * f[1] + (p[2] - camera.position[2]) * f[2];
    if (!(depth > camera.near)) return null;
    worldPerPx = (2 * depth * Math.tan(camera.fovY / 2)) / heightPx;
  } else {
    worldPerPx = (2 * camera.orthoScale) / heightPx;
  }
  const px = new Float32Array(2);
  const toPx = (w: ArrayLike<number>): [number, number] | null => (project(w, px) && Number.isFinite(px[0]) && Number.isFinite(px[1]) ? [px[0], px[1]] : null);
  const center = toPx(p);
  if (!center) return null;
  // Blickrichtung zum Drehpunkt (für Ring-Sichtbarkeit)
  const view = camera.view === 'perspective' ? [p[0] - camera.position[0], p[1] - camera.position[1], p[2] - camera.position[2]] : [f[0], f[1], f[2]];
  const vl = Math.hypot(view[0], view[1], view[2]) || 1;

  const len = ARROW_PX * worldPerPx;
  const axes = AXES.map((e) => {
    const tip = Float32Array.from([p[0] + e[0] * len, p[1] + e[1] * len, p[2] + e[2] * len]);
    const tipPx = toPx(tip);
    const visible = tipPx !== null && Math.hypot(tipPx[0] - center[0], tipPx[1] - center[1]) >= MIN_VISIBLE_PX;
    return { visible, tip, tipPx: tipPx ?? center };
  });

  const s0 = SQUARE_OFFSET_PX * worldPerPx, s1 = (SQUARE_OFFSET_PX + SQUARE_PX) * worldPerPx;
  const planes = [0, 1, 2].map((normal) => {
    const [a, b] = [0, 1, 2].filter((k) => k !== normal);
    const ea = AXES[a], eb = AXES[b];
    const corner = (sa: number, sb: number) => [0, 1, 2].map((k) => p[k] + ea[k] * sa + eb[k] * sb);
    const corners = Float32Array.from([...corner(s0, s0), ...corner(s1, s0), ...corner(s1, s1), ...corner(s0, s1)]);
    const cornersPx: number[] = [];
    let ok = axes[a].visible && axes[b].visible;
    for (let k = 0; k < 4 && ok; k++) {
      const q = toPx(corners.subarray(k * 3, k * 3 + 3));
      if (!q) ok = false;
      else cornersPx.push(q[0], q[1]);
    }
    return { visible: ok, corners, cornersPx };
  });

  const radius = RING_PX * worldPerPx;
  const ringList = [0, 1, 2].map((axis) => {
    const [a, b] = [0, 1, 2].filter((k) => k !== axis);
    const points = new Float32Array(RING_SEGMENTS * 3);
    const pointsPx: number[] = [];
    let ok = rings;
    for (let k = 0; k < RING_SEGMENTS && ok; k++) {
      const t = (k / RING_SEGMENTS) * Math.PI * 2;
      points[k * 3] = p[0];
      points[k * 3 + 1] = p[1];
      points[k * 3 + 2] = p[2];
      points[k * 3 + a] += Math.cos(t) * radius;
      points[k * 3 + b] += Math.sin(t) * radius;
      const q = toPx(points.subarray(k * 3, k * 3 + 3));
      if (!q) ok = false;
      else pointsPx.push(q[0], q[1]);
    }
    // flach von der Seite gesehen (nur ein Strich) → ausblenden
    const flat = RING_PX * Math.abs(view[axis] / vl);
    return { visible: ok && flat >= MIN_VISIBLE_PX, points, pointsPx };
  });

  return { pivot: p, centerPx: center, worldPerPx, axes, planes, rings: ringList };
}

function segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

function insideQuad(px: number, py: number, q: number[]): boolean {
  let inside = false;
  for (let i = 0, j = 3; i < 4; j = i++) {
    const xi = q[i * 2], yi = q[i * 2 + 1], xj = q[j * 2], yj = q[j * 2 + 1];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Griff unter dem Zeiger: Pfeil (≤ 8 px) vor Quadrat (innen) vor Ring (≤ 8 px). */
export function hitGizmo(layout: GizmoLayout, px: number, py: number): GizmoHandle | null {
  let best: GizmoHandle | null = null;
  let bestD = HIT_PX;
  layout.axes.forEach((a, axis) => {
    if (!a.visible) return;
    const d = segmentDistance(px, py, layout.centerPx[0], layout.centerPx[1], a.tipPx[0], a.tipPx[1]);
    if (d <= bestD) {
      bestD = d;
      best = { kind: 'axis', axis: axis as 0 | 1 | 2 };
    }
  });
  if (best) return best;
  for (let axis = 0; axis < 3; axis++) {
    const pl = layout.planes[axis];
    if (pl.visible && insideQuad(px, py, pl.cornersPx)) return { kind: 'plane', axis: axis as 0 | 1 | 2 };
  }
  bestD = HIT_PX;
  layout.rings.forEach((r, axis) => {
    if (!r.visible) return;
    const q = r.pointsPx;
    const n = q.length / 2;
    for (let k = 0; k < n; k++) {
      const j = (k + 1) % n;
      const d = segmentDistance(px, py, q[k * 2], q[k * 2 + 1], q[j * 2], q[j * 2 + 1]);
      if (d <= bestD) {
        bestD = d;
        best = { kind: 'ring', axis: axis as 0 | 1 | 2 };
      }
    }
  });
  return best;
}

const snapTo = (v: number, snap: number | null) => (snap && snap > 0 ? Math.round(v / snap) * snap : v);
const fin = (v: number) => (Number.isFinite(v) ? v : 0);

/** Parameter s des Punkts auf der Achse (pivot + s·e), der dem Strahl am nächsten liegt; null bei parallel. */
function axisParam(pivot: ArrayLike<number>, axis: number, o: ArrayLike<number>, d: ArrayLike<number>): number | null {
  const e = AXES[axis];
  const dl = Math.hypot(d[0], d[1], d[2]);
  if (!(dl > 0)) return null;
  const dx = d[0] / dl, dy = d[1] / dl, dz = d[2] / dl;
  const b = e[0] * dx + e[1] * dy + e[2] * dz;
  const denom = 1 - b * b;
  if (!(denom > 1e-9)) return null;
  const w0 = [pivot[0] - o[0], pivot[1] - o[1], pivot[2] - o[2]];
  const dd = e[0] * w0[0] + e[1] * w0[1] + e[2] * w0[2];
  const ee = dx * w0[0] + dy * w0[1] + dz * w0[2];
  return (b * ee - dd) / denom;
}

/** Strecke entlang der Achse zwischen zwei Zeiger-Strahlen, eingerastet (snap) oder frei (null). */
export function axisDragDelta(
  pivot: ArrayLike<number>,
  axis: 0 | 1 | 2,
  o0: ArrayLike<number>,
  d0: ArrayLike<number>,
  o1: ArrayLike<number>,
  d1: ArrayLike<number>,
  snap: number | null,
): number {
  const s0 = axisParam(pivot, axis, o0, d0);
  const s1 = axisParam(pivot, axis, o1, d1);
  if (s0 === null || s1 === null) return 0;
  return fin(snapTo(s1 - s0, snap));
}

function planeHit(pivot: ArrayLike<number>, normal: number, o: ArrayLike<number>, d: ArrayLike<number>): number[] | null {
  const den = d[normal];
  if (!(Math.abs(den) > 1e-6)) return null;
  const t = (pivot[normal] - o[normal]) / den;
  if (!Number.isFinite(t)) return null;
  return [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t];
}

/** Verschiebung in der Fläche senkrecht zu normalAxis durch den Drehpunkt; jede Achse eingerastet. */
export function planeDragDelta(
  pivot: ArrayLike<number>,
  normalAxis: 0 | 1 | 2,
  o0: ArrayLike<number>,
  d0: ArrayLike<number>,
  o1: ArrayLike<number>,
  d1: ArrayLike<number>,
  snap: number | null,
): [number, number, number] {
  const h0 = planeHit(pivot, normalAxis, o0, d0);
  const h1 = planeHit(pivot, normalAxis, o1, d1);
  if (!h0 || !h1) return [0, 0, 0];
  const out = [0, 1, 2].map((k) => (k === normalAxis ? 0 : fin(snapTo(h1[k] - h0[k], snap)))) as [number, number, number];
  return out.map((v) => v + 0) as [number, number, number];
}

/** Drehwinkel um +axis (Rechte-Hand-Regel) zwischen zwei Zeiger-Strahlen, eingerastet oder frei. */
export function ringDragAngle(
  pivot: ArrayLike<number>,
  axis: 0 | 1 | 2,
  o0: ArrayLike<number>,
  d0: ArrayLike<number>,
  o1: ArrayLike<number>,
  d1: ArrayLike<number>,
  snapRad: number | null,
): number {
  const h0 = planeHit(pivot, axis, o0, d0);
  const h1 = planeHit(pivot, axis, o1, d1);
  if (!h0 || !h1) return 0;
  const v0 = [h0[0] - pivot[0], h0[1] - pivot[1], h0[2] - pivot[2]];
  const v1 = [h1[0] - pivot[0], h1[1] - pivot[1], h1[2] - pivot[2]];
  if (!(Math.hypot(v0[0], v0[1], v0[2]) > 1e-9) || !(Math.hypot(v1[0], v1[1], v1[2]) > 1e-9)) return 0;
  const c = [v0[1] * v1[2] - v0[2] * v1[1], v0[2] * v1[0] - v0[0] * v1[2], v0[0] * v1[1] - v0[1] * v1[0]];
  const angle = Math.atan2(c[axis], v0[0] * v1[0] + v0[1] * v1[1] + v0[2] * v1[2]);
  return fin(snapTo(angle, snapRad));
}
