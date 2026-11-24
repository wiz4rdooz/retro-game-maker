import {
  World,
  FormatError,
  chunkFileName,
  chunkKey,
  decodeChunkInto,
  decodeWorldMeta,
  encodeChunk,
  encodeWorldMeta,
  type FormatMessages,
} from '@rgm/engine';
import type { t } from '../strings/de';
import { defaultEditorPrefs, type EditorPrefs, type ProjectFile, type TilesetMeta } from './projectModel';
import { isSafePath, type ProjectStorage } from './storage';

export type FehlerTexte = typeof t.fehler;

export const PROJECT_FILE = 'projekt.json';
export const BACKUP_DIR = '.sicherung/';
const COUNTER_FILE = '.sicherung/zaehler.txt';
const BACKUP_SLOTS = 10;
const WORLD_NAME = /^[A-Za-z0-9_-]{1,64}$/;
const CHUNK_FILE = /^(-?\d+)_(-?\d+)_(-?\d+)\.json$/;

export const worldFile = (world: string) => `welten/${world}/welt.json`;
export const chunkDir = (world: string) => `welten/${world}/chunks/`;

export interface LoadedProject {
  project: ProjectFile;
  world: World;
  tilesetBytes: Map<number, Uint8Array>;
  warnings: string[];
}

/** Liest und schreibt ein Projekt nach K8; vor jedem Überschreiben landet die alte Datei in `.sicherung/<slot>/`. */
export class ProjectIO {
  private readonly engineMessages: FormatMessages;

  constructor(
    readonly storage: ProjectStorage,
    private readonly messages: FehlerTexte,
  ) {
    this.engineMessages = { newerVersion: messages.neuereVersion, broken: messages.kaputt };
  }

  async load(): Promise<LoadedProject> {
    const s = this.storage;
    const warnings: string[] = [];
    const text = await s.readText(PROJECT_FILE);
    if (text === null) throw new FormatError(this.messages.kaputt);
    const project = parseProject(text, this.engineMessages);

    const metaText = await s.readText(worldFile(project.activeWorld));
    if (metaText === null) throw new FormatError(this.messages.kaputt);
    const meta = decodeWorldMeta(metaText, this.engineMessages);
    const world = new World(meta.chunkSize);
    world.layers = meta.layers;
    world.nextTileId = meta.nextTileId;
    world.nextLayerId = meta.nextLayerId;
    for (const path of await s.list(chunkDir(project.activeWorld))) {
      if (!path.endsWith('.json')) continue;
      const chunkText = await s.readText(path);
      if (chunkText === null) continue;
      try {
        decodeChunkInto(world, chunkText, this.engineMessages);
      } catch (e) {
        if (!(e instanceof FormatError) || e.message !== this.messages.kaputt) throw e;
        warnings.push(this.messages.dateiUebersprungen(path));
      }
    }
    addMissingLayers(world);
    world.takeSaveDirty();

    const tilesetBytes = new Map<number, Uint8Array>();
    for (const ts of project.tilesets) {
      const bytes = isSafePath(ts.file) ? await s.readBytes(ts.file) : null;
      if (bytes) tilesetBytes.set(ts.id, bytes);
      else warnings.push(this.messages.tilesetFehlt(ts.file));
    }
    return { project, world, tilesetBytes, warnings };
  }

  /** Schreibt alles; Chunk-Dateien ohne Chunk in der Welt werden gelöscht. */
  async saveAll(project: ProjectFile, world: World): Promise<void> {
    const keys = new Set<number>(world.chunks.keys());
    const dir = chunkDir(checkWorldName(project.activeWorld));
    for (const p of await this.storage.list(dir)) {
      const k = keyOfChunkFile(p.slice(dir.length));
      if (k !== null) keys.add(k);
    }
    await this.saveChanges(project, world, keys);
  }

  /**
   * Schreibt projekt.json, welt.json, die geänderten Chunks (leer → Datei löschen) und neue Dateien.
   * Alles wird vor dem ersten await kodiert, spätere Änderungen an der Welt stören also nicht.
   */
  async saveChanges(
    project: ProjectFile,
    world: World,
    dirtyChunks: ReadonlySet<number>,
    newFiles: ReadonlyMap<string, Uint8Array> = new Map(),
  ): Promise<void> {
    const name = checkWorldName(project.activeWorld);
    const writes: [string, string | Uint8Array][] = [];
    const removes: string[] = [];
    for (const [path, bytes] of newFiles) writes.push([path, bytes]);
    for (const key of dirtyChunks) {
      const path = chunkDir(name) + chunkFileName(key);
      const chunk = world.chunks.get(key);
      if (chunk && chunk.count > 0) writes.push([path, encodeChunk(chunk)]);
      else removes.push(path);
    }
    writes.push([worldFile(name), encodeWorldMeta(world)]);
    writes.push([PROJECT_FILE, JSON.stringify(project, null, 2)]);

    await this.backup([...writes.map((w) => w[0]), ...removes]);
    const s = this.storage;
    for (const [path, data] of writes) {
      if (typeof data === 'string') await s.writeText(path, data);
      else await s.writeBytes(path, data);
    }
    for (const path of removes) await s.remove(path);
  }

