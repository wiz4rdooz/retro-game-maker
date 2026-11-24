/** Ablage eines Projekts: Pfade mit „/“, relativ zum Projektordner. */
export interface ProjectStorage {
  readonly kind: 'memory' | 'indexeddb' | 'folder';
  readText(path: string): Promise<string | null>;
  readBytes(path: string): Promise<Uint8Array | null>;
  writeText(path: string, text: string): Promise<void>;
  writeBytes(path: string, bytes: Uint8Array): Promise<void>;
  remove(path: string): Promise<void>;
  /** Alle Dateipfade, die mit prefix beginnen, sortiert. */
  list(prefix: string): Promise<string[]>;
}

/** Zerlegt einen Projektpfad; wirft bei leeren Segmenten, „.“, „..“, Backslash oder führendem „/“. */
export function pathSegments(path: string): string[] {
  const segs = path.split('/');
  for (const s of segs) {
    if (s === '' || s === '.' || s === '..' || s.includes('\\')) throw new Error(`Ungültiger Pfad: ${path}`);
  }
  return segs;
}

export function isSafePath(path: string): boolean {
  try {
    pathSegments(path);
    return true;
  } catch {
    return false;
  }
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const encodeText = (text: string): Uint8Array => encoder.encode(text);
export const decodeText = (bytes: Uint8Array): string => decoder.decode(bytes);
