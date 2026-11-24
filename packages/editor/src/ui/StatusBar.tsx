import type { AppCtx } from '../app/App';
import type { EditorSession } from '../app/session';
import { t } from '../strings/de';

const fmt = (v: number) => (Math.round(v * 100) / 100).toString().replace('.', ',');
const SNAPS = [1, 0.5, 0.25] as const;
const snapLabel = (s: number) => (s === 1 ? '1' : s === 0.5 ? '½' : '¼');

/** Ort unter dem Zeiger, Ebene, Rasterschritt (Klick wechselt), Pinsel und Kurzhinweis. */
export function StatusBar({ ctx, session }: { ctx: AppCtx; session: EditorSession }) {
  const { state } = ctx;
  void state.docVersion.value;
  const hover = state.hover.value;
  const brush = state.brush.value;
  const snap = state.snap.value;
  const tileset = session.project.tilesets.find((ts) => ts.id === brush.tileset);
  const layer = session.world.layers.find((l) => l.id === state.activeLayer.value);
  const status = state.status.value;
  return (
    <footer class="statusbar">
      <span>{hover ? t.status.ort(fmt(hover.point[0]), fmt(hover.point[2]), fmt(hover.point[1])) : '–'}</span>
      {hover && <span>{hover.planeLabel}</span>}
      <span>{layer ? layer.name : '–'}</span>
      <button
        type="button"
        class="status-btn"
        title={t.status.rasterWechseln}
        onClick={() => {
          state.snap.value = SNAPS[(SNAPS.indexOf(snap) + 1) % SNAPS.length];
        }}
      >
        {t.status.raster(snapLabel(snap))}
      </button>
      <span>{t.status.pinsel(tileset ? `${tileset.name} ${brush.tx},${brush.ty}` : t.panel.pruefmuster)}</span>
      <span class="status-message" role="status">
        {status ?? t.kurz[state.tool.value]}
      </span>
    </footer>
  );
}
