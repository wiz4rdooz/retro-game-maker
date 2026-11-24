import { useEffect, useState } from 'preact/hooks';
import type { AppCtx } from '../app/App';
import { t } from '../strings/de';

/** F3: Bilder pro Sekunde (Mittel über 1 s), Zeichenaufrufe, sichtbare Chunks, Dreiecke, Kacheln gesamt. */
export function StatsOverlay({ ctx }: { ctx: AppCtx }) {
  const visible = ctx.state.statsVisible.value;
  const [, tick] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [visible]);
  const s = ctx.viewport.current?.fullStats();
  if (!visible || !s) return null;
  const rows: [string, string][] = [
    [t.statistik.fps, s.fps.toFixed(0)],
    [t.statistik.aufrufe, String(s.drawCalls)],
    [t.statistik.chunks, String(s.visibleChunks)],
    [t.statistik.dreiecke, s.triangles.toLocaleString('de-DE')],
    [t.statistik.kacheln, s.tiles.toLocaleString('de-DE')],
  ];
  return (
    <dl class="stats-overlay" aria-label={t.statistik.titel}>
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
