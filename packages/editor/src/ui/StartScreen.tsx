import { useEffect, useRef, useState } from 'preact/hooks';
import { enterSession, type AppCtx } from '../app/App';
import { EditorSession } from '../app/session';
import { IdbStorage } from '../project/idbStorage';
import { PROJECT_FILE } from '../project/projectIO';
import { listRecent, removeRecent, type RecentEntry } from '../project/recentProjects';
import { importZip } from '../project/zip';
import { t } from '../strings/de';
import { NewProjectDialog, type StorageKind } from './Dialogs';
import { IconClose, IconCube, IconFolder, IconPlus, IconUpload } from './icons';

const dateFmt = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' });

export function StartScreen({ ctx }: { ctx: AppCtx }) {
  const [recent, setRecent] = useState<RecentEntry[] | null>(null);
  const [dialog, setDialog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const zipInput = useRef<HTMLInputElement>(null);
  const canUseFolder = typeof window.showDirectoryPicker === 'function';

  const refresh = () =>
    listRecent()
      .then(setRecent)
      .catch(() => setRecent([]));
  useEffect(() => {
    void refresh();
  }, []);

  /** Führt eine Öffnen-Aktion aus und zeigt Fehler an; Abbruch im Dateidialog bleibt still. */
  const run = async (action: () => Promise<EditorSession | null>) => {
    setError(null);
    setBusy(true);
    try {
      const session = await action();
      if (session) enterSession(ctx, session);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const create = (name: string, kind: StorageKind) =>
    run(async () => {
      if (kind === 'folder') {
        const dir = await window.showDirectoryPicker!({ mode: 'readwrite' });
        setDialog(false);
        return EditorSession.create(name, 'folder', dir);
      }
      setDialog(false);
      return EditorSession.create(name, 'indexeddb');
    });

  const openFolder = () =>
    run(async () => {
      const dir = await window.showDirectoryPicker!({ mode: 'readwrite' });
      const hasProject = await dir
        .getFileHandle(PROJECT_FILE)
        .then(() => true)
        .catch(() => false);
      if (!hasProject) throw new Error(t.start.keinProjekt);
      const known = (await listRecent()).filter((e) => e.kind === 'folder' && e.handle);
      let entry: RecentEntry | undefined;
      for (const e of known) if (await e.handle!.isSameEntry(dir)) entry = e;
      return EditorSession.open(entry ?? { id: crypto.randomUUID(), name: dir.name, kind: 'folder', handle: dir, lastOpened: Date.now() });
    });

  const importZipFile = (file: File) =>
    run(async () => {
      const id = crypto.randomUUID();
      try {
        await importZip(new Uint8Array(await file.arrayBuffer()), new IdbStorage(id));
        return await EditorSession.open({ id, name: file.name.replace(/\.zip$/i, ''), kind: 'indexeddb', lastOpened: Date.now() });
      } catch {
        indexedDB.deleteDatabase(`rgm-projekt-${id}`);
        throw new Error(t.start.zipFehler);
      }
    });

  return (
    <div class="start">
      <div class="start-card">
        <header class="start-header">
          <div class="logo large" aria-hidden="true">
            <IconCube size={26} />
          </div>
          <div>
            <h1>{t.programm}</h1>
            <p class="muted">{t.start.untertitel}</p>
          </div>
        </header>
        <div class="start-actions">
          <button type="button" class="btn-primary" disabled={busy} onClick={() => setDialog(true)}>
            <IconPlus />
            {t.start.neuesProjekt}
          </button>
          {canUseFolder && (
            <button type="button" class="btn" disabled={busy} onClick={openFolder}>
              <IconFolder />
              {t.start.ordnerOeffnen}
            </button>
          )}
          <button type="button" class="btn" disabled={busy} onClick={() => zipInput.current?.click()}>
            <IconUpload />
            {t.start.zipImportieren}
          </button>
          <input
            ref={zipInput}
            type="file"
            accept=".zip,application/zip"
            hidden
            onChange={(e) => {
              const input = e.target as HTMLInputElement;
              const file = input.files?.[0];
              input.value = '';
              if (file) void importZipFile(file);
            }}
          />
        </div>
        {busy && <p class="muted">{t.start.oeffnet}</p>}
        {error && (
          <p role="alert" class="error-text">
            {error}
          </p>
        )}
        <section aria-labelledby="recent-title" class="recent">
          <h2 id="recent-title">{t.start.zuletzt}</h2>
          {recent && recent.length === 0 && <p class="muted">{t.start.leer}</p>}
          <ul>
            {(recent ?? []).map((e) => (
              <li key={e.id}>
                <button type="button" class="recent-open" aria-label={t.start.oeffnen(e.name)} disabled={busy} onClick={() => run(() => EditorSession.open(e))}>
                  <span class="strong">{e.name}</span>
                  <span class="muted mono small-text">
                    {e.kind === 'folder' ? t.start.imOrdner : t.start.imBrowser} · {dateFmt.format(e.lastOpened)}
                  </span>
                </button>
                <button
                  type="button"
                  class="icon-btn"
                  aria-label={t.start.entfernen(e.name)}
                  title={t.start.entfernen(e.name)}
                  disabled={busy}
                  onClick={async () => {
                    await removeRecent(e.id);
                    await refresh();
                  }}
                >
                  <IconClose />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
      {dialog && <NewProjectDialog canUseFolder={canUseFolder} onCancel={() => setDialog(false)} onCreate={create} />}
    </div>
  );
}
