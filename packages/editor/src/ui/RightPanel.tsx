import type { AppCtx } from '../app/App';
import type { EditorSession } from '../app/session';
import { t } from '../strings/de';
import { BrushPanel } from './BrushPanel';
import { LayersPanel } from './LayersPanel';
import { SelectionPanel } from './SelectionPanel';
import { TilesetPanel } from './TilesetPanel';

/** Seitenleiste rechts: Tileset, Pinsel, Ebenen. */
export function RightPanel({ ctx, session }: { ctx: AppCtx; session: EditorSession }) {
  const { state } = ctx;
  void state.docVersion.value;
  return (
    <aside aria-label={t.panel.label} class="right-panel">
      <TilesetPanel ctx={ctx} session={session} />
      <SelectionPanel ctx={ctx} />
      <BrushPanel ctx={ctx} session={session} />
      <LayersPanel ctx={ctx} session={session} />
    </aside>
  );
}
