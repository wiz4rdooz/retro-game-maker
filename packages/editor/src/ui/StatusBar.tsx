import type { AppCtx } from '../app/App';
import type { EditorSession } from '../app/session';
import { t } from '../strings/de';

const fmt = (v: number) => (Math.round(v * 100) / 100).toString().replace('.', ',');
const snapLabel = (s: number) => (s === 1 ? '1' : s === 0.5 ? '½' : '¼');

export function StatusBar({ ctx, session }: { ctx: AppCtx; session: EditorSession }) {
  const { state } = ctx;
  const hover = state.hover.value;
  const brush = state.brush.value;
  const tileset = session.project.tilesets.find((ts) => ts.id === brush.tileset);
  const status = state.status.value;
  return (
    <footer class="statusbar">
      <span>{hover ? t.status.position(fmt(hover.point[0]), fmt(hover.point[1]), fmt(hover.point[2])) : '–'}</span>
      <span>{t.status.raster(snapLabel(state.snap.value))}</span>
      <span>{t.status.pinsel(tileset ? `${tileset.name} ${brush.tx},${brush.ty}` : t.panel.pruefmuster)}</span>
      <span class="status-message" role="status">
        {status ?? ''}
      </span>
    </footer>
  );
}
