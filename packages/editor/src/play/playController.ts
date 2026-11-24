import { signal } from '@preact/signals';
import type { ViewKind } from '@rgm/engine';
import { PlaySession, findSpawn, type PlayerInput } from '@rgm/runtime';
import type { EditorSession } from '../app/session';
import type { EditorState } from '../state/editorState';
import type { ViewportController } from '../viewport/viewportController';

const LOOK_RAD_PER_PX = 0.0022;

interface SavedCamera {
  position: Float32Array;
  yaw: number;
  pitch: number;
  view: ViewKind;
  fovY: number;
  orthoScale: number;
}

/**
 * Play-Modus: Spielfigur an der Stelle unter der Editor-Kamera, Blick per Pointer-Lock (sonst mit
 * gedrückter linker Maustaste). W/S/A/D und Pfeiltasten laufen, Shift rennt, Leertaste springt.
 * Esc, Verlust des Pointer-Locks oder F5 beenden das Spiel; die Editor-Kamera kommt zurück.
 */
export class PlayController {
  /** 'lock' = Maus gefangen, 'drag' = Umsehen mit gedrückter linker Maustaste. */
  readonly lookMode = signal<'lock' | 'drag'>('lock');
  private play: PlaySession | null = null;
  private saved: SavedCamera | null = null;
  private readonly keys = new Set<string>();
  private jumpQueued = false;
  private lookDX = 0;
  private lookDY = 0;
  private locked = false;
  private dragging = false;
  private cleanups: (() => void)[] = [];

  constructor(
    private readonly viewport: ViewportController,
    private readonly session: EditorSession,
    private readonly state: EditorState,
  ) {}

  get active(): boolean {
    return this.play !== null;
  }

  start(): void {
    if (this.play || this.state.mode.value !== 'edit') return;
    void this.session.autosave.flush(); // im Hintergrund, Play startet sofort
    const cam = this.viewport.camera;
    this.saved = { position: new Float32Array(cam.position), yaw: cam.yaw, pitch: cam.pitch, view: cam.view, fovY: cam.fovY, orthoScale: cam.orthoScale };
    this.play = new PlaySession(this.session.world, findSpawn(this.session.world, cam.position), cam.yaw);
    this.keys.clear();
    this.jumpQueued = false;
    this.lookDX = this.lookDY = 0;
    this.locked = false;
    this.state.mode.value = 'play';
    this.state.hover.value = null;
    this.installInput();
    this.requestLock();
    this.viewport.setFrameHook((dt) => this.frame(dt));
  }

  stop(): void {
    if (!this.play) return;
    for (const fn of this.cleanups) fn();
    this.cleanups = [];
    this.viewport.setFrameHook(null);
    this.play = null;
    this.keys.clear();
    if (document.pointerLockElement === this.viewport.canvasElement) document.exitPointerLock();
    this.locked = false;
    const s = this.saved;
    if (s) {
      const cam = this.viewport.camera;
      cam.position.set(s.position);
      cam.yaw = s.yaw;
      cam.pitch = s.pitch;
      cam.view = s.view;
      cam.fovY = s.fovY;
      cam.orthoScale = s.orthoScale;
    }
    this.saved = null;
    this.state.mode.value = 'edit';
    this.viewport.commitCamera();
  }

  toggle(): void {
    if (this.play) this.stop();
    else this.start();
  }

  /** Tasten im Spiel (von der Editor-Tastatur weitergereicht): alle gehören dem Spiel, Esc beendet. */
  handleKey(e: KeyboardEvent): boolean {
    if (e.key === 'Escape') this.stop();
    return true;
  }

  playerInfo(): { x: number; y: number; z: number; grounded: boolean } | null {
    if (!this.play) return null;
    const p = this.play.player;
    return { x: p.position[0], y: p.position[1], z: p.position[2], grounded: p.grounded };
  }

  dispose(): void {
    this.stop();
  }

  private frame(dt: number): void {
    const play = this.play;
    if (!play) return;
    const k = this.keys;
    const input: PlayerInput = {
      moveX: (k.has('d') || k.has('ArrowRight') ? 1 : 0) - (k.has('a') || k.has('ArrowLeft') ? 1 : 0),
      moveZ: (k.has('w') || k.has('ArrowUp') ? 1 : 0) - (k.has('s') || k.has('ArrowDown') ? 1 : 0),
      run: k.has('shift'),
      jump: this.jumpQueued,
      lookDX: this.lookDX,
      lookDY: this.lookDY,
    };
    this.jumpQueued = false;
    this.lookDX = this.lookDY = 0;
    play.update(Math.min(dt, 0.1), input);
    play.applyCamera(this.viewport.camera);
  }

  private requestLock(): void {
    const canvas = this.viewport.canvasElement;
    this.lookMode.value = 'drag';
    try {
      const r = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      if (r && typeof r.catch === 'function') {
        r.catch(() => {
          this.lookMode.value = 'drag';
        });
      }
    } catch {
      this.lookMode.value = 'drag';
    }
  }

  private installInput(): void {
    const canvas = this.viewport.canvasElement;
    const name = (e: KeyboardEvent) => (e.key === 'Shift' ? 'shift' : e.key.length === 1 ? e.key.toLowerCase() : e.key);
    const keyDown = (e: KeyboardEvent) => {
      const k = name(e);
      if (k === ' ' && !e.repeat) this.jumpQueued = true;
      this.keys.add(k);
    };
    const keyUp = (e: KeyboardEvent) => {
      this.keys.delete(name(e));
      if (e.key === 'Shift') this.keys.delete('shift');
    };
    const blur = () => {
      this.keys.clear();
      this.dragging = false;
    };
    const lockChange = () => {
      if (document.pointerLockElement === canvas) {
        this.locked = true;
        this.lookMode.value = 'lock';
      } else if (this.locked) {
        // Pointer-Lock verloren (z. B. Esc im Browser) → zurück in den Editor
        this.locked = false;
        this.stop();
      }
    };
    const lockError = () => {
      this.lookMode.value = 'drag';
    };
    const mouseMove = (e: MouseEvent) => {
      if (!this.locked && !this.dragging) return;
      const dx = e.movementX, dy = e.movementY;
      if (Number.isFinite(dx) && Number.isFinite(dy)) {
        this.lookDX += dx * LOOK_RAD_PER_PX;
        this.lookDY += dy * LOOK_RAD_PER_PX;
      }
    };
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      if (this.locked) return;
      this.dragging = true;
      canvas.setPointerCapture(e.pointerId);
      this.requestLock(); // ein Klick ist eine Nutzergeste: Maus wenn möglich doch noch fangen
    };
    const up = (e: PointerEvent) => {
      if (e.button === 0) this.dragging = false;
    };
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', blur);
    document.addEventListener('pointerlockchange', lockChange);
    document.addEventListener('pointerlockerror', lockError);
    document.addEventListener('mousemove', mouseMove);
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointerup', up);
    this.cleanups.push(() => {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', blur);
      document.removeEventListener('pointerlockchange', lockChange);
      document.removeEventListener('pointerlockerror', lockError);
      document.removeEventListener('mousemove', mouseMove);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointerup', up);
    });
  }
}
