import { useEffect, useRef, useState } from 'preact/hooks';
import { leaveSession, type AppCtx } from '../app/App';
import type { EditorSession } from '../app/session';
import { exportZip } from '../project/zip';
import { t } from '../strings/de';
import { IconCube, IconMenu, IconPlay, IconRedo, IconUndo } from './icons';
import { SettingsDialog } from './SettingsDialog';
import { showToast } from './Toast';

/** Datei herunterladen (über einen unsichtbaren Link). */
function download(bytes: Uint8Array, fileName: string): void {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/zip' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const fileSafe = (name: string) => name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'projekt';

export function TopBar({ ctx, session }: { ctx: AppCtx; session: EditorSession }) {
  const { state } = ctx;
  void state.docVersion.value; // neu zeichnen, wenn sich die History ändert
  const status = t.speichern[state.saveStatus.value];
  const name = session.project.name || t.programm;
  const [menu, setMenu] = useState(false);
  const [settings, setSettings] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menu) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const outside = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [menu]);

  const close = () => {
    setMenu(false);
    buttonRef.current?.focus();
  };
  const items: [string, string | null, () => void | Promise<void>][] = [
    [t.menue.speichern, 'Strg+S', () => void session.autosave.flush()],
    [
      t.menue.zip,
      null,
      async () => {
        await session.autosave.flush();
        download(await exportZip(session.io.storage), `${fileSafe(name)}.zip`);
        showToast(t.menue.exportiert(fileSafe(name)), 4000);
      },
    ],
    [t.menue.einstellungen, null, () => setSettings(true)],
    [t.menue.schliessen, null, () => leaveSession(ctx)],
  ];

  return (
    <header class="topbar">
      <div class="topbar-start">
        <div class="logo" aria-hidden="true">
          <IconCube size={18} />
        </div>
        <div class="menu-wrap">
          <button
            ref={buttonRef}
            type="button"
            class="project-button"
            aria-haspopup="menu"
            aria-expanded={menu}
            aria-controls="project-menu"
            aria-label={t.leiste.projekt(name, status)}
            title={name}
            onClick={() => setMenu(!menu)}
          >
            <span class="project-name">
              {name}
              <IconMenu size={14} />
            </span>
            <span class={`save-status save-${state.saveStatus.value}`}>{status}</span>
          </button>
          {menu && (
            <div
              ref={menuRef}
              id="project-menu"
              role="menu"
              aria-label={t.menue.label}
              class="menu"
              onKeyDown={(e) => {
                const list = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
                const i = list.indexOf(document.activeElement as HTMLElement);
                if (e.key === 'Escape') close();
                else if (e.key === 'ArrowDown') list[(i + 1) % list.length]?.focus();
                else if (e.key === 'ArrowUp') list[(i - 1 + list.length) % list.length]?.focus();
                else return;
                e.preventDefault();
              }}
            >
              {items.map(([label, keys, run]) => (
                <button
                  key={label}
                  type="button"
                  role="menuitem"
                  class="menu-item"
                  onClick={() => {
                    setMenu(false);
                    void run();
                  }}
                >
                  {label}
                  {keys && <kbd>{keys}</kbd>}
                </button>
              ))}
            </div>
          )}
        </div>
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
        <button
          type="button"
          class="btn-primary play-button"
          title={`${t.leiste.spielen} · F5`}
          aria-pressed={state.mode.value === 'play'}
          onClick={(e) => {
            (e.currentTarget as HTMLButtonElement).blur();
            ctx.play.current?.toggle();
          }}
        >
          <IconPlay />
          {t.leiste.spielen}
          <kbd>F5</kbd>
        </button>
      </div>
      {settings && <SettingsDialog onClose={() => setSettings(false)} />}
    </header>
  );
}
