import { describe, it, expect, vi } from 'vitest';
import { cellQuad } from '@rgm/engine';
import { EditorSession } from '../src/app/session';
import { addTilesCmd } from '../src/commands/tileCommands';
import { FolderStorage, folderAccessAvailable } from '../src/project/folderStorage';
import { MemoryStorage } from '../src/project/memoryStorage';
import { ProjectIO } from '../src/project/projectIO';
import { importZip } from '../src/project/zip';
import { t } from '../src/strings/de';

const floor = (x: number) => ({ layer: 1, tileset: 0, tx: 0, ty: 0, rot: 0 as const, flipX: false, flipY: false, doubleSided: false, ghost: false, corners: cellQuad({ axis: 'y', offset: 0, facing: 1 }, x, 0) });

/** Lässt jeden Schreibzugriff des Sitzungs-Speichers scheitern, bis ok = true. */
function breakWrites(s: EditorSession): { ok: boolean } {
  const st = s.io.storage as MemoryStorage;
  const flag = { ok: false };
  const wt = st.writeText.bind(st), wb = st.writeBytes.bind(st);
  st.writeText = async (p, x) => {
    if (!flag.ok) throw new Error('Speicher voll');
    return wt(p, x);
  };
  st.writeBytes = async (p, x) => {
    if (!flag.ok) throw new Error('Speicher voll');
    return wb(p, x);
  };
  return flag;
}

describe('Speichern scheitert (Review Focus 3)', () => {
  it('Schließen lässt die Sitzung offen, solange Ungespeichertes nicht geschrieben werden kann', async () => {
    const s = await EditorSession.create('Probe', 'indexeddb');
    const w = breakWrites(s);
    s.exec(addTilesCmd([floor(0), floor(1)]));
    expect(await s.close()).toBe(false);
    expect(s.autosave.pending).toBe(true);
    w.ok = true;
    expect(await s.close()).toBe(true);
    expect((await new ProjectIO(s.io.storage, t.fehler).load()).world.tileCount()).toBe(2);
  });

  it('close(true) schließt trotz Fehler', async () => {
    const s = await EditorSession.create('Probe', 'indexeddb');
    breakWrites(s);
    s.exec(addTilesCmd([floor(0)]));
    expect(await s.close(true)).toBe(true);
  });

  it('ZIP-Export nimmt den Stand im Arbeitsspeicher, auch wenn Speichern scheitert', async () => {
    const s = await EditorSession.create('Probe', 'indexeddb');
    breakWrites(s);
    s.addProjectFile('tilesets/stein.png', new Uint8Array([1, 2, 3]));
    s.exec(addTilesCmd([floor(0), floor(1), floor(2)]));
    expect(await s.autosave.flush()).toBe(false);
    const mem = new MemoryStorage();
    await importZip(await s.exportZip(), mem);
    expect((await new ProjectIO(mem, t.fehler).load()).world.tileCount()).toBe(3);
    expect(await mem.readBytes('tilesets/stein.png')).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('Speichern per Hand fragt nach einem Fehler erneut nach Schreibzugriff', async () => {
    const s = await EditorSession.create('Probe', 'indexeddb');
    const w = breakWrites(s);
    const ensure = vi.fn(async () => {
      w.ok = true;
      return true;
    });
    (s.io.storage as unknown as { ensureWriteAccess: () => Promise<boolean> }).ensureWriteAccess = ensure;
    s.exec(addTilesCmd([floor(0)]));
    expect(await s.save()).toBe(false); // erster Versuch scheitert, noch ohne Rückfrage
    expect(ensure).not.toHaveBeenCalled();
    expect(await s.save()).toBe(true);
    expect(ensure).toHaveBeenCalledTimes(1);
  });
});

describe('FolderStorage.ensureWriteAccess', () => {
  it('fragt nur, wenn der Zugriff nicht mehr erteilt ist', async () => {
    const requestPermission = vi.fn(async () => 'granted' as PermissionState);
    let state: PermissionState = 'granted';
    const dir = { queryPermission: async () => state, requestPermission } as unknown as FileSystemDirectoryHandle;
    const fs = new FolderStorage(dir);
    expect(await fs.ensureWriteAccess()).toBe(true);
    expect(requestPermission).not.toHaveBeenCalled();
    state = 'prompt';
    expect(await fs.ensureWriteAccess()).toBe(true);
    expect(requestPermission).toHaveBeenCalledTimes(1);
  });
});

describe('EditorSession ohne Browser-Speicher', () => {
  it('ohne IndexedDB landet ein neues Projekt im Arbeitsspeicher, mit Hinweis', async () => {
    expect(typeof (globalThis as { indexedDB?: unknown }).indexedDB).toBe('undefined');
    const s = await EditorSession.create('Probe', 'indexeddb');
    expect(s.io.storage.kind).toBe('memory');
    expect(s.warnings).toContain(t.start.nurArbeitsspeicher);
    expect(await s.io.storage.readText('projekt.json')).not.toBeNull();
  });
});

describe('Ordner-Zugriff', () => {
  const picker = async () => ({}) as FileSystemDirectoryHandle;
  it('nur im obersten Fenster mit showDirectoryPicker', () => {
    const top = { showDirectoryPicker: picker } as unknown as Window;
    Object.assign(top, { self: top, top });
    expect(folderAccessAvailable(top)).toBe(true);
    const framed = { showDirectoryPicker: picker, top: {} } as unknown as Window;
    Object.assign(framed, { self: framed });
    expect(folderAccessAvailable(framed)).toBe(false);
    const none = {} as Window;
    Object.assign(none, { self: none, top: none });
    expect(folderAccessAvailable(none)).toBe(false);
  });
});

describe('newId', () => {
  it('liefert auch ohne crypto.randomUUID eine UUID v4', async () => {
    const { newId } = await import('../src/app/ids');
    const orig = crypto.randomUUID;
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
    try {
      const id = newId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(newId()).not.toBe(id);
    } finally {
      Object.defineProperty(crypto, 'randomUUID', { value: orig, configurable: true });
    }
  });
});
