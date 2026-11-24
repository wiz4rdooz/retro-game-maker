import { unzipSync, zipSync, type Zippable } from 'fflate';
import { BACKUP_DIR } from './projectIO';
import { isSafePath, type ProjectStorage } from './storage';

/** Packt das ganze Projekt (ohne `.sicherung/`) als ZIP; PNGs werden nur gespeichert, nicht nochmals gepackt. */
export async function exportZip(storage: ProjectStorage): Promise<Uint8Array> {
  const files: Zippable = {};
  for (const path of await storage.list('')) {
    if (path.startsWith(BACKUP_DIR)) continue;
    const bytes = await storage.readBytes(path);
    if (bytes) files[path] = [bytes, { level: path.endsWith('.png') ? 0 : 6 }];
  }
  return zipSync(files);
}

/** Entpackt ein ZIP in storage; Ordner-Einträge, Sicherungen und unsichere Pfade werden übersprungen. */
export async function importZip(bytes: Uint8Array, storage: ProjectStorage): Promise<void> {
  const entries = unzipSync(bytes);
  for (const [path, data] of Object.entries(entries)) {
    if (path.endsWith('/') || path.startsWith(BACKUP_DIR) || !isSafePath(path)) continue;
    await storage.writeBytes(path, data);
  }
}
