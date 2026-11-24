import type { AppCtx } from '../app/App';
import type { EditorSession } from '../app/session';
import { t } from '../strings/de';
import { IconCube, IconPlay, IconRedo, IconUndo } from './icons';

export function TopBar({ ctx, session }: { ctx: AppCtx; session: EditorSession }) {
  const { state } = ctx;
  void state.docVersion.value; // neu zeichnen, wenn sich die History ändert
  const status = t.speichern[state.saveStatus.value];
  const name = session.project.name || t.programm;
  return (
    <header class="topbar">
      <div class="topbar-start">
        <div class="logo" aria-hidden="true">
          <IconCube size={18} />
        </div>
        <button
          type="button"
          class="project-button"
          aria-haspopup="menu"
          aria-label={t.leiste.projekt(name, status)}
          title={name}
        >
          <span class="project-name">{name}</span>
          <span class={`save-status save-${state.saveStatus.value}`}>{status}</span>
        </button>
      </div>
      <nav aria-label={t.reiter.label} class="seg">
        <button type="button" disabled title={t.reiter.kommtEtappe3}>
          {t.reiter.modelle}
        </button>
        <button type="button" aria-current="page">
          {t.reiter.welt}
        </button>
        <button type="button" disabled title={t.reiter.kommtEtappe2}>
          {t.reiter.regeln}
        </button>
      </nav>
      <div class="topbar-end">
        <button
          type="button"
          class="icon-btn"
          aria-label={t.leiste.rueckgaengig}
          title={`${t.leiste.rueckgaengig} · Strg+Z`}
          disabled={!session.history.canUndo}
          onClick={() => session.undo()}
        >
          <IconUndo />
        </button>
        <button
          type="button"
          class="icon-btn"
          aria-label={t.leiste.wiederholen}
          title={`${t.leiste.wiederholen} · Strg+Y`}
          disabled={!session.history.canRedo}
          onClick={() => session.redo()}
        >
          <IconRedo />
        </button>
        <div class="divider-v" aria-hidden="true" />
        <button type="button" class="btn-primary play-button" title={`${t.leiste.spielen} · F5`}>
          <IconPlay />
          {t.leiste.spielen}
          <kbd>F5</kbd>
        </button>
      </div>
    </header>
  );
}
