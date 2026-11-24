import { planeOfQuad, rayPlane, vec3, type Camera, type DrawPlane, type RayHit, type World } from '@rgm/engine';
import type { Command, DocCtx } from '../commands/command';
import type { History } from '../commands/history';
import type { EditorState } from '../state/editorState';
import type { Preview } from '../viewport/viewportController';
import type { PlaneResolver } from './drawPlane';
import type { ToolId } from './registry';

/** Höchstzahl Kacheln pro Aktion (Review Focus 5). */
export const MAX_TILES_PER_OP = 65_536;
/** Mehr Geister zeigt die Vorschau nicht; darüber nur den Umriss. */
export const MAX_GHOSTS = 4_096;

export interface ToolPointer {
  /** NDC, nicht auf ±1 begrenzt. */
  ndcX: number;
  ndcY: number;
  /** Canvas-Pixel (CSS). */
  px: number;
  py: number;
  button: 0 | 2;
  shift: boolean;
  alt: boolean;
  ctrl: boolean;
}

export interface ToolContext {
  world: World;
  exec(cmd: Command<DocCtx>): void;
  history: History<DocCtx>;
  state: EditorState;
  camera: Camera;
  /** Zeichenebene und 3D-Cursor, gemeinsam für alle Werkzeuge. */
  planes: PlaneResolver;
  aspect(): number;
  /** Erster Treffer, nur sichtbare Ebenen. */
  raycast(ndcX: number, ndcY: number): RayHit | null;
  screenRay(ndcX: number, ndcY: number, o: Float32Array, d: Float32Array): void;
  /** Sichtbar und nicht gesperrt. */
  editable(layer: number): boolean;
  setPreview(p: Preview | null): void;
  notify(msg: string): void;
  /** Welt → Canvas-px; false, wenn nicht abbildbar. */
  project(p: ArrayLike<number>, out: Float32Array): boolean;
}

export interface Tool {
  readonly id: ToolId;
  pointerDown(p: ToolPointer, c: ToolContext): void;
  pointerMove(p: ToolPointer, c: ToolContext): void;
  pointerUp(p: ToolPointer, c: ToolContext): void;
  key(e: KeyboardEvent, c: ToolContext): boolean;
  deactivate?(c: ToolContext): void;
}

export interface PointerTarget {
  hit: RayHit | null;
  plane: DrawPlane;
  /** Punkt auf der Zeichenebene, null wenn der Strahl sie nicht trifft. */
  point: Float32Array | null;
}

const rayO = vec3.create();
const rayD = vec3.create();

/** Treffer, Zeichenebene und Ebenenpunkt unter dem Zeiger. */
export function pointerTarget(p: ToolPointer, c: ToolContext): PointerTarget {
  const hit = c.raycast(p.ndcX, p.ndcY);
  const plane = c.planes.resolve(c.state.drawPlane.value, hit, c.world, c.camera.position);
  return { hit, plane, point: pointOnPlane(p, c, plane) };
}

/** Schnittpunkt des Zeigerstrahls mit einer festen Ebene (für Striche und Rechtecke). */
export function pointOnPlane(p: ToolPointer, c: ToolContext, plane: DrawPlane): Float32Array | null {
  c.screenRay(p.ndcX, p.ndcY, rayO, rayD);
  const pt = rayPlane(rayO, rayD, plane);
  return pt && Number.isFinite(pt[0]) && Number.isFinite(pt[1]) && Number.isFinite(pt[2]) ? pt : null;
}

/** true, wenn der Treffer auf einer nicht achsparallelen Kachel liegt (z. B. Rampe). */
export function hitIsSlanted(hit: RayHit | null, world: World): boolean {
  if (!hit) return false;
  const tile = world.getTile(hit.tileId);
  return !!tile && planeOfQuad(tile.corners) === null;
}

/** Umrisslinien eines Vierecks (4 Segmente, je 6 Zahlen). */
export function quadOutline(corners: ArrayLike<number>, out: number[], base = 0): void {
  for (let k = 0; k < 4; k++) {
    const a = base + k * 3, b = base + ((k + 1) % 4) * 3;
    out.push(corners[a], corners[a + 1], corners[a + 2], corners[b], corners[b + 1], corners[b + 2]);
  }
}

export const NO_LINES = new Float32Array(0);
