import { blockQuads, BlockFace } from '../geometry/block';
import { cellQuad, type DrawPlane } from '../geometry/plane';
import type { TileData } from './types';
import type { World } from './world';

export interface TestIslandOptions {
  /** Kantenlänge in Metern (Standard 500). */
  size?: number;
  /** Startwert des Zufalls (Standard 1). */
  seed?: number;
  layer: number;
  tileset: number;
  columns: number;
  rows: number;
}

/** Kleiner, schneller Zufallsgenerator (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Value-Noise: Zufallswerte auf einem Gitter (Abstand cell), weich interpoliert; Ergebnis 0…1. */
function valueNoise(rand: () => number, extent: number, cell: number): (x: number, z: number) => number {
  const n = Math.ceil(extent / cell) + 2;
  const grid = new Float32Array(n * n);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x, z) => {
    const gx = x / cell, gz = z / cell;
    const ix = Math.floor(gx), iz = Math.floor(gz);
    const fx = smooth(gx - ix), fz = smooth(gz - iz);
    const at = (a: number, b: number) => grid[Math.min(n - 1, Math.max(0, b)) * n + Math.min(n - 1, Math.max(0, a))];
    const top = at(ix, iz) * (1 - fx) + at(ix + 1, iz) * fx;
    const bottom = at(ix, iz + 1) * (1 - fx) + at(ix + 1, iz + 1) * fx;
    return top * (1 - fz) + bottom * fz;
  };
}

/**
 * Erzeugt die Test-Insel: terrassierte Höhenkarte (ganze Meter 0–6) mit je einer Bodenkachel pro
 * Zelle, senkrechten Seitenkacheln an Höhensprüngen und 400 Ruinen (beidseitige Mauern und Blöcke).
 * Reproduzierbar über seed. checksum = Σ (tx·31 + ty·17 + gerundete Eckensumme) mod 2³².
 */
export function generateTestIsland(world: World, o: TestIslandOptions): { tiles: number; checksum: number } {
  const size = Math.max(8, Math.floor(o.size ?? 500));
  const rand = mulberry32(o.seed ?? 1);
  const cols = Math.max(1, o.columns), rows = Math.max(1, o.rows);
  let tiles = 0;
  let checksum = 0;

  const add = (corners: Float32Array, tx: number, ty: number, doubleSided = false) => {
    const t: TileData = {
      layer: o.layer,
      tileset: o.tileset,
      tx: tx % cols,
      ty: ty % rows,
      rot: 0,
      flipX: false,
      flipY: false,
      doubleSided,
      ghost: false,
      corners,
    };
    world.addTile(t);
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += corners[i];
    checksum = (checksum + t.tx * 31 + t.ty * 17 + Math.round(sum)) >>> 0;
    tiles++;
  };

  // Höhenkarte
  const big = valueNoise(rand, size, 64);
  const small = valueNoise(rand, size, 16);
  const raw = new Float32Array(size * size);
  const height = new Uint8Array(size * size);
  const half = size / 2;
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - half, z + 0.5 - half) / half;
      const falloff = Math.min(1, Math.max(0, 1.3 - d * 1.15));
      const h = (big(x, z) * 0.72 + small(x, z) * 0.28) * falloff * 8.2;
      raw[z * size + x] = h;
      height[z * size + x] = Math.min(6, Math.max(0, Math.floor(h)));
    }
  }
  const hAt = (x: number, z: number) => (x < 0 || z < 0 || x >= size || z >= size ? 0 : height[z * size + x]);

  // Boden: Sand/Wasser auf 0, Gras 1–3, Erde 4–5, Fels 6
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const h = height[z * size + x];
      const v = (x * 7 + z * 13) & 3;
      let tx = v, ty = 0;
      if (h === 0) {
        if (raw[z * size + x] < 0.35) [tx, ty] = [v, 2];
        else [tx, ty] = [4 + v, 1];
      } else if (h >= 6) [tx, ty] = [v, 1];
      else if (h >= 4) [tx, ty] = [4 + v, 0];
      add(cellQuad({ axis: 'y', offset: h, facing: 1 }, x, z), tx, ty);
    }
  }

  // Seiten an Höhensprüngen, nach außen zum tieferen Nachbarn
  const sides: [number, number, (x: number, z: number) => DrawPlane, (x: number, z: number) => number][] = [
    [1, 0, (x) => ({ axis: 'x', offset: x + 1, facing: 1 }), (_x, z) => z],
    [-1, 0, (x) => ({ axis: 'x', offset: x, facing: -1 }), (_x, z) => z],
    [0, 1, (_x, z) => ({ axis: 'z', offset: z + 1, facing: 1 }), (x) => x],
    [0, -1, (_x, z) => ({ axis: 'z', offset: z, facing: -1 }), (x) => x],
  ];
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const h = height[z * size + x];
      if (h === 0) continue;
      for (const [dx, dz, plane, u] of sides) {
        const hn = hAt(x + dx, z + dz);
        for (let y = hn; y < h; y++) add(cellQuad(plane(x, z), u(x, z), y), (x + y + z) & 3, 1);
      }
    }
  }

  // Ruinen: beidseitige Mauern (3–8 m lang, 2–4 m hoch, oben bröckelnd) und Blöcke
  const ri = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  for (let r = 0; r < 400; r++) {
    let px = 0, pz = 0;
    for (let tries = 0; tries < 20; tries++) {
      px = ri(8, size - 16);
      pz = ri(8, size - 16);
      if (hAt(px, pz) >= 1) break;
    }
    const base = hAt(px, pz);
    const len = ri(3, 8);
    const tall = ri(2, 4);
    const alongX = rand() < 0.5;
    for (let i = 0; i < len; i++) {
      for (let j = 0; j < tall; j++) {
        if (j > 0 && rand() < 0.18) continue;
        const corners = alongX
          ? cellQuad({ axis: 'z', offset: pz, facing: 1 }, px + i, base + j)
          : cellQuad({ axis: 'x', offset: px, facing: 1 }, pz + i, base + j);
        add(corners, 4 + ((i + j) & 3), 2, true);
      }
    }
    const blocks = ri(2, 4);
    for (let b = 0; b < blocks; b++) {
      const bx = Math.min(size - 1, px + ri(-3, 3) + (alongX ? ri(0, len) : 0));
      const bz = Math.min(size - 1, pz + ri(-3, 3) + (alongX ? 0 : ri(0, len)));
      const stack = rand() < 0.3 ? 2 : 1;
      for (let s = 0; s < stack; s++) {
        const quads = blockQuads(bx, hAt(bx, bz) + s, bz, 1);
        quads.forEach((q, face) => {
          if (face === BlockFace.Bottom) return; // liegt auf dem Boden
          if (s === 0 && stack === 2 && face === BlockFace.Top) return; // verdeckt vom oberen Block
          add(q, face === BlockFace.Top ? 4 + b : b, 1);
        });
      }
    }
  }
  return { tiles, checksum };
}
