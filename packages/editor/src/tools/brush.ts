/** Was der Pinsel gerade setzt. tileset −1 = eingebaute Prüftextur. */
export interface BrushState {
  tileset: number;
  tx: number;
  ty: number;
  /** Ausschnitt in Kacheln (Rechteck aus dem Tileset). */
  w: number;
  h: number;
  rot: 0 | 1 | 2 | 3;
  flipX: boolean;
  flipY: boolean;
  size: 1 | 2 | 3;
  doubleSided: boolean;
  ghost: boolean;
  /** Deckel-Kachel für Blöcke; null = wie die Seiten. */
  topTile: { tx: number; ty: number } | null;
}

export const DEFAULT_BRUSH: Readonly<BrushState> = Object.freeze({
  tileset: -1,
  tx: 0,
  ty: 0,
  w: 1,
  h: 1,
  rot: 0,
  flipX: false,
  flipY: false,
  size: 1,
  doubleSided: false,
  ghost: false,
  topTile: null,
});
