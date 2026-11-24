import { rayTriangle } from '../math/intersect';

type V = ArrayLike<number>;
type Out = Float32Array;

const EPS = 1e-12;

/** Nächster Punkt des Dreiecks (a, b, c) zu p (Ericson, Real-Time Collision Detection 5.1.5). */
export function closestPointOnTriangle(p: V, a: V, b: V, c: V, out: Out): Out {
  const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
  const acx = c[0] - a[0], acy = c[1] - a[1], acz = c[2] - a[2];
  const apx = p[0] - a[0], apy = p[1] - a[1], apz = p[2] - a[2];
  const d1 = abx * apx + aby * apy + abz * apz;
  const d2 = acx * apx + acy * apy + acz * apz;
  if (d1 <= 0 && d2 <= 0) return set(out, a[0], a[1], a[2]);
  const bpx = p[0] - b[0], bpy = p[1] - b[1], bpz = p[2] - b[2];
  const d3 = abx * bpx + aby * bpy + abz * bpz;
  const d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) return set(out, b[0], b[1], b[2]);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    return set(out, a[0] + abx * v, a[1] + aby * v, a[2] + abz * v);
  }
  const cpx = p[0] - c[0], cpy = p[1] - c[1], cpz = p[2] - c[2];
  const d5 = abx * cpx + aby * cpy + abz * cpz;
  const d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) return set(out, c[0], c[1], c[2]);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    return set(out, a[0] + acx * w, a[1] + acy * w, a[2] + acz * w);
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
    return set(out, b[0] + (c[0] - b[0]) * w, b[1] + (c[1] - b[1]) * w, b[2] + (c[2] - b[2]) * w);
  }
  const denom = 1 / (va + vb + vc);
  const v = vb * denom;
  const w = vc * denom;
  return set(out, a[0] + abx * v + acx * w, a[1] + aby * v + acy * w, a[2] + abz * v + acz * w);
}

/** Nächste Punkte zweier Strecken (Ericson 5.1.9); gibt den Abstand² zurück. */
export function closestSegmentSegment(p1: V, q1: V, p2: V, q2: V, c1: Out, c2: Out): number {
  const d1x = q1[0] - p1[0], d1y = q1[1] - p1[1], d1z = q1[2] - p1[2];
  const d2x = q2[0] - p2[0], d2y = q2[1] - p2[1], d2z = q2[2] - p2[2];
  const rx = p1[0] - p2[0], ry = p1[1] - p2[1], rz = p1[2] - p2[2];
  const a = d1x * d1x + d1y * d1y + d1z * d1z;
  const e = d2x * d2x + d2y * d2y + d2z * d2z;
  const f = d2x * rx + d2y * ry + d2z * rz;
  let s = 0, t = 0;
  if (a <= EPS && e <= EPS) {
    s = t = 0;
  } else if (a <= EPS) {
    s = 0;
    t = clamp01(f / e);
  } else {
    const c = d1x * rx + d1y * ry + d1z * rz;
    if (e <= EPS) {
      t = 0;
      s = clamp01(-c / a);
    } else {
      const b = d1x * d2x + d1y * d2y + d1z * d2z;
      const denom = a * e - b * b;
      s = denom !== 0 ? clamp01((b * f - c * e) / denom) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp01(-c / a);
      } else if (t > 1) {
        t = 1;
        s = clamp01((b - c) / a);
      }
    }
  }
  set(c1, p1[0] + d1x * s, p1[1] + d1y * s, p1[2] + d1z * s);
  set(c2, p2[0] + d2x * t, p2[1] + d2y * t, p2[2] + d2z * t);
  return distSq(c1, c2);
}

const tA = new Float32Array(3);
const tB = new Float32Array(3);
const seg = new Float32Array(3);

/** Kleinster Abstand² zwischen Strecke p0–p1 und Dreieck; die nächsten Punkte landen in outSeg/outTri. */
export function closestSegmentTriangle(p0: V, p1: V, a: V, b: V, c: V, outSeg: Out, outTri: Out): number {
  set(seg, p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
  const t = rayTriangle(p0, seg, a, b, c, false);
  if (t >= 0 && t <= 1) {
    set(outSeg, p0[0] + seg[0] * t, p0[1] + seg[1] * t, p0[2] + seg[2] * t);
    set(outTri, outSeg[0], outSeg[1], outSeg[2]);
    return 0;
  }
  let best = Infinity;
  const consider = (d: number, s: Out, q: Out) => {
    if (d < best) {
      best = d;
      set(outSeg, s[0], s[1], s[2]);
      set(outTri, q[0], q[1], q[2]);
    }
  };
  closestPointOnTriangle(p0, a, b, c, tB);
  consider(distSq(p0, tB), set(tA, p0[0], p0[1], p0[2]), tB);
  closestPointOnTriangle(p1, a, b, c, tB);
  consider(distSq(p1, tB), set(tA, p1[0], p1[1], p1[2]), tB);
  consider(closestSegmentSegment(p0, p1, a, b, tA, tB), tA, tB);
  consider(closestSegmentSegment(p0, p1, b, c, tA, tB), tA, tB);
  consider(closestSegmentSegment(p0, p1, c, a, tA, tB), tA, tB);
  return best;
}

function set(out: Out, x: number, y: number, z: number): Out {
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}

function distSq(a: V, b: V): number {
  const x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2];
  return x * x + y * y + z * z;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
