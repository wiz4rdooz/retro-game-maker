import { decodeText, encodeText, pathSegments, type ProjectStorage } from './storage';

/** Ordner-Zugriff gibt es nur im obersten Fenster (in eingebetteten Seiten blockt der Browser den Dialog). */
export function folderAccessAvailable(win: Window): boolean {
  return typeof win.showDirectoryPicker === 'function' && win.self === win.top;
}

/** Projekt in einem Ordner auf der Festplatte (File System Access API); ein Unterordner je Pfadsegment. */
export class FolderStorage implements ProjectStorage {
  readonly kind = 'folder';

  constructor(private readonly dir: FileSystemDirectoryHandle) {}

  async readText(path: string): Promise<string | null> {
    const b = await this.readBytes(path);
    return b ? decodeText(b) : null;
  }

  async readBytes(path: string): Promise<Uint8Array | null> {
    const segs = pathSegments(path);
    const name = segs.pop()!;
    const d = await this.folder(segs, false);
    if (!d) return null;
    try {
      const file = await (await d.getFileHandle(name)).getFile();
      return new Uint8Array(await file.arrayBuffer());
    } catch (e) {
      if (isMissing(e)) return null;
      throw e;
    }
  }

  async writeText(path: string, text: string): Promise<void> {
    await this.writeBytes(path, encodeText(text));
  }

  async writeBytes(path: string, bytes: Uint8Array): Promise<void> {
    const segs = pathSegments(path);
    const name = segs.pop()!;
    const d = (await this.folder(segs, true))!;
    const handle = await d.getFileHandle(name, { create: true });
    const w = await handle.createWritable();
    try {
      await w.write(new Uint8Array(bytes));
      await w.close();
    } catch (e) {
      await w.abort().catch(() => undefined);
      throw e;
    }
  }

  async remove(path: string): Promise<void> {
    const segs = pathSegments(path);
    const name = segs.pop()!;
    const d = await this.folder(segs, false);
    if (!d) return;
    try {
      await d.removeEntry(name);
    } catch (e) {
      if (!isMissing(e)) throw e;
    }
  }

  async list(prefix: string): Promise<string[]> {
    const out: string[] = [];
    await walk(this.dir, '', prefix, out);
    return out.sort();
  }

  private async folder(segs: string[], create: boolean): Promise<FileSystemDirectoryHandle | null> {
    let d = this.dir;
    for (const s of segs) {
      try {
        d = await d.getDirectoryHandle(s, { create });
      } catch (e) {
        if (!create && isMissing(e)) return null;
        throw e;
      }
    }
    return d;
  }
}

type DirWithEntries = FileSystemDirectoryHandle & {
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
};

async function walk(d: FileSystemDirectoryHandle, base: string, prefix: string, out: string[]): Promise<void> {
  for await (const [name, h] of (d as DirWithEntries).entries()) {
    const path = base + name;
    if (h.kind === 'file') {
      if (path.startsWith(prefix)) out.push(path);
    } else if (prefix.startsWith(path + '/') || (path + '/').startsWith(prefix)) {
      // nur in Ordner absteigen, die zum Präfix passen können
      await walk(h as FileSystemDirectoryHandle, path + '/', prefix, out);
    }
  }
}

function isMissing(e: unknown): boolean {
  return e instanceof DOMException && (e.name === 'NotFoundError' || e.name === 'TypeMismatchError');
}
