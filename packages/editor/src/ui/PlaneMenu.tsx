import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { EditorState } from '../state/editorState';
import { t } from '../strings/de';
import { PLANE_CYCLE } from '../tools/drawPlane';
import { IconPlane } from './icons';

/**
 * Knopf „Zeichenebene“ in der Werkzeugleiste: zeigt die Ebene (Auto, Boden, Wand X, Wand Z) und Q.
 * Ein Klick klappt rechts ein Menü auf: die vier Ebenen, darunter „Höher“/„Tiefer“ mit der Höhe.
 * Esc, ein Klick daneben oder der Start des Spiels schließen es; ein Klick in die Ansicht malt dabei nicht.
 */
export function PlaneMenu({ state, onStep }: { state: EditorState; onStep: (steps: 1 | -1) => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const mode = state.drawPlane.value;
  const name = t.pinsel.ebenen[mode];
  const playing = state.mode.value === 'play';

  useEffect(() => {
    if (open && playing) setOpen(false);
  }, [open, playing]);

  // gleich nach dem Aufklappen (vor dem nächsten Tastendruck) liegt der Fokus im Menü
  useLayoutEffect(() => {
    if (!open) return;
    const items = menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]');
    const checked = menuRef.current?.querySelector<HTMLElement>('[aria-checked="true"]');
    (checked ?? items?.[0])?.focus();
    const outside = (e: PointerEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
      // Der Klick zum Schließen malt nicht in die Welt
      if (target instanceof HTMLCanvasElement) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  }, [open]);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <div class="plane-menu-wrap">
      <button
        ref={buttonRef}
        type="button"
        class="tool-btn plane-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="plane-menu"
        aria-label={t.ebene.knopfMit(name)}
        aria-keyshortcuts="Q"
        onClick={() => setOpen(!open)}
      >
        <IconPlane />
        <span class="plane-caption" aria-hidden="true">
          {name}
        </span>
        <span class="tool-key" aria-hidden="true">
          Q
        </span>
        {!open && (
          <span class="tooltip" aria-hidden="true">
            {t.ebene.knopf}
            <kbd>Q</kbd>
          </span>
        )}
      </button>
      {open && (
        <div
          ref={menuRef}
          id="plane-menu"
          role="menu"
          aria-label={t.ebene.knopf}
          class="menu plane-menu"
          onKeyDown={(e) => {
            const list = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])];
            const i = list.indexOf(document.activeElement as HTMLElement);
            if (e.key === 'Escape') close();
            else if (e.key === 'ArrowDown') list[(i + 1) % list.length]?.focus();
            else if (e.key === 'ArrowUp') list[(i - 1 + list.length) % list.length]?.focus();
            else if (e.key === 'Home') list[0]?.focus();
            else if (e.key === 'End') list[list.length - 1]?.focus();
            else return;
            e.preventDefault();
          }}
        >
          {PLANE_CYCLE.map((m) => (
            <button
              key={m}
              type="button"
              role="menuitemradio"
              aria-checked={mode === m}
              class="menu-item"
              onClick={() => {
                state.drawPlane.value = m;
                close();
              }}
            >
              {t.pinsel.ebenen[m]}
              {mode === m && <span class="menu-check" aria-hidden="true" />}
            </button>
          ))}
          <div role="separator" class="menu-sep" />
          <div role="presentation" class="menu-note mono">
            {state.planeLabel.value}
          </div>
          <button type="button" role="menuitem" class="menu-item" onClick={() => onStep(1)}>
            {t.ebene.hoeher}
            <kbd>Bild↑</kbd>
          </button>
          <button type="button" role="menuitem" class="menu-item" onClick={() => onStep(-1)}>
            {t.ebene.tiefer}
            <kbd>Bild↓</kbd>
          </button>
        </div>
      )}
    </div>
  );
}
