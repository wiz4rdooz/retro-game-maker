import type { Vec3 } from '../math/vec3';

type V = ArrayLike<number>;

/**
 * Normale eines Vierecks (Konvention K1) nach dem Newell-Verfahren.
 * Für ebene Vierecke entspricht sie normalize((c1−c0) × (c3−c0)); anders als dieses
 * Kreuzprodukt bleibt sie auch bei zusammengefallenen Ecken (Dreieck) richtig.
 * Nicht endliche oder flächenlose Vierecke ergeben (0, 0, 0).
 */
export function quadNormal(corners: V, out: Vec3, base = 0): Vec3 {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < 4; i++) {
    const a = base + i * 3;
    const b = base + ((i + 1) % 4) * 3;
    const ax = corners[a], ay = corners[a + 1], az = corners[a + 2];
    const bx = corners[b], by = corners[b + 1], bz = corners[b + 2];
    nx += (ay - by) * (az + bz);
    ny += (az - bz) * (ax + bx);
    nz += (ax - bx) * (ay + by);
  }
  const len = Math.hypot(nx, ny, nz);
  if (len > 0 && Number.isFinite(len)) {
    out[0] = nx / len;
    out[1] = ny / len;
    out[2] = nz / len;
  } else {
    out[0] = out[1] = out[2] = 0;
  }
  return out;
}

/** true, wenn alle 12 Koordinaten endlich sind. */
export function quadIsFinite(corners: V, base = 0): boolean {
  for (let k = 0; k < 12; k++) if (!Number.isFinite(corners[base + k])) return false;
  return true;
}

/** Fläche des Vierecks (halber Betrag des Newell-Vektors; bei nicht endlichen Ecken NaN). */
export function quadArea(corners: V, base = 0): number {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < 4; i++) {
    const a = base + i * 3;
    const b = base + ((i + 1) % 4) * 3;
    nx += (corners[a + 1] - corners[b + 1]) * (corners[a + 2] + corners[b + 2]);
    ny += (corners[a + 2] - corners[b + 2]) * (corners[a] + corners[b]);
    nz += (corners[a] - corners[b]) * (corners[a + 1] + corners[b + 1]);
  }
  return Math.hypot(nx, ny, nz) / 2;
}

/** Entartet: nicht endlich oder Fläche < 1e-8. Ein Dreieck (zwei gleiche Ecken) ist nicht entartet. */
export function quadIsDegenerate(corners: V, base = 0): boolean {
  if (!quadIsFinite(corners, base)) return true;
  return !(quadArea(corners, base) >= 1e-8);
}

/** Mittelwert der vier Ecken. */
export function quadCentroid(corners: V, out: Vec3, base = 0): Vec3 {
  out[0] = (corners[base] + corners[base + 3] + corners[base + 6] + corners[base + 9]) / 4;
  out[1] = (corners[base + 1] + corners[base + 4] + corners[base + 7] + corners[base + 10]) / 4;
  out[2] = (corners[base + 2] + corners[base + 5] + corners[base + 8] + corners[base + 11]) / 4;
  return out;
}
