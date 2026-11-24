import { useEffect, useRef } from 'preact/hooks';
import type { AppCtx } from '../app/App';
import type { EditorSession } from '../app/session';
import type { DrawPlaneMode } from '../state/editorState';
import { t } from '../strings/de';
import type { BrushState } from '../tools/brush';
import { IconClose } from './icons';
import { PanelSection } from './PanelSection';

const PLANES: DrawPlaneMode[] = ['auto', 'y', 'x', 'z'];
const SIZES = [1, 2, 3] as const;

/** Pinsel: Vorschau, Drehen/Spiegeln, Größe, Beidseitig, Ohne Kollision, Deckel, Zeichenebene. */
export function BrushPanel({ ctx, session }: { ctx: AppCtx; session: EditorSession }) {
  const { state } = ctx;
  void state.docVersion.value;
  const b = state.brush.value;
  const meta = session.project.tilesets.find((ts) => ts.id === b.tileset);
  const image = meta ? session.tilesetImages.get(meta.id) : undefined;
  const set = (patch: Partial<BrushState>) => {
    state.brush.value = { ...state.brush.value, ...patch };
  };
  return (
    <PanelSection title={t.panel.pinsel}>
      <div class="brush-head">
        {meta && image ? (
          <BrushPreview image={image} tileSize={meta.tileSize} brush={b} />
        ) : (
          <div class="brush-preview checker" role="img" aria-label={t.pinsel.vorschau} />
        )}
        <div class="brush-name">
          <span class="strong">{meta ? meta.name : t.panel.pruefmuster}</span>
          <span class="mono muted small-text">
            {t.pinsel.kachel(b.tx, b.ty)}
            {b.w * b.h > 1 ? ` · ${t.pinsel.rechteck(b.w, b.h)}` : ''}
          </span>
        </div>
      </div>
      <div class="btn-row">
        <button type="button" class="btn grow" aria-keyshortcuts="R" onClick={() => set({ rot: ((b.rot + 1) & 3) as BrushState['rot'] })}>
          {t.pinsel.drehen}
          <kbd>R</kbd>
        </button>
        <button type="button" class="btn grow" aria-keyshortcuts="X" onClick={() => set({ flipX: !b.flipX })}>
          {t.pinsel.spiegeln}
          <kbd>X</kbd>
        </button>
      </div>
      <div role="group" aria-label={t.pinsel.groesseLabel} class="size-row">
        <span class="muted">{t.pinsel.groesse}</span>
        <div class="seg compact">
          {SIZES.map((s) => (
            <button key={s} type="button" aria-pressed={b.size === s} onClick={() => set({ size: s })}>
              {s}
            </button>
          ))}
        </div>
      </div>
      <label class="check">
        <input type="checkbox" checked={b.doubleSided} onChange={(e) => set({ doubleSided: (e.target as HTMLInputElement).checked })} />
        {t.pinsel.beidseitig}
      </label>
      <label class="check">
        <input type="checkbox" checked={b.ghost} onChange={(e) => set({ ghost: (e.target as HTMLInputElement).checked })} />
        {t.pinsel.ohneKollision}
      </label>
      {b.topTile && (
        <div class="row-between">
          <span class="mono small-text">{t.tileset.deckel(b.topTile.tx, b.topTile.ty)}</span>
          <button type="button" class="icon-btn small" aria-label={t.pinsel.deckelEntfernen} title={t.pinsel.deckelEntfernen} onClick={() => set({ topTile: null })}>
            <IconClose />
          </button>
        </div>
      )}
      <div class="size-row">
        <span class="muted">
          {t.pinsel.zeichenebene} <kbd>Q</kbd>
        </span>
      </div>
      <div role="group" aria-label={t.pinsel.zeichenebene} class="seg compact plane-switch">
        {PLANES.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={state.drawPlane.value === m}
            onClick={() => {
              state.drawPlane.value = m;
            }}
          >
            {t.pinsel.ebenen[m]}
          </button>
        ))}
      </div>
    </PanelSection>
  );
}

/** Erste Pinsel-Kachel mit Drehung und Spiegelung, pixelgenau vergrößert. */
function BrushPreview({ image, tileSize, brush }: { image: ImageBitmap; tileSize: number; brush: BrushState }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const size = 48;
  useEffect(() => {
    const g = ref.current?.getContext('2d');
    if (!g) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, size, size);
    g.imageSmoothingEnabled = false;
    g.translate(size / 2, size / 2);
    g.rotate((brush.rot * Math.PI) / 2);
    g.scale(brush.flipX ? -1 : 1, brush.flipY ? -1 : 1);
    g.drawImage(image, brush.tx * tileSize, brush.ty * tileSize, tileSize, tileSize, -size / 2, -size / 2, size, size);
  }, [image, tileSize, brush.tx, brush.ty, brush.rot, brush.flipX, brush.flipY]);
  return <canvas ref={ref} class="brush-preview" width={size} height={size} role="img" aria-label={t.pinsel.vorschau} />;
}
