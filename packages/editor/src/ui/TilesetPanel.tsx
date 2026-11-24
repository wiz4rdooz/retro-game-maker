import { useEffect, useRef, useState } from 'preact/hooks';
import type { AppCtx } from '../app/App';
import type { EditorSession } from '../app/session';
import { setTilesetSizeCmd } from '../commands/tilesetCommands';
import type { TilesetMeta } from '../project/projectModel';
import { t } from '../strings/de';
import { importTilesetFile, tilesetInUse } from '../tileset/importTileset';
import { validateTilesetImage } from '../tileset/validateTileset';
import type { BrushState } from '../tools/brush';
import { IconUpload } from './icons';
import { PanelSection } from './PanelSection';
import { showToast } from './Toast';

const PRESETS = [8, 16, 32] as const;
const VIEW_WIDTH = 286;

/** Bereich „Tileset“: Auswahl, Kachelgröße, Laden (Knopf oder Ablegen) und die Kachel-Auswahl. */
export function TilesetPanel({ ctx, session }: { ctx: AppCtx; session: EditorSession }) {
  const { state } = ctx;
  void state.docVersion.value;
  const brush = state.brush.value;
  const tilesets = session.project.tilesets;
  const current = tilesets.find((ts) => ts.id === brush.tileset) ?? tilesets[0] ?? null;
  const image = current ? session.tilesetImages.get(current.id) : undefined;
  const inUse = current ? tilesetInUse(session.world, current.id) : false;
  const [size, setSize] = useState(current?.tileSize ?? 16);
  const [custom, setCustom] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const sizeRef = useRef(size);
  sizeRef.current = size;

  useEffect(() => {
    if (!current) return;
    setSize(current.tileSize);
    setCustom(!PRESETS.includes(current.tileSize as 8));
  }, [current?.id]);

  const doImport = async (file: File) => {
    try {
      const meta = await importTilesetFile(file, sizeRef.current, session, state);
      const check = validateTilesetImage(meta.imageWidth, meta.imageHeight, meta.tileSize, session.maxTextureSize);
      if (check.ok && check.warnings.length > 0) showToast(check.warnings.join(' '));
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e));
    }
  };

  // PNG ins Fenster ziehen und ablegen
  useEffect(() => {
    const hasFiles = (e: DragEvent) => [...(e.dataTransfer?.types ?? [])].includes('Files');
    const over = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const drop = (e: DragEvent) => {
      const files = [...(e.dataTransfer?.files ?? [])];
      if (files.length === 0) return;
      e.preventDefault();
      void doImport(files.find((f) => /\.png$/i.test(f.name)) ?? files[0]);
    };
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, [session]);

  /** Neue Größe: gilt für den nächsten Import; das gezeigte Tileset wird umgerastert, solange es unbenutzt ist. */
  const applySize = (next: number) => {
    setSize(next);
    if (!current || inUse) return;
    const check = validateTilesetImage(current.imageWidth, current.imageHeight, next, session.maxTextureSize);
    if (!check.ok) {
      showToast(check.error);
      return;
    }
    session.exec(setTilesetSizeCmd(current.id, next, check.columns, check.rows));
    state.brush.value = { ...state.brush.value, tx: 0, ty: 0, w: 1, h: 1, topTile: null };
    if (check.warnings.length > 0) showToast(check.warnings.join(' '));
  };

  return (
    <PanelSection title={t.panel.tileset}>
      {current && (
        <div class="tileset-row">
          <select
            aria-label={t.tileset.waehlen}
            class="select"
            value={String(current.id)}
            onChange={(e) => {
              const id = Number((e.target as HTMLSelectElement).value);
              state.brush.value = { ...state.brush.value, tileset: id, tx: 0, ty: 0, w: 1, h: 1, topTile: null };
            }}
          >
            {tilesets.map((ts) => (
              <option key={ts.id} value={String(ts.id)}>
                {ts.name}.png
              </option>
            ))}
          </select>
          <span class="mono muted small-text">{t.tileset.groesse(current.tileSize)}</span>
        </div>
      )}
      <div role="group" aria-label={t.tileset.kachelgroesse} class="size-row">
        <span class="muted">{t.tileset.kachelgroesse}</span>
        <div class="seg compact">
          {PRESETS.map((s) => (
            <button key={s} type="button" aria-pressed={!custom && size === s} onClick={() => (setCustom(false), applySize(s))}>
              {s}
            </button>
          ))}
          <button type="button" aria-pressed={custom} onClick={() => setCustom(true)}>
            {t.tileset.eigene}
          </button>
        </div>
      </div>
      {custom && (
        <label class="field-inline">
          <span class="muted">{t.tileset.eigeneGroesse}</span>
          <input
            type="number"
            min={4}
            max={256}
            step={1}
            value={size}
            onChange={(e) => {
              const v = Number((e.target as HTMLInputElement).value);
              if (Number.isInteger(v) && v >= 4 && v <= 256) applySize(v);
              else showToast(t.tileset.kachelgroesseUngueltig);
            }}
          />
        </label>
      )}
      {current && inUse && size !== current.tileSize && <p class="muted small-text">{t.tileset.inBenutzung}</p>}
      {current && image ? (
        <TilesetPicker
          meta={current}
          image={image}
          brush={brush}
          onPick={(tx, ty, w, h) => {
            state.brush.value = { ...state.brush.value, tileset: current.id, tx, ty, w, h };
          }}
          onTop={(tx, ty) => {
            state.brush.value = { ...state.brush.value, tileset: current.id, topTile: { tx, ty } };
          }}
        />
      ) : (
        <p class="muted">{t.tileset.leer}</p>
      )}
      {current && image && (
        <div class="row-between small-text">
          <span class="mono">
            {brush.tileset === current.id ? t.tileset.auswahl(brush.tx, brush.ty, brush.w, brush.h) : ''}
          </span>
          <span class="mono muted" title={t.tileset.deckelHinweis}>
            {brush.tileset === current.id && brush.topTile ? t.tileset.deckel(brush.topTile.tx, brush.topTile.ty) : ''}
          </span>
        </div>
      )}
      <button type="button" class="btn" onClick={() => fileInput.current?.click()}>
        <IconUpload />
        {t.tileset.laden}
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="image/png"
        hidden
        onChange={(e) => {
          const input = e.target as HTMLInputElement;
          const file = input.files?.[0];
          input.value = '';
          if (file) void doImport(file);
        }}
      />
    </PanelSection>
  );
}

