import { describe, it, expect } from 'vitest';
import { Camera, extractFrustum, aabbInFrustum, selectVisibleChunks, mat4, vec3 } from '../src';

const r = (a: ArrayLike<number>) => Array.from(a).map((v) => +v.toFixed(4) + 0);

describe('Camera', () => {
  it('yaw 0 blickt nach −Z, yaw 90° nach −X, pitch ist begrenzt', () => {
    const c = new Camera(); expect(r(c.forward(vec3.create()))).toEqual([0, 0, -1]);
    c.yaw = Math.PI / 2; expect(r(c.forward(vec3.create()))).toEqual([-1, 0, 0]);
    c.pitch = 3; expect(c.pitch).toBeCloseTo((89 * Math.PI) / 180, 6);
  });
  it('Strahl durch die Bildmitte = Blickrichtung; top-Ansicht blickt nach unten', () => {
    const c = new Camera(); c.yaw = 0.3; c.pitch = -0.4;
    const o = vec3.create(), d = vec3.create(); c.screenRay(0, 0, 1.6, o, d);
    expect(r(d)).toEqual(r(c.forward(vec3.create())));
    c.view = 'top'; c.screenRay(0.5, 0.5, 1.6, o, d); expect(r(d)).toEqual([0, -1, 0]);
  });
  it('Strahl am rechten Bildrand zeigt nach rechts', () => {
    const c = new Camera(); const o = vec3.create(), d = vec3.create();
    c.screenRay(1, 0, 1, o, d);
    expect(d[0]).toBeGreaterThan(0.3); expect(d[2]).toBeLessThan(0);
  });
});

describe('Sichtfeld', () => {
  const c = new Camera(); c.position.set([0, 2, 10]);
  const planes = extractFrustum(c.viewProj(mat4.create(), 1.6), new Float32Array(24));
  it('Box vor der Kamera sichtbar, hinter ihr nicht', () => {
    expect(aabbInFrustum(planes, [-1, 0, -1], [1, 1, 1])).toBe(true);
    expect(aabbInFrustum(planes, [-1, 0, 20], [1, 1, 22])).toBe(false);
  });
  it('selectVisibleChunks beachtet die Sichtweite', () => {
    const chunks = [{ key: 1, min: [-16, 0, -16], max: [16, 32, 16] }, { key: 2, min: [-16, 0, -400], max: [16, 32, -368] }];
    expect(selectVisibleChunks(chunks, planes, c.position, 160)).toEqual([1]);
  });
});
