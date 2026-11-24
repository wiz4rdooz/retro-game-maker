import { toolForKey, type ToolId } from '../tools/registry';

export interface KeyboardHandlers {
  onTool(id: ToolId): void;
  onUndo(): void;
  onRedo(): void;
  onSave(): void;
  onPlay(): void;
  /** Weitere Tasten (Werkzeuge, Ansicht); true = erledigt. */
  onKey(e: KeyboardEvent): boolean;
}

/** true, wenn das Ereignis aus einem Eingabefeld, einem Menü oder einem Dialog kommt. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return (
    target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="menu"], [role="dialog"]') !== null
  );
}

/**
 * Editor-Tastatur. Der Browser-Standard für F5, Strg+S, Strg+R, Strg+Z und Strg+Y wird immer
 * unterdrückt – auch in Textfeldern, dort aber ohne Editor-Aktion. Gibt eine Abmeldefunktion zurück.
 */
export function installKeyboard(h: KeyboardHandlers): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    const typing = isTypingTarget(e.target);
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const reserved = e.key === 'F5' || (mod && (k === 's' || k === 'r' || k === 'z' || k === 'y'));
    if (reserved) {
      e.preventDefault();
      if (typing || (e.repeat && (e.key === 'F5' || k === 's' || k === 'r'))) return;
      if (e.key === 'F5') h.onPlay();
      else if (k === 's') h.onSave();
      else if (k === 'z') (e.shiftKey ? h.onRedo : h.onUndo)();
      else if (k === 'y') h.onRedo();
      return;
    }
    if (typing) return;
    if (h.onKey(e)) {
      e.preventDefault();
      return;
    }
    if (!mod && !e.altKey) {
      const tool = toolForKey(e.key);
      if (tool) {
        e.preventDefault();
        h.onTool(tool);
      }
    }
  };
  window.addEventListener('keydown', onKeyDown, true);
  return () => window.removeEventListener('keydown', onKeyDown, true);
}
