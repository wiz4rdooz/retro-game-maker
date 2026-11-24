import * as mat4 from '../math/mat4';
import * as vec3 from '../math/vec3';
import type { Vec3 } from '../math/vec3';
import type { Mat4 } from '../math/mat4';

export type ViewKind = 'perspective' | 'top' | 'front' | 'side';

const MAX_PITCH = (89 * Math.PI) / 180;
const ORTHO_DEPTH = 1000;

/** Kamera nach K7: yaw 0 blickt nach −Z; Ortho-Ansichten top (−Y), front (−Z), side (−X). */
export class Camera {
  position: Vec3 = vec3.create();
  yaw = 0;
  fovY = (70 * Math.PI) / 180;
  near = 0.05;
  far = 1000;
  view: ViewKind = 'perspective';
  /** Halbe sichtbare Höhe in Metern für Ortho-Ansichten. */
  orthoScale = 20;
  private _pitch = 0;

  get pitch(): number {
    return this._pitch;
  }

  set pitch(v: number) {
    this._pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, v));
  }

  forward(out: Vec3): Vec3 {
    switch (this.view) {
      case 'top':
        return vec3.set(out, 0, -1, 0);
      case 'front':
        return vec3.set(out, 0, 0, -1);
      case 'side':
        return vec3.set(out, -1, 0, 0);
      default: {
        const cp = Math.cos(this._pitch);
        return vec3.set(out, -Math.sin(this.yaw) * cp, Math.sin(this._pitch), -Math.cos(this.yaw) * cp);
      }
    }
  }

  right(out: Vec3): Vec3 {
    switch (this.view) {
      case 'top':
      case 'front':
        return vec3.set(out, 1, 0, 0);
      case 'side':
        return vec3.set(out, 0, 0, -1);
      default:
        return vec3.set(out, Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    }
  }

  up(out: Vec3): Vec3 {
    if (this.view === 'top') return vec3.set(out, 0, 0, -1);
    if (this.view !== 'perspective') return vec3.set(out, 0, 1, 0);
    const f = this.forward(vec3.create());
    const r = this.right(vec3.create());
    return vec3.cross(out, r, f);
  }

  viewMatrix(out: Mat4): Mat4 {
    const f = this.forward(vec3.create());
    const target = vec3.add(vec3.create(), this.position, f);
    return mat4.lookAt(out, this.position, target, this.up(vec3.create()));
  }

  projMatrix(out: Mat4, aspect: number): Mat4 {
    if (this.view === 'perspective') return mat4.perspective(out, this.fovY, aspect, this.near, this.far);
    const h = this.orthoScale;
    const w = h * aspect;
    return mat4.ortho(out, -w, w, -h, h, -ORTHO_DEPTH, ORTHO_DEPTH);
  }

  viewProj(out: Mat4, aspect: number): Mat4 {
    const v = this.viewMatrix(mat4.create());
    const p = this.projMatrix(mat4.create(), aspect);
    return mat4.multiply(out, p, v);
  }

  /** Strahl durch den Bildpunkt (NDC −1 … 1, Werte außerhalb erlaubt). */
  screenRay(ndcX: number, ndcY: number, aspect: number, outOrigin: Vec3, outDir: Vec3): void {
    const f = this.forward(vec3.create());
    const r = this.right(vec3.create());
    const u = this.up(vec3.create());
    if (this.view === 'perspective') {
      const th = Math.tan(this.fovY / 2);
      vec3.copy(outOrigin, this.position);
      vec3.scaleAndAdd(outDir, f, r, ndcX * th * aspect);
      vec3.scaleAndAdd(outDir, outDir, u, ndcY * th);
      vec3.normalize(outDir, outDir);
    } else {
      const h = this.orthoScale;
      vec3.scaleAndAdd(outOrigin, this.position, r, ndcX * h * aspect);
      vec3.scaleAndAdd(outOrigin, outOrigin, u, ndcY * h);
      vec3.scaleAndAdd(outOrigin, outOrigin, f, -ORTHO_DEPTH);
      vec3.copy(outDir, f);
    }
  }
}
