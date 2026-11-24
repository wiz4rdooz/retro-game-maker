import { effect, signal } from '@preact/signals';
import {
  CHECKER_TILESET,
  Camera,
  Chunk,
  LineRenderer,
  TileRenderer,
  buildChunkMesh,
  createGl,
  mat4,
  planeToWorld,
  raycastWorld,
  vec3,
  worldToPlane,
  type DrawPlane,
  type RayHit,
  type ChunkMeshPart,
  type FogOptions,
  type RenderStats,
  type TileData,
  type TilesetInfo,
  type ViewKind,
} from '@rgm/engine';
import type { EditorSession } from '../app/session';
import type { EditorState } from '../state/editorState';
import { PlaneResolver, nextPlaneMode, planeLabel } from '../tools/drawPlane';
import { createTool } from '../tools/registry';
import { pointerTarget, type Tool, type ToolContext, type ToolPointer } from '../tools/tool';
import { showToast } from '../ui/Toast';
import { isTypingTarget } from './keyboard';
import { CameraController } from './cameraController';

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
const GRID_RGBA: [number, number, number, number] = [1, 1, 1, 0.22];
const GRID_CELLS = 24;

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
  /** Tileset-id → zuletzt übergebene Größe (Kachel/Bild). */
  private readonly synced = new Map<number, string>();
  private queue: number[] = [];
  private preview: Preview | null = null;
  private ghostParts: ChunkMeshPart[] = [];
  private lastStats: RenderStats = { drawCalls: 0, visibleChunks: 0, triangles: 0 };
  private raf = 0;
  private lastFrame = 0;
  private disposed = false;
  readonly cam: CameraController;
  /** Gedrückte Tasten (Kleinbuchstaben, ' ', 'shift') für Fliegen und Verschieben. */
  private readonly keys = new Set<string>();
  private pointerInside = false;
  private readonly rayO = vec3.create();
  private readonly rayD = vec3.create();
  readonly planes = new PlaneResolver();
  private tool: Tool;
  private readonly toolCtx: ToolContext;
  /** Zeiger gehört gerade dem Werkzeug (gedrückt). */
  private toolDown = false;
  private grid: Float32Array = new Float32Array(0);
  private cursorLines: Float32Array = new Float32Array(0);
  private readonly vp = mat4.create();
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
    session.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;

    const c = session.project.editor.camera;
    this.camera.position[0] = c.x;
    this.camera.position[1] = c.y;
    this.camera.position[2] = c.z;
    this.camera.yaw = c.yaw;
    this.camera.pitch = c.pitch;
    this.camera.view = state.view.value;
    this.cam = new CameraController(this.camera, () => this.cameraChanged());
    this.toolCtx = this.makeToolContext();
    this.tool = createTool(state.tool.value);

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
        this.syncTilesets();
        this.requestRender();
      }),
      effect(() => {
        this.cam.setView(state.view.value);
        this.requestRender();
      }),
      effect(() => {
        const id = state.tool.value;
        if (this.tool.id === id) return;
        this.tool.deactivate?.(this.toolCtx);
        this.toolDown = false;
        this.tool = createTool(id);
        this.setPreview(null);
      }),
      effect(() => {
        void state.drawPlane.value;
        void state.snap.value;
        this.updateCursorLines();
        this.requestRender();
      }),
    );
    this.installInput();

    const lost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    };
    const restored = () => {
      this.tiles.restore();
      this.lines.restore();
      this.synced.clear();
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

  /** Gibt neue oder geänderte Tilesets der Sitzung an den Renderer; dann wird die Welt neu vernetzt. */
  syncTilesets(): void {
    let changed = false;
    for (const meta of this.session.project.tilesets) {
      const img = this.session.tilesetImages.get(meta.id);
      if (!img) continue;
      const sig = `${meta.tileSize}/${meta.imageWidth}/${meta.imageHeight}`;
      if (this.synced.get(meta.id) === sig) continue;
      const info: TilesetInfo = { id: meta.id, tileSize: meta.tileSize, imageWidth: meta.imageWidth, imageHeight: meta.imageHeight };
      this.tiles.setTileset(meta.id, img, info);
      this.tilesets.set(meta.id, info);
      this.synced.set(meta.id, sig);
      changed = true;
    }
    if (changed) {
      this.session.world.markAllRenderDirty();
      this.requestRender();
    }
  }

  requestRender(): void {
    if (this.disposed || this.raf !== 0) return;
    this.raf = requestAnimationFrame((now) => {
      this.raf = 0;
      if (this.disposed || this.gl.isContextLost()) return;
      const dt = Math.min(0.1, Math.max(0, (now - this.lastFrame) / 1000));
      this.lastFrame = now;
      const flying = this.cam.update(dt, this.keys);
      const more = this.remesh(MESH_BUDGET_MS);
      this.draw();
      if (more || flying) this.requestRender();
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
    this.tool.deactivate?.(this.toolCtx);
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    for (const fn of this.cleanups) fn();
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }

  /**
   * Tasten für die Ansicht (von der Editor-Tastatur gefragt): beim Umsehen gehören W/A/S/D/Q/E und
   * Shift der Kamera, die Leertaste über der Ansicht dem Verschieben, F rückt an den Punkt unter dem Zeiger.
   */
  handleKey(e: KeyboardEvent): boolean {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (this.cam.looking && (CameraController.isFlyKey(k) || k === 'Shift')) return true;
    if (k === ' ' && (this.pointerInside || this.cam.panning)) return true;
    if (k === 'q' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      this.state.drawPlane.value = nextPlaneMode(this.state.drawPlane.value);
      return true;
    }
    if (k === 'PageUp' || k === 'PageDown') {
      this.planes.offsetCursor(k === 'PageUp' ? 1 : -1, this.state.snap.value);
      this.updateCursorLines();
      this.requestRender();
      return true;
    }
    if (this.tool.key(e, this.toolCtx)) return true;
    if (k === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const hover = this.state.hover.value;
      const b = this.session.world.bounds();
      const target = hover ? hover.point : b ? [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2] : null;
      if (target) this.cam.focus(target);
      return true;
    }
    return false;
  }

  /** Erster Treffer unter dem Zeiger (CSS-Pixel) auf sichtbaren Ebenen. */
  pick(cssX: number, cssY: number): RayHit | null {
    const w = Math.max(1, this.canvas.clientWidth);
    const h = Math.max(1, this.canvas.clientHeight);
    return this.raycastNdc((cssX / w) * 2 - 1, 1 - (cssY / h) * 2);
  }

  private raycastNdc(ndcX: number, ndcY: number): RayHit | null {
    this.camera.screenRay(ndcX, ndcY, this.aspect(), this.rayO, this.rayD);
    const hidden = new Set(this.session.world.layers.filter((l) => !l.visible).map((l) => l.id));
    return raycastWorld(this.session.world, this.rayO, this.rayD, 2000, (id) => !hidden.has(id));
  }

  private aspect(): number {
    return Math.max(1, this.canvas.clientWidth) / Math.max(1, this.canvas.clientHeight);
  }

  private makeToolContext(): ToolContext {
    const session = this.session;
    return {
      world: session.world,
      history: session.history,
      state: this.state,
      camera: this.camera,
      planes: this.planes,
      exec: (cmd) => session.exec(cmd),
      aspect: () => this.aspect(),
      raycast: (x, y) => this.raycastNdc(x, y),
      screenRay: (x, y, o, d) => this.camera.screenRay(x, y, this.aspect(), o, d),
      editable: (layer) => {
        const l = session.world.layers.find((x) => x.id === layer);
        return !!l && l.visible && !l.locked;
      },
      setPreview: (p) => this.setPreview(p),
      notify: (msg) => showToast(msg),
      project: (p, out) => {
        const m = this.camera.viewProj(this.vp, this.aspect());
        const x = p[0], y = p[1], z = p[2];
        const w = m[3] * x + m[7] * y + m[11] * z + m[15];
        if (!(w > 1e-6)) return false;
        const nx = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
        const ny = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
        out[0] = ((nx + 1) / 2) * this.canvas.clientWidth;
        out[1] = ((1 - ny) / 2) * this.canvas.clientHeight;
        return Number.isFinite(out[0]) && Number.isFinite(out[1]);
      },
    };
  }

  private toolPointer(e: PointerEvent): ToolPointer {
    const w = Math.max(1, this.canvas.clientWidth);
    const h = Math.max(1, this.canvas.clientHeight);
    return {
      ndcX: (e.offsetX / w) * 2 - 1,
      ndcY: 1 - (e.offsetY / h) * 2,
      px: e.offsetX,
      py: e.offsetY,
      button: e.button === 2 ? 2 : 0,
      shift: e.shiftKey,
      alt: e.altKey,
      ctrl: e.ctrlKey || e.metaKey,
    };
  }

  /** Hover-Anzeige und Raster um den Punkt unter dem Zeiger. */
  private updateHover(p: ToolPointer): void {
    const tgt = pointerTarget(p, this.toolCtx);
    const pt = tgt.hit?.point ?? tgt.point;
    if (!pt) {
      this.state.hover.value = null;
      this.grid = new Float32Array(0);
      return;
    }
    this.state.hover.value = { point: [pt[0], pt[1], pt[2]], planeLabel: planeLabel(tgt.plane), tileId: tgt.hit?.tileId ?? null };
    this.grid = tgt.point ? buildGrid(tgt.plane, tgt.point, this.state.snap.value) : new Float32Array(0);
  }

  private clearHover(): void {
    this.state.hover.value = null;
    this.grid = new Float32Array(0);
    if (!this.toolDown) this.setPreview(null);
  }

  /** Kreuz am 3D-Cursor, wenn die Zeichenebene an ihm hängt (x/y/z). */
  private updateCursorLines(): void {
    if (this.state.drawPlane.value === 'auto') {
      this.cursorLines = new Float32Array(0);
      return;
    }
    const c = this.planes.cursor;
    const r = 0.5;
    this.cursorLines = new Float32Array([
      c[0] - r, c[1], c[2], c[0] + r, c[1], c[2],
      c[0], c[1] - r, c[2], c[0], c[1] + r, c[2],
      c[0], c[1], c[2] - r, c[0], c[1], c[2] + r,
    ]);
  }

  private cameraChanged(): void {
    const ec = this.session.project.editor.camera;
    ec.x = this.camera.position[0];
    ec.y = this.camera.position[1];
    ec.z = this.camera.position[2];
    ec.yaw = this.camera.yaw;
    ec.pitch = this.camera.pitch;
    this.requestRender();
  }

  private installInput(): void {
    const canvas = this.canvas;
    canvas.tabIndex = -1;
    const down = (e: PointerEvent) => {
      if (this.cam.looking || this.cam.panning) return;
      const panLike = e.button === 1 || e.button === 2 || (e.button === 0 && this.keys.has(' '));
      if (panLike && this.camera.view === 'perspective') {
        const hit = this.pick(e.offsetX, e.offsetY);
        if (hit) this.cam.focusDistance = Math.max(0.5, hit.t);
      }
      if (this.cam.pointerDown(e.button, e.offsetX, e.offsetY, this.keys.has(' '))) {
        e.preventDefault();
        canvas.focus({ preventScroll: true });
        canvas.setPointerCapture(e.pointerId);
        this.lastFrame = performance.now();
        return;
      }
      if ((e.button !== 0 && e.button !== 2) || this.toolDown) return;
      e.preventDefault();
      canvas.focus({ preventScroll: true });
      const p = this.toolPointer(e);
      if (p.ctrl && e.button === 0) {
        // Strg+Klick setzt den 3D-Cursor
        const tgt = pointerTarget(p, this.toolCtx);
        const pt = tgt.hit?.point ?? tgt.point;
        if (pt) this.planes.setCursor(pt, this.state.snap.value);
        this.updateCursorLines();
        this.requestRender();
        return;
      }
      canvas.setPointerCapture(e.pointerId);
      this.toolDown = true;
      this.tool.pointerDown(p, this.toolCtx);
    };
    const move = (e: PointerEvent) => {
      if (this.cam.pointerMove(e.offsetX, e.offsetY)) return;
      const p = this.toolPointer(e);
      this.updateHover(p);
      this.tool.pointerMove(p, this.toolCtx);
    };
    const up = (e: PointerEvent) => {
      this.cam.pointerUp(e.button);
      if (!this.toolDown) return;
      this.toolDown = false;
      this.tool.pointerUp(this.toolPointer(e), this.toolCtx);
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const scale = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? Math.max(1, canvas.clientHeight) : 1;
      const hit = this.camera.view === 'perspective' ? this.pick(e.offsetX, e.offsetY) : null;
      this.cam.wheel(e.deltaY * scale, hit ? hit.t : null);
    };
    const keyName = (e: KeyboardEvent) => (e.key === 'Shift' ? 'shift' : e.key.length === 1 ? e.key.toLowerCase() : '');
    const keyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const k = keyName(e);
      if (!k) return;
      if (!this.keys.has(k) && this.cam.looking && CameraController.isFlyKey(k)) {
        this.lastFrame = performance.now();
        this.requestRender();
      }
      this.keys.add(k);
    };
    const keyUp = (e: KeyboardEvent) => {
      const k = keyName(e);
      if (k === ' ' && (this.pointerInside || this.cam.panning) && !isTypingTarget(e.target)) e.preventDefault();
      if (k) this.keys.delete(k);
    };
    const blur = () => {
      this.keys.clear();
      this.cam.cancel();
      if (this.toolDown) {
        this.toolDown = false;
        this.tool.deactivate?.(this.toolCtx);
      }
    };
    const enter = () => {
      this.pointerInside = true;
    };
    const leave = () => {
      this.pointerInside = false;
      if (!this.toolDown) this.clearHover();
    };
    const menu = (e: Event) => e.preventDefault();
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', blur);
    canvas.addEventListener('pointerenter', enter);
    canvas.addEventListener('pointerleave', leave);
    canvas.addEventListener('wheel', wheel, { passive: false });
    canvas.addEventListener('contextmenu', menu);
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', blur);
    this.cleanups.push(() => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', blur);
      canvas.removeEventListener('pointerenter', enter);
      canvas.removeEventListener('pointerleave', leave);
      canvas.removeEventListener('wheel', wheel);
      canvas.removeEventListener('contextmenu', menu);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', blur);
    });
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
    if (this.grid.length >= 6) this.lines.drawLines(this.camera, aspect, this.grid, GRID_RGBA, true);
    if (this.cursorLines.length >= 6) this.lines.drawLines(this.camera, aspect, this.cursorLines, ACCENT, false);
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
    this.cam.viewportHeight = this.canvas.clientHeight;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.requestRender();
    }
  }
}

/** Raster auf der Zeichenebene, ±24 Zellen um die Zelle unter dem Punkt, minimal zur Kamera versetzt. */
function buildGrid(plane: DrawPlane, point: ArrayLike<number>, snap: number): Float32Array {
  const [u, v] = worldToPlane(plane, point);
  const cu = Math.floor(u / snap) * snap;
  const cv = Math.floor(v / snap) * snap;
  const n = GRID_CELLS;
  const lift: DrawPlane = { ...plane, offset: plane.offset + plane.facing * 0.003 };
  const out = new Float32Array((2 * n + 2) * 2 * 6);
  let o = 0;
  const seg = (u0: number, v0: number, u1: number, v1: number) => {
    out.set(planeToWorld(lift, u0, v0), o);
    out.set(planeToWorld(lift, u1, v1), o + 3);
    o += 6;
  };
  for (let i = -n; i <= n + 1; i++) {
    seg(cu + i * snap, cv - n * snap, cu + i * snap, cv + (n + 1) * snap);
    seg(cu - n * snap, cv + i * snap, cu + (n + 1) * snap, cv + i * snap);
  }
  return out;
}
