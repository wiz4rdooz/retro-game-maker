/** Eine Kachel: ein Viereck im Raum mit einem Ausschnitt aus einem Tileset (Konvention K1). */
export interface TileData {
  layer: number;
  /** Tileset-id; −1 = eingebaute Prüftextur. */
  tileset: number;
  tx: number;
  ty: number;
  /** Drehung in 90°-Schritten im Uhrzeigersinn. */
  rot: 0 | 1 | 2 | 3;
  flipX: boolean;
  flipY: boolean;
  doubleSided: boolean;
  /** Ohne Kollision. */
  ghost: boolean;
  /** c0 … c3, je x, y, z (12 Zahlen), gegen den Uhrzeigersinn von vorne. */
  corners: Float32Array;
}

export interface Layer {
  id: number;
  name: string;
  visible: boolean;
  locked: boolean;
}

export type TileBits = Pick<TileData, 'rot' | 'flipX' | 'flipY' | 'doubleSided' | 'ghost'>;

/** Bit-Feld nach K4: Bits 0–1 rot, 2 flipX, 3 flipY, 4 doubleSided, 5 ghost (6 reserviert). */
export function packBits(t: TileBits): number {
  return (t.rot & 3) | (t.flipX ? 4 : 0) | (t.flipY ? 8 : 0) | (t.doubleSided ? 16 : 0) | (t.ghost ? 32 : 0);
}

export function unpackBits(bits: number): TileBits {
  return {
    rot: (bits & 3) as 0 | 1 | 2 | 3,
    flipX: (bits & 4) !== 0,
    flipY: (bits & 8) !== 0,
    doubleSided: (bits & 16) !== 0,
    ghost: (bits & 32) !== 0,
  };
}
