import type { World } from '@rgm/engine';
import type { EditorSession } from '../app/session';
import { addTilesetCmd } from '../commands/tilesetCommands';
import type { TilesetMeta } from '../project/projectModel';
import type { EditorState } from '../state/editorState';
import { t } from '../strings/de';
import { validateTilesetImage } from './validateTileset';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Dateiname → Tileset-Name: klein, `[^a-z0-9-_]` → `-`, eindeutig mit `-2`, `-3`, … */
export function tilesetName(fileName: string, taken: Iterable<string>): string {
  const base =
    fileName
      .replace(/\.png$/i, '')
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'tileset';
  const used = new Set(taken);
  let name = base;
  for (let n = 2; used.has(name); n++) name = `${base}-${n}`;
  return name;
}

/**
 * Liest ein PNG als Tileset ein: prüfen, als `tilesets/<name>.png` vormerken, `addTilesetCmd`
 * ausführen und (mit state) den Pinsel auf die erste Kachel des neuen Tilesets setzen.
 * Fehler werfen ein Error mit verständlichem Text.
 */
export async function importTilesetFile(
  file: File,
  tileSize: number,
  session: EditorSession,
  state?: EditorState,
): Promise<TilesetMeta> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length < PNG_SIGNATURE.length || PNG_SIGNATURE.some((b, i) => bytes[i] !== b)) throw new Error(t.tileset.keinBild);
  let image: ImageBitmap;
  try {
    image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
  } catch {
    throw new Error(t.tileset.keinBild);
  }
  const check = validateTilesetImage(image.width, image.height, tileSize, session.maxTextureSize);
  if (!check.ok) {
    image.close();
    throw new Error(check.error);
  }
  const name = tilesetName(file.name, session.project.tilesets.map((ts) => ts.name));
  const meta: TilesetMeta = {
    id: session.project.nextTilesetId,
    name,
    file: `tilesets/${name}.png`,
    tileSize,
    imageWidth: image.width,
    imageHeight: image.height,
    columns: check.columns,
    rows: check.rows,
  };
  session.tilesetImages.set(meta.id, image);
  session.addProjectFile(meta.file, bytes);
  session.exec(addTilesetCmd(meta));
  if (state) state.brush.value = { ...state.brush.value, tileset: meta.id, tx: 0, ty: 0, w: 1, h: 1, topTile: null };
  return meta;
}

/** true, sobald eine Kachel das Tileset benutzt. */
export function tilesetInUse(world: World, id: number): boolean {
  for (const chunk of world.chunks.values()) {
    const ts = chunk.tileset;
    for (let i = 0; i < chunk.count; i++) if (ts[i] === id) return true;
  }
  return false;
}
