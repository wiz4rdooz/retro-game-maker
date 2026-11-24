import { raycastWorld, type Camera, type World } from '@rgm/engine';
import { FpsController, type PlayerInput } from '../player/fpsController';
import type { PlayerConfig } from '../player/playerConfig';

const DOWN = [0, -1, 0];
const PLAY_FOV = (75 * Math.PI) / 180;

/** Startpunkt: Strahl senkrecht nach unten (alle Ebenen, höchstens 200 m); Füße 1 cm über dem Treffer, sonst from. */
export function findSpawn(world: World, from: ArrayLike<number>): Float32Array {
  const start = new Float32Array([from[0], from[1], from[2]]);
  if (!Array.from(start).every(Number.isFinite)) return start;
  const hit = raycastWorld(world, start, DOWN, 200, () => true);
  if (!hit) return start;
  return new Float32Array([hit.point[0], hit.point[1] + 0.01, hit.point[2]]);
}

/** Eine laufende Spielrunde: Spielfigur plus Kamera aus ihrer Sicht. */
export class PlaySession {
  readonly player: FpsController;
  private readonly eyeTmp = new Float32Array(3);

  constructor(world: World, spawn: ArrayLike<number>, yaw: number, cfg?: PlayerConfig) {
    this.player = new FpsController(world, spawn, yaw, cfg);
  }

  update(dt: number, input: PlayerInput): void {
    this.player.update(dt, input);
  }

  /** Augenposition, Blickrichtung, Sichtfeld 75°, Perspektive. */
  applyCamera(cam: Camera): void {
    this.player.eye(this.eyeTmp);
    cam.position[0] = this.eyeTmp[0];
    cam.position[1] = this.eyeTmp[1];
    cam.position[2] = this.eyeTmp[2];
    cam.yaw = this.player.yaw;
    cam.pitch = this.player.pitch;
    cam.fovY = PLAY_FOV;
    cam.view = 'perspective';
  }
}
