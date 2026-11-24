import type { World } from '@rgm/engine';
import type { Command, DocCtx } from '../commands/command';
import { History } from '../commands/history';
import { Autosave, type SaveStatus } from '../project/autosave';
import { FolderStorage } from '../project/folderStorage';
import { IdbStorage } from '../project/idbStorage';
import { ProjectIO } from '../project/projectIO';
import { newProject, type ProjectFile } from '../project/projectModel';
import { upsertRecent, type RecentEntry } from '../project/recentProjects';
import type { ProjectStorage } from '../project/storage';
import { t } from '../strings/de';

export interface SessionHooks {
  onDocChange?: () => void;
  onSaveStatus?: (s: SaveStatus, error?: string) => void;
}

/** Ein geöffnetes Projekt: Dokument, History, automatisches Speichern und geladene Tileset-Bilder. */
export class EditorSession {
  readonly history: History<DocCtx>;
  readonly autosave: Autosave;
  readonly io: ProjectIO;
  /** Wird von der Oberfläche gesetzt. */
  hooks: SessionHooks = {};
  private closed = false;

  private constructor(
    readonly entry: RecentEntry,
    storage: ProjectStorage,
    readonly project: ProjectFile,
    readonly world: World,
    readonly tilesetImages: Map<number, ImageBitmap>,
    readonly warnings: string[],
  ) {
    this.io = new ProjectIO(storage, t.fehler);
    const doc: DocCtx = { world, project };
    this.history = new History(doc);
    this.autosave = new Autosave({
      io: this.io,
      getDoc: () => doc,
      onStatus: (s, e) => this.hooks.onSaveStatus?.(s, e),
    });
    this.history.subscribe(() => {
      this.autosave.markDirty();
      this.hooks.onDocChange?.();
    });
  }

  get doc(): DocCtx {
    return { world: this.world, project: this.project };
  }

  /** Legt ein Projekt an (im Browser mit neuer UUID oder im gewählten Ordner), speichert es und trägt es ein. */
  static async create(name: string, kind: 'indexeddb' | 'folder', dir?: FileSystemDirectoryHandle): Promise<EditorSession> {
    if (kind === 'folder' && !dir) throw new Error('Ordner fehlt');
    const id = crypto.randomUUID();
    const storage: ProjectStorage = kind === 'indexeddb' ? new IdbStorage(id) : new FolderStorage(dir!);
    const { project, world } = newProject(name, new Date());
    await new ProjectIO(storage, t.fehler).saveAll(project, world);
    world.takeSaveDirty();
    const entry: RecentEntry = { id, name, kind, handle: dir, lastOpened: Date.now() };
    await upsertRecent(entry);
    return new EditorSession(entry, storage, project, world, new Map(), []);
  }

  /** Öffnet ein Projekt aus „Zuletzt geöffnet“; Ordner fragen dabei nach Schreibzugriff. */
  static async open(entry: RecentEntry): Promise<EditorSession> {
    let storage: ProjectStorage;
    if (entry.kind === 'folder') {
      const dir = entry.handle;
      if (!dir) throw new Error(t.start.keinProjekt);
      const state = (await dir.queryPermission?.({ mode: 'readwrite' })) ?? 'granted';
      if (state !== 'granted' && (await dir.requestPermission?.({ mode: 'readwrite' })) !== 'granted') {
        throw new Error(t.start.keinZugriff);
      }
      storage = new FolderStorage(dir);
    } else {
      storage = new IdbStorage(entry.id);
    }
    const loaded = await new ProjectIO(storage, t.fehler).load();
    const images = new Map<number, ImageBitmap>();
    const warnings = [...loaded.warnings];
    for (const [id, bytes] of loaded.tilesetBytes) {
      try {
        images.set(id, await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' })));
      } catch {
        const meta = loaded.project.tilesets.find((ts) => ts.id === id);
        warnings.push(t.fehler.tilesetFehlt(meta?.file ?? String(id)));
      }
    }
    const updated: RecentEntry = { ...entry, name: loaded.project.name || entry.name, lastOpened: Date.now() };
    await upsertRecent(updated);
    return new EditorSession(updated, storage, loaded.project, loaded.world, images, warnings);
  }

  exec(cmd: Command<DocCtx>): void {
    this.history.exec(cmd);
  }

  undo(): boolean {
    return this.history.undo();
  }

  redo(): boolean {
    return this.history.redo();
  }

  /** Speichert ausstehende Änderungen und gibt die Bilder frei. */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.autosave.flush();
    this.autosave.dispose();
    for (const img of this.tilesetImages.values()) img.close();
    this.tilesetImages.clear();
  }
}
