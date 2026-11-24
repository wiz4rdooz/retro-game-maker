import { packBits, unpackBits, type TileData } from './types';

/**
 * Kacheln eines Chunks als Struktur aus typisierten Arrays (eine Zeile je Kachel).
 * Änderungen laufen über World, damit Dirty-Mengen und id-Zuordnung stimmen.
 */
export class Chunk {
  readonly key: number;
  count = 0;
  ids: Uint32Array;
  layer: Uint16Array;
  tileset: Int16Array;
  txy: Uint16Array;
  bits: Uint8Array;
  corners: Float32Array;
  /** Umschließende Box aller Kacheln (bei leerem Chunk +∞ / −∞). Wächst beim Hinzufügen, schrumpft nicht. */
  readonly min = new Float32Array([Infinity, Infinity, Infinity]);
  readonly max = new Float32Array([-Infinity, -Infinity, -Infinity]);
  private readonly index = new Map<number, number>();

  constructor(key: number, capacity = 64) {
    this.key = key;
    this.ids = new Uint32Array(capacity);
    this.layer = new Uint16Array(capacity);
    this.tileset = new Int16Array(capacity);
    this.txy = new Uint16Array(capacity * 2);
    this.bits = new Uint8Array(capacity);
    this.corners = new Float32Array(capacity * 12);
  }

  indexOf(id: number): number {
    return this.index.get(id) ?? -1;
  }

  read(i: number): TileData {
    return {
      layer: this.layer[i],
      tileset: this.tileset[i],
      tx: this.txy[i * 2],
      ty: this.txy[i * 2 + 1],
      ...unpackBits(this.bits[i]),
      corners: this.corners.slice(i * 12, i * 12 + 12),
    };
  }

  /** @internal Nur für World. */
  push(id: number, t: TileData): number {
    if (this.count === this.ids.length) this.grow();
    const i = this.count++;
    this.ids[i] = id;
    this.index.set(id, i);
    this.writeAt(i, t);
    return i;
  }

  /** @internal Nur für World. Überschreibt die Daten an Index i. */
  writeAt(i: number, t: TileData): void {
    this.layer[i] = t.layer;
    this.tileset[i] = t.tileset;
    this.txy[i * 2] = t.tx;
    this.txy[i * 2 + 1] = t.ty;
    this.bits[i] = packBits(t);
    const base = i * 12;
    for (let k = 0; k < 12; k++) this.corners[base + k] = t.corners[k];
    for (let k = 0; k < 12; k++) {
      const v = t.corners[k];
      const axis = k % 3;
      if (v < this.min[axis]) this.min[axis] = v;
      if (v > this.max[axis]) this.max[axis] = v;
    }
  }

  /** @internal Nur für World. Entfernt Index i (die letzte Kachel rückt nach). */
  removeAt(i: number): void {
    const last = this.count - 1;
    const id = this.ids[i];
    this.index.delete(id);
    if (i !== last) {
      const movedId = this.ids[last];
      this.ids[i] = movedId;
      this.layer[i] = this.layer[last];
      this.tileset[i] = this.tileset[last];
      this.txy[i * 2] = this.txy[last * 2];
      this.txy[i * 2 + 1] = this.txy[last * 2 + 1];
      this.bits[i] = this.bits[last];
      this.corners.copyWithin(i * 12, last * 12, last * 12 + 12);
      this.index.set(movedId, i);
    }
    this.count = last;
    if (this.count === 0) {
      this.min.fill(Infinity);
      this.max.fill(-Infinity);
    }
  }

  private grow(): void {
    const cap = this.ids.length * 2;
    const grow = <T extends Uint32Array | Uint16Array | Int16Array | Uint8Array | Float32Array>(a: T, n: number): T => {
      const b = new (a.constructor as new (len: number) => T)(n);
      b.set(a);
      return b;
    };
    this.ids = grow(this.ids, cap);
    this.layer = grow(this.layer, cap);
    this.tileset = grow(this.tileset, cap);
    this.txy = grow(this.txy, cap * 2);
    this.bits = grow(this.bits, cap);
    this.corners = grow(this.corners, cap * 12);
  }
}
