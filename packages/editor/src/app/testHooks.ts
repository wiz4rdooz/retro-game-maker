import { cellQuad, type TileData } from '@rgm/engine';
import { addTilesCmd } from '../commands/tileCommands';
import type { AppCtx } from './App';

/** Kachel mit dem aktuellen Pinsel auf der aktiven Ebene. */
function brushed(ctx: AppCtx, corners: Float32Array): TileData {
  const b = ctx.state.brush.value;
  return {
    layer: ctx.state.activeLayer.value,
    tileset: b.tileset,
    tx: b.tx,
    ty: b.ty,
    rot: b.rot,
    flipX: b.flipX,
    flipY: b.flipY,
    doubleSided: b.doubleSided,
    ghost: b.ghost,
    corners,
  };
}

const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/**
 * window.__rgm für E2E-Tests: im Dev-Server, mit `?testhooks` oder unter Browser-Automation
 * (navigator.webdriver) – Playwrights page.goto('/') verwirft die Query der baseURL.
 */
export function installTestHooks(ctx: AppCtx): void {
  const enabled =
    import.meta.env.DEV || new URLSearchParams(location.search).has('testhooks') || navigator.webdriver === true;
  if (!enabled) return;
  const { state } = ctx;
  const session = () => ctx.session.value;
  const view = () => ctx.viewport.current;
  (window as unknown as { __rgm: unknown }).__rgm = {
    state: () => {
      const s = session();
      return plain({
        mode: state.mode.value,
        tool: state.tool.value,
        view: state.view.value,
        drawPlane: state.drawPlane.value,
        snap: state.snap.value,
        selectMode: state.selectMode.value,
        brush: state.brush.value,
        activeLayer: state.activeLayer.value,
        hover: state.hover.value,
        status: state.status.value,
        saveStatus: state.saveStatus.value,
        docVersion: state.docVersion.value,
        statsVisible: state.statsVisible.value,
        project: s?.project.name ?? null,
        camera: s?.project.editor.camera ?? null,
        tiles: s?.world.tileCount() ?? 0,
        layers: s?.world.layers ?? [],
        canUndo: s?.history.canUndo ?? false,
        canRedo: s?.history.canRedo ?? false,
      });
    },
    renderStats: () => {
      const v = view();
      if (!v) return null;
      v.renderNow();
      return v.fullStats();
    },
    pixelAt: (x: number, y: number) => view()?.readPixel(x, y) ?? null,
    gizmo: () => view()?.gizmoInfo() ?? null,
    /** Ecken aller Kacheln (nach id sortiert), je 12 Zahlen. */
    tileCorners: () => {
      const w = session()?.world;
      if (!w) return [];
      const rows: { id: number; corners: number[] }[] = [];
      for (const c of w.chunks.values()) for (let i = 0; i < c.count; i++) rows.push({ id: c.ids[i], corners: Array.from(c.corners.subarray(i * 12, i * 12 + 12)) });
      return rows.sort((a, b) => a.id - b.id).map((r) => r.corners);
    },
    tiles: () => session()?.world.tileCount() ?? 0,
    tile: (id: number) => {
      const tile = session()?.world.getTile(id);
      return tile ? { ...tile, corners: Array.from(tile.corners) } : null;
    },
    exec: (name: 'addFloor' | 'addWall', args: number[]) => {
      const s = session();
      if (!s) throw new Error('Kein Projekt offen');
      const tiles: TileData[] = [];
      if (name === 'addFloor') {
        const [x0, z0, w, d, y] = args;
        for (let x = x0; x < x0 + w; x++)
          for (let z = z0; z < z0 + d; z++) tiles.push(brushed(ctx, cellQuad({ axis: 'y', offset: y, facing: 1 }, x, z)));
      } else if (name === 'addWall') {
        const [x0, z, w, h] = args;
        for (let x = x0; x < x0 + w; x++)
          for (let y = 0; y < h; y++) tiles.push(brushed(ctx, cellQuad({ axis: 'z', offset: z, facing: 1 }, x, y)));
      } else {
        throw new Error(`Unbekannter Befehl: ${String(name)}`);
      }
      const cmd = addTilesCmd(tiles, name);
      s.exec(cmd);
      return [...cmd.addedIds];
    },
    setCamera: (x: number, y: number, z: number, yaw: number, pitch: number) => {
      view()?.setCameraPose(x, y, z, yaw, pitch);
    },
    player: () => ctx.play.current?.playerInfo() ?? null,
    flushSave: () => session()?.autosave.flush() ?? Promise.resolve(false),
  };
}
