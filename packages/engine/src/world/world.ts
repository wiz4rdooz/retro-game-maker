import { quadNormal } from '../geometry/quad';
import { Chunk } from './chunk';
import { CHUNK_SIZE, chunkKeyForPoint } from './keys';
import type { Layer, TileData } from './types';

type V = ArrayLike<number>;
export type Facing = 'same' | 'opposite' | 'any';

const tmpA = new Float32Array(3);
const tmpB = new Float32Array(3);

/** Die Welt: Ebenen und alle Kacheln, aufgeteilt in Chunks (Konvention K5). */
export class World {
  readonly chunkSize: number;
  layers: Layer[] = [];
  nextTileId = 1;
  nextLayerId = 1;
  private readonly _chunks = new Map<number, Chunk>();
  private readonly idChunk = new Map<number, number>();
  private renderDirty = new Set<number>();
  private saveDirty = new Set<number>();

  constructor(chunkSize = CHUNK_SIZE) {
    this.chunkSize = chunkSize;
  }

  get chunks(): ReadonlyMap<number, Chunk> {
    return this._chunks;
  }

  /** Legt eine Kachel an. Mit id (beim Laden oder Wiederholen) wird genau diese id benutzt. */
  addTile(t: TileData, id?: number): number {
    let tileId: number;
    if (id === undefined) {
      tileId = this.nextTileId;
    } else {
      if (!Number.isInteger(id) || id <= 0) throw new Error(`Ungültige Kachel-id: ${id}`);
      if (this.idChunk.has(id)) throw new Error(`Kachel-id ${id} gibt es schon`);
      tileId = id;
    }
    if (tileId >= this.nextTileId) this.nextTileId = tileId + 1;
    const key = this.keyFor(t.corners);
    let chunk = this._chunks.get(key);
    if (!chunk) {
      chunk = new Chunk(key);
      this._chunks.set(key, chunk);
    }
    chunk.push(tileId, t);
    this.idChunk.set(tileId, key);
    this.touch(key);
    return tileId;
  }

  removeTile(id: number): TileData | null {
    const key = this.idChunk.get(id);
    if (key === undefined) return null;
    const chunk = this._chunks.get(key)!;
    const i = chunk.indexOf(id);
    const data = chunk.read(i);
    chunk.removeAt(i);
    if (chunk.count === 0) this._chunks.delete(key);
    this.idChunk.delete(id);
    this.touch(key);
    return data;
  }

  getTile(id: number): TileData | null {
    const key = this.idChunk.get(id);
    if (key === undefined) return null;
    const chunk = this._chunks.get(key)!;
    return chunk.read(chunk.indexOf(id));
  }

  /** Ersetzt die Daten einer Kachel; wechselt der Schwerpunkt den Chunk, wandert sie mit. */
  setTile(id: number, t: TileData): void {
    const oldKey = this.idChunk.get(id);
    if (oldKey === undefined) throw new Error(`Kachel-id ${id} gibt es nicht`);
    const key = this.keyFor(t.corners);
    if (key === oldKey) {
      const chunk = this._chunks.get(key)!;
      chunk.writeAt(chunk.indexOf(id), t);
      this.touch(key);
    } else {
      this.removeTile(id);
      this.addTile(t, id);
    }
  }

  hasTile(id: number): boolean {
    return this.idChunk.has(id);
  }

  tileCount(): number {
    return this.idChunk.size;
  }

  chunkKeyOf(id: number): number | undefined {
    return this.idChunk.get(id);
  }

  /**
   * Sucht eine Kachel mit denselben vier Eckpunkten (Reihenfolge egal) im Chunk des Schwerpunkts.
   * 'same'/'opposite' verlangen zusätzlich gleiche bzw. entgegengesetzte Normale.
   */
  findCoincident(corners: V, facing: Facing, eps = 1e-4): number | null {
    const chunk = this._chunks.get(this.keyFor(corners));
    if (!chunk) return null;
    if (facing !== 'any') quadNormal(corners, tmpA);
    const c = chunk.corners;
    for (let i = 0; i < chunk.count; i++) {
      const base = i * 12;
      if (!sameCornerSet(corners, 0, c, base, eps)) continue;
      if (facing === 'any') return chunk.ids[i];
      quadNormal(c, tmpB, base);
      const d = tmpA[0] * tmpB[0] + tmpA[1] * tmpB[1] + tmpA[2] * tmpB[2];
      if (facing === 'same' ? d > 0.99 : d < -0.99) return chunk.ids[i];
    }
    return null;
  }

