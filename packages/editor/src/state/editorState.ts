import { signal, type Signal } from '@preact/signals';
import type { GizmoHandle } from '../tools/gizmo';
import type { ViewKind } from '@rgm/engine';
import type { SaveStatus } from '../project/autosave';
import { DEFAULT_BRUSH, type BrushState } from '../tools/brush';
import type { ToolId } from '../tools/registry';
import type { Selection } from '../tools/selection';
import { t } from '../strings/de';

export interface HoverInfo {
  point: [number, number, number];
  planeLabel: string;
  tileId: number | null;
}

export type DrawPlaneMode = 'auto' | 'x' | 'y' | 'z';
export type SelectMode = 'vertices' | 'edges' | 'tiles';

export interface EditorState {
  mode: Signal<'start' | 'edit' | 'play'>;
  tool: Signal<ToolId>;
  view: Signal<ViewKind>;
  drawPlane: Signal<DrawPlaneMode>;
  snap: Signal<1 | 0.5 | 0.25>;
  selectMode: Signal<SelectMode>;
  brush: Signal<BrushState>;
  activeLayer: Signal<number>;
  hover: Signal<HoverInfo | null>;
  status: Signal<string | null>;
  saveStatus: Signal<SaveStatus>;
  /** Zählt jede Änderung am Dokument (History). */
  docVersion: Signal<number>;
  statsVisible: Signal<boolean>;
  selection: Signal<Selection>;
  /** Gizmo-Griff unter dem Zeiger oder gerade gezogen (Ansicht hebt ihn hervor). */
  gizmoHandle: Signal<GizmoHandle | null>;
  /** Aktuelle Zeichenebene mit Höhe, z. B. „Wand X = 1“ (für das Ebenen-Menü). */
  planeLabel: Signal<string>;
}

export function createEditorState(): EditorState {
  return {
    mode: signal('start'),
    tool: signal('paint'),
    view: signal('perspective'),
    drawPlane: signal('auto'),
    snap: signal(1),
    selectMode: signal('tiles'),
    brush: signal({ ...DEFAULT_BRUSH }),
    activeLayer: signal(1),
    hover: signal(null),
    status: signal(null),
    saveStatus: signal('gespeichert'),
    docVersion: signal(0),
    statsVisible: signal(false),
    selection: signal<Selection>({ mode: 'tiles', ids: new Set() }),
    gizmoHandle: signal<GizmoHandle | null>(null),
    planeLabel: signal(t.ebene.boden('0')),
  };
}
