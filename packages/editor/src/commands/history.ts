import { MIN_COMMAND_BYTES, type Command } from './command';

export interface HistoryOptions {
  /** Höchstzahl Rückgängig-Schritte (Standard 200). */
  maxSteps?: number;
  /** Speichergrenze der Rückgängig-Schritte in Byte (Standard 256 MB); der neueste Schritt bleibt immer. */
  maxBytes?: number;
}

/** Mehrere Befehle als ein Schritt (aus begin/end). */
class GroupCommand<C> implements Command<C> {
  readonly children: Command<C>[] = [];
  constructor(readonly label: string) {}
  get bytes(): number {
    let b = 0;
    for (const c of this.children) b += c.bytes;
    return Math.max(MIN_COMMAND_BYTES, b);
  }
  do(ctx: C): void {
    for (const c of this.children) c.do(ctx);
  }
  undo(ctx: C): void {
    for (let i = this.children.length - 1; i >= 0; i--) this.children[i].undo(ctx);
  }
}

interface Entry<C> {
  cmd: Command<C>;
  bytes: number;
}

/**
 * Rückgängig/Wiederholen. `exec` führt sofort aus und leert den Wiederholen-Stapel.
 * `begin`/`end` dürfen verschachtelt sein; das äußerste `end` legt einen Schritt ab, ein leerer
 * entfällt. Solange eine Gruppe offen ist, tun `undo`/`redo` nichts.
 */
export class History<C> {
  private readonly undoStack: Entry<C>[] = [];
  private readonly redoStack: Entry<C>[] = [];
  private readonly groups: GroupCommand<C>[] = [];
  private readonly listeners = new Set<() => void>();
  private undoBytes = 0;
  private readonly maxSteps: number;
  private readonly maxBytes: number;

  constructor(
    private readonly ctx: C,
    opts: HistoryOptions = {},
  ) {
    this.maxSteps = Math.max(1, Math.floor(opts.maxSteps ?? 200));
    this.maxBytes = Math.max(1, opts.maxBytes ?? 256 * 1024 * 1024);
  }

  get canUndo(): boolean {
    return this.groups.length === 0 && this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.groups.length === 0 && this.redoStack.length > 0;
  }

  /** Führt aus und legt ab; wirft `do`, bleibt die History unverändert. */
  exec(cmd: Command<C>): void {
    cmd.do(this.ctx);
    this.redoStack.length = 0;
    const group = this.groups[this.groups.length - 1];
    if (group) group.children.push(cmd);
    else this.push(cmd);
    this.emit();
  }

  begin(label: string): void {
    this.groups.push(new GroupCommand<C>(label));
  }

  end(): void {
    const group = this.groups.pop();
    if (!group || group.children.length === 0) return;
    const parent = this.groups[this.groups.length - 1];
    if (parent) {
      parent.children.push(...group.children);
      return;
    }
    this.push(group);
    this.emit();
  }

  undo(): boolean {
    if (this.groups.length > 0) return false;
    const e = this.undoStack.pop();
    if (!e) return false;
    this.undoBytes -= e.bytes;
    e.cmd.undo(this.ctx);
    this.redoStack.push(e);
    this.emit();
    return true;
  }

  redo(): boolean {
    if (this.groups.length > 0) return false;
    const e = this.redoStack.pop();
    if (!e) return false;
    e.cmd.do(this.ctx);
    e.bytes = e.cmd.bytes;
    this.undoStack.push(e);
    this.undoBytes += e.bytes;
    this.trim();
    this.emit();
    return true;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private push(cmd: Command<C>): void {
    const bytes = cmd.bytes;
    this.undoStack.push({ cmd, bytes });
    this.undoBytes += bytes;
    this.trim();
  }

  private trim(): void {
    while (
      this.undoStack.length > this.maxSteps ||
      (this.undoBytes > this.maxBytes && this.undoStack.length > 1)
    ) {
      const e = this.undoStack.shift()!;
      this.undoBytes -= e.bytes;
    }
  }

  private emit(): void {
    for (const fn of [...this.listeners]) fn();
  }
}
