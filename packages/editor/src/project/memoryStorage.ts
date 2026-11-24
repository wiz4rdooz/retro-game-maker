import { decodeText, encodeText, pathSegments, type ProjectStorage } from './storage';

/** Projekt im Arbeitsspeicher (Tests, Test-Insel). */
export class MemoryStorage implements ProjectStorage {
  readonly kind = 'memory';
  private readonly files = new Map<string, Uint8Array>();
  private failures = 0;
  private failure: Error | null = null;

  /** Die nächsten n Schreibvorgänge schlagen mit error fehl. */
  failNextWrites(n: number, error: Error): void {
    this.failures = Math.max(0, Math.floor(n));
    this.failure = error;
  }

  async readText(path: string): Promise<string | null> {
    const b = this.files.get(path);
    return b ? decodeText(b) : null;
  }

  async readBytes(path: string): Promise<Uint8Array | null> {
    const b = this.files.get(path);
    return b ? b.slice() : null;
  }

  async writeText(path: string, text: string): Promise<void> {
    this.write(path, encodeText(text));
  }

  async writeBytes(path: string, bytes: Uint8Array): Promise<void> {
    this.write(path, bytes.slice());
  }

  async remove(path: string): Promise<void> {
    this.files.delete(path);
  }

  async list(prefix: string): Promise<string[]> {
    return [...this.files.keys()].filter((p) => p.startsWith(prefix)).sort();
  }

  private write(path: string, bytes: Uint8Array): void {
    pathSegments(path);
    if (this.failures > 0) {
      this.failures--;
      throw this.failure ?? new Error('Schreiben fehlgeschlagen');
    }
    this.files.set(path, bytes);
  }
}
