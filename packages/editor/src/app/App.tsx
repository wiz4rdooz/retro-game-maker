import { effect, signal, type Signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { DEFAULT_BRUSH } from '../tools/brush';
import type { EditorState } from '../state/editorState';
import { installKeyboard } from '../viewport/keyboard';
import type { ViewportController } from '../viewport/viewportController';
import type { PlayController } from '../play/playController';
import { Viewport } from '../viewport/Viewport';
import { RightPanel } from '../ui/RightPanel';
import { StartScreen } from '../ui/StartScreen';
import { StatusBar } from '../ui/StatusBar';
import { Toast } from '../ui/Toast';
import { ToolRail } from '../ui/ToolRail';
import { TopBar } from '../ui/TopBar';
import type { EditorSession } from './session';

/** Gemeinsamer Zustand der Oberfläche. */
export interface AppCtx {
  state: EditorState;
  session: Signal<EditorSession | null>;
  viewport: { current: ViewportController | null };
  play: { current: PlayController | null };
}

export function createAppCtx(state: EditorState): AppCtx {
  return { state, session: signal(null), viewport: { current: null }, play: { current: null } };
}

/** Übernimmt eine frisch geöffnete Sitzung in die Oberfläche. */
export function enterSession(ctx: AppCtx, session: EditorSession): void {
  const { state } = ctx;
  const prefs = session.project.editor;
  session.hooks = {
    onDocChange: () => {
      state.docVersion.value++;
    },
    onSaveStatus: (s) => {
      state.saveStatus.value = s;
    },
  };
  const layers = session.world.layers;
  state.activeLayer.value = layers.some((l) => l.id === prefs.activeLayer) ? prefs.activeLayer : (layers[0]?.id ?? 1);
  state.snap.value = prefs.snap;
  state.drawPlane.value = prefs.drawPlane;
  state.brush.value = { ...DEFAULT_BRUSH };
  state.tool.value = 'paint';
  state.hover.value = null;
  state.saveStatus.value = 'gespeichert';
  state.status.value = session.warnings.length > 0 ? session.warnings.join(' · ') : null;
  ctx.session.value = session;
  state.mode.value = 'edit';
}

/** Speichert, schließt die Sitzung und kehrt zum Startbildschirm zurück. */
export async function leaveSession(ctx: AppCtx): Promise<void> {
  const session = ctx.session.value;
  if (!session) return;
  ctx.play.current?.stop();
  await session.close();
  const { state } = ctx;
  state.mode.value = 'start';
  state.hover.value = null;
  state.status.value = null;
  state.selection.value = { mode: 'tiles', ids: new Set() };
  ctx.session.value = null;
}

export function App({ ctx }: { ctx: AppCtx }) {
  const { state } = ctx;
  const session = ctx.session.value;
  const mode = state.mode.value;

  // Editor-Einstellungen im Projekt mitführen (werden mit dem nächsten Speichern geschrieben)
  useEffect(() => {
    if (!session) return;
    return effect(() => {
      const e = session.project.editor;
      e.snap = state.snap.value;
      e.drawPlane = state.drawPlane.value;
      e.activeLayer = state.activeLayer.value;
    });
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const editing = () => state.mode.value === 'edit';
    return installKeyboard({
      onTool: (id) => {
        if (editing()) state.tool.value = id;
      },
      onUndo: () => editing() && session.undo(),
      onRedo: () => editing() && session.redo(),
      onSave: () => editing() && void session.autosave.flush(),
      onPlay: () => ctx.play.current?.toggle(),
      onKey: (e) => {
        const play = ctx.play.current;
        if (play?.active) return play.handleKey(e);
        return ctx.viewport.current?.handleKey(e) ?? false;
      },
    });
  }, [session]);

  if (mode === 'start' || !session) return <StartScreen ctx={ctx} />;
  return (
    <div class="app">
      <TopBar ctx={ctx} session={session} />
      <div class="workspace">
        <ToolRail state={state} />
        <Viewport ctx={ctx} session={session} />
        <RightPanel ctx={ctx} session={session} />
      </div>
      <StatusBar ctx={ctx} session={session} />
      <Toast />
    </div>
  );
}
