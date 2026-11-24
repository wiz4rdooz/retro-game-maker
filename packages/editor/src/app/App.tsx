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
import { Toast, showToast } from '../ui/Toast';
import { ToolRail } from '../ui/ToolRail';
import { TopBar } from '../ui/TopBar';
import { t } from '../strings/de';
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
  let failing = false;
  session.hooks = {
    onDocChange: () => {
      state.docVersion.value++;
    },
    onSaveStatus: (s, error) => {
      state.saveStatus.value = s;
      // Ein Fehler wird einmal gemeldet (mit Grund), erst nach einem Erfolg wieder
      if (s === 'fehler') {
        if (!failing) showToast(error ? `${t.fehler.speichernFehlgeschlagen} (${error})` : t.fehler.speichernFehlgeschlagen, 10_000);
        failing = true;
      } else if (s !== 'speichert') {
        failing = false;
      }
    },
  };
  const layers = session.world.layers;
  state.activeLayer.value = layers.some((l) => l.id === prefs.activeLayer) ? prefs.activeLayer : (layers[0]?.id ?? 1);
  state.snap.value = prefs.snap;
  state.drawPlane.value = prefs.drawPlane;
  // mit vorhandenem Tileset gleich dessen erste Kachel im Pinsel
  const firstTileset = session.project.tilesets.find((ts) => session.tilesetImages.has(ts.id));
  state.brush.value = { ...DEFAULT_BRUSH, tileset: firstTileset ? firstTileset.id : DEFAULT_BRUSH.tileset };
  state.tool.value = 'paint';
  state.hover.value = null;
  state.saveStatus.value = session.autosave.pending ? 'ungespeichert' : 'gespeichert';
  state.status.value = session.warnings.length > 0 ? session.warnings.join(' · ') : null;
  if (session.warnings.length > 0) showToast(session.warnings.join(' '), 10_000);
  ctx.session.value = session;
  state.mode.value = 'edit';
}

/**
 * Speichert, schließt die Sitzung und kehrt zum Startbildschirm zurück. Scheitert das Speichern,
 * bleibt alles offen und das Ergebnis ist false (mit force wird trotzdem geschlossen).
 */
export async function leaveSession(ctx: AppCtx, force = false): Promise<boolean> {
  const session = ctx.session.value;
  if (!session) return true;
  ctx.play.current?.stop();
  if (!(await session.close(force))) return false;
  const { state } = ctx;
  state.mode.value = 'start';
  state.hover.value = null;
  state.status.value = null;
  state.selection.value = { mode: 'tiles', ids: new Set() };
  ctx.session.value = null;
  return true;
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
      onSave: () => editing() && void session.save(),
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
