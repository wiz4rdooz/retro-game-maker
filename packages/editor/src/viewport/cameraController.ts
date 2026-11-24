import { vec3, type Camera, type ViewKind } from '@rgm/engine';

const LOOK_RAD_PER_PX = 0.0025;
const FLY_SPEED = 10;
const FLY_BOOST = 3;
const WHEEL_NOTCH = 100;
const ORTHO_STEP = 1.1;
const ORTHO_MIN = 0.5;
const ORTHO_MAX = 2000;
const FOCUS_DISTANCE = 6;
const FLY_KEYS = ['w', 'a', 's', 'd', 'q', 'e'] as const;

/**
 * Bedienung der Editor-Kamera. Rechte Maustaste: umsehen (in Ortho: verschieben); mit gehaltener
 * rechter Taste fliegen W/A/S/D/Q/E (10 m/s, Shift × 3). Rad: in Perspektive 10 % der
 * Fokusdistanz (mindestens 0,5 m) je Raste entlang der Blickrichtung, in Ortho Maßstab × / ÷ 1,1.
 * Leertaste + linke oder mittlere Maustaste: verschieben. F: 6 m vor einen Punkt.
 */
export class CameraController {
  /** Abstand zum Punkt unter dem Zeiger, für Zoom- und Verschiebe-Tempo (Standard 10 m). */
  focusDistance = 10;
  /** Höhe der Ansicht in CSS-Pixeln (für Ortho-Verschieben). */
  viewportHeight = 800;

  private mode: 'none' | 'look' | 'pan' = 'none';
  private button = -1;
  private lastX = 0;
  private lastY = 0;
  private readonly tmp = vec3.create();
  private readonly tmp2 = vec3.create();

  constructor(
    private readonly camera: Camera,
    private readonly onChange: () => void,
  ) {}

  get looking(): boolean {
    return this.mode === 'look';
  }

  get panning(): boolean {
    return this.mode === 'pan';
  }

  /** true, wenn die Kamera den Klick übernimmt. */
  pointerDown(button: number, x: number, y: number, spaceHeld: boolean): boolean {
    if (this.mode !== 'none') return true;
    let mode: 'look' | 'pan' | null = null;
    if (button === 2) mode = this.camera.view === 'perspective' ? 'look' : 'pan';
    else if (button === 1 || (button === 0 && spaceHeld)) mode = 'pan';
    if (!mode) return false;
    this.mode = mode;
    this.button = button;
    this.lastX = x;
    this.lastY = y;
    return true;
  }

  /** true, wenn die Kamera die Bewegung verbraucht hat. */
  pointerMove(x: number, y: number): boolean {
    if (this.mode === 'none') return false;
    const dx = x - this.lastX;
    const dy = y - this.lastY;
    this.lastX = x;
    this.lastY = y;
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return true;
    const cam = this.camera;
    if (this.mode === 'look') {
      cam.yaw -= dx * LOOK_RAD_PER_PX;
      cam.pitch = cam.pitch - dy * LOOK_RAD_PER_PX;
    } else {
      const k =
        cam.view === 'perspective'
          ? 0.02 * (this.focusDistance / 10)
          : (2 * cam.orthoScale) / Math.max(1, this.viewportHeight);
      cam.right(this.tmp);
      cam.up(this.tmp2);
      vec3.scaleAndAdd(cam.position, cam.position, this.tmp, -dx * k);
      vec3.scaleAndAdd(cam.position, cam.position, this.tmp2, dy * k);
    }
    this.onChange();
    return true;
  }

  pointerUp(button: number): void {
    if (button === this.button) {
      this.mode = 'none';
      this.button = -1;
    }
  }

  /** Bricht Umsehen/Verschieben ab (z. B. Fenster verliert den Fokus). */
  cancel(): void {
    this.mode = 'none';
    this.button = -1;
  }

  /** deltaY in Pixeln (100 = eine Raste); positiv = vom Bild weg. */
  wheel(deltaY: number, focusDistance: number | null): void {
    if (!Number.isFinite(deltaY) || deltaY === 0) return;
    const notches = deltaY / WHEEL_NOTCH;
    const cam = this.camera;
    if (cam.view === 'perspective') {
      if (focusDistance !== null && Number.isFinite(focusDistance) && focusDistance > 0) this.focusDistance = focusDistance;
      let step = -notches * Math.max(0.5, 0.1 * this.focusDistance);
      // nicht durch den Punkt unter dem Zeiger hindurch
      if (focusDistance !== null && step > 0) step = Math.min(step, Math.max(0, focusDistance - 0.25));
      cam.forward(this.tmp);
      vec3.scaleAndAdd(cam.position, cam.position, this.tmp, step);
      this.focusDistance = Math.max(0.5, this.focusDistance - step);
    } else {
      cam.orthoScale = Math.min(ORTHO_MAX, Math.max(ORTHO_MIN, cam.orthoScale * ORTHO_STEP ** notches));
    }
    this.onChange();
  }

  setView(v: ViewKind): void {
    if (this.camera.view === v) return;
    this.cancel();
    this.camera.view = v;
    this.onChange();
  }

  /** Rückt die Kamera auf 6 m vor den Punkt (Blickrichtung bleibt). */
  focus(point: ArrayLike<number>): void {
    if (![point[0], point[1], point[2]].every(Number.isFinite)) return;
    const cam = this.camera;
    cam.forward(this.tmp);
    vec3.scaleAndAdd(cam.position, point, this.tmp, -FOCUS_DISTANCE);
    this.focusDistance = FOCUS_DISTANCE;
    this.onChange();
  }

  /** Fliegen; true, wenn sich die Kamera bewegt hat. */
  update(dt: number, keys: ReadonlySet<string>): boolean {
    if (this.mode !== 'look' || !(dt > 0)) return false;
    const cam = this.camera;
    const f = (keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0);
    const r = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
    const u = (keys.has('e') ? 1 : 0) - (keys.has('q') ? 1 : 0);
    if (f === 0 && r === 0 && u === 0) return false;
    const dir = this.tmp;
    cam.forward(this.tmp2);
    vec3.scale(dir, this.tmp2, f);
    cam.right(this.tmp2);
    vec3.scaleAndAdd(dir, dir, this.tmp2, r);
    dir[1] += u;
    vec3.normalize(dir, dir);
    const speed = FLY_SPEED * (keys.has('shift') ? FLY_BOOST : 1);
    vec3.scaleAndAdd(cam.position, cam.position, dir, speed * dt);
    this.onChange();
    return true;
  }

  /** Tasten, die beim Fliegen dem Werkzeug nicht zur Verfügung stehen. */
  static isFlyKey(key: string): boolean {
    return (FLY_KEYS as readonly string[]).includes(key.toLowerCase());
  }
}
