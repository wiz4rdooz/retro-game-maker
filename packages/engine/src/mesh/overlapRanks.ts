/** Kacheln für die Rangstufen: ein Chunk oder ein Chunk samt Kacheln seiner Nachbarn. */
export interface RankTiles {
  count: number;
  ids: ArrayLike<number>;
  layer: ArrayLike<number>;
  corners: Float32Array;
}

/** Höchste Rangstufe; mehr Überlagerungen teilen sich die oberste. */
export const MAX_RANK = 3;
/** Ab dieser Schnittfläche (m²) gelten zwei Kacheln einer Fläche als überlappend. */
const MIN_OVERLAP_AREA = 1e-6;
/** Kacheln mit mehr Rasterzellen werden mit allen derselben Fläche verglichen. */
const MAX_CELLS = 256;
const SHRINK = 1e-4;

/**
 * Rangstufe 0–3 je Kachel-Index: Überlappen sich Kacheln in derselben Fläche (gleiche Ebene ±1 mm,
 * Blickrichtung egal), liegt die mit größerem (layerOrder, id) eine Stufe höher als jede, die sie
 * überdeckt. So flackert nichts; der Shader rückt höhere Stufen minimal nach vorn. Kacheln, deren
 * Ebene include verneint (ausgeblendet), zählen nicht mit und behalten Stufe 0.
 *
 * Schnell für den Normalfall: Kacheln kommen in Raster-Eimer (Fläche + Zelle); nur Kacheln, die
 * sich einen Eimer teilen, werden genau verglichen.
 */
