import type { World } from '@rgm/engine';
import { unzipSync, zipSync, type Zippable } from 'fflate';
import { t } from '../strings/de';
import { MemoryStorage } from './memoryStorage';
import { BACKUP_DIR, ProjectIO, chunkDir } from './projectIO';
import type { ProjectFile } from './projectModel';
import { isSafePath, type ProjectStorage } from './storage';

/**
 * ZIP aus dem Dokument im Arbeitsspeicher (Projekt, aktive Welt, files) – unabhängig davon, ob das
 * letzte Speichern geklappt hat. Übrige Dateien (z. B. weitere Welten) kommen, soweit lesbar, aus storage.
 */
export async function exportDocumentZip(
  storage: ProjectStorage,
  project: ProjectFile,
  world: World,
  files: ReadonlyMap<string, Uint8Array>,
): Promise<Uint8Array> {
  const mem = new MemoryStorage();
  const ownChunks = chunkDir(project.activeWorld);
  let paths: string[] = [];
  try {
    paths = await storage.list('');
  } catch {
    /* Speicher nicht lesbar: nur der Stand im Arbeitsspeicher */
  }
  for (const p of paths) {
    if (p.startsWith(BACKUP_DIR) || p.startsWith(ownChunks)) continue;
    try {
      const bytes = await storage.readBytes(p);
      if (bytes) await mem.writeBytes(p, bytes);
    } catch {
      /* unlesbare Datei auslassen */
    }
  }
  for (const [p, bytes] of files) await mem.writeBytes(p, bytes);
  await new ProjectIO(mem, t.fehler).saveAll(project, world);
  return exportZip(mem);
}

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
