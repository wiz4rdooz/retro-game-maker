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

/** Eingaben ohne Tipp-Bedeutung: nach einem Häkchen oder Knopf wirken die Editor-Tasten weiter. */
const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'color', 'file', 'image']);

/** true, wenn das Ereignis aus einem Ausklapp-Menü kommt: dort ruhen Werkzeug-Tasten, F5 und Strg+S/Z/Y wirken weiter. */
export function isMenuTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('[role="menu"]') !== null;
}

/** true, wenn das Ereignis aus einem Eingabefeld, einem Menü oder einem Dialog kommt. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest('[role="menu"], [role="dialog"]') !== null) return true;
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(target.type);
  return target.closest('textarea, select, [contenteditable]:not([contenteditable="false"])') !== null;
}

/**
 * Editor-Tastatur. Der Browser-Standard für F5, Strg+S, Strg+R, Strg+Z und Strg+Y wird immer
 * unterdrückt – auch in Textfeldern und Dialogen, dort aber ohne Editor-Aktion (in Menüs mit).
 * Gibt eine Abmeldefunktion zurück.
 */
export function installKeyboard(h: KeyboardHandlers): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    const typing = isTypingTarget(e.target);
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const reserved = e.key === 'F5' || (mod && (k === 's' || k === 'r' || k === 'z' || k === 'y'));
    if (reserved) {
      e.preventDefault();
      if ((typing && !isMenuTarget(e.target)) || (e.repeat && (e.key === 'F5' || k === 's' || k === 'r'))) return;
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
