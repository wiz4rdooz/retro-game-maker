import type { TilesetMeta } from '../project/projectModel';
import { MIN_COMMAND_BYTES, type Command, type DocCtx } from './command';

/**
 * Trägt ein Tileset ins Projekt ein. Rückgängig nimmt es wieder heraus, lässt nextTilesetId aber
 * stehen: ids werden nie wiederverwendet.
 */
class AddTilesetCommand implements Command<DocCtx> {
  readonly label = 'Tileset hinzufügen';
  readonly bytes = MIN_COMMAND_BYTES;
  private readonly meta: TilesetMeta;
  constructor(meta: TilesetMeta) {
    this.meta = { ...meta };
  }
  do({ project }: DocCtx): void {
    if (project.tilesets.some((t) => t.id === this.meta.id)) throw new Error(`Tileset-id ${this.meta.id} gibt es schon`);
    project.tilesets.push({ ...this.meta });
    project.nextTilesetId = Math.max(project.nextTilesetId, this.meta.id + 1);
  }
  undo({ project }: DocCtx): void {
    const i = project.tilesets.findIndex((t) => t.id === this.meta.id);
    if (i >= 0) project.tilesets.splice(i, 1);
  }
}

export function addTilesetCmd(meta: TilesetMeta): Command<DocCtx> {
  return new AddTilesetCommand(meta);
}

/** Ändert Kachelgröße und Raster eines Tilesets (nur sinnvoll, solange keine Kachel es nutzt). */
class SetTilesetSizeCommand implements Command<DocCtx> {
  readonly label = 'Kachelgröße ändern';
  readonly bytes = MIN_COMMAND_BYTES;
  private before: Pick<TilesetMeta, 'tileSize' | 'columns' | 'rows'> | null = null;
  constructor(
    private readonly id: number,
    private readonly size: Pick<TilesetMeta, 'tileSize' | 'columns' | 'rows'>,
  ) {}
  do({ project }: DocCtx): void {
    const ts = project.tilesets.find((x) => x.id === this.id);
    if (!ts) return;
    this.before = { tileSize: ts.tileSize, columns: ts.columns, rows: ts.rows };
    Object.assign(ts, this.size);
  }
  undo({ project }: DocCtx): void {
    const ts = project.tilesets.find((x) => x.id === this.id);
    if (ts && this.before) Object.assign(ts, this.before);
  }
}

export function setTilesetSizeCmd(id: number, tileSize: number, columns: number, rows: number): Command<DocCtx> {
  return new SetTilesetSizeCommand(id, { tileSize, columns, rows });
}
