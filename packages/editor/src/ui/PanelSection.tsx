import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
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
