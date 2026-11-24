import { describe, it, expect, vi } from 'vitest';
import { cellQuad } from '@rgm/engine';
import { newProject } from '../src/project/projectModel';
import { MemoryStorage } from '../src/project/memoryStorage';
import { ProjectIO } from '../src/project/projectIO';
import { Autosave, type SaveStatus } from '../src/project/autosave';
import { t } from '../src/strings/de';

describe('Autosave', () => {
  it('entprellt und speichert nach 3 s', async () => {
    vi.useFakeTimers(); const s = new MemoryStorage(); const d = newProject('A', new Date()); const io = new ProjectIO(s, t.fehler);
    const states: SaveStatus[] = []; const a = new Autosave({ io, getDoc: () => d, onStatus: (st) => states.push(st) });
    a.markDirty(); await vi.advanceTimersByTimeAsync(2900); expect(await s.readText('projekt.json')).toBeNull();
    await vi.advanceTimersByTimeAsync(200); expect(states.at(-1)).toBe('gespeichert'); vi.useRealTimers();
  });
  it('Fehler beim Speichern: Status fehler, nichts geht verloren (Review Focus 3)', async () => {
    const s = new MemoryStorage(); const d = newProject('A', new Date()); const io = new ProjectIO(s, t.fehler);
    const states: SaveStatus[] = []; const a = new Autosave({ io, getDoc: () => d, onStatus: (st) => states.push(st) });
    d.world.addTile({ layer: 1, tileset: 0, tx: 0, ty: 0, rot: 0, flipX: false, flipY: false, doubleSided: false, ghost: false, corners: cellQuad({ axis: 'y', offset: 0, facing: 1 }, 0, 0) });
    s.failNextWrites(1, new DOMException('voll', 'QuotaExceededError'));
    expect(await a.flush()).toBe(false); expect(states.at(-1)).toBe('fehler');
    expect(await a.flush()).toBe(true); expect(await s.list('welten/insel/chunks/')).toEqual(['welten/insel/chunks/0_0_0.json']);
  });
  it('nie zwei Speichervorgänge gleichzeitig', async () => {
    const s = new MemoryStorage(); const d = newProject('A', new Date()); const io = new ProjectIO(s, t.fehler);
    let running = 0, maxRunning = 0; const orig = io.saveChanges.bind(io);
    io.saveChanges = async (...args) => { running++; maxRunning = Math.max(maxRunning, running); try { await orig(...args); } finally { running--; } };
    const a = new Autosave({ io, getDoc: () => d, onStatus: () => {} });
    a.markDirty(); const p1 = a.flush(); a.markDirty(); const p2 = a.flush();
    expect(await Promise.all([p1, p2])).toEqual([true, true]); expect(maxRunning).toBe(1); a.dispose();
  });
});
