import { closestSegmentTriangle } from './closest';

export interface CapsuleResult {
  pushed: boolean;
  /** Größtes n.y der Kontakt-Normalen (Richtung Dreieck → Kapsel), −1 ohne Kontakt. */
  groundNy: number;
}

const S = new Float32Array(3);
const Q = new Float32Array(3);
const A = new Float32Array(3);
const B = new Float32Array(3);
const C = new Float32Array(3);
const P0 = new Float32Array(3);
const P1 = new Float32Array(3);

/**
 * Schiebt eine senkrechte Kapsel (Füße bei feet, Achse von feet+r bis feet+height−r) in bis zu
 * 4 Durchläufen aus allen Dreiecken heraus, entlang (Kapselpunkt − Dreieckspunkt).
 * Kontakte mit n.y < wallNy gelten als Wand und werden nur waagerecht aufgelöst; zeigt ihre
 * Normale fast senkrecht, bleibt der Kontakt unaufgelöst. Ohne wallNy wird alles normal aufgelöst.
 */
export function resolveCapsule(
  feet: Float32Array,
  radius: number,
  height: number,
  tris: ArrayLike<number>,
  triCount: number,
  wallNy = -Infinity,
): CapsuleResult {
  const res: CapsuleResult = { pushed: false, groundNy: -1 };
  const r = radius;
  const rr = r * r;
  const axis = Math.max(0, height - 2 * r);
  for (let iter = 0; iter < 4; iter++) {
    let moved = false;
    for (let t = 0; t < triCount; t++) {
      const o = t * 9;
      if (!boxesOverlap(tris, o, feet, r, axis + 2 * r)) continue;
      P0[0] = feet[0]; P0[1] = feet[1] + r; P0[2] = feet[2];
      P1[0] = feet[0]; P1[1] = feet[1] + r + axis; P1[2] = feet[2];
      A[0] = tris[o]; A[1] = tris[o + 1]; A[2] = tris[o + 2];
      B[0] = tris[o + 3]; B[1] = tris[o + 4]; B[2] = tris[o + 5];
      C[0] = tris[o + 6]; C[1] = tris[o + 7]; C[2] = tris[o + 8];
      const dSq = closestSegmentTriangle(P0, P1, A, B, C, S, Q);
      if (!(dSq < rr - 1e-10)) continue;
      const d = Math.sqrt(dSq);
      let nx: number, ny: number, nz: number;
      if (d > 1e-6) {
        nx = (S[0] - Q[0]) / d; ny = (S[1] - Q[1]) / d; nz = (S[2] - Q[2]) / d;
      } else {
        // Achse schneidet das Dreieck: Flächen-Normale zur Kapselmitte hin
        const ex = B[0] - A[0], ey = B[1] - A[1], ez = B[2] - A[2];
        const fx = C[0] - A[0], fy = C[1] - A[1], fz = C[2] - A[2];
        nx = ey * fz - ez * fy; ny = ez * fx - ex * fz; nz = ex * fy - ey * fx;
        const len = Math.hypot(nx, ny, nz);
        if (!(len > 0)) continue;
        const mid = feet[1] + r + axis / 2;
        const side = (feet[0] - Q[0]) * nx + (mid - Q[1]) * ny + (feet[2] - Q[2]) * nz;
        const sgn = side < 0 || (side === 0 && ny < 0) ? -1 / len : 1 / len;
        nx *= sgn; ny *= sgn; nz *= sgn;
      }
      if (ny > res.groundNy) res.groundNy = ny;
      const depth = r - d;
      if (ny < wallNy) {
        const hl = Math.hypot(nx, nz);
        if (hl < 1e-3) continue;
        const amount = depth / hl;
        feet[0] += (nx / hl) * amount;
        feet[2] += (nz / hl) * amount;
      } else {
        feet[0] += nx * depth;
        feet[1] += ny * depth;
        feet[2] += nz * depth;
      }
      res.pushed = true;
      moved = true;
    }
    if (!moved) break;
  }
  return res;
}

/** Grobtest: Box des Dreiecks gegen Box der Kapsel (ohne Speicheranforderung). */
function boxesOverlap(tris: ArrayLike<number>, o: number, feet: Float32Array, r: number, h: number): boolean {
  for (let a = 0; a < 3; a++) {
    const v0 = tris[o + a], v1 = tris[o + 3 + a], v2 = tris[o + 6 + a];
    const lo = a === 1 ? feet[1] : feet[a] - r;
    const hi = a === 1 ? feet[1] + h : feet[a] + r;
    if ((v0 < lo && v1 < lo && v2 < lo) || (v0 > hi && v1 > hi && v2 > hi)) return false;
  }
  return true;
}
