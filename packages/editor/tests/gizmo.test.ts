import { describe, it, expect } from 'vitest';
import { Camera, mat4, vec3 } from '@rgm/engine';
import { axisDragDelta, gizmoLayout, hitGizmo, planeDragDelta, ringDragAngle } from '../src/tools/gizmo';

const W = 800, H = 600;

function lookFrom(from: [number, number, number], to: [number, number, number] = [0, 0, 0]): Camera {
  const cam = new Camera();
  cam.position.set(from);
  const d = vec3.normalize(vec3.create(), vec3.create(to[0] - from[0], to[1] - from[1], to[2] - from[2]));
  cam.yaw = Math.atan2(-d[0], -d[2]);
  cam.pitch = Math.asin(d[1]);
  return cam;
}

function projector(cam: Camera) {
  const vp = mat4.create();
  const tmp = vec3.create();
  return (p: ArrayLike<number>, out: Float32Array): boolean => {
    cam.viewProj(vp, W / H);
    mat4.transformPoint(tmp, vp, p);
    if (![tmp[0], tmp[1]].every(Number.isFinite)) return false;
    out[0] = ((tmp[0] + 1) / 2) * W;
    out[1] = ((1 - tmp[1]) / 2) * H;
    return true;
  };
}

const ray = (cam: Camera, to: [number, number, number]) => {
  const o = vec3.create(cam.position[0], cam.position[1], cam.position[2]);
  const d = vec3.normalize(vec3.create(), vec3.create(to[0] - o[0], to[1] - o[1], to[2] - o[2]));
  return [o, d] as const;
};

describe('Gizmo-Rechnung', () => {
  const cam = lookFrom([3, 3, 6]);
  const layout = gizmoLayout([0, 0, 0], cam, H, projector(cam), true)!;

  it('Pfeil-Spitzen liegen ≈ 90 px vom Drehpunkt', () => {
    for (const a of layout.axes) {
      expect(a.visible).toBe(true);
      // projiziert kürzer als 90 px, wenn der Pfeil schräg zur Kamera steht; nie länger
      expect(Math.hypot(a.tipPx[0] - layout.centerPx[0], a.tipPx[1] - layout.centerPx[1])).toBeLessThanOrEqual(90.5);
    }
    const y = layout.axes[1];
    expect(Math.hypot(y.tipPx[0] - layout.centerPx[0], y.tipPx[1] - layout.centerPx[1])).toBeGreaterThan(70);
  });

  it('Treffer an der Y-Spitze, 40 px daneben nichts', () => {
    const [x, y] = layout.axes[1].tipPx;
    expect(hitGizmo(layout, x, y + 2)).toEqual({ kind: 'axis', axis: 1 });
    expect(hitGizmo(layout, x + 40, y - 40)).toBeNull();
  });

  it('Pfeil ziehen: 1,3 m entlang +Y, eingerastet bzw. frei', () => {
    const [o0, d0] = ray(cam, [0, 0, 0]);
    const [o1, d1] = ray(cam, [0, 1.3, 0]);
    expect(axisDragDelta([0, 0, 0], 1, o0, d0, o1, d1, 1)).toBeCloseTo(1, 6);
    expect(axisDragDelta([0, 0, 0], 1, o0, d0, o1, d1, 0.25)).toBeCloseTo(1.25, 6);
    expect(axisDragDelta([0, 0, 0], 1, o0, d0, o1, d1, null)).toBeCloseTo(1.3, 4);
  });

  it('Quadrat mit Normalachse Y verschiebt nur x und z', () => {
    const [o0, d0] = ray(cam, [0, 0, 0]);
    const [o1, d1] = ray(cam, [1.2, 0, -0.7]);
    const free = planeDragDelta([0, 0, 0], 1, o0, d0, o1, d1, null);
    expect(free[0]).toBeCloseTo(1.2, 4);
    expect(free[1]).toBe(0);
    expect(free[2]).toBeCloseTo(-0.7, 4);
    expect(planeDragDelta([0, 0, 0], 1, o0, d0, o1, d1, 0.5)).toEqual([1, 0, -0.5]);
  });

  it('Ring ziehen: Viertelkreis = π/2, 20° rasten auf 15°', () => {
    const [o0, d0] = ray(cam, [1, 0, 0]);
    const [o1, d1] = ray(cam, [0, 0, -1]);
    expect(ringDragAngle([0, 0, 0], 1, o0, d0, o1, d1, null)).toBeCloseTo(Math.PI / 2, 4);
    const a = (20 * Math.PI) / 180;
    const [o2, d2] = ray(cam, [Math.cos(a), 0, -Math.sin(a)]);
    expect(ringDragAngle([0, 0, 0], 1, o0, d0, o2, d2, (15 * Math.PI) / 180)).toBeCloseTo((15 * Math.PI) / 180, 6);
  });

  it('Draufsicht: Y-Pfeil und X/Z-Ringe ausgeblendet, Y-Ring sichtbar', () => {
    const top = new Camera();
    top.view = 'top';
    top.position.set([0, 50, 0]);
    const l = gizmoLayout([0, 0, 0], top, H, projector(top), true)!;
    expect(l.axes.map((a) => a.visible)).toEqual([true, false, true]);
    expect(l.rings.map((r) => r.visible)).toEqual([false, true, false]);
    expect(l.planes.map((p) => p.visible)).toEqual([false, true, false]);
  });

  it('Grenzlagen ohne NaN (Review Focus 2)', () => {
    const onX = lookFrom([10, 0, 0]);
    const l = gizmoLayout([0, 0, 0], onX, H, projector(onX), true)!;
    expect(l.axes[0].visible).toBe(false);
    for (const a of l.axes) expect([...a.tipPx, ...a.tip].every(Number.isFinite)).toBe(true);
    const behind = lookFrom([0, 0, 5], [0, 0, 10]);
    expect(gizmoLayout([0, 0, 0], behind, H, projector(behind), true)).toBeNull();
    expect(gizmoLayout([Number.NaN, 0, 0], cam, H, projector(cam), true)).toBeNull();
    const along = vec3.create(0, 1, 0);
    expect(axisDragDelta([0, 0, 0], 1, [0, 5, 0], along, [0, 6, 0], along, null)).toBe(0);
    expect(planeDragDelta([0, 0, 0], 1, [0, 5, 0], [1, 0, 0], [0, 5, 0], [1, 0, 0], null)).toEqual([0, 0, 0]);
    expect(ringDragAngle([0, 0, 0], 1, [0, 5, 0], [1, 0, 0], [0, 5, 0], [0, 0, 1], null)).toBe(0);
  });
});
