import type { DocCtx } from '../commands/command';
import type { ProjectIO } from './projectIO';

export type SaveStatus = 'gespeichert' | 'ungespeichert' | 'speichert' | 'fehler';

export interface AutosaveOptions {
  io: ProjectIO;
  getDoc: () => DocCtx;
  /** Ruhezeit nach der letzten Änderung (Standard 3000 ms). */
  debounceMs?: number;
  /** Spätestens so lange nach der ersten ungespeicherten Änderung wird gespeichert (Standard 30000 ms). */
  maxIntervalMs?: number;
  onStatus: (s: SaveStatus, error?: string) => void;
}

/**
 * Speichert entprellt im Hintergrund. Nie mehr als ein Speichervorgang gleichzeitig; schlägt einer
 * fehl, bleiben alle Chunks und Dateien vorgemerkt, der Status bleibt „fehler“ bis zum nächsten
 * Erfolg, und nach maxIntervalMs (oder beim nächsten markDirty/flush) folgt ein neuer Versuch.
 */
export class Autosave {
  private readonly debounceMs: number;
  private readonly maxIntervalMs: number;
  private readonly pendingChunks = new Set<number>();
  private readonly pendingFiles = new Map<string, Uint8Array>();
  private dirty = false;
  private saving = false;
  private failed = false;
  private disposed = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private maxTimer: ReturnType<typeof setTimeout> | null = null;
  private chain: Promise<boolean> = Promise.resolve(true);

  constructor(private readonly o: AutosaveOptions) {
    this.debounceMs = o.debounceMs ?? 3000;
    this.maxIntervalMs = o.maxIntervalMs ?? 30000;
  }

  markDirty(): void {
    if (this.disposed) return;
    this.dirty = true;
    if (!this.saving && !this.failed) this.o.onStatus('ungespeichert');
    this.schedule(this.debounceMs);
  }

  /** Merkt eine neue Projektdatei (z. B. ein Tileset-PNG) für den nächsten Speichervorgang vor. */
  addFile(path: string, bytes: Uint8Array): void {
    this.pendingFiles.set(path, bytes);
    this.markDirty();
  }

  /** Speichert jetzt (nach einem laufenden Vorgang); true bei Erfolg. */
  flush(): Promise<boolean> {
    this.clearTimers();
    const run = this.chain.then(() => this.saveOnce());
    this.chain = run;
    return run;
  }

  dispose(): void {
    this.disposed = true;
    this.clearTimers();
  }

  private schedule(delay: number): void {
    if (this.disposed) return;
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.flush();
    }, delay);
    if (this.maxTimer === null) {
      this.maxTimer = setTimeout(() => {
        this.maxTimer = null;
        void this.flush();
      }, this.maxIntervalMs);
    }
  }

  private clearTimers(): void {
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
    if (this.maxTimer !== null) clearTimeout(this.maxTimer);
    this.debounceTimer = this.maxTimer = null;
  }

  private async saveOnce(): Promise<boolean> {
    const { project, world } = this.o.getDoc();
    for (const k of world.takeSaveDirty()) this.pendingChunks.add(k);
    if (!this.dirty && this.pendingChunks.size === 0 && this.pendingFiles.size === 0) {
      if (!this.failed) this.o.onStatus('gespeichert');
      return !this.failed;
    }
    const chunks = new Set(this.pendingChunks);
    const files = new Map(this.pendingFiles);
    this.pendingChunks.clear();
    this.pendingFiles.clear();
    this.dirty = false;
    this.saving = true;
    this.o.onStatus('speichert');
    try {
      await this.o.io.saveChanges(project, world, chunks, files);
      this.saving = false;
      this.failed = false;
      this.o.onStatus(this.dirty || this.pendingFiles.size > 0 ? 'ungespeichert' : 'gespeichert');
      return true;
    } catch (e) {
      this.saving = false;
      this.failed = true;
      this.dirty = true;
      for (const k of chunks) this.pendingChunks.add(k);
      for (const [p, b] of files) if (!this.pendingFiles.has(p)) this.pendingFiles.set(p, b);
      this.o.onStatus('fehler', e instanceof Error ? e.message : String(e));
      this.schedule(this.maxIntervalMs);
      return false;
    }
  }
}
