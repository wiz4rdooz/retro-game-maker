import type { AppCtx } from '../app/App';
import type { EditorSession } from '../app/session';
import { t } from '../strings/de';
import { PanelSection } from './PanelSection';
import { TilesetPanel } from './TilesetPanel';

/** Seitenleiste rechts: Tileset, Pinsel, Ebenen. */
export function RightPanel({ ctx, session }: { ctx: AppCtx; session: EditorSession }) {
  const { state } = ctx;
  void state.docVersion.value;
  const brush = state.brush.value;
  const active = state.activeLayer.value;
  const tileset = session.project.tilesets.find((ts) => ts.id === brush.tileset);
  return (
    <aside aria-label={t.panel.label} class="right-panel">
      <TilesetPanel ctx={ctx} session={session} />
      <PanelSection title={t.panel.pinsel}>
        <div class="row-between">
          <span class="strong">{tileset ? tileset.name : t.panel.pruefmuster}</span>
          <span class="mono muted">{t.panel.kachel(brush.tx, brush.ty)}</span>
        </div>
      </PanelSection>
      <PanelSection title={t.panel.ebenen}>
        <ul class="layer-list">
          {session.world.layers.map((l) => (
            <li key={l.id} class={l.id === active ? 'layer active' : 'layer'} aria-current={l.id === active ? 'true' : undefined}>
              <span>{l.name}</span>
              <span class="mono small-text">{l.id === active ? `${t.panel.ebene} · ${t.panel.aktiv}` : t.panel.ebene}</span>
            </li>
          ))}
        </ul>
      </PanelSection>
    </aside>
  );
}