  /** Ruft cb für jede Kachel auf, deren Box die Suchbox schneidet. Die Welt darf in cb nicht geändert werden. */
  queryAabb(min: V, max: V, cb: (id: number, chunk: Chunk, index: number) => void): void {
    for (const chunk of this._chunks.values()) {
      if (chunk.max[0] < min[0] || chunk.min[0] > max[0]) continue;
      if (chunk.max[1] < min[1] || chunk.min[1] > max[1]) continue;
      if (chunk.max[2] < min[2] || chunk.min[2] > max[2]) continue;
      const c = chunk.corners;
      for (let i = 0; i < chunk.count; i++) {
        const b = i * 12;
        let hit = true;
        for (let axis = 0; axis < 3 && hit; axis++) {
          let lo = Infinity, hi = -Infinity;
          for (let k = 0; k < 4; k++) {
            const v = c[b + k * 3 + axis];
            if (v < lo) lo = v;
            if (v > hi) hi = v;
          }
          if (hi < min[axis] || lo > max[axis]) hit = false;
        }
        if (hit) cb(chunk.ids[i], chunk, i);
      }
    }
  }

  takeRenderDirty(): Set<number> {
    const s = this.renderDirty;
    this.renderDirty = new Set();
    return s;
  }

  takeSaveDirty(): Set<number> {
    const s = this.saveDirty;
    this.saveDirty = new Set();
    return s;
  }

  markAllRenderDirty(): void {
    for (const key of this._chunks.keys()) this.renderDirty.add(key);
  }

  addLayer(name: string, id?: number): Layer {
    const layerId = id ?? this.nextLayerId;
    if (this.layers.some((l) => l.id === layerId)) throw new Error(`Ebenen-id ${layerId} gibt es schon`);
    if (layerId >= this.nextLayerId) this.nextLayerId = layerId + 1;
    const layer: Layer = { id: layerId, name, visible: true, locked: false };
    this.layers.push(layer);
    return layer;
  }

  /** Entfernt eine leere Ebene; wirft, solange sie Kacheln hat. */
  removeLayer(id: number): void {
    if (this.layerTileCount(id) > 0) throw new Error(`Ebene ${id} hat noch Kacheln`);
    this.layers = this.layers.filter((l) => l.id !== id);
  }

  layerTileCount(id: number): number {
    let n = 0;
    for (const chunk of this._chunks.values()) {
      for (let i = 0; i < chunk.count; i++) if (chunk.layer[i] === id) n++;
    }
    return n;
  }

  bounds(): { min: Float32Array; max: Float32Array } | null {
    if (this._chunks.size === 0) return null;
    const min = new Float32Array([Infinity, Infinity, Infinity]);
    const max = new Float32Array([-Infinity, -Infinity, -Infinity]);
    for (const chunk of this._chunks.values()) {
      for (let a = 0; a < 3; a++) {
        if (chunk.min[a] < min[a]) min[a] = chunk.min[a];
        if (chunk.max[a] > max[a]) max[a] = chunk.max[a];
      }
    }
    return min[0] <= max[0] ? { min, max } : null;
  }

  /** Chunk-Schlüssel, in dem eine Kachel mit diesen Ecken liegt (Schwerpunkt). */
  chunkKeyForCorners(corners: V): number {
    return this.keyFor(corners);
  }

  /** Chunk-Schlüssel aus dem Schwerpunkt; nicht endliche Ecken zählen nicht mit. */
  private keyFor(corners: V): number {
    const p = [0, 0, 0];
    for (let axis = 0; axis < 3; axis++) {
      let sum = 0, n = 0;
      for (let k = 0; k < 4; k++) {
        const v = corners[k * 3 + axis];
        if (Number.isFinite(v)) {
          sum += v;
          n++;
        }
      }
      p[axis] = n > 0 ? sum / n : 0;
    }
    return chunkKeyForPoint(p[0], p[1], p[2], this.chunkSize);
  }

  private touch(key: number): void {
    this.renderDirty.add(key);
    this.saveDirty.add(key);
  }
}

/** true, wenn jede Ecke von a eine Ecke in b hat und umgekehrt (Abstand ≤ eps je Achse). */
function sameCornerSet(a: V, ab: number, b: V, bb: number, eps: number): boolean {
  return covers(a, ab, b, bb, eps) && covers(b, bb, a, ab, eps);
}

function covers(a: V, ab: number, b: V, bb: number, eps: number): boolean {
  for (let i = 0; i < 4; i++) {
    const ax = a[ab + i * 3], ay = a[ab + i * 3 + 1], az = a[ab + i * 3 + 2];
    let found = false;
    for (let j = 0; j < 4 && !found; j++) {
      found =
        Math.abs(ax - b[bb + j * 3]) <= eps &&
        Math.abs(ay - b[bb + j * 3 + 1]) <= eps &&
        Math.abs(az - b[bb + j * 3 + 2]) <= eps;
    }
    if (!found) return false;
  }
  return true;
}
