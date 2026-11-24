import { quadNormal } from './quad';

export type PlaneAxis = 'x' | 'y' | 'z';

/** Achsparallele Ebene: alle Punkte mit p[axis] = offset, Normale = facing entlang axis. */
export interface DrawPlane {
  axis: PlaneAxis;
  offset: number;
  facing: 1 | -1;
}

const AXIS_INDEX: Record<PlaneAxis, number> = { x: 0, y: 1, z: 2 };

export function axisIndex(axis: PlaneAxis): number {
  return AXIS_INDEX[axis];
}

/**
 * Viereck einer Rasterzelle (u, v) der Kantenlänge s auf der Ebene (Konvention K2).
 * Ebenen-Koordinaten: y → (u = x, v = z), z → (u = x, v = y), x → (u = z, v = y).
 */
export function cellQuad(plane: DrawPlane, u: number, v: number, s = 1): Float32Array {
  const o = plane.offset;
  const f = plane.facing;
  const q = new Float32Array(12);
  const put = (i: number, x: number, y: number, z: number) => {
    q[i * 3] = x;
    q[i * 3 + 1] = y;
    q[i * 3 + 2] = z;
  };
  switch (plane.axis) {
    case 'y':
      if (f === 1) {
        put(0, u, o, v + s); put(1, u + s, o, v + s); put(2, u + s, o, v); put(3, u, o, v);
      } else {
        put(0, u, o, v); put(1, u + s, o, v); put(2, u + s, o, v + s); put(3, u, o, v + s);
      }
      break;
    case 'z':
      if (f === 1) {
        put(0, u, v, o); put(1, u + s, v, o); put(2, u + s, v + s, o); put(3, u, v + s, o);
      } else {
        put(0, u + s, v, o); put(1, u, v, o); put(2, u, v + s, o); put(3, u + s, v + s, o);
      }
      break;
    case 'x':
      if (f === 1) {
        put(0, o, v, u + s); put(1, o, v, u); put(2, o, v + s, u); put(3, o, v + s, u + s);
      } else {
        put(0, o, v, u); put(1, o, v, u + s); put(2, o, v + s, u + s); put(3, o, v + s, u);
      }
      break;
  }
  return q;
}

/** Welt-Punkt → Ebenen-Koordinaten (u, v). */
export function worldToPlane(plane: DrawPlane, p: ArrayLike<number>): [number, number] {
  switch (plane.axis) {
    case 'y':
      return [p[0], p[2]];
    case 'z':
      return [p[0], p[1]];
    case 'x':
      return [p[2], p[1]];
  }
}

/** Ebenen-Koordinaten (u, v) → Welt-Punkt auf der Ebene. */
export function planeToWorld(plane: DrawPlane, u: number, v: number, out = new Float32Array(3)): Float32Array {
  const o = plane.offset;
  switch (plane.axis) {
    case 'y':
      out[0] = u; out[1] = o; out[2] = v;
      break;
    case 'z':
      out[0] = u; out[1] = v; out[2] = o;
      break;
    case 'x':
      out[0] = o; out[1] = v; out[2] = u;
      break;
  }
  return out;
}

const tmpN = new Float32Array(3);

/** Ebene eines achsparallelen Vierecks (Toleranz 1e-4), sonst null. */
export function planeOfQuad(corners: ArrayLike<number>, base = 0): DrawPlane | null {
  quadNormal(corners, tmpN, base);
  const axes: PlaneAxis[] = ['x', 'y', 'z'];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(tmpN[a]) < 1 - 1e-4) continue;
    const o = corners[base + a];
    for (let k = 1; k < 4; k++) {
      if (Math.abs(corners[base + k * 3 + a] - o) > 1e-4) return null;
    }
    return { axis: axes[a], offset: o, facing: tmpN[a] > 0 ? 1 : -1 };
  }
  return null;
}
