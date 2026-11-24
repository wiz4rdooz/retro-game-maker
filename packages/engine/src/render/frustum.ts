type V = ArrayLike<number>;

/** Sechs Ebenen (a, b, c, d) aus einer spaltenweisen View-Projection-Matrix; innen gilt a·x + b·y + c·z + d ≥ 0. */
export function extractFrustum(m: V, out: Float32Array): Float32Array {
  const row = (i: number) => [m[i], m[4 + i], m[8 + i], m[12 + i]];
  const r0 = row(0), r1 = row(1), r2 = row(2), r3 = row(3);
  const planes = [
    r3.map((v, k) => v + r0[k]),
    r3.map((v, k) => v - r0[k]),
    r3.map((v, k) => v + r1[k]),
    r3.map((v, k) => v - r1[k]),
    r3.map((v, k) => v + r2[k]),
    r3.map((v, k) => v - r2[k]),
  ];
  planes.forEach((p, i) => {
    const len = Math.hypot(p[0], p[1], p[2]) || 1;
    for (let k = 0; k < 4; k++) out[i * 4 + k] = p[k] / len;
  });
  return out;
}

export function aabbInFrustum(planes: V, min: V, max: V): boolean {
  for (let i = 0; i < 6; i++) {
    const a = planes[i * 4], b = planes[i * 4 + 1], c = planes[i * 4 + 2], d = planes[i * 4 + 3];
    const x = a >= 0 ? max[0] : min[0];
    const y = b >= 0 ? max[1] : min[1];
    const z = c >= 0 ? max[2] : min[2];
    if (a * x + b * y + c * z + d < 0) return false;
  }
  return true;
}

export interface ChunkBounds {
  key: number;
  min: V;
  max: V;
}

/** Schlüssel aller Chunks im Sichtfeld, deren Box höchstens viewDistance von camPos entfernt ist. */
export function selectVisibleChunks(chunks: Iterable<ChunkBounds>, planes: V, camPos: V, viewDistance: number): number[] {
  const out: number[] = [];
  const maxSq = viewDistance * viewDistance;
  for (const ch of chunks) {
    let dSq = 0;
    for (let a = 0; a < 3; a++) {
      const v = camPos[a];
      const d = v < ch.min[a] ? ch.min[a] - v : v > ch.max[a] ? v - ch.max[a] : 0;
      dSq += d * d;
    }
    if (dSq > maxSq) continue;
    if (!aabbInFrustum(planes, ch.min, ch.max)) continue;
    out.push(ch.key);
  }
  return out;
}
