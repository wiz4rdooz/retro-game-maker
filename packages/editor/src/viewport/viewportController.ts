import { effect, signal } from '@preact/signals';
import {
  CHECKER_TILESET,
  Camera,
  Chunk,
  LineRenderer,
  TileRenderer,
  buildChunkMesh,
  createGl,
  type ChunkMeshPart,
  type FogOptions,
  type RenderStats,
  type TileData,
  type TilesetInfo,
  type ViewKind,
} from '@rgm/engine';
import type { EditorSession } from '../app/session';
import type { EditorState } from '../state/editorState';

/** Vorschau der Werkzeuge: halbdurchsichtige Kacheln, Linien (je 6 Zahlen) und Punkte (je 3). */
export interface Preview {
  ghosts: TileData[];
  lines: Float32Array;
  points: Float32Array;
}

export class NoWebGl2Error extends Error {}

/** --viewport-bg #16181b; Nebel 110–160 m, Sichtweite 160 m (K7). */
const BG: [number, number, number] = [0x16 / 255, 0x18 / 255, 0x1b / 255];
const FOG: FogOptions = { color: BG, start: 110, end: 160, viewDistance: 160 };
const ACCENT: [number, number, number, number] = [0x4d / 255, 0x9f / 255, 1, 1];
const MESH_BUDGET_MS = 8;
const GHOST_ALPHA = 0.6;

/**
 * Zeichnet die Welt bei Bedarf (Kamera, Welt, Hover, Vorschau). Vor jedem Bild werden geänderte
 * Chunks neu vernetzt – die zuletzt bearbeiteten zuerst, höchstens 8 ms pro Bild.
 */
export class ViewportController {
  readonly camera = new Camera();
  /** Ändert sich, wenn sich Blickrichtung oder Ansicht ändern (für die Achsen-Anzeige). */
  readonly cameraInfo = signal<{ yaw: number; pitch: number; view: ViewKind }>({ yaw: 0, pitch: 0, view: 'perspective' });

