import { quadNormal } from './quad';

/** u nach rechts, v nach unten innerhalb einer Kachel; Ecke c0 = unten links (Konvention K3). */
const BASE = [0, 1, 1, 1, 1, 0, 0, 0];
/** Um so viel werden die Werte zur Mitte gezogen: An Kanten erscheint nie die Nachbar-Wiederholung. */
const PULL = 1 - 2e-4;

const n = new Float32Array(3);

/**
 * Texturkoordinaten der vier Ecken in Kachel-Einheiten (1 Kachel = 1 m), (u0, v0, …, u3, v3):
 * Ursprung c0, u entlang der Kante c0→c1 (bei zusammengefallenen Ecken c3→c2), v senkrecht dazu
 * Richtung c3, nach unten gezählt wie K3. Größere Kacheln wiederholen die Textur, Schrägen dehnen
 * sie nicht. rot = k bedeutet k × 90° im Uhrzeigersinn, danach wird gespiegelt (wie `tileUVs`).
 * `normal`: schon berechnete Newell-Normale (spart beim Vernetzen eine Rechnung).
 */
export function tileLocalUVs(
  corners: ArrayLike<number>,
  base: number,
  rot: 0 | 1 | 2 | 3,
  flipX: boolean,
  flipY: boolean,
  out: Float32Array,
  normal?: ArrayLike<number>,
): Float32Array {
  // ohne Zwischen-Arrays: läuft für jede Kachel der Welt beim Vernetzen
  const c = corners;
  const x0 = c[base], y0 = c[base + 1], z0 = c[base + 2];
  const ax = c[base + 3] - x0, ay = c[base + 4] - y0, az = c[base + 5] - z0;
  const bx = c[base + 6] - c[base + 9], by = c[base + 7] - c[base + 10], bz = c[base + 8] - c[base + 11];
  const useA = ax * ax + ay * ay + az * az >= bx * bx + by * by + bz * bz;
  let tx = useA ? ax : bx, ty = useA ? ay : by, tz = useA ? az : bz;
  const nn = normal ?? quadNormal(c, n, base);
  const nx = nn[0], ny = nn[1], nz = nn[2];
  // u-Richtung in die Ebene der Kachel legen
  const tn = tx * nx + ty * ny + tz * nz;
  tx -= tn * nx;
  ty -= tn * ny;
  tz -= tn * nz;
  const tl = Math.sqrt(tx * tx + ty * ty + tz * tz);
  let vx = ny * tz - nz * ty, vy = nz * tx - nx * tz, vz = nx * ty - ny * tx;
  const vl = Math.sqrt(vx * vx + vy * vy + vz * vz);
  if (!(tl > 1e-9) || !(vl > 1e-9)) {
    out.set(BASE);
    return out;
  }
  tx /= tl;
  ty /= tl;
  tz /= tl;
  vx /= vl;
  vy /= vl;
  vz /= vl;
  // v zeigt zu c3/c2 („nach oben“ in der Textur)
  const upx = c[base + 9] - x0 + c[base + 6] - c[base + 3];
  const upy = c[base + 10] - y0 + c[base + 7] - c[base + 4];
  const upz = c[base + 11] - z0 + c[base + 8] - c[base + 5];
  if (vx * upx + vy * upy + vz * upz < 0) {
    vx = -vx;
    vy = -vy;
    vz = -vz;
  }
  let mu = 0;
  let mv = 0;
  for (let i = 0; i < 4; i++) {
    const dx = c[base + i * 3] - x0, dy = c[base + i * 3 + 1] - y0, dz = c[base + i * 3 + 2] - z0;
    const u0 = dx * tx + dy * ty + dz * tz;
    const v0 = 1 - (dx * vx + dy * vy + dz * vz);
    // Drehen wie K3: rot 1 (u, v) → (v, 1 − u), rot 2 → (1 − u, 1 − v), rot 3 → (1 − v, u)
    let u = rot === 1 ? v0 : rot === 2 ? 1 - u0 : rot === 3 ? 1 - v0 : u0;
    let v = rot === 1 ? 1 - u0 : rot === 2 ? 1 - v0 : rot === 3 ? u0 : v0;
    if (flipX) u = 1 - u;
    if (flipY) v = 1 - v;
    out[i * 2] = u;
    out[i * 2 + 1] = v;
    mu += u * 0.25;
    mv += v * 0.25;
  }
  let ok = true;
  for (let i = 0; i < 4; i++) {
    const u = mu + (out[i * 2] - mu) * PULL;
    const v = mv + (out[i * 2 + 1] - mv) * PULL;
    if (!Number.isFinite(u) || !Number.isFinite(v)) ok = false;
    out[i * 2] = u;
    out[i * 2 + 1] = v;
  }
  if (!ok) out.set(BASE);
  return out;
}
