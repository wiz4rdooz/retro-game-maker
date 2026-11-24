import { collectTriangles, rayTriangle, resolveCapsule, type World } from '@rgm/engine';
import { DEFAULT_PLAYER, type PlayerConfig } from './playerConfig';

/** Eingabe eines Bilds. Blick in rad: lookDX > 0 dreht nach rechts, lookDY > 0 blickt nach unten. */
export interface PlayerInput {
  /** −1…1, rechts + */
  moveX: number;
  /** −1…1, vorwärts + */
  moveZ: number;
  run: boolean;
  jump: boolean;
  lookDX: number;
  lookDY: number;
}

const MAX_DT = 0.1;
const MAX_SUBSTEPS = 64;
const SUBSTEP = 1 / 120;
const MAX_FALL_SPEED = 60;
const PITCH_LIMIT = (89 * Math.PI) / 180;
/** Abstand der äußeren Bodenstrahlen von der Mitte, als Anteil des Radius. */
const PROBE_RING = 0.7;
/** Wie weit ein fallender Körper unter seine Füße schaut. */
const PROBE_EPS = 0.01;
const DOWN = new Float32Array([0, -1, 0]);
/** Um so viel darf ein Schritt den Kopf tiefer in eine Decke drücken, bevor er nicht stattfindet. */
const CEILING_EPS = 1e-4;

/**
 * Spielfigur in Ego-Sicht. Der Kollisionskörper ist eine Kapsel, die stepHeight über den Füßen
 * schwebt; Boden, Stufen und Landung findet ein Bündel senkrechter Strahlen (Mitte und vier
 * Punkte im Abstand 0,7·r). Alles bis stepHeight wird so überstiegen, Höheres hält die Kapsel auf.
 */
export class FpsController {
  /** Füße (Mitte unten). */
  readonly position = new Float32Array(3);
  readonly velocity = new Float32Array(3);
  yaw: number;
  pitch = 0;
  grounded = false;

  private readonly cfg: PlayerConfig;
  /** Deckenberührung an der aktuellen Stelle (Wandmodus), für „nicht tiefer hinein“. */
  private ceilingDepth = 0;
  private readonly spawn = new Float32Array(3);
  private readonly spawnYaw: number;
  private readonly cosMaxSlope: number;
  private readonly bodyHeight: number;
  private readonly tris: number[] = [];
  private triCount = 0;
  private readonly body = new Float32Array(3);
  private readonly prevPos = new Float32Array(3);
  private readonly prevVel = new Float32Array(3);
  private readonly rayO = new Float32Array(3);
  private readonly qMin = new Float32Array(3);
  private readonly qMax = new Float32Array(3);

  constructor(
    private readonly world: World,
    spawn: ArrayLike<number>,
    yaw: number,
    cfg: PlayerConfig = DEFAULT_PLAYER,
  ) {
    this.cfg = cfg;
    for (let i = 0; i < 3; i++) this.spawn[i] = finite(spawn[i]);
    this.spawnYaw = wrapAngle(finite(yaw));
    this.yaw = this.spawnYaw;
    this.cosMaxSlope = Math.cos((cfg.maxSlopeDeg * Math.PI) / 180);
    this.bodyHeight = Math.max(2 * cfg.radius, cfg.height - cfg.stepHeight);
    this.position.set(this.spawn);
  }

  /** Augenpunkt (Füße + eyeHeight). */
  eye(out: Float32Array): Float32Array {
    out[0] = this.position[0];
    out[1] = this.position[1] + this.cfg.eyeHeight;
    out[2] = this.position[2];
    return out;
  }

  respawn(): void {
    this.position.set(this.spawn);
    this.velocity.fill(0);
    this.yaw = this.spawnYaw;
    this.pitch = 0;
    this.grounded = false;
    this.ceilingDepth = 0;
  }

  update(dt: number, input: PlayerInput): void {
    if (!(dt > 0)) return;
    dt = Math.min(dt, MAX_DT);
    const cfg = this.cfg;

    this.yaw = wrapAngle(this.yaw - finite(input.lookDX));
    this.pitch = Math.min(PITCH_LIMIT, Math.max(-PITCH_LIMIT, this.pitch - finite(input.lookDY)));

    let mx = finite(input.moveX), mz = finite(input.moveZ);
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const speed = input.run ? cfg.runSpeed : cfg.walkSpeed;
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    // vorwärts = (−sin yaw, 0, −cos yaw), rechts = (cos yaw, 0, −sin yaw)
    this.velocity[0] = (c * mx - s * mz) * speed;
    this.velocity[2] = (-s * mx - c * mz) * speed;
    if (input.jump && this.grounded) {
      this.velocity[1] = cfg.jumpSpeed;
      this.grounded = false;
    }

    const v = this.velocity;
    const travel = (Math.hypot(v[0], v[2]) + Math.abs(v[1]) + cfg.gravity * dt) * dt;
    const n = Math.min(
      MAX_SUBSTEPS,
      Math.max(1, Math.ceil(dt / SUBSTEP - 1e-9), Math.ceil(travel / (cfg.radius * 0.5))),
    );
    this.gather(travel);
    const h = dt / n;
    for (let i = 0; i < n; i++) this.substep(h);

    const b = this.world.bounds();
    const floor = Math.min(b ? b.min[1] : this.spawn[1], this.spawn[1]);
    if (this.position[1] < floor - cfg.fallRespawnDepth) this.respawn();
  }

  /** Dreiecke um die Bewegung dieses Bilds herum einsammeln. */
  private gather(travel: number): void {
    const p = this.position, cfg = this.cfg;
    const reach = travel + cfg.radius + 0.1;
    this.qMin[0] = p[0] - reach; this.qMax[0] = p[0] + reach;
    this.qMin[2] = p[2] - reach; this.qMax[2] = p[2] + reach;
    this.qMin[1] = p[1] - travel - cfg.stepHeight - 0.1;
    this.qMax[1] = p[1] + cfg.height + travel + 0.1;
    this.triCount = collectTriangles(this.world, this.qMin, this.qMax, this.tris);
  }

