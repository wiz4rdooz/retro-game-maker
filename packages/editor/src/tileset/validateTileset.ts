import { t } from '../strings/de';

export type TilesetCheck =
  | { ok: true; columns: number; rows: number; warnings: string[] }
  | { ok: false; error: string };

/**
 * Prüft Bildgröße und Kachelgröße. Kachelgröße ganzzahlig 4…256; Breite und Höhe höchstens
 * maxTextureSize; mindestens eine Kachel. Ein Rest am Rand wird abgeschnitten und gemeldet.
 */
export function validateTilesetImage(width: number, height: number, tileSize: number, maxTextureSize: number): TilesetCheck {
  if (!Number.isInteger(tileSize) || tileSize < 4 || tileSize > 256) return { ok: false, error: t.tileset.kachelgroesseUngueltig };
  if (width > maxTextureSize || height > maxTextureSize) return { ok: false, error: t.tileset.zuGross(maxTextureSize) };
  if (width < tileSize || height < tileSize) return { ok: false, error: t.tileset.zuKlein };
  const columns = Math.floor(width / tileSize);
  const rows = Math.floor(height / tileSize);
  const restX = width - columns * tileSize;
  const restY = height - rows * tileSize;
  return { ok: true, columns, rows, warnings: restX > 0 || restY > 0 ? [t.tileset.randIgnoriert(restX, restY)] : [] };
}
