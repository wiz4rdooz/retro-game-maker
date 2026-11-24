import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { t } from '../strings/de';

/** Modaler Dialog mit Titel; Escape schließt. */
export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ComponentChildren }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    const el = ref.current;
    el?.addEventListener('keydown', onKey);
    return () => {
      el?.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, []);
  return (
    <div class="dialog-backdrop">
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="dialog-title" class="dialog">
        <h2 id="dialog-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export type StorageKind = 'indexeddb' | 'folder';

/** „Neues Projekt“: Name (Vorgabe „Mein Spiel“) und Speicherort. */
export function NewProjectDialog({
  canUseFolder,
  onCancel,
  onCreate,
}: {
  canUseFolder: boolean;
  onCancel: () => void;
  onCreate: (name: string, kind: StorageKind) => void;
}) {
  const [name, setName] = useState(t.dialog.vorgabeName);
  const [kind, setKind] = useState<StorageKind>('indexeddb');
  const input = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  // Ohne <form>-Absenden: in eingebetteten Seiten ohne allow-forms blockt der Browser es ganz
  const submit = () => onCreate(name.trim() || t.dialog.vorgabeName, kind);
  return (
    <Dialog title={t.dialog.neuesProjekt} onClose={onCancel}>
      <div class="dialog-form">
        <label class="field">
          <span>{t.dialog.name}</span>
          <input
            ref={input}
            type="text"
            value={name}
            maxLength={80}
            autoComplete="off"
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
          />
        </label>
        <fieldset class="field">
          <legend>{t.dialog.speicherort}</legend>
          <label class="radio">
            <input type="radio" name="speicherort" checked={kind === 'indexeddb'} onChange={() => setKind('indexeddb')} />
            {t.dialog.imBrowser}
          </label>
          {canUseFolder && (
            <label class="radio">
              <input type="radio" name="speicherort" checked={kind === 'folder'} onChange={() => setKind('folder')} />
              {t.dialog.imOrdner}
            </label>
          )}
        </fieldset>
        <div class="dialog-actions">
          <button type="button" class="btn" onClick={onCancel}>
            {t.dialog.abbrechen}
          </button>
          <button type="button" class="btn-primary" onClick={submit}>
            {t.dialog.anlegen}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

/** Rückfrage mit „Löschen“ (oder anderem Text) und „Abbrechen“; Abbrechen hat den Fokus. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => cancel.current?.focus(), []);
  return (
    <Dialog title={title} onClose={onCancel}>
      <p class="dialog-text">{message}</p>
      <div class="dialog-actions">
        <button ref={cancel} type="button" class="btn" onClick={onCancel}>
          {t.dialog.abbrechen}
        </button>
        <button type="button" class="btn-danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
