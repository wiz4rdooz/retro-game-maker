import type { ViewKind } from '@rgm/engine';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { AppCtx } from '../app/App';
import type { EditorSession } from '../app/session';
import { t } from '../strings/de';
import { HintCard } from '../ui/HintCard';
import { StatsOverlay } from '../ui/StatsOverlay';
import { AxisGizmo } from './AxisGizmo';
import { NoWebGl2Error, ViewportController } from './viewportController';

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
    ctx.viewport.current = c;
    setCtrl(c);
    return () => {
      c.dispose();
      if (ctx.viewport.current === c) ctx.viewport.current = null;
      setCtrl(null);
    };
  }, [session]);

  const view = state.view.value;
  return (
    <main aria-label={t.ansicht.bereich} class="viewport">
      {error ? (
        <p role="alert" class="viewport-error">
          {error}
        </p>
      ) : (
        <canvas ref={canvasRef} class="viewport-canvas" />
      )}
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
      {ctrl && <AxisGizmo ctrl={ctrl} />}
      <p class="camera-hint">{t.kamera}</p>
      <HintCard state={state} />
      {ctrl && <StatsOverlay ctx={ctx} />}
    </main>
  );
}
