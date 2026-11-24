import type { ViewKind } from '@rgm/engine';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { AppCtx } from '../app/App';
import type { EditorSession } from '../app/session';
import { t } from '../strings/de';
import { HintCard } from '../ui/HintCard';
import { StatsOverlay } from '../ui/StatsOverlay';
import { AxisGizmo } from './AxisGizmo';
import { NoWebGl2Error, ViewportController } from './viewportController';
import { PlayController } from '../play/playController';
import { PlayOverlay } from '../play/PlayOverlay';

const VIEWS: ViewKind[] = ['perspective', 'top', 'front', 'side'];

export function Viewport({ ctx, session }: { ctx: AppCtx; session: EditorSession }) {
  const { state } = ctx;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ctrl, setCtrl] = useState<ViewportController | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let c: ViewportController;
    try {
      c = new ViewportController(canvas, session, state);
    } catch (e) {
      setError(e instanceof NoWebGl2Error ? t.fehler.keinWebgl2 : t.fehler.ansicht(e instanceof Error ? e.message : String(e)));
      return;
    }
    const play = new PlayController(c, session, state);
    ctx.viewport.current = c;
    ctx.play.current = play;
    setCtrl(c);
    return () => {
      play.dispose();
      c.dispose();
      if (ctx.viewport.current === c) ctx.viewport.current = null;
      if (ctx.play.current === play) ctx.play.current = null;
      setCtrl(null);
    };
  }, [session]);

  const view = state.view.value;
  const playing = state.mode.value === 'play';
  return (
    <main aria-label={t.ansicht.bereich} class={playing ? 'viewport playing' : 'viewport'}>
      {error ? (
        <p role="alert" class="viewport-error">
          {error}
        </p>
      ) : (
        <canvas ref={canvasRef} class="viewport-canvas" />
      )}
      {playing && ctx.play.current && <PlayOverlay play={ctx.play.current} />}
      {!playing && (
      <div role="group" aria-label={t.ansicht.label} class="seg view-switch">
        {VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => {
              state.view.value = v;
            }}
          >
            {t.ansicht[v]}
          </button>
        ))}
      </div>
      )}
      {ctrl && !playing && <AxisGizmo ctrl={ctrl} />}
      {!playing && <p class="camera-hint">{t.kamera}</p>}
      {!playing && <HintCard state={state} />}
      {ctrl && <StatsOverlay ctx={ctx} />}
    </main>
  );
}
