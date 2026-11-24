import { describe, it, expect } from 'vitest';
import { vec3, mat4, rayTriangle, rayAabb } from '../src';

describe('vec3', () => {
  it('cross und normalize', () => {
    const c = vec3.cross(vec3.create(), [1, 0, 0], [0, 1, 0]);
    expect(Array.from(c)).toEqual([0, 0, 1]);
    expect(Array.from(vec3.normalize(vec3.create(), [0, 0, 0]))).toEqual([0, 0, 0]);
    expect(vec3.length(vec3.normalize(vec3.create(), [3, 4, 0]))).toBeCloseTo(1, 6);
  });
});

describe('mat4', () => {
  it('lookAt + perspective bilden einen Punkt vor der Kamera in die Bildmitte ab', () => {
    const v = mat4.lookAt(mat4.create(), [0, 0, 5], [0, 0, 0], [0, 1, 0]);
    const p = mat4.perspective(mat4.create(), Math.PI / 2, 1, 0.1, 100);
    const vp = mat4.multiply(mat4.create(), p, v);
    const ndc = mat4.transformPoint(vec3.create(), vp, [0, 0, 0]);
    expect(ndc[0]).toBeCloseTo(0, 6);
    expect(ndc[1]).toBeCloseTo(0, 6);
    expect(ndc[2]).toBeGreaterThan(-1);
    expect(ndc[2]).toBeLessThan(1);
  });
  it('invert(m)·m = Einheit', () => {
    const m = mat4.lookAt(mat4.create(), [1, 2, 3], [4, 0, -2], [0, 1, 0]);
    const inv = mat4.create();
    expect(mat4.invert(inv, m)).toBe(true);
    const id = mat4.multiply(mat4.create(), inv, m);
    for (let i = 0; i < 16; i++) expect(id[i]).toBeCloseTo(i % 5 === 0 ? 1 : 0, 5);
  });
});

describe('Strahltests', () => {
  const a = [0, 0, 0], b = [1, 0, 0], c = [0, 0, -1]; // Normale +Y
  it('trifft das Dreieck von oben bei t = 2', () => {
    expect(rayTriangle([0.2, 2, -0.2], [0, -1, 0], a, b, c, true)).toBeCloseTo(2, 6);
  });
  it('cullBack ignoriert die Rückseite', () => {
    expect(rayTriangle([0.2, -2, -0.2], [0, 1, 0], a, b, c, true)).toBe(-1);
    expect(rayTriangle([0.2, -2, -0.2], [0, 1, 0], a, b, c, false)).toBeCloseTo(2, 6);
  });
  it('rayAabb', () => {
    expect(rayAabb([-5, 0.5, 0.5], [1, Infinity, Infinity], [0, 0, 0], [1, 1, 1])).toBeCloseTo(5, 6);
    expect(rayAabb([-5, 2, 0.5], [1, Infinity, Infinity], [0, 0, 0], [1, 1, 1])).toBe(-1);
  });
});
