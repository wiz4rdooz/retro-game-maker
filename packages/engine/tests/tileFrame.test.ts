import { describe, it, expect } from 'vitest';
import { cellQuad, tileLocalUVs, type DrawPlane } from '../src';

const boden: DrawPlane = { axis: 'y', offset: 0, facing: 1 };
const uvs = (c: ArrayLike<number>, rot: 0 | 1 | 2 | 3 = 0, fx = false, fy = false) =>
  Array.from(tileLocalUVs(c, 0, rot, fx, fy, new Float32Array(8)));
const near = (a: number[], b: number[], eps = 1e-3) => {
  expect(a.length).toBe(b.length);
  a.forEach((x, i) => expect(Math.abs(x - b[i])).toBeLessThan(eps));
};
const us = (v: number[]) => v.filter((_, i) => i % 2 === 0);
const vs = (v: number[]) => v.filter((_, i) => i % 2 === 1);

describe('tileLocalUVs (Texturen dehnen sich nie)', () => {
  it('1×1-Boden rot 0 = BASE', () => {
    near(uvs(cellQuad(boden, 0, 0)), [0, 1, 1, 1, 1, 0, 0, 0]);
  });

  it('2 m breite Kachel wiederholt statt zu dehnen', () => {
    const c = cellQuad(boden, 0, 0);
    const d = [c[3] - c[0], c[4] - c[1], c[5] - c[2]]; // Richtung c0 → c1
    for (const k of [1, 2]) for (let j = 0; j < 3; j++) c[k * 3 + j] += d[j];
    near(us(uvs(c)), [0, 2, 2, 0]);
    near(vs(uvs(c)), [1, 1, 0, 0]);
  });

  it('Rampe läuft den Hang entlang', () => {
    const c = cellQuad(boden, 0, 0);
    c[7] += 1; // c2.y
    c[10] += 1; // c3.y
    near(us(uvs(c)), [0, 1, 1, 0]);
    near(vs(uvs(c)), [1, 1, 1 - Math.SQRT2, 1 - Math.SQRT2]);
  });

  it('Drehen/Spiegeln wie K3', () => {
    const c = cellQuad(boden, 0, 0);
    const base = [[0, 1], [1, 1], [1, 0], [0, 0]];
    const map: Record<number, (u: number, v: number) => [number, number]> = {
      1: (u, v) => [v, 1 - u],
      2: (u, v) => [1 - u, 1 - v],
      3: (u, v) => [1 - v, u],
    };
    for (const rot of [1, 2, 3] as const) near(uvs(c, rot), base.flatMap(([u, v]) => map[rot](u, v)));
    near(uvs(c, 1, true, false), base.flatMap(([u, v]) => { const [a, b] = map[1](u, v); return [1 - a, b]; }));
    near(uvs(c, 0, false, true), base.flatMap(([u, v]) => [u, 1 - v]));
  });

  it('zusammengefallene Ecken und NaN → endlich (Review Focus 1)', () => {
    const tri = cellQuad(boden, 0, 0);
    tri[9] = tri[6]; tri[10] = tri[7]; tri[11] = tri[8]; // c3 = c2
    const flat = new Float32Array(12).fill(2); // Fläche 0, alle Ecken gleich
    const nan = cellQuad(boden, 0, 0);
    nan[4] = Number.NaN;
    for (const c of [tri, flat, nan]) expect(uvs(c).every(Number.isFinite)).toBe(true);
  });

  it('Werte liegen um 1/10.000 innen', () => {
    for (const x of uvs(cellQuad(boden, 3, -2))) {
      expect(x).not.toBe(0);
      expect(x).not.toBe(1);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(1);
    }
  });
});
