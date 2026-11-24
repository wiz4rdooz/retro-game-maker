import { axisIndex, planeOfQuad, worldToPlane, type DrawPlane, type RayHit, type World } from '@rgm/engine';
import type { DrawPlaneMode } from '../state/editorState';
import { t } from '../strings/de';

/** Reihenfolge für Q: auto → y → x → z → auto. */
export const PLANE_CYCLE: readonly DrawPlaneMode[] = ['auto', 'y', 'x', 'z'];

export function nextPlaneMode(mode: DrawPlaneMode): DrawPlaneMode {
  return PLANE_CYCLE[(PLANE_CYCLE.indexOf(mode) + 1) % PLANE_CYCLE.length];
}

/**
 * Wählt die Zeichenebene. auto: Ein Treffer auf eine achsparallele Kachel liefert deren Ebene
 * (zur Kamera gewandt) und merkt sie als sticky; sonst gilt sticky. x/y/z: Ebene durch den
 * 3D-Cursor senkrecht zur Achse, zur Kamera hin.
 */
export class PlaneResolver {
  sticky: DrawPlane = { axis: 'y', offset: 0, facing: 1 };
  readonly cursor = new Float32Array(3);
  /** Woher die zuletzt gelieferte Ebene kam (für Bild↑/Bild↓). */
  private last: { plane: DrawPlane; fromCursor: boolean } = { plane: this.sticky, fromCursor: false };

  resolve(mode: DrawPlaneMode, hit: RayHit | null, world: World, camPos: ArrayLike<number>): DrawPlane {
    if (mode === 'auto') {
      if (hit) {
        const tile = world.getTile(hit.tileId);
        const p = tile ? planeOfQuad(tile.corners) : null;
        if (p) {
          const plane: DrawPlane = hit.front ? p : { ...p, facing: p.facing === 1 ? -1 : 1 };
          this.sticky = plane;
        }
      }
      this.last = { plane: this.sticky, fromCursor: false };
      return this.sticky;
    }
    const a = axisIndex(mode);
    const offset = this.cursor[a];
    const plane: DrawPlane = { axis: mode, offset, facing: camPos[a] >= offset ? 1 : -1 };
    this.last = { plane, fromCursor: true };
    return plane;
  }

  /** Setzt den 3D-Cursor auf p, gerastert. */
  setCursor(p: ArrayLike<number>, snap: number): void {
    for (let a = 0; a < 3; a++) {
      const v = p[a];
      if (Number.isFinite(v)) this.cursor[a] = Math.round(v / snap) * snap;
    }
  }

  /** Bild↑/Bild↓: verschiebt die zuletzt genutzte Ebene um steps Rasterschritte entlang ihrer Normalen. */
  offsetCursor(steps: number, snap: number): void {
    const { plane, fromCursor } = this.last;
    const delta = steps * snap * plane.facing;
    if (fromCursor) {
      this.cursor[axisIndex(plane.axis)] += delta;
    } else {
      this.sticky = { ...this.sticky, offset: this.sticky.offset + delta };
      this.last = { plane: this.sticky, fromCursor: false };
    }
  }
}

/** Zelle unter einem Punkt der Ebene: gerastert (floor(u/snap)·snap) oder frei (Zelle mittig unter dem Punkt). */
export function cellAt(plane: DrawPlane, point: ArrayLike<number>, snap: number, free: boolean): [number, number] {
  const [u, v] = worldToPlane(plane, point);
  if (free) return [u - snap / 2, v - snap / 2];
  return [Math.floor(u / snap + 1e-9) * snap, Math.floor(v / snap + 1e-9) * snap];
}

/** Kurzname der Ebene für Statusleiste und Hover. */
export function planeLabel(plane: DrawPlane): string {
  const o = (Math.round(plane.offset * 100) / 100).toString().replace('.', ',');
  if (plane.axis === 'y') return t.ebene.boden(o);
  return plane.axis === 'x' ? t.ebene.wandX(o) : t.ebene.wandZ(o);
}

export function planeKey(plane: DrawPlane): string {
  return `${plane.axis}${plane.facing}:${plane.offset}`;
}

export function samePlane(a: DrawPlane, b: DrawPlane): boolean {
  return a.axis === b.axis && a.facing === b.facing && Math.abs(a.offset - b.offset) < 1e-4;
}
