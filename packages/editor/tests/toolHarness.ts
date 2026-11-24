import { Camera, mat4, raycastWorld, vec3, type TileData } from '@rgm/engine';
import type { DocCtx } from '../src/commands/command';
import { History } from '../src/commands/history';
import { newProject } from '../src/project/projectModel';
import { createEditorState } from '../src/state/editorState';
import { PlaneResolver } from '../src/tools/drawPlane';
import { createTool, type ToolId } from '../src/tools/registry';
import type { Tool, ToolContext, ToolPointer } from '../src/tools/tool';
import type { Preview } from '../src/viewport/viewportController';

export interface CellOpts {
  button?: 0 | 2;
  shift?: boolean;
  alt?: boolean;
  ctrl?: boolean;
  /** Treffpunkt auf der Oberfläche der dortigen Kachel statt auf y = 0 (bei Blick von oben gleiche NDC). */
  onTile?: boolean;
}

const CANVAS = 1000;
const SCALE = 20;

/**
 * Werkzeug-Prüfstand ohne DOM: Kamera bei (0, 50, 0), Ortho „top“ (orthoScale 20, aspect 1),
 * gedachtes Canvas 1000 × 1000 px. Zellen (u, v) liegen auf dem Boden (x = u, z = v).
 */
export function makeToolHarness(toolId: ToolId) {
  const { project, world } = newProject('Test', new Date(0));
  const doc: DocCtx = { world, project };
  const history = new History(doc);
  const state = createEditorState();
  state.mode.value = 'edit';
  state.tool.value = toolId;
  const camera = new Camera();
  camera.view = 'top';
  camera.orthoScale = SCALE;
  camera.position[0] = 0;
  camera.position[1] = 50;
  camera.position[2] = 0;
  const planes = new PlaneResolver();
  let lastNotice: string | null = null;
  let preview: Preview | null = null;
  const vp = mat4.create();
  const tmp = vec3.create();

  const visible = (layer: number) => world.layers.find((l) => l.id === layer)?.visible ?? true;
  const ctx: ToolContext = {
    world,
    history,
    state,
    camera,
    planes,
    exec: (cmd) => history.exec(cmd),
    aspect: () => 1,
    raycast: (x, y) => {
      const o = vec3.create(), d = vec3.create();
      camera.screenRay(x, y, 1, o, d);
      return raycastWorld(world, o, d, 5000, visible);
    },
    screenRay: (x, y, o, d) => camera.screenRay(x, y, 1, o, d),
    editable: (layer) => {
      const l = world.layers.find((x) => x.id === layer);
      return !!l && l.visible && !l.locked;
    },
    setPreview: (p) => {
      preview = p;
    },
    notify: (msg) => {
      lastNotice = msg;
    },
    project: (p, out) => {
      camera.viewProj(vp, 1);
      mat4.transformPoint(tmp, vp, p);
      if (![tmp[0], tmp[1], tmp[2]].every(Number.isFinite)) return false;
      out[0] = ((tmp[0] + 1) / 2) * CANVAS;
      out[1] = ((1 - tmp[1]) / 2) * CANVAS;
      return true;
    },
  };

  let tool: Tool = createTool(toolId);

  const pointer = (u: number, v: number, o: CellOpts = {}): ToolPointer => {
    // Zellmitte; bei Blick von oben ändert die Höhe (onTile) die NDC nicht
    const ndcX = (u + 0.5 - camera.position[0]) / SCALE;
    const ndcY = -(v + 0.5 - camera.position[2]) / SCALE;
    return {
      ndcX,
      ndcY,
      px: ((ndcX + 1) / 2) * CANVAS,
      py: ((1 - ndcY) / 2) * CANVAS,
      button: o.button ?? 0,
      shift: !!o.shift,
      alt: !!o.alt,
      ctrl: !!o.ctrl,
    };
  };

  const tileIds = (): number[] => {
    const ids: number[] = [];
    for (const c of world.chunks.values()) for (let i = 0; i < c.count; i++) ids.push(c.ids[i]);
    return ids.sort((a, b) => a - b);
  };

  return {
    world,
    history,
    state,
    camera,
    ctx,
    get lastNotice() {
      return lastNotice;
    },
    get preview() {
      return preview;
    },
    get tool() {
      return tool;
    },
    clickCell(u: number, v: number, o: CellOpts = {}) {
      const p = pointer(u, v, o);
      tool.pointerDown(p, ctx);
      tool.pointerUp(p, ctx);
    },
    dragCells([u0, v0]: [number, number], [u1, v1]: [number, number], o: CellOpts = {}) {
      tool.pointerDown(pointer(u0, v0, o), ctx);
      const n = Math.max(Math.abs(u1 - u0), Math.abs(v1 - v0));
      for (let i = 1; i <= n; i++) {
        tool.pointerMove(pointer(u0 + Math.round(((u1 - u0) * i) / n), v0 + Math.round(((v1 - v0) * i) / n), o), ctx);
      }
      tool.pointerUp(pointer(u1, v1, o), ctx);
    },
    hoverCell(u: number, v: number, o: CellOpts = {}) {
      tool.pointerMove(pointer(u, v, o), ctx);
    },
    useTool(id: ToolId) {
      tool.deactivate?.(ctx);
      tool = createTool(id);
      state.tool.value = id;
    },
    onlyTile(): TileData {
      const ids = tileIds();
      if (ids.length !== 1) throw new Error(`erwartet genau eine Kachel, gefunden ${ids.length}`);
      return world.getTile(ids[0])!;
    },
    tileIds,
  };
}
