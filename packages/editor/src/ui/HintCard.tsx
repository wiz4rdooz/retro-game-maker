import { prefs, updatePrefs } from '../state/prefs';
import type { EditorState } from '../state/editorState';
import { t } from '../strings/de';
import { IconClose } from './icons';

/** Hinweis zum aktiven Werkzeug über der Ansicht; × blendet ihn für dieses Werkzeug aus. */
export function HintCard({ state }: { state: EditorState }) {
  const tool = state.tool.value;
  const p = prefs.value;
  if (!p.hintsEnabled || p.hintsHiddenFor.includes(tool)) return null;
  return (
    <div role="note" class="hint-card">
      <span>{t.hinweis[tool]}</span>
      <button
        type="button"
        class="icon-btn small"
        aria-label={t.hinweis.ausblenden}
        title={t.hinweis.ausblenden}
        onClick={() => updatePrefs({ hintsHiddenFor: [...p.hintsHiddenFor, tool] })}
      >
        <IconClose />
      </button>
    </div>
  );
}
