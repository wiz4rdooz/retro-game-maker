import type { AppCtx } from '../app/App';
import type { SelectMode } from '../state/editorState';
import { t } from '../strings/de';
import { emptySelection, selectionSize, type SelectionAction } from '../tools/selection';
import { PanelSection } from './PanelSection';

const MODES: [SelectMode, string][] = [
  ['vertices', '1'],
  ['edges', '2'],
  ['tiles', '3'],
];

/** Auswahl: Anzahl, Modus und Knöpfe für die Auswahl-Aktionen (nur mit dem Auswahl-Werkzeug). */
export function SelectionPanel({ ctx }: { ctx: AppCtx }) {
  const { state } = ctx;
  if (state.tool.value !== 'select') return null;
  void state.docVersion.value;
  const sel = state.selection.value;
  const mode = state.selectMode.value;
  const n = sel.mode === mode ? selectionSize(sel) : 0;
  const run = (a: SelectionAction) => ctx.viewport.current?.selectionAction(a);
  const button = (label: string, action: SelectionAction, enabled: boolean, keys?: string) => (
    <button
      type="button"
      class="btn small-btn"
      disabled={!enabled}
      onClick={() => run(action)}
      aria-keyshortcuts={keys}
      title={keys ? `${label} · ${keys}` : label}
    >
      {label}
    </button>
  );
  return (
    <PanelSection title={t.auswahl.titel}>
      <div role="group" aria-label={t.auswahl.modus} class="seg compact plane-switch">
        {MODES.map(([m, key]) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            aria-keyshortcuts={key}
            onClick={() => {
              state.selectMode.value = m;
              const tc = ctx.viewport.current;
              state.selection.value = tc ? tc.convertSelection(m) : emptySelection(m);
            }}
          >
            {t.auswahl.modi[m]}
          </button>
        ))}
      </div>
      <p class="muted" role="status">
        {n === 0 ? t.auswahl.leer : t.auswahl.anzahl(n, t.auswahl.modi[mode])}
      </p>
      <div class="btn-grid">
        {button(t.auswahl.drehen, 'rotate', n > 0 && mode === 'tiles', 'R')}
        {button(t.auswahl.mal2, 'scaleUp', n > 0 && mode === 'tiles', '+')}
        {button(t.auswahl.halb, 'scaleDown', n > 0 && mode === 'tiles', '-')}
        {button(t.auswahl.extrudieren, 'extrude', n > 0 && mode === 'tiles', 'Strg+E')}
        {button(t.auswahl.zusammenfuehren, 'merge', n > 1 && mode === 'vertices', 'Strg+M')}
        {button(t.auswahl.loeschen, 'delete', n > 0, 'Entf')}
      </div>
    </PanelSection>
  );
}
