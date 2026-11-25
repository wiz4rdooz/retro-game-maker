import { quadIsDegenerate, quadNormal } from '../geometry/quad';
import { tileLocalUVs } from '../geometry/tileFrame';
import type { TilesetInfo } from '../geometry/uv';
import type { Chunk } from '../world/chunk';
import { overlapRanks } from './overlapRanks';

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
  /** Texturkoordinaten in Kachel-Einheiten (2 je Ecke), Wiederholung im Shader. */
  locals: Float32Array;
  /** Kachel im Tileset (tx, ty) je Ecke. */
  cells: Float32Array;
  shades: Float32Array;
  /** Rangstufe 0–3 je Ecke: höhere Stufen liegen bei Überlappung in derselben Fläche vorn. */
  ranks: Float32Array;
  indices: Uint32Array;
  triangles: number;
}

interface Builder {
  part: ChunkMeshPart;
  quads: number;
}

const tmpLocal = new Float32Array(8);
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
  layerOrder: (layer: number) => number = (layer) => layer,
): ChunkMeshPart[] {
  const ranks = overlapRanks(chunk, layerOrder);
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
        locals: new Float32Array(n * 8),
        cells: new Float32Array(n * 8),
        shades: new Float32Array(n * 4),
        ranks: new Float32Array(n * 4),
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
    const bits = chunk.bits[i];
    const own = tsId === chunk.tileset[i];
    quadNormal(c, tmpN, i * 12);
    tileLocalUVs(c, i * 12, (bits & 3) as 0 | 1 | 2 | 3, (bits & 4) !== 0, (bits & 8) !== 0, tmpLocal, tmpN);
    const tx = own ? chunk.txy[i * 2] : 0;
    const ty = own ? chunk.txy[i * 2 + 1] : 0;
    writeQuad(b, c, i * 12, ORDER_FRONT, faceShade(tmpN[0], tmpN[1], tmpN[2]), tx, ty, ranks[i]);
    if (sides[i] === 2) writeQuad(b, c, i * 12, ORDER_BACK, faceShade(-tmpN[0], -tmpN[1], -tmpN[2]), tx, ty, ranks[i]);
  }
  return [...builders.values()].map((b) => b.part);
}

function writeQuad(b: Builder, corners: Float32Array, base: number, order: number[], shade: number, tx: number, ty: number, rank: number): void {
  const p = b.part;
  const q = b.quads++;
  const v0 = q * 4;
  for (let k = 0; k < 4; k++) {
    const src = order[k];
    const pv = (v0 + k) * 3;
    p.positions[pv] = corners[base + src * 3];
    p.positions[pv + 1] = corners[base + src * 3 + 1];
    p.positions[pv + 2] = corners[base + src * 3 + 2];
    p.locals[(v0 + k) * 2] = tmpLocal[src * 2];
    p.locals[(v0 + k) * 2 + 1] = tmpLocal[src * 2 + 1];
    p.cells[(v0 + k) * 2] = tx;
    p.cells[(v0 + k) * 2 + 1] = ty;
    p.shades[v0 + k] = shade;
    p.ranks[v0 + k] = rank;
  }
  const ii = q * 6;
  p.indices[ii] = v0;
  p.indices[ii + 1] = v0 + 1;
  p.indices[ii + 2] = v0 + 2;
  p.indices[ii + 3] = v0;
  p.indices[ii + 4] = v0 + 2;
  p.indices[ii + 5] = v0 + 3;
}
