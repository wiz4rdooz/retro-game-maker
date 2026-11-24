import { createStore, del, set, values, type UseStore } from 'idb-keyval';

export interface RecentEntry {
  id: string;
  name: string;
  kind: 'indexeddb' | 'folder';
  handle?: FileSystemDirectoryHandle;
  lastOpened: number;
}

let store: UseStore | null = null;
/** Erst beim ersten Zugriff öffnen (ohne IndexedDB darf das Modul trotzdem geladen werden). */
const registry = (): UseStore => (store ??= createStore('rgm-register', 'projekte'));

/** Zuletzt geöffnete Projekte, neueste zuerst. */
export async function listRecent(): Promise<RecentEntry[]> {
  const all = await values<RecentEntry>(registry());
  return all.filter((e) => e && typeof e.id === 'string').sort((a, b) => b.lastOpened - a.lastOpened);
}

export async function upsertRecent(e: RecentEntry): Promise<void> {
  await set(e.id, e, registry());
}

export async function removeRecent(id: string): Promise<void> {
  await del(id, registry());
}
