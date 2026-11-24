import { describe, it, expect } from 'vitest';
import { cellQuad, quadNormal, worldToPlane, planeToWorld, planeOfQuad, tileUVs, blockQuads, quadIsDegenerate, vec3, type DrawPlane } from '../src';

const n = (c: Float32Array) => Array.from(quadNormal(c, vec3.create())).map((v) => Math.round(v) + 0);
const combos: [DrawPlane, number[]][] = [
  [{ axis: 'y', offset: 1, facing: 1 }, [0, 1, 0]], [{ axis: 'y', offset: 1, facing: -1 }, [0, -1, 0]],
  [{ axis: 'x', offset: 1, facing: 1 }, [1, 0, 0]], [{ axis: 'x', offset: 1, facing: -1 }, [-1, 0, 0]],
  [{ axis: 'z', offset: 1, facing: 1 }, [0, 0, 1]], [{ axis: 'z', offset: 1, facing: -1 }, [0, 0, -1]],
];

describe('cellQuad', () => {
  it.each(combos)('Normale %o', (plane, normal) => expect(n(cellQuad(plane, 2, 3))).toEqual(normal));
  it('Boden-Zelle (2,3) auf Höhe 1', () => {
    expect(Array.from(cellQuad({ axis: 'y', offset: 1, facing: 1 }, 2, 3))).toEqual([2, 1, 4, 3, 1, 4, 3, 1, 3, 2, 1, 3]);
  });
  it('worldToPlane ist die Umkehrung von planeToWorld', () => {
    const p: DrawPlane = { axis: 'x', offset: 4, facing: -1 };
    expect(worldToPlane(p, planeToWorld(p, 2.5, 7))).toEqual([2.5, 7]);
    expect(planeOfQuad(cellQuad(p, 0, 0))).toEqual(p);
  });
});

describe('tileUVs (Tileset 64×32, Kachel 16 px, Kachel (1,1))', () => {
  const ts = { id: 0, tileSize: 16, imageWidth: 64, imageHeight: 32 };
  const L = (16 + 0.01) / 64, R = (32 - 0.01) / 64, T = (16 + 0.01) / 32, B = (32 - 0.01) / 32;
  const uv = (rot: 0 | 1 | 2 | 3, fx = false, fy = false) => Array.from(tileUVs(1, 1, rot, fx, fy, ts, new Float32Array(8)));
  it('rot 0', () => uv(0).forEach((v, i) => expect(v).toBeCloseTo([L, B, R, B, R, T, L, T][i], 6)));
  it('rot 1 (90° im Uhrzeigersinn)', () => uv(1).forEach((v, i) => expect(v).toBeCloseTo([R, B, R, T, L, T, L, B][i], 6)));
  it('flipX', () => uv(0, true).forEach((v, i) => expect(v).toBeCloseTo([R, B, L, B, L, T, R, T][i], 6)));
});

describe('Blöcke und Sonderfälle', () => {
  it('alle sechs Seiten zeigen nach außen', () => {
    const q = blockQuads(0, 0, 0);
    expect(q.map(n)).toEqual([[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]);
  });
  it('zusammengefallene Ecken und NaN gelten als entartet', () => {
    expect(quadIsDegenerate(new Float32Array([0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0]))).toBe(true);
    expect(quadIsDegenerate(new Float32Array([NaN, 0, 0, 1, 0, 0, 1, 0, -1, 0, 0, -1]))).toBe(true);
  });
  it('ein Dreieck (zwei gleiche Ecken) ist nicht entartet', () => {
    expect(quadIsDegenerate(new Float32Array([0, 0, 1, 1, 0, 1, 0.5, 0, 0, 0.5, 0, 0]))).toBe(false);
  });
});
