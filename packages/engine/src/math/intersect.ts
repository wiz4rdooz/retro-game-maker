type V = ArrayLike<number>;

const EPS = 1e-7;

/**
 * Strahl gegen Dreieck (Möller–Trumbore).
 * Gibt den Abstand t ≥ 0 entlang dir zurück oder −1 ohne Treffer.
 * Mit cullBack zählen nur Treffer auf der Vorderseite (Ecken gegen den Uhrzeigersinn gesehen).
 */
export function rayTriangle(o: V, d: V, a: V, b: V, c: V, cullBack: boolean): number {
  const e1x = b[0] - a[0], e1y = b[1] - a[1], e1z = b[2] - a[2];
  const e2x = c[0] - a[0], e2y = c[1] - a[1], e2z = c[2] - a[2];
  const px = d[1] * e2z - d[2] * e2y;
  const py = d[2] * e2x - d[0] * e2z;
  const pz = d[0] * e2y - d[1] * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (cullBack ? det < EPS : Math.abs(det) < EPS) return -1;
  if (!Number.isFinite(det)) return -1;
  const inv = 1 / det;
  const sx = o[0] - a[0], sy = o[1] - a[1], sz = o[2] - a[2];
  const u = (sx * px + sy * py + sz * pz) * inv;
  if (u < -EPS || u > 1 + EPS) return -1;
  const qx = sy * e1z - sz * e1y;
  const qy = sz * e1x - sx * e1z;
  const qz = sx * e1y - sy * e1x;
  const v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv;
  if (v < -EPS || u + v > 1 + EPS) return -1;
  const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
  return t >= 0 && Number.isFinite(t) ? t : -1;
}

/**
 * Strahl gegen achsparallele Box (Slab-Verfahren).
 * invD = 1 / Richtung je Achse (±Infinity bei Richtung 0).
 * Gibt den Eintritts-t zurück (0, wenn der Ursprung in der Box liegt) oder −1.
 */
export function rayAabb(o: V, invD: V, min: V, max: V): number {
  let tmin = -Infinity;
  let tmax = Infinity;
  for (let i = 0; i < 3; i++) {
    const inv = invD[i];
    if (!Number.isFinite(inv)) {
      // Strahl parallel zu dieser Achse: nur innerhalb der Scheibe möglich
      if (o[i] < min[i] || o[i] > max[i]) return -1;
      continue;
    }
    let t1 = (min[i] - o[i]) * inv;
    let t2 = (max[i] - o[i]) * inv;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmax < tmin) return -1;
  }
  if (tmax < 0) return -1;
  return tmin > 0 ? tmin : 0;
}