export function overlapRanks(
  chunk: RankTiles,
  layerOrder: (layer: number) => number,
  include: (layer: number) => boolean = () => true,
): Uint8Array {
  const count = chunk.count;
  const ranks = new Uint8Array(count);
  if (count < 2) return ranks;
  const c = chunk.corners;
  const plane = new Int32Array(count * 4); // gerundete Normale (×1000) und Abstand (mm)
  const axisOf = new Uint8Array(count);
  const box = new Int32Array(count * 4); // Zellen cx0, cy0, cx1, cy1
  const valid = new Uint8Array(count);
  const big = new Uint8Array(count);
  const contested = new Uint8Array(count);
  const head = new Map<number, number>();
  const multi = new Map<number, number[]>();
  const bigByPlane = new Map<number, number[]>();
  const planeHash = new Int32Array(count);

  for (let i = 0; i < count; i++) {
    if (!include(chunk.layer[i])) continue;
    const base = i * 12;
    // Newell-Normale in einem Durchgang; ihre Länge ist die doppelte Fläche (entartet/NaN → überspringen)
    let gx = 0, gy = 0, gz = 0;
    for (let k = 0; k < 4; k++) {
      const a = base + k * 3, b = base + ((k + 1) & 3) * 3;
      gx += (c[a + 1] - c[b + 1]) * (c[a + 2] + c[b + 2]);
      gy += (c[a + 2] - c[b + 2]) * (c[a] + c[b]);
      gz += (c[a] - c[b]) * (c[a + 1] + c[b + 1]);
    }
    const len = Math.sqrt(gx * gx + gy * gy + gz * gz);
    if (!(len >= 2e-8) || !Number.isFinite(len)) continue;
    let finite = true;
    for (let k = 0; k < 12; k++) if (!Number.isFinite(c[base + k])) finite = false;
    if (!finite) continue;
    const ux = gx / len, uy = gy / len, uz = gz / len;
    // Vorzeichen so, dass die größte Komponente positiv ist: beide Blickrichtungen teilen die Fläche
    const ax0 = Math.abs(ux), ay0 = Math.abs(uy), az0 = Math.abs(uz);
    const big0 = ax0 >= ay0 && ax0 >= az0 ? ux : ay0 >= az0 ? uy : uz;
    const s = big0 < 0 ? -1 : 1;
    const p0 = Math.round(ux * s * 1000), p1 = Math.round(uy * s * 1000), p2 = Math.round(uz * s * 1000);
    const p3 = Math.round((ux * s * c[base] + uy * s * c[base + 1] + uz * s * c[base + 2]) * 1000);
    plane[i * 4] = p0;
    plane[i * 4 + 1] = p1;
    plane[i * 4 + 2] = p2;
    plane[i * 4 + 3] = p3;
    // Projektionsachse aus der gerundeten Normalen: in einer Fläche für alle gleich
    let qa = 0;
    if (Math.abs(p1) > Math.abs(p0)) qa = 1;
    if (Math.abs(p2) > Math.abs(qa === 0 ? p0 : p1)) qa = 2;
    axisOf[i] = qa;
    const a = qa === 0 ? 1 : 0, b = qa === 2 ? 1 : 2;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let k = 0; k < 4; k++) {
      const x = c[base + k * 3 + a], y = c[base + k * 3 + b];
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    const cx0 = Math.floor(x0 + SHRINK), cx1 = Math.floor(x1 - SHRINK);
    const cy0 = Math.floor(y0 + SHRINK), cy1 = Math.floor(y1 - SHRINK);
    box[i * 4] = cx0;
    box[i * 4 + 1] = cy0;
    box[i * 4 + 2] = Math.max(cx0, cx1);
    box[i * 4 + 3] = Math.max(cy0, cy1);
    valid[i] = 1;
    const ph = mix(mix(mix(mix(0x9e3779b9, p0), p1), p2), p3);
    planeHash[i] = ph;
    if ((Math.max(cx0, cx1) - cx0 + 1) * (Math.max(cy0, cy1) - cy0 + 1) > MAX_CELLS) {
      big[i] = 1;
      const list = bigByPlane.get(ph);
      if (list) list.push(i);
      else bigByPlane.set(ph, [i]);
      continue;
    }
    for (let cx = cx0; cx <= Math.max(cx0, cx1); cx++) {
      for (let cy = cy0; cy <= Math.max(cy0, cy1); cy++) {
        const k = mix(mix(ph, cx), cy);
        const h = head.get(k);
        if (h === undefined) {
          head.set(k, i);
          continue;
        }
        let list = multi.get(k);
        if (!list) {
          list = [h];
          multi.set(k, list);
          contested[h] = 1;
        }
        list.push(i);
        contested[i] = 1;
      }
    }
  }
  if (bigByPlane.size > 0) {
    for (let i = 0; i < count; i++) if (valid[i] && bigByPlane.has(planeHash[i])) contested[i] = 1;
  }

  const order: number[] = [];
  for (let i = 0; i < count; i++) if (contested[i]) order.push(i);
  if (order.length === 0) return ranks;
  const key = new Float64Array(count);
  for (const i of order) key[i] = layerOrder(chunk.layer[i]) * 2 ** 32 + chunk.ids[i];
  order.sort((x, y) => key[x] - key[y]);
  // Eimer nach Reihenfolge sortieren: dann prüft jede Kachel nur Ältere, die Jüngsten zuerst,
  // und hört auf, sobald die oberste Stufe erreicht ist (sonst O(n²) bei Stapeln)
  const pos = new Int32Array(count);
  for (let k = 0; k < order.length; k++) pos[order[k]] = k;
  const byPos = (x: number, y: number) => pos[x] - pos[y];
  for (const list of multi.values()) list.sort(byPos);
  for (const list of bigByPlane.values()) list.sort(byPos);
  /** Anzahl der Einträge mit pos < p (Liste nach pos sortiert). */
  const before = (list: number[], p: number) => {
    let lo = 0, hi = list.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (pos[list[mid]] < p) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const polys = new Map<number, number[]>();
  const poly = (i: number) => {
    let p = polys.get(i);
    if (!p) polys.set(i, (p = project(c, i * 12, axisOf[i])));
    return p;
  };
  const samePlane = (i: number, j: number) =>
    plane[i * 4] === plane[j * 4] && plane[i * 4 + 1] === plane[j * 4 + 1] && plane[i * 4 + 2] === plane[j * 4 + 2] && plane[i * 4 + 3] === plane[j * 4 + 3];

  for (let k = 0; k < order.length; k++) {
    const i = order[k];
    let rank = 0;
    /** Prüft list[end−1] … list[0] (alle älter als i), bis die oberste Stufe erreicht ist. */
    const scan = (list: number[], end: number) => {
      for (let m = end - 1; m >= 0 && rank < MAX_RANK; m--) {
        const j = list[m];
        if (ranks[j] + 1 <= rank || !samePlane(i, j)) continue;
        if (overlapArea(poly(i), poly(j)) > MIN_OVERLAP_AREA) rank = Math.min(MAX_RANK, ranks[j] + 1);
      }
    };
    if (big[i]) {
      scan(order, k);
    } else {
      const bigs = bigByPlane.get(planeHash[i]);
      if (bigs) scan(bigs, before(bigs, k));
      const b = i * 4;
      for (let cx = box[b]; cx <= box[b + 2] && rank < MAX_RANK; cx++) {
        for (let cy = box[b + 1]; cy <= box[b + 3] && rank < MAX_RANK; cy++) {
          const list = multi.get(mix(mix(planeHash[i], cx), cy));
          if (list) scan(list, before(list, k));
        }
      }
    }
    ranks[i] = rank;
  }
  return ranks;
}

/** 32-bit-Mischung für Eimer-Schlüssel (Kollisionen fängt der genaue Vergleich ab). */
function mix(h: number, v: number): number {
  // auf 30 Bit begrenzt: bleibt eine kleine Ganzzahl (schnelle Map-Schlüssel)
  return (Math.imul(h ^ (v | 0), 0x85ebca6b) ^ (h >>> 13)) & 0x3fffffff;
}

/** Projektion auf die Ebene ohne Hauptachse, gegen den Uhrzeigersinn, doppelte Punkte entfernt. */
function project(c: Float32Array, base: number, axis: number): number[] {
  const a = axis === 0 ? 1 : 0;
  const b = axis === 2 ? 1 : 2;
  const out: number[] = [];
  for (let k = 0; k < 4; k++) {
    const x = c[base + k * 3 + a], y = c[base + k * 3 + b];
    const m = out.length;
    if (m >= 2 && Math.abs(out[m - 2] - x) < 1e-9 && Math.abs(out[m - 1] - y) < 1e-9) continue;
    out.push(x, y);
  }
  if (out.length >= 4 && Math.abs(out[0] - out[out.length - 2]) < 1e-9 && Math.abs(out[1] - out[out.length - 1]) < 1e-9) out.length -= 2;
  if (signedArea(out) < 0) {
    const r: number[] = [];
    for (let k = out.length - 2; k >= 0; k -= 2) r.push(out[k], out[k + 1]);
    return r;
  }
  return out;
}

function signedArea(p: number[]): number {
  let s = 0;
  for (let k = 0; k < p.length; k += 2) {
    const j = (k + 2) % p.length;
    s += p[k] * p[j + 1] - p[j] * p[k + 1];
  }
  return s / 2;
}

/** Schnittfläche zweier (konvexer) Vielecke per Sutherland–Hodgman. */
function overlapArea(subject: number[], clip: number[]): number {
  if (subject.length < 6 || clip.length < 6) return 0;
  let out = subject;
  for (let e = 0; e < clip.length && out.length >= 6; e += 2) {
    const ax = clip[e], ay = clip[e + 1];
    const bx = clip[(e + 2) % clip.length], by = clip[(e + 3) % clip.length];
    const side = (x: number, y: number) => (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    const input = out;
    out = [];
    for (let k = 0; k < input.length; k += 2) {
      const px = input[k], py = input[k + 1];
      const qx = input[(k + 2) % input.length], qy = input[(k + 3) % input.length];
      const sp = side(px, py), sq = side(qx, qy);
      if (sp >= 0) out.push(px, py);
      if (sp >= 0 !== sq >= 0) {
        const t = sp / (sp - sq);
        out.push(px + (qx - px) * t, py + (qy - py) * t);
      }
    }
  }
  return out.length >= 6 ? Math.abs(signedArea(out)) : 0;
}
