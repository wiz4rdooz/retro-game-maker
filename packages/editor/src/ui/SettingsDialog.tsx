import { prefs, updatePrefs } from '../state/prefs';
import { t } from '../strings/de';
import { Dialog } from './Dialogs';

/** Einstellungen: Oberflächengröße 100–200 %, Hinweise an/aus, alle Hinweise wieder zeigen. */
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const p = prefs.value;
  const percent = Math.round(p.uiScale * 100);
  const setPercent = (v: number) => {
    if (!Number.isFinite(v)) return;
    const clamped = Math.min(200, Math.max(100, Math.round(v / 10) * 10));
    updatePrefs({ uiScale: clamped / 100 });
  };
  return (
    <Dialog title={t.einstellungen.titel} onClose={onClose}>
      <div class="dialog-form">
        <div class="field">
          <span>{t.einstellungen.groesse}</span>
          <div class="range-row">
            <input
              type="range"
              min={100}
              max={200}
              step={10}
              value={percent}
              aria-label={t.einstellungen.groesse}
              onInput={(e) => setPercent(Number((e.target as HTMLInputElement).value))}
            />
            <input
              type="number"
              min={100}
              max={200}
              step={10}
              value={percent}
              aria-label={t.einstellungen.groesseProzent}
              onChange={(e) => setPercent(Number((e.target as HTMLInputElement).value))}
            />
            <span class="muted">%</span>
          </div>
        </div>
        <label class="check">
          <input type="checkbox" checked={p.hintsEnabled} onChange={(e) => updatePrefs({ hintsEnabled: (e.target as HTMLInputElement).checked })} />
          {t.einstellungen.hinweise}
        </label>
        <button type="button" class="btn" disabled={p.hintsHiddenFor.length === 0} onClick={() => updatePrefs({ hintsHiddenFor: [], hintsEnabled: true })}>
          {t.einstellungen.alleHinweise}
        </button>
        <div class="dialog-actions">
          <button type="button" class="btn-primary" onClick={onClose}>
            {t.einstellungen.fertig}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
