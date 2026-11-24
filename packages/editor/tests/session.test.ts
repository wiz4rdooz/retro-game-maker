import { describe, it, expect } from 'vitest';
import { EditorSession } from '../src/app/session';
import { folderAccessAvailable } from '../src/project/folderStorage';
import { t } from '../src/strings/de';

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
