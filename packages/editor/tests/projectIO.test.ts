import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { cellQuad } from '@rgm/engine';
import { newProject } from '../src/project/projectModel';
import { MemoryStorage } from '../src/project/memoryStorage';
import { IdbStorage } from '../src/project/idbStorage';
import { ProjectIO } from '../src/project/projectIO';
import { exportZip, importZip } from '../src/project/zip';
import { t } from '../src/strings/de';

const tile = (x: number) => ({ layer: 1, tileset: 0, tx: 0, ty: 0, rot: 0 as const, flipX: false, flipY: false, doubleSided: false, ghost: false, corners: cellQuad({ axis: 'y', offset: 0, facing: 1 }, x, 0) });
describe('ProjectIO', () => {
  it('saveAll/load-Rundreise', async () => {
    const s = new MemoryStorage(); const { project, world } = newProject('Insel', new Date());
    world.addTile(tile(0)); world.addTile(tile(40));
    await new ProjectIO(s, t.fehler).saveAll(project, world);
    const loaded = await new ProjectIO(s, t.fehler).load();
    expect(loaded.project.name).toBe('Insel'); expect(loaded.world.tileCount()).toBe(2);
  });
  it('saveChanges schreibt nur geänderte Chunks und löscht leere', async () => {
    const s = new MemoryStorage(); const { project, world } = newProject('Insel', new Date());
    const a = world.addTile(tile(0)); world.addTile(tile(40)); const io = new ProjectIO(s, t.fehler);
    await io.saveAll(project, world); world.takeSaveDirty();
    world.removeTile(a); await io.saveChanges(project, world, world.takeSaveDirty());
    expect(await s.list('welten/insel/chunks/')).toEqual(['welten/insel/chunks/1_0_0.json']);
  });
  it('Sicherungen: höchstens 10 Slots', async () => {
    const s = new MemoryStorage(); const { project, world } = newProject('Insel', new Date()); const io = new ProjectIO(s, t.fehler);
    await io.saveAll(project, world);
    for (let i = 0; i < 12; i++) { world.addTile(tile(i)); await io.saveChanges(project, world, world.takeSaveDirty()); }
    const slots = new Set((await s.list('.sicherung/')).map((p) => p.split('/')[1]).filter((x) => x !== 'zaehler.txt'));
    expect(slots.size).toBe(10);
  });
  it('ZIP-Export/Import und IndexedDB-Speicher', async () => {
    const s = new MemoryStorage(); const { project, world } = newProject('Insel', new Date()); world.addTile(tile(3));
    await new ProjectIO(s, t.fehler).saveAll(project, world);
    const idb = new IdbStorage('test-1'); await importZip(await exportZip(s), idb);
    expect((await new ProjectIO(idb, t.fehler).load()).world.tileCount()).toBe(1);
  });
});