  private substep(h: number): void {
    const p = this.position, v = this.velocity, cfg = this.cfg;
    const step = cfg.stepHeight;
    this.prevPos.set(p);
    this.prevVel.set(v);
    const wasGrounded = this.grounded;

    if (wasGrounded && v[1] <= 0) v[1] = 0;
    else v[1] = Math.max(v[1] - cfg.gravity * h, -MAX_FALL_SPEED);
    p[0] += v[0] * h;
    p[1] += v[1] * h;
    p[2] += v[2] * h;

    // Boden: höchste begehbare Fläche unter dem Strahlenbündel, von Fußhöhe + stepHeight abwärts
    this.grounded = false;
    if (v[1] <= 0) {
      const below = wasGrounded ? step : PROBE_EPS;
      const gy = this.probeGround(step + below);
      if (gy > -Infinity) {
        p[1] = gy;
        v[1] = 0;
        this.grounded = true;
      }
    }

    // Körper: am Boden zählt jeder Kontakt als Wand, in der Luft wird normal herausgeschoben
    const body = this.body;
    body[0] = p[0]; body[1] = p[1] + step; body[2] = p[2];
    const before = body[1];
    const res = resolveCapsule(body, cfg.radius, this.bodyHeight, this.tris, this.triCount, this.grounded ? Infinity : -Infinity);
    // Beim Gehen: kein Schritt (auch keine Stufe) tiefer unter eine zu niedrige Decke und kein
    // Riesenschub – dann findet dieser Teilschritt nicht statt und die Figur bleibt stehen
    const shove = Math.hypot(body[0] - p[0], body[2] - p[2]);
    if (wasGrounded && this.grounded && (res.ceilingDepth > this.ceilingDepth + CEILING_EPS || shove > 2 * cfg.radius)) {
      p.set(this.prevPos);
      v.set(this.prevVel);
      return;
    }
    this.ceilingDepth = this.grounded ? res.ceilingDepth : 0;
    if (body[1] < before - 1e-6 && v[1] > 0) v[1] = 0;
    p[0] = body[0]; p[1] = body[1] - step; p[2] = body[2];

    if (!allFinite(p) || !allFinite(v)) {
      p.set(this.prevPos);
      v.set(allFinite(this.prevVel) ? this.prevVel : ZERO);
      this.grounded = wasGrounded;
    }
  }

  /** Höchstes y einer begehbaren Fläche, die einer der Bodenstrahlen zuerst trifft; −∞ ohne Treffer. */
  private probeGround(len: number): number {
    const p = this.position;
    const ring = this.cfg.radius * PROBE_RING;
    const top = p[1] + this.cfg.stepHeight;
    let best = -Infinity;
    for (let k = 0; k < 5; k++) {
      const o = this.rayO;
      o[0] = p[0] + (k === 1 ? ring : k === 2 ? -ring : 0);
      o[1] = top;
      o[2] = p[2] + (k === 3 ? ring : k === 4 ? -ring : 0);
      let tMin = Infinity, hitTri = -1;
      for (let t = 0; t < this.triCount; t++) {
        const i = t * 9;
        const tr = this.tris;
        // Grobtest in x/z: liegt der Strahl überhaupt über dem Dreieck?
        if (o[0] < tr[i] && o[0] < tr[i + 3] && o[0] < tr[i + 6]) continue;
        if (o[0] > tr[i] && o[0] > tr[i + 3] && o[0] > tr[i + 6]) continue;
        if (o[2] < tr[i + 2] && o[2] < tr[i + 5] && o[2] < tr[i + 8]) continue;
        if (o[2] > tr[i + 2] && o[2] > tr[i + 5] && o[2] > tr[i + 8]) continue;
        const hit = rayTriangle(o, DOWN, tri(tr, i, TA), tri(tr, i + 3, TB), tri(tr, i + 6, TC), false);
        if (hit >= 0 && hit < tMin) { tMin = hit; hitTri = i; }
      }
      if (hitTri < 0 || tMin > len) continue;
      if (this.upNy(hitTri) < this.cosMaxSlope) continue;
      const y = top - tMin;
      if (y > best) best = y;
    }
    return best;
  }

  /** |n.y| der Flächen-Normale des Dreiecks ab Index i (Seite zum Strahl hin). */
  private upNy(i: number): number {
    const tr = this.tris;
    const ux = tr[i + 3] - tr[i], uy = tr[i + 4] - tr[i + 1], uz = tr[i + 5] - tr[i + 2];
    const vx = tr[i + 6] - tr[i], vy = tr[i + 7] - tr[i + 1], vz = tr[i + 8] - tr[i + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz);
    return l > 0 ? Math.abs(ny) / l : 0;
  }
}

const ZERO = new Float32Array(3);
const TA = new Float32Array(3);
const TB = new Float32Array(3);
const TC = new Float32Array(3);

function tri(tr: number[], i: number, out: Float32Array): Float32Array {
  out[0] = tr[i]; out[1] = tr[i + 1]; out[2] = tr[i + 2];
  return out;
}

function finite(x: number | undefined): number {
  return typeof x === 'number' && Number.isFinite(x) ? x : 0;
}

function allFinite(a: Float32Array): boolean {
  return Number.isFinite(a[0]) && Number.isFinite(a[1]) && Number.isFinite(a[2]);
}

function wrapAngle(a: number): number {
  return a - 2 * Math.PI * Math.floor((a + Math.PI) / (2 * Math.PI));
}
