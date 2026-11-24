/** Kantenlänge eines Chunks in Rasterzellen (Metern). */
export const CHUNK_SIZE = 32;

const OFFSET = 512;
const MIN_C = -512;
const MAX_C = 511;

/** Packt Chunk-Koordinaten (je −512 … 511) in eine nicht negative Zahl < 2³⁰. */
export function chunkKey(cx: number, cy: number, cz: number): number {
  if (!inRange(cx) || !inRange(cy) || !inRange(cz)) {
    throw new RangeError(`Chunk-Koordinaten außerhalb von −512 … 511: ${cx}, ${cy}, ${cz}`);
  }
  return ((cx + OFFSET) << 20) | ((cy + OFFSET) << 10) | (cz + OFFSET);
}

export function chunkCoords(key: number): [number, number, number] {
  return [((key >> 20) & 1023) - OFFSET, ((key >> 10) & 1023) - OFFSET, (key & 1023) - OFFSET];
}

/**
 * Chunk, der den Punkt enthält. Nicht endliche Werte zählen als 0, Punkte außerhalb
 * des gültigen Bereichs landen im Randchunk – so wirft eine beschädigte Kachel nie.
 */
export function chunkKeyForPoint(x: number, y: number, z: number, size = CHUNK_SIZE): number {
  return chunkKey(cell(x, size), cell(y, size), cell(z, size));
}

function cell(v: number, size: number): number {
  if (!Number.isFinite(v)) return 0;
  const c = Math.floor(v / size);
  return c < MIN_C ? MIN_C : c > MAX_C ? MAX_C : c;
}

function inRange(c: number): boolean {
  return Number.isInteger(c) && c >= MIN_C && c <= MAX_C;
}
