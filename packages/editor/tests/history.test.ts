import { describe, it, expect } from 'vitest';
import { cellQuad, type TileData } from '@rgm/engine';
import { newProject } from '../src/project/projectModel';
import { History } from '../src/commands/history';
import { addTilesCmd, removeTilesCmd, updateTilesCmd } from '../src/commands/tileCommands';
import { removeLayerCmd } from '../src/commands/layerCommands';

const doc = () => newProject('Test', new Date('2026-11-24T10:00:00Z'));
const T = (x: number, z: number, tx = 0): TileData => ({ layer: 1, tileset: 0, tx, ty: 0, rot: 0, flipX: false, flipY: false, doubleSided: false, ghost: false, corners: cellQuad({ axis: 'y', offset: 0, facing: 1 }, x, z) });

describe('History', () => {
  it('hinzufügen → rückgängig → wiederholen mit derselben id', () => {
    const d = doc(); const h = new History(d); const cmd = addTilesCmd([T(0, 0)]);
    h.exec(cmd); const id = cmd.addedIds[0];
    expect(h.undo()).toBe(true); expect(d.world.hasTile(id)).toBe(false);
    expect(h.redo()).toBe(true); expect(d.world.getTile(id)!.tx).toBe(0);
  });
  it('entfernen und ändern lassen sich exakt zurücknehmen', () => {
    const d = doc(); const h = new History(d); const add = addTilesCmd([T(1, 1, 3)]); h.exec(add); const id = add.addedIds[0];
    const before = d.world.getTile(id)!; h.exec(updateTilesCmd([{ id, before, after: { ...before, tx: 5 } }]));
    h.exec(removeTilesCmd([id])); h.undo(); h.undo();
    expect(d.world.getTile(id)!.tx).toBe(3);
  });
  it('begin/end bündelt zu einem Schritt; exec nach undo leert redo', () => {
    const d = doc(); const h = new History(d);
    h.begin('Strich'); h.exec(addTilesCmd([T(0, 0)])); h.exec(addTilesCmd([T(1, 0)])); h.end();
    h.undo(); expect(d.world.tileCount()).toBe(0);
    h.exec(addTilesCmd([T(5, 5)])); expect(h.canRedo).toBe(false);
  });
  it('maxSteps verwirft die ältesten Schritte', () => {
    const d = doc(); const h = new History(d, { maxSteps: 3 });
    for (let i = 0; i < 5; i++) h.exec(addTilesCmd([T(i, 0)]));
    let n = 0; while (h.undo()) n++; expect(n).toBe(3); expect(d.world.tileCount()).toBe(2);
  });
  it('Ebene löschen entfernt ihre Kacheln, undo stellt beides wieder her', () => {
    const d = doc(); const h = new History(d); h.exec(addTilesCmd([T(0, 0), T(1, 0)]));
    h.exec(removeLayerCmd(1)); expect(d.world.layers.length).toBe(0); expect(d.world.tileCount()).toBe(0);
    h.undo(); expect(d.world.layers[0].name).toBe('Ebene 1'); expect(d.world.tileCount()).toBe(2);
  });
  it('65.536 Kacheln: rückgängig und wiederholen exakt (Review Focus 5)', () => {
    const d = doc(); const h = new History(d); const tiles: TileData[] = [];
    for (let x = 0; x < 256; x++) for (let z = 0; z < 256; z++) tiles.push(T(x, z));
    const cmd = addTilesCmd(tiles); h.exec(cmd); expect(cmd.bytes).toBe(96 * 65_536);
    h.undo(); expect(d.world.tileCount()).toBe(0); h.redo(); expect(d.world.tileCount()).toBe(65_536);
  });
});
