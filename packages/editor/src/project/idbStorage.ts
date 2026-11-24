import { createStore, del, get, keys, set, type UseStore } from 'idb-keyval';
import { decodeText, encodeText, pathSegments, type ProjectStorage } from './storage';

/** Projekt im Browser-Speicher: eine Datenbank `rgm-projekt-<id>` mit dem Store `dateien`. */
export class IdbStorage implements ProjectStorage {
  readonly kind = 'indexeddb';
  private readonly store: UseStore;

  constructor(readonly projectId: string) {
    this.store = createStore(`rgm-projekt-${projectId}`, 'dateien');
  }

  async readText(path: string): Promise<string | null> {
    const v = await get<unknown>(path, this.store);
    if (typeof v === 'string') return v;
    return v instanceof Uint8Array ? decodeText(v) : null;
  }

  async readBytes(path: string): Promise<Uint8Array | null> {
    const v = await get<unknown>(path, this.store);
    if (v instanceof Uint8Array) return v;
    return typeof v === 'string' ? encodeText(v) : null;
  }

  async writeText(path: string, text: string): Promise<void> {
    pathSegments(path);
    await set(path, text, this.store);
  }

  async writeBytes(path: string, bytes: Uint8Array): Promise<void> {
    pathSegments(path);
    await set(path, bytes.slice(), this.store);
  }

  async remove(path: string): Promise<void> {
    await del(path, this.store);
  }

  async list(prefix: string): Promise<string[]> {
    const all = await keys(this.store);
    return all.filter((k): k is string => typeof k === 'string' && k.startsWith(prefix)).sort();
  }
}
