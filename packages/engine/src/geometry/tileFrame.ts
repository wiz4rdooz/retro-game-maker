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
 */
export function tileLocalUVs(
  corners: ArrayLike<number>,
  base: number,
  rot: 0 | 1 | 2 | 3,
  flipX: boolean,
  flipY: boolean,
  out: Float32Array,
): Float32Array {
  const c = (i: number, j: number) => corners[base + i * 3 + j];
  const edge = (a: number, b: number) => [c(b, 0) - c(a, 0), c(b, 1) - c(a, 1), c(b, 2) - c(a, 2)];
  const e01 = edge(0, 1);
  const e32 = edge(3, 2);
  let t = Math.hypot(e01[0], e01[1], e01[2]) >= Math.hypot(e32[0], e32[1], e32[2]) ? e01 : e32;
  quadNormal(corners, n, base);
  // u-Richtung in die Ebene der Kachel legen
  const tn = t[0] * n[0] + t[1] * n[1] + t[2] * n[2];
  t = [t[0] - tn * n[0], t[1] - tn * n[1], t[2] - tn * n[2]];
  const tl = Math.hypot(t[0], t[1], t[2]);
  let b = [n[1] * t[2] - n[2] * t[1], n[2] * t[0] - n[0] * t[2], n[0] * t[1] - n[1] * t[0]];
  const bl = Math.hypot(b[0], b[1], b[2]);
  if (!(tl > 1e-9) || !(bl > 1e-9)) {
    out.set(BASE);
    return out;
  }
  t = t.map((x) => x / tl);
  b = b.map((x) => x / bl);
  // v zeigt zu c3/c2 („nach oben“ in der Textur)
  const up = [...edge(0, 3)].map((x, j) => x + edge(1, 2)[j]);
  if (b[0] * up[0] + b[1] * up[1] + b[2] * up[2] < 0) b = b.map((x) => -x);

  let mu = 0;
  let mv = 0;
  for (let i = 0; i < 4; i++) {
    const d = [c(i, 0) - c(0, 0), c(i, 1) - c(0, 1), c(i, 2) - c(0, 2)];
    let u = d[0] * t[0] + d[1] * t[1] + d[2] * t[2];
    let v = 1 - (d[0] * b[0] + d[1] * b[1] + d[2] * b[2]);
    // Drehen wie K3: rot 1 (u, v) → (v, 1 − u), rot 2 → (1 − u, 1 − v), rot 3 → (1 − v, u)
    if (rot === 1) [u, v] = [v, 1 - u];
    else if (rot === 2) [u, v] = [1 - u, 1 - v];
    else if (rot === 3) [u, v] = [1 - v, u];
    if (flipX) u = 1 - u;
    if (flipY) v = 1 - v;
    out[i * 2] = u;
    out[i * 2 + 1] = v;
    mu += u / 4;
    mv += v / 4;
  }
  for (let i = 0; i < 4; i++) {
    out[i * 2] = mu + (out[i * 2] - mu) * PULL;
    out[i * 2 + 1] = mv + (out[i * 2 + 1] - mv) * PULL;
  }
  if (!out.every(Number.isFinite)) out.set(BASE);
  return out;
}
