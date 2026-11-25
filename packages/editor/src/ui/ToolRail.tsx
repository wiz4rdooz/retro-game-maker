import type { EditorState } from '../state/editorState';
import { t } from '../strings/de';
import { TOOLS } from '../tools/registry';
import { PlaneMenu } from './PlaneMenu';

/** Werkzeugleiste links: Taste als kleines Kürzel am Knopf, Tooltip mit Name und Taste; darunter die Zeichenebene. */
export function ToolRail({ state, onPlaneStep }: { state: EditorState; onPlaneStep: (steps: 1 | -1) => void }) {
  const active = state.tool.value;
  return (
    <nav aria-label={t.leiste.werkzeuge} class="tool-rail">
      {TOOLS.map((tool) => {
        const key = tool.key.toUpperCase();
        const Icon = tool.icon;
        return [
          tool.groupStart ? <div class="divider-h" aria-hidden="true" key={`${tool.id}-sep`} /> : null,
          <button
            key={tool.id}
            type="button"
            class="tool-btn"
            aria-label={tool.name}
            aria-pressed={active === tool.id}
            aria-keyshortcuts={key}
            onClick={() => {
              state.tool.value = tool.id;
            }}
          >
            <Icon />
            <span class="tool-key" aria-hidden="true">
              {key}
            </span>
            <span class="tooltip" aria-hidden="true">
              {tool.name}
              <kbd>{key}</kbd>
            </span>
          </button>,
        ];
      })}
      <div class="divider-h" aria-hidden="true" />
      <PlaneMenu state={state} onStep={onPlaneStep} />
    </nav>
  );
}
