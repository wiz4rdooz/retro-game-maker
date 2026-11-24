import type { TileData } from '@rgm/engine';
import { recordBytes, type Command, type DocCtx } from './command';

export interface TileChange {
  id: number;
  before: TileData;
  after: TileData;
}

export interface TileEdit {
  add: TileData[];
  remove: number[];
  update: TileChange[];
}

export type AddingCommand = Command<DocCtx> & { readonly addedIds: readonly number[] };

const cloneTile = (t: TileData): TileData => ({ ...t, corners: new Float32Array(t.corners) });

/**
 * Ändert, entfernt und setzt Kacheln in einem Schritt (in dieser Reihenfolge; rückgängig umgekehrt).
 * Neue Kacheln bekommen beim ersten `do` ihre ids, beim Wiederholen dieselben.
 * Fehlende ids werden übersprungen. Die Daten werden beim Anlegen kopiert.
 */
class EditTilesCommand implements Command<DocCtx> {
  readonly bytes: number;
  private readonly add: TileData[];
  private readonly removeIds: number[];
  private readonly update: TileChange[];
  private removed: { id: number; data: TileData }[] = [];
  private ids: number[] | null = null;

  constructor(
    op: TileEdit,
    readonly label: string,
  ) {
    this.add = op.add.map(cloneTile);
    this.removeIds = [...new Set(op.remove)];
    this.update = op.update.map((c) => ({ id: c.id, before: cloneTile(c.before), after: cloneTile(c.after) }));
    // je Änderung zwei Datensätze (vorher/nachher)
    this.bytes = recordBytes(this.add.length + this.removeIds.length + 2 * this.update.length);
  }

  get addedIds(): readonly number[] {
    return this.ids ?? [];
  }

  do({ world }: DocCtx): void {
    for (const c of this.update) if (world.hasTile(c.id)) world.setTile(c.id, c.after);
    this.removed = [];
    for (const id of this.removeIds) {
      const data = world.removeTile(id);
      if (data) this.removed.push({ id, data });
    }
    const known = this.ids;
    const ids = known ?? new Array<number>(this.add.length);
    for (let i = 0; i < this.add.length; i++) ids[i] = world.addTile(this.add[i], known ? known[i] : undefined);
    this.ids = ids;
  }

  undo({ world }: DocCtx): void {
    const ids = this.ids ?? [];
    for (let i = ids.length - 1; i >= 0; i--) world.removeTile(ids[i]);
    for (let i = this.removed.length - 1; i >= 0; i--) world.addTile(this.removed[i].data, this.removed[i].id);
    for (let i = this.update.length - 1; i >= 0; i--) {
      const c = this.update[i];
      if (world.hasTile(c.id)) world.setTile(c.id, c.before);
    }
  }
}

export function editTilesCmd(op: TileEdit, label: string): AddingCommand {
  return new EditTilesCommand(op, label);
}

export function addTilesCmd(tiles: TileData[], label = 'Kacheln setzen'): AddingCommand {
  return new EditTilesCommand({ add: tiles, remove: [], update: [] }, label);
}

export function removeTilesCmd(ids: number[], label = 'Kacheln entfernen'): Command<DocCtx> {
  return new EditTilesCommand({ add: [], remove: ids, update: [] }, label);
}

export function updateTilesCmd(changes: TileChange[], label = 'Kacheln ändern'): Command<DocCtx> {
  return new EditTilesCommand({ add: [], remove: [], update: changes }, label);
}