  /** Kopiert die vorhandenen Dateien unter paths in den nächsten Sicherungs-Slot (vorher geleert). */
  private async backup(paths: string[]): Promise<void> {
    const s = this.storage;
    const n = Number.parseInt((await s.readText(COUNTER_FILE)) ?? '0', 10);
    const counter = Number.isSafeInteger(n) && n >= 0 ? n : 0;
    const slotDir = `${BACKUP_DIR}${counter % BACKUP_SLOTS}/`;
    for (const p of await s.list(slotDir)) await s.remove(p);
    for (const p of paths) {
      const bytes = await s.readBytes(p);
      if (bytes) await s.writeBytes(slotDir + p, bytes);
    }
    await s.writeText(COUNTER_FILE, String(counter + 1));
  }
}

function checkWorldName(name: string): string {
  if (!WORLD_NAME.test(name)) throw new Error(`Ungültiger Weltname: ${name}`);
  return name;
}

function keyOfChunkFile(name: string): number | null {
  const m = CHUNK_FILE.exec(name);
  if (!m) return null;
  try {
    return chunkKey(Number(m[1]), Number(m[2]), Number(m[3]));
  } catch {
    return null;
  }
}

/** Kacheln auf unbekannten Ebenen bekommen eine Ebene, damit sie sichtbar und löschbar bleiben. */
function addMissingLayers(world: World): void {
  const known = new Set(world.layers.map((l) => l.id));
  for (const chunk of world.chunks.values()) {
    for (let i = 0; i < chunk.count; i++) {
      const id = chunk.layer[i];
      if (!known.has(id)) {
        world.addLayer(`Ebene ${id}`, id);
        known.add(id);
      }
    }
  }
}

function parseProject(text: string, m: FormatMessages): ProjectFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new FormatError(m.broken);
  }
  if (!isObject(raw) || raw.format !== 'rgm-projekt' || !isInt(raw.version, 1)) throw new FormatError(m.broken);
  if (raw.version > 1) throw new FormatError(m.newerVersion);
  const worlds = Array.isArray(raw.worlds)
    ? raw.worlds.filter((w): w is string => typeof w === 'string' && WORLD_NAME.test(w))
    : [];
  const activeWorld = typeof raw.activeWorld === 'string' && worlds.includes(raw.activeWorld) ? raw.activeWorld : worlds[0];
  if (!activeWorld) throw new FormatError(m.broken);
  const tilesets: TilesetMeta[] = [];
  if (Array.isArray(raw.tilesets)) {
    for (const v of raw.tilesets) {
      const ts = parseTileset(v);
      if (ts && !tilesets.some((x) => x.id === ts.id)) tilesets.push(ts);
    }
  }
  const maxId = tilesets.reduce((mx, ts) => Math.max(mx, ts.id), -1);
  return {
    format: 'rgm-projekt',
    version: 1,
    name: typeof raw.name === 'string' ? raw.name : '',
    created: typeof raw.created === 'string' ? raw.created : '',
    activeWorld,
    worlds,
    tilesets,
    nextTilesetId: Math.max(isInt(raw.nextTilesetId, 0) ? raw.nextTilesetId : 0, maxId + 1),
    editor: parsePrefs(raw.editor),
  };
}

function parseTileset(v: unknown): TilesetMeta | null {
  if (!isObject(v)) return null;
  const { id, name, file, tileSize, imageWidth, imageHeight, columns, rows } = v;
  if (!isInt(id, 0, 0x7fff) || typeof name !== 'string' || typeof file !== 'string') return null;
  if (!isInt(tileSize, 1) || !isInt(imageWidth, 1) || !isInt(imageHeight, 1) || !isInt(columns, 0) || !isInt(rows, 0)) return null;
  return { id, name, file, tileSize, imageWidth, imageHeight, columns, rows };
}

function parsePrefs(v: unknown): EditorPrefs {
  const p = isObject(v) ? v : {};
  const d = defaultEditorPrefs(isInt(p.activeLayer, 0, 0xffff) ? p.activeLayer : 1);
  const cam = isObject(p.camera) ? p.camera : {};
  for (const k of ['x', 'y', 'z', 'yaw', 'pitch'] as const) {
    const n = cam[k];
    if (typeof n === 'number' && Number.isFinite(n)) d.camera[k] = n;
  }
  if (p.snap === 1 || p.snap === 0.5 || p.snap === 0.25) d.snap = p.snap;
  if (p.drawPlane === 'auto' || p.drawPlane === 'x' || p.drawPlane === 'y' || p.drawPlane === 'z') d.drawPlane = p.drawPlane;
  return d;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isInt(v: unknown, min: number, max = Number.MAX_SAFE_INTEGER): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
}
