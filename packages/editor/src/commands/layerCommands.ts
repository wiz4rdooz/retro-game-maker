import type { Layer, TileData } from '@rgm/engine';
import { MIN_COMMAND_BYTES, recordBytes, type Command, type DocCtx } from './command';

type LayerPatch = Partial<Omit<Layer, 'id'>>;

class AddLayerCommand implements Command<DocCtx> {
  readonly label = 'Ebene anlegen';
  readonly bytes = MIN_COMMAND_BYTES;
  private id = -1;
  constructor(private readonly name: string) {}
  get layerId(): number {
    return this.id;
  }
  do({ world }: DocCtx): void {
    this.id = world.addLayer(this.name, this.id >= 0 ? this.id : undefined).id;
  }
  undo({ world }: DocCtx): void {
    world.removeLayer(this.id);
  }
}

/** Löscht eine Ebene samt ihren Kacheln; rückgängig stellt Ebene (an alter Stelle) und Kacheln wieder her. */
class RemoveLayerCommand implements Command<DocCtx> {
  readonly label = 'Ebene löschen';
  private saved: { layer: Layer; index: number } | null = null;
  private tiles: { id: number; data: TileData }[] = [];
  constructor(private readonly id: number) {}
  get bytes(): number {
    return recordBytes(this.tiles.length);
  }
  do({ world }: DocCtx): void {
    const index = world.layers.findIndex((l) => l.id === this.id);
    this.tiles = [];
    if (index < 0) {
      this.saved = null;
      return;
    }
    this.saved = { layer: { ...world.layers[index] }, index };
    const ids: number[] = [];
    for (const chunk of world.chunks.values()) {
      for (let i = 0; i < chunk.count; i++) if (chunk.layer[i] === this.id) ids.push(chunk.ids[i]);
    }
    for (const id of ids) {
      const data = world.removeTile(id);
      if (data) this.tiles.push({ id, data });
    }
    world.removeLayer(this.id);
  }
  undo({ world }: DocCtx): void {
    if (!this.saved) return;
    const { layer, index } = this.saved;
    const restored = world.addLayer(layer.name, layer.id);
    restored.visible = layer.visible;
    restored.locked = layer.locked;
    const list = world.layers;
    list.splice(list.indexOf(restored), 1);
    list.splice(Math.min(index, list.length), 0, restored);
    for (let i = this.tiles.length - 1; i >= 0; i--) world.addTile(this.tiles[i].data, this.tiles[i].id);
  }
}

class UpdateLayerCommand implements Command<DocCtx> {
  readonly label = 'Ebene ändern';
  readonly bytes = MIN_COMMAND_BYTES;
  private readonly patch: LayerPatch;
  private before: LayerPatch | null = null;
  constructor(
    private readonly id: number,
    patch: LayerPatch,
  ) {
    const clean: LayerPatch = {};
    if (patch.name !== undefined) clean.name = patch.name;
    if (patch.visible !== undefined) clean.visible = patch.visible;
    if (patch.locked !== undefined) clean.locked = patch.locked;
    this.patch = clean;
  }
  do({ world }: DocCtx): void {
    const layer = world.layers.find((l) => l.id === this.id);
    if (!layer) {
      this.before = null;
      return;
    }
    const before: LayerPatch = {};
    if (this.patch.name !== undefined) before.name = layer.name;
    if (this.patch.visible !== undefined) before.visible = layer.visible;
    if (this.patch.locked !== undefined) before.locked = layer.locked;
    this.before = before;
    this.apply(world, layer, this.patch);
  }
  undo({ world }: DocCtx): void {
    const layer = world.layers.find((l) => l.id === this.id);
    if (layer && this.before) this.apply(world, layer, this.before);
  }
  private apply(world: DocCtx['world'], layer: Layer, p: LayerPatch): void {
    const visibilityChanges = p.visible !== undefined && p.visible !== layer.visible;
    Object.assign(layer, p);
    // ausgeblendete Ebenen fallen beim Vernetzen weg
    if (visibilityChanges) world.markAllRenderDirty();
  }
}

export function addLayerCmd(name: string): Command<DocCtx> & { readonly layerId: number } {
  return new AddLayerCommand(name);
}

export function removeLayerCmd(id: number): Command<DocCtx> {
  return new RemoveLayerCommand(id);
}

export function updateLayerCmd(id: number, patch: LayerPatch): Command<DocCtx> {
  return new UpdateLayerCommand(id, patch);
}