/** Das Tileset pixelgenau mit Raster; Klick wählt, Ziehen wählt ein Rechteck, Alt+Klick setzt den Deckel. */
function TilesetPicker({
  meta,
  image,
  brush,
  onPick,
  onTop,
}: {
  meta: TilesetMeta;
  image: ImageBitmap;
  brush: BrushState;
  onPick: (tx: number, ty: number, w: number, h: number) => void;
  onTop: (tx: number, ty: number) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const scale = Math.max(1, Math.min(8, Math.floor(VIEW_WIDTH / meta.imageWidth)));
  const w = meta.imageWidth * scale;
  const h = meta.imageHeight * scale;

  useEffect(() => {
    const g = canvas.current?.getContext('2d');
    if (!g) return;
    const cell = meta.tileSize * scale;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, w, h);
    g.drawImage(image, 0, 0, w, h);
    // abgeschnittener Rand
    g.fillStyle = 'rgba(0, 0, 0, 0.55)';
    g.fillRect(meta.columns * cell, 0, w - meta.columns * cell, h);
    g.fillRect(0, meta.rows * cell, meta.columns * cell, h - meta.rows * cell);
    g.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    g.lineWidth = 1;
    g.beginPath();
    for (let c = 0; c <= meta.columns; c++) {
      g.moveTo(c * cell + 0.5, 0);
      g.lineTo(c * cell + 0.5, meta.rows * cell);
    }
    for (let r = 0; r <= meta.rows; r++) {
      g.moveTo(0, r * cell + 0.5);
      g.lineTo(meta.columns * cell, r * cell + 0.5);
    }
    g.stroke();
    const sel = drag
      ? { tx: Math.min(drag.x0, drag.x1), ty: Math.min(drag.y0, drag.y1), w: Math.abs(drag.x1 - drag.x0) + 1, h: Math.abs(drag.y1 - drag.y0) + 1 }
      : brush.tileset === meta.id
        ? brush
        : null;
    if (sel) {
      g.strokeStyle = '#4d9fff';
      g.lineWidth = 2;
      g.strokeRect(sel.tx * cell + 1, sel.ty * cell + 1, sel.w * cell - 2, sel.h * cell - 2);
    }
    if (brush.tileset === meta.id && brush.topTile) {
      g.strokeStyle = '#ff9a3c';
      g.setLineDash([3, 2]);
      g.strokeRect(brush.topTile.tx * cell + 2.5, brush.topTile.ty * cell + 2.5, cell - 5, cell - 5);
      g.setLineDash([]);
    }
  }, [meta, meta.tileSize, meta.columns, meta.rows, image, brush, drag, scale]);

  const cellAt = (e: PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / Math.max(1, r.width)) * meta.imageWidth;
    const py = ((e.clientY - r.top) / Math.max(1, r.height)) * meta.imageHeight;
    return {
      tx: Math.min(meta.columns - 1, Math.max(0, Math.floor(px / meta.tileSize))),
      ty: Math.min(meta.rows - 1, Math.max(0, Math.floor(py / meta.tileSize))),
    };
  };

  return (
    <div class="tileset-view">
      <canvas
        ref={canvas}
        role="img"
        aria-label={t.tileset.bild(meta.name)}
        title={t.tileset.deckelHinweis}
        width={w}
        height={h}
        style={{ width: `${w}px`, height: `${h}px` }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          const c = cellAt(e);
          if (e.altKey) {
            onTop(c.tx, c.ty);
            return;
          }
          (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
          setDrag({ x0: c.tx, y0: c.ty, x1: c.tx, y1: c.ty });
        }}
        onPointerMove={(e) => {
          if (!drag) return;
          const c = cellAt(e);
          if (c.tx !== drag.x1 || c.ty !== drag.y1) setDrag({ ...drag, x1: c.tx, y1: c.ty });
        }}
        onPointerUp={(e) => {
          if (!drag) return;
          const c = cellAt(e);
          setDrag(null);
          onPick(Math.min(drag.x0, c.tx), Math.min(drag.y0, c.ty), Math.abs(c.tx - drag.x0) + 1, Math.abs(c.ty - drag.y0) + 1);
        }}
        onPointerCancel={() => setDrag(null)}
      />
    </div>
  );
}
