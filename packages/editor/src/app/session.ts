import type { World } from '@rgm/engine';
import type { Command, DocCtx } from '../commands/command';
import { History } from '../commands/history';
import { Autosave, type SaveStatus } from '../project/autosave';
import { FolderStorage } from '../project/folderStorage';
import { IdbStorage } from '../project/idbStorage';
import { MemoryStorage } from '../project/memoryStorage';
import { PROJECT_FILE, ProjectIO } from '../project/projectIO';
import { newProject, type ProjectFile } from '../project/projectModel';
import { upsertRecent, type RecentEntry } from '../project/recentProjects';
import type { ProjectStorage } from '../project/storage';
import { exportDocumentZip } from '../project/zip';
import { t } from '../strings/de';
import { newId } from './ids';

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
  /** Größte Texturkante; die Ansicht trägt den Wert aus WebGL ein. */
  maxTextureSize = 4096;
  private closed = false;

  private constructor(
    readonly entry: RecentEntry,
    storage: ProjectStorage,
    readonly project: ProjectFile,
    readonly world: World,
    readonly tilesetImages: Map<number, ImageBitmap>,
    readonly warnings: string[],
    /** Projektdateien außerhalb der Welt (Tileset-PNGs) im Arbeitsspeicher – für den ZIP-Export ohne Speicher. */
    readonly projectFiles: Map<string, Uint8Array> = new Map(),
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

  /**
   * Legt ein Projekt an (im Browser mit neuer UUID oder im gewählten Ordner), speichert es und trägt
   * es ein. Fehlt der Browser-Speicher (gesperrt, privater Modus), bleibt es im Arbeitsspeicher – mit Hinweis.
   */
  static async create(name: string, kind: 'indexeddb' | 'folder', dir?: FileSystemDirectoryHandle): Promise<EditorSession> {
    if (kind === 'folder' && !dir) throw new Error('Ordner fehlt');
    const id = newId();
    const { project, world } = newProject(name, new Date());
    const warnings: string[] = [];
    let storage: ProjectStorage;
    if (kind === 'folder') {
      storage = new FolderStorage(dir!);
      // nie ein vorhandenes Projekt überschreiben (saveAll würde dessen Chunks löschen)
      if ((await storage.readText(PROJECT_FILE)) !== null) throw new Error(t.start.ordnerHatProjekt);
      await new ProjectIO(storage, t.fehler).saveAll(project, world);
    } else {
      try {
        storage = new IdbStorage(id);
        await new ProjectIO(storage, t.fehler).saveAll(project, world);
      } catch {
        storage = new MemoryStorage();
        await new ProjectIO(storage, t.fehler).saveAll(project, world);
        warnings.push(t.start.nurArbeitsspeicher);
      }
    }
    world.takeSaveDirty();
    const entry: RecentEntry = { id, name, kind, handle: dir, lastOpened: Date.now() };
    if (storage.kind !== 'memory') {
      try {
        await upsertRecent(entry);
      } catch {
        /* „Zuletzt geöffnet“ nicht verfügbar – das Projekt selbst ist gespeichert */
      }
    }
    return new EditorSession(entry, storage, project, world, new Map(), warnings);
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
    const files = new Map<string, Uint8Array>();
    const warnings = [...loaded.warnings];
    for (const [id, bytes] of loaded.tilesetBytes) {
      const file = loaded.project.tilesets.find((ts) => ts.id === id)?.file;
      if (file) files.set(file, bytes);
      try {
        images.set(id, await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' })));
      } catch {
        const meta = loaded.project.tilesets.find((ts) => ts.id === id);
        warnings.push(t.fehler.tilesetFehlt(meta?.file ?? String(id)));
      }
    }
    const updated: RecentEntry = { ...entry, name: loaded.project.name || entry.name, lastOpened: Date.now() };
    await upsertRecent(updated);
    return new EditorSession(updated, storage, loaded.project, loaded.world, images, warnings, files);
  }

  /** Neue Projektdatei (z. B. Tileset-PNG): fürs nächste Speichern vormerken und im Arbeitsspeicher halten. */
  addProjectFile(path: string, bytes: Uint8Array): void {
    this.projectFiles.set(path, bytes);
    this.autosave.addFile(path, bytes);
  }

  /** Speichern per Hand; nach einem Fehler wird vorher erneut nach Schreibzugriff gefragt (Ordner). */
  async save(): Promise<boolean> {
    const st = this.io.storage as Partial<{ ensureWriteAccess(): Promise<boolean> }>;
    if (this.autosave.failed && st.ensureWriteAccess) await st.ensureWriteAccess().catch(() => false);
    return this.autosave.flush();
  }

  /** Projekt als ZIP – aus dem Arbeitsspeicher, also auch dann vollständig, wenn Speichern scheitert. */
  exportZip(): Promise<Uint8Array> {
    return exportDocumentZip(this.io.storage, this.project, this.world, this.projectFiles);
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

  /**
   * Speichert ausstehende Änderungen und gibt die Bilder frei. Scheitert das Speichern, bleibt die
   * Sitzung offen und das Ergebnis ist false – außer mit force (Änderungen seit dem letzten Speichern gehen verloren).
   */
  async close(force = false): Promise<boolean> {
    if (this.closed) return true;
    const saved = await this.autosave.flush();
    if (!saved && !force) return false;
    this.closed = true;
    this.autosave.dispose();
    for (const img of this.tilesetImages.values()) img.close();
    this.tilesetImages.clear();
    return true;
  }
}
