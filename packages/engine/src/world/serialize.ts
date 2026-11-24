import type { Chunk } from './chunk';
import { chunkCoords } from './keys';
import { unpackBits, type Layer, type TileData } from './types';
import type { World } from './world';

export const FORMAT_VERSION = 1;

/** Texte für Lesefehler; die Engine kennt keine Oberflächen-Texte. */
export interface FormatMessages {
  newerVersion: string;
  broken: string;
}

export class FormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormatError';
  }
}

export interface WorldMeta {
  chunkSize: number;
  layers: Layer[];
  nextTileId: number;
  nextLayerId: number;
}

const ROW = 18;
const round4 = (v: number) => Math.round(v * 1e4) / 1e4;

export function encodeWorldMeta(world: World): string {
  return JSON.stringify({
    format: 'rgm-welt',
    version: FORMAT_VERSION,
    chunkSize: world.chunkSize,
    layers: world.layers.map((l) => ({ id: l.id, name: l.name, visible: l.visible, locked: l.locked })),
    nextTileId: world.nextTileId,
    nextLayerId: world.nextLayerId,
  });
}

export function decodeWorldMeta(text: string, messages: FormatMessages): WorldMeta {
  const raw = parseHeader(text, 'rgm-welt', messages);
  const chunkSize = raw.chunkSize;
  if (!isInt(chunkSize, 1, 1024)) throw new FormatError(messages.broken);
  const layers: Layer[] = [];
  if (Array.isArray(raw.layers)) {
    for (const l of raw.layers) {
      if (!isObject(l) || !isInt(l.id, 0, 0xffff) || typeof l.name !== 'string') continue;
      if (layers.some((x) => x.id === l.id)) continue;
      layers.push({ id: l.id, name: l.name, visible: l.visible !== false, locked: l.locked === true });
    }
  }
  const maxLayer = layers.reduce((m, l) => Math.max(m, l.id), 0);
  return {
    chunkSize,
    layers,
    nextTileId: isInt(raw.nextTileId, 1, 0xffffffff) ? raw.nextTileId : 1,
    nextLayerId: Math.max(isInt(raw.nextLayerId, 1, 0x10000) ? raw.nextLayerId : 1, maxLayer + 1),
  };
}

/** Eine Zeile je Kachel: [id, layer, tileset, tx, ty, bits, x0, y0, z0, …, z3], Koordinaten auf 1e-4 gerundet. */
export function encodeChunk(chunk: Chunk): string {
  const rows: (number | null)[][] = new Array(chunk.count);
  for (let i = 0; i < chunk.count; i++) {
    const row: (number | null)[] = [
      chunk.ids[i],
      chunk.layer[i],
      chunk.tileset[i],
      chunk.txy[i * 2],
      chunk.txy[i * 2 + 1],
      chunk.bits[i],
    ];
    for (let k = 0; k < 12; k++) {
      const v = chunk.corners[i * 12 + k];
      row.push(Number.isFinite(v) ? round4(v) : null);
    }
    rows[i] = row;
  }
  return JSON.stringify({ format: 'rgm-chunk', version: FORMAT_VERSION, tiles: rows });
}

/**
 * Liest eine Chunk-Datei in die Welt. Kaputter Kopf → FormatError(broken), neuere Version →
 * FormatError(newerVersion). Einzelne ungültige Zeilen und schon vorhandene ids werden übersprungen.
 * Nicht endliche Koordinaten (null) kommen als NaN zurück. Rückgabe: Anzahl gelesener Kacheln.
 */
export function decodeChunkInto(world: World, text: string, messages: FormatMessages): number {
  const raw = parseHeader(text, 'rgm-chunk', messages);
  if (!Array.isArray(raw.tiles)) throw new FormatError(messages.broken);
  let added = 0;
  for (const row of raw.tiles as unknown[]) {
    const t = decodeRow(row);
    if (!t || world.hasTile(t.id)) continue;
    world.addTile(t.data, t.id);
    added++;
  }
  return added;
}

export function chunkFileName(key: number): string {
  const [cx, cy, cz] = chunkCoords(key);
  return `${cx}_${cy}_${cz}.json`;
}

function decodeRow(row: unknown): { id: number; data: TileData } | null {
  if (!Array.isArray(row) || row.length !== ROW) return null;
  const [id, layer, tileset, tx, ty, bits] = row as unknown[];
  if (!isInt(id, 1, 0xffffffff) || !isInt(layer, 0, 0xffff) || !isInt(tileset, -1, 0x7fff)) return null;
  if (!isInt(tx, 0, 0xffff) || !isInt(ty, 0, 0xffff) || !isInt(bits, 0, 0xff)) return null;
  const corners = new Float32Array(12);
  for (let k = 0; k < 12; k++) {
    const v = row[6 + k] as unknown;
    if (v === null) corners[k] = NaN;
    else if (typeof v === 'number') corners[k] = v;
    else return null;
  }
  return { id, data: { layer, tileset, tx, ty, ...unpackBits(bits), corners } };
}

function parseHeader(text: string, format: string, messages: FormatMessages): Record<string, unknown> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new FormatError(messages.broken);
  }
  if (!isObject(raw) || raw.format !== format || !isInt(raw.version, 1, Number.MAX_SAFE_INTEGER)) {
    throw new FormatError(messages.broken);
  }
  if (raw.version > FORMAT_VERSION) throw new FormatError(messages.newerVersion);
  return raw;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isInt(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
}

