import { quadIsDegenerate, quadNormal } from '../geometry/quad';
import { tileUVs, type TilesetInfo } from '../geometry/uv';
import type { Chunk } from '../world/chunk';

const L_LEN = Math.hypot(0.35, 1, 0.6);
const LX = 0.35 / L_LEN;
const LY = 1 / L_LEN;
const LZ = 0.6 / L_LEN;

/** Helligkeit einer Fläche nach K6: clamp(0.55 + 0.45 · n·L, 0.4, 1). */
export function faceShade(nx: number, ny: number, nz: number): number {
  const s = 0.55 + 0.45 * (nx * LX + ny * LY + nz * LZ);
  return s < 0.4 ? 0.4 : s > 1 ? 1 : s;
}

export interface ChunkMeshPart {
  tileset: number;
  positions: Float32Array;
  uvs: Float32Array;
  shades: Float32Array;
  indices: Uint32Array;
  triangles: number;
}

interface Builder {
  part: ChunkMeshPart;
  quads: number;
}

const tmpUv = new Float32Array(8);
const tmpN = new Float32Array(3);
const ORDER_FRONT = [0, 1, 2, 3];
const ORDER_BACK = [0, 3, 2, 1];

/** Tileset der eingebauten Prüftextur; Ersatz für fehlende Tilesets. */
const FALLBACK_TILESET = -1;

/**
 * Baut die Zeichendaten eines Chunks: ein Teil je Tileset, 4 Ecken je Kachelseite.
 * Übersprungen werden verborgene Ebenen und entartete Kacheln. Kacheln, deren Tileset fehlt,
 * zeigen die erste Kachel der Prüftextur (−1), sofern sie in tilesets steht – sonst wären sie
 * unsichtbar, aber weiter fest und anklickbar.
 */
export function buildChunkMesh(
  chunk: Chunk,
  tilesets: ReadonlyMap<number, TilesetInfo>,
  layerVisible: (layer: number) => boolean,
): ChunkMeshPart[] {
  const sides = new Uint8Array(chunk.count);
  const partOf = new Int32Array(chunk.count);
  const counts = new Map<number, number>();
  const hasFallback = tilesets.has(FALLBACK_TILESET);
  for (let i = 0; i < chunk.count; i++) {
    if (!layerVisible(chunk.layer[i])) continue;
    let tsId = chunk.tileset[i];
    if (!tilesets.has(tsId)) {
      if (!hasFallback) continue;
      tsId = FALLBACK_TILESET;
    }
    if (quadIsDegenerate(chunk.corners, i * 12)) continue;
    sides[i] = (chunk.bits[i] & 16) !== 0 ? 2 : 1;
    partOf[i] = tsId;
    counts.set(tsId, (counts.get(tsId) ?? 0) + sides[i]);
  }

  const builders = new Map<number, Builder>();
  for (const [tsId, n] of counts) {
    builders.set(tsId, {
      quads: 0,
      part: {
        tileset: tsId,
        positions: new Float32Array(n * 12),
        uvs: new Float32Array(n * 8),
        shades: new Float32Array(n * 4),
        indices: new Uint32Array(n * 6),
        triangles: n * 2,
      },
    });
  }

  const c = chunk.corners;
  for (let i = 0; i < chunk.count; i++) {
    if (sides[i] === 0) continue;
    const tsId = partOf[i];
    const b = builders.get(tsId)!;
    const info = tilesets.get(tsId)!;
    const bits = chunk.bits[i];
    const own = tsId === chunk.tileset[i];
    tileUVs(own ? chunk.txy[i * 2] : 0, own ? chunk.txy[i * 2 + 1] : 0, (bits & 3) as 0 | 1 | 2 | 3, (bits & 4) !== 0, (bits & 8) !== 0, info, tmpUv);
    quadNormal(c, tmpN, i * 12);
    writeQuad(b, c, i * 12, ORDER_FRONT, faceShade(tmpN[0], tmpN[1], tmpN[2]));
    if (sides[i] === 2) writeQuad(b, c, i * 12, ORDER_BACK, faceShade(-tmpN[0], -tmpN[1], -tmpN[2]));
  }
  return [...builders.values()].map((b) => b.part);
}

function writeQuad(b: Builder, corners: Float32Array, base: number, order: number[], shade: number): void {
  const p = b.part;
  const q = b.quads++;
  const v0 = q * 4;
  for (let k = 0; k < 4; k++) {
    const src = order[k];
    const pv = (v0 + k) * 3;
    p.positions[pv] = corners[base + src * 3];
    p.positions[pv + 1] = corners[base + src * 3 + 1];
    p.positions[pv + 2] = corners[base + src * 3 + 2];
    p.uvs[(v0 + k) * 2] = tmpUv[src * 2];
    p.uvs[(v0 + k) * 2 + 1] = tmpUv[src * 2 + 1];
    p.shades[v0 + k] = shade;
  }
  const ii = q * 6;
  p.indices[ii] = v0;
  p.indices[ii + 1] = v0 + 1;
  p.indices[ii + 2] = v0 + 2;
  p.indices[ii + 3] = v0;
  p.indices[ii + 4] = v0 + 2;
  p.indices[ii + 5] = v0 + 3;
}