  private readonly gl: WebGL2RenderingContext;
  private readonly tiles: TileRenderer;
  private readonly lines: LineRenderer;
  private readonly tilesets = new Map<number, TilesetInfo>([[CHECKER_TILESET.id, CHECKER_TILESET]]);
  private queue: number[] = [];
  private preview: Preview | null = null;
  private ghostParts: ChunkMeshPart[] = [];
  private lastStats: RenderStats = { drawCalls: 0, visibleChunks: 0, triangles: 0 };
  private raf = 0;
  private disposed = false;
  private readonly cleanups: (() => void)[] = [];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly session: EditorSession,
    private readonly state: EditorState,
  ) {
    const gl = createGl(canvas);
    if (!gl) throw new NoWebGl2Error('WebGL2 fehlt');
    this.gl = gl;
    this.tiles = new TileRenderer(gl);
    this.lines = new LineRenderer(gl);

    const c = session.project.editor.camera;
    this.camera.position[0] = c.x;
    this.camera.position[1] = c.y;
    this.camera.position[2] = c.z;
    this.camera.yaw = c.yaw;
    this.camera.pitch = c.pitch;
    this.camera.view = state.view.value;

    this.syncTilesets();
    session.world.markAllRenderDirty();

    const ro = new ResizeObserver(() => this.resize());
    ro.observe(canvas);
    this.cleanups.push(() => ro.disconnect());
    this.resize();

    this.cleanups.push(
      effect(() => {
        void state.docVersion.value;
        void state.hover.value;
        this.requestRender();
      }),
      effect(() => {
        this.camera.view = state.view.value;
        this.requestRender();
      }),
    );

    const lost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    };
    const restored = () => {
      this.tiles.restore();
      this.lines.restore();
      this.syncTilesets();
      this.queue = [];
      this.session.world.markAllRenderDirty();
      if (this.preview) this.setPreview(this.preview);
      this.requestRender();
    };
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', restored);
    this.cleanups.push(() => {
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
    });
    this.requestRender();
  }

  /** Lädt alle Tileset-Bilder der Sitzung in den Renderer und vernetzt die Welt neu. */
  syncTilesets(): void {
    for (const meta of this.session.project.tilesets) {
      const img = this.session.tilesetImages.get(meta.id);
      if (!img) continue;
      const info: TilesetInfo = { id: meta.id, tileSize: meta.tileSize, imageWidth: meta.imageWidth, imageHeight: meta.imageHeight };
      this.tiles.setTileset(meta.id, img, info);
      this.tilesets.set(meta.id, info);
    }
    this.session.world.markAllRenderDirty();
    this.requestRender();
  }

  requestRender(): void {
    if (this.disposed || this.raf !== 0) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      if (this.disposed || this.gl.isContextLost()) return;
      const more = this.remesh(MESH_BUDGET_MS);
      this.draw();
      if (more) this.requestRender();
    });
  }

  setPreview(p: Preview | null): void {
    this.preview = p;
    this.ghostParts = [];
    if (p && p.ghosts.length > 0) {
      const chunk = new Chunk(0);
      for (let i = 0; i < p.ghosts.length; i++) chunk.push(i + 1, p.ghosts[i]);
      this.ghostParts = buildChunkMesh(chunk, this.tilesets, () => true);
    }
    this.requestRender();
  }

  /** Farbe an einer Stelle (CSS-Pixel relativ zur Ansicht); zeichnet dafür sofort ein Bild. */
  readPixel(cssX: number, cssY: number): [number, number, number, number] {
    const gl = this.gl;
    this.remesh(Infinity);
    this.draw();
    const w = this.canvas.width, h = this.canvas.height;
    const sx = w / Math.max(1, this.canvas.clientWidth);
    const sy = h / Math.max(1, this.canvas.clientHeight);
    const x = Math.min(w - 1, Math.max(0, Math.floor(cssX * sx)));
    const y = Math.min(h - 1, Math.max(0, h - 1 - Math.floor(cssY * sy)));
    const out = new Uint8Array(4);
    gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
    return [out[0], out[1], out[2], out[3]];
  }

  stats(): RenderStats {
    return { ...this.lastStats };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    for (const fn of this.cleanups) fn();
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }

  /** Vernetzt Chunks aus der Warteschlange, bis das Zeitbudget aufgebraucht ist; true = Rest bleibt. */
  private remesh(budgetMs: number): boolean {
    const world = this.session.world;
    const fresh = world.takeRenderDirty();
    if (fresh.size > 0) {
      const recent = [...fresh].reverse();
      this.queue = [...recent, ...this.queue.filter((k) => !fresh.has(k))];
    }
    if (this.queue.length === 0) return false;
    const hidden = new Set(world.layers.filter((l) => !l.visible).map((l) => l.id));
    const visible = (id: number) => !hidden.has(id);
    const t0 = performance.now();
    let i = 0;
    while (i < this.queue.length) {
      const key = this.queue[i++];
      const chunk = world.chunks.get(key);
      if (!chunk || chunk.count === 0) this.tiles.removeChunk(key);
      else this.tiles.updateChunk(key, buildChunkMesh(chunk, this.tilesets, visible), chunk.min, chunk.max);
      if (performance.now() - t0 >= budgetMs) break;
    }
    this.queue = this.queue.slice(i);
    return this.queue.length > 0;
  }

  private draw(): void {
    const gl = this.gl;
    const w = this.canvas.width, h = this.canvas.height;
    gl.viewport(0, 0, w, h);
    gl.clearColor(BG[0], BG[1], BG[2], 1);
    gl.clearDepth(1);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const aspect = w / Math.max(1, h);
    this.lastStats = this.tiles.draw(this.camera, aspect, FOG);
    if (this.ghostParts.length > 0) this.tiles.drawGhosts(this.camera, aspect, this.ghostParts, GHOST_ALPHA);
    const p = this.preview;
    if (p && p.lines.length >= 6) this.lines.drawLines(this.camera, aspect, p.lines, ACCENT, false);
    if (p && p.points.length >= 3) this.lines.drawPoints(this.camera, aspect, p.points, ACCENT, 6);
    const info = this.cameraInfo.value;
    if (info.yaw !== this.camera.yaw || info.pitch !== this.camera.pitch || info.view !== this.camera.view) {
      this.cameraInfo.value = { yaw: this.camera.yaw, pitch: this.camera.pitch, view: this.camera.view };
    }
  }

  private resize(): void {
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.requestRender();
    }
  }
}
