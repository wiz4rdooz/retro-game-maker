import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import type { AppCtx } from '../app/App';
import type { EditorSession } from '../app/session';
import { t } from '../strings/de';
import { IconChevron } from './icons';

/** Aufklappbarer Abschnitt der Seitenleiste; als Region mit Namen auffindbar. */
export function PanelSection({ title, children }: { title: string; children: ComponentChildren }) {
  const [open, setOpen] = useState(true);
  const id = `panel-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <section class="panel-section" role="region" aria-label={title}>
      <h2>
        <button type="button" class="panel-header" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
          {title}
          <span class={open ? 'chevron' : 'chevron closed'}>
            <IconChevron />
          </span>
        </button>
      </h2>
      {open && (
        <div id={id} class="panel-body">
          {children}
        </div>
      )}
    </section>
  );
}

/** Seitenleiste rechts; Tileset, Pinsel und Ebenen füllen spätere Aufgaben. */
export function RightPanel({ ctx, session }: { ctx: AppCtx; session: EditorSession }) {
  const { state } = ctx;
  void state.docVersion.value;
  const brush = state.brush.value;
  const active = state.activeLayer.value;
  const tileset = session.project.tilesets.find((ts) => ts.id === brush.tileset);
  return (
    <aside aria-label={t.panel.label} class="right-panel">
      <PanelSection title={t.panel.tileset}>
        <p class="muted">{tileset ? tileset.name : t.panel.pruefmuster}</p>
      </PanelSection>
      <PanelSection title={t.panel.pinsel}>
        <div class="row-between">
          <span class="strong">{tileset ? tileset.name : t.panel.pruefmuster}</span>
          <span class="mono muted">{t.panel.kachel(brush.tx, brush.ty)}</span>
        </div>
      </PanelSection>
      <PanelSection title={t.panel.ebenen}>
        <ul class="layer-list">
          {session.world.layers.map((l) => (
            <li key={l.id} class={l.id === active ? 'layer active' : 'layer'} aria-current={l.id === active ? 'true' : undefined}>
              <span>{l.name}</span>
              <span class="mono small-text">{l.id === active ? `${t.panel.ebene} · ${t.panel.aktiv}` : t.panel.ebene}</span>
            </li>
          ))}
        </ul>
      </PanelSection>
    </aside>
  );
}
