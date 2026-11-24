import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { AppCtx } from '../app/App';
import type { EditorSession } from '../app/session';
import { addLayerCmd, removeLayerCmd, updateLayerCmd } from '../commands/layerCommands';
import { t } from '../strings/de';
import { ConfirmDialog } from './Dialogs';
import { IconEye, IconLock, IconPlus, IconTrash } from './icons';
import { PanelSection } from './PanelSection';
import { showToast } from './Toast';

/** Ebenen: Auge, Schloss, Name (Klick = aktiv, Doppelklick = umbenennen), Löschen mit Rückfrage. */
export function LayersPanel({ ctx, session }: { ctx: AppCtx; session: EditorSession }) {
  const { state } = ctx;
  void state.docVersion.value;
  const layers = session.world.layers;
  const active = state.activeLayer.value;
  const [editing, setEditing] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<{ id: number; name: string; count: number } | null>(null);

  // Die aktive Ebene muss es geben (z. B. nach Löschen oder Rückgängig)
  useEffect(() => {
    if (!layers.some((l) => l.id === active) && layers.length > 0) state.activeLayer.value = layers[0].id;
  });

  const add = () => {
    const names = new Set(layers.map((l) => l.name));
    let n = layers.length + 1;
    while (names.has(t.ebenen.neu(n))) n++;
    const cmd = addLayerCmd(t.ebenen.neu(n));
    session.exec(cmd);
    state.activeLayer.value = cmd.layerId;
  };

  const remove = (id: number) => {
    if (layers.length <= 1) {
      showToast(t.ebenen.letzte);
      return;
    }
    const layer = layers.find((l) => l.id === id);
    if (layer) setConfirm({ id, name: layer.name, count: session.world.layerTileCount(id) });
  };

  return (
    <PanelSection title={t.ebenen.titel}>
      <ul class="layer-list">
        {layers.map((l) => (
          <li key={l.id} class={l.id === active ? 'layer-row active' : 'layer-row'}>
            <button
              type="button"
              class={l.visible ? 'icon-btn small' : 'icon-btn small off'}
              aria-label={t.ebenen.ausblenden(l.name)}
              aria-pressed={!l.visible}
              title={t.ebenen.ausblenden(l.name)}
              onClick={() => session.exec(updateLayerCmd(l.id, { visible: !l.visible }))}
            >
              <IconEye />
            </button>
            <button
              type="button"
              class={l.locked ? 'icon-btn small on' : 'icon-btn small'}
              aria-label={t.ebenen.sperren(l.name)}
              aria-pressed={l.locked}
              title={t.ebenen.sperren(l.name)}
              onClick={() => session.exec(updateLayerCmd(l.id, { locked: !l.locked }))}
            >
              <IconLock />
            </button>
            {editing === l.id ? (
              <RenameField
                name={l.name}
                label={t.ebenen.umbenennen(l.name)}
                onDone={(name) => {
                  setEditing(null);
                  const clean = name.trim();
                  if (clean && clean !== l.name) session.exec(updateLayerCmd(l.id, { name: clean }));
                }}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <button
                type="button"
                class="layer-name"
                aria-label={l.name}
                aria-current={l.id === active ? 'true' : undefined}
                title={t.ebenen.umbenennen(l.name)}
                onClick={() => {
                  state.activeLayer.value = l.id;
                }}
                onDblClick={() => setEditing(l.id)}
              >
                <span class="layer-label">{l.name}</span>
                <span class="mono small-text" aria-hidden="true">
                  {[l.id === active ? t.ebenen.aktiv : '', !l.visible ? t.ebenen.verborgen : '', l.locked ? t.ebenen.gesperrt : '']
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </button>
            )}
            <button
              type="button"
              class="icon-btn small"
              aria-label={t.ebenen.loeschen(l.name)}
              title={layers.length <= 1 ? t.ebenen.letzte : t.ebenen.loeschen(l.name)}
              aria-disabled={layers.length <= 1 ? 'true' : undefined}
              onClick={() => remove(l.id)}
            >
              <IconTrash />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" class="btn" onClick={add}>
        <IconPlus />
        {t.ebenen.hinzufuegen}
      </button>
      {confirm && (
        <ConfirmDialog
          title={t.ebenen.loeschenTitel}
          message={t.ebenen.loeschenFrage(confirm.name, confirm.count)}
          confirmLabel={t.dialog.loeschen}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const id = confirm.id;
            setConfirm(null);
            session.exec(removeLayerCmd(id));
            if (state.activeLayer.value === id) state.activeLayer.value = session.world.layers[0]?.id ?? 1;
          }}
        />
      )}
    </PanelSection>
  );
}

/** Inline-Umbenennen: Enter übernimmt, Esc bricht ab, Verlassen übernimmt. */
function RenameField({ name, label, onDone, onCancel }: { name: string; label: string; onDone: (v: string) => void; onCancel: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  // gleich nach dem Einhängen fokussieren, damit sofort getippte Buchstaben im Feld landen
  useLayoutEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const finish = (commit: boolean) => {
    if (done.current) return;
    done.current = true;
    if (commit) onDone(ref.current?.value ?? name);
    else onCancel();
  };
  return (
    <input
      ref={ref}
      class="layer-input"
      type="text"
      aria-label={label}
      defaultValue={name}
      maxLength={60}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          finish(true);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          finish(false);
        }
      }}
      onBlur={() => finish(true)}
    />
  );
}
