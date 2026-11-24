import { describe, it, expect } from 'vitest';
import { stampCells } from '../src/tools/brush';
const b = { tileset: 0, tx: 4, ty: 1, w: 2, h: 1, rot: 0 as const, flipX: false, flipY: false, size: 1 as const, doubleSided: false, ghost: false, topTile: null };
const floor = { axis: 'y' as const, offset: 0, facing: 1 as const };
const wall = { axis: 'z' as const, offset: 0, facing: 1 as const };
describe('stampCells', () => {
  it('2×1-Pinsel auf dem Boden', () => expect(stampCells(b, floor)).toEqual([{ du: 0, dv: 0, tx: 4, ty: 1 }, { du: 1, dv: 0, tx: 5, ty: 1 }]));
  it('gedreht (rot 1) liegt er quer', () => expect(stampCells({ ...b, rot: 1 }, floor)).toEqual([{ du: 0, dv: 0, tx: 4, ty: 1 }, { du: 0, dv: 1, tx: 5, ty: 1 }]));
  it('1×2-Pinsel an der Wand: obere Zeile oben', () => expect(stampCells({ ...b, w: 1, h: 2 }, wall)).toEqual([{ du: 0, dv: 1, tx: 4, ty: 1 }, { du: 0, dv: 0, tx: 4, ty: 2 }]));
  it('Größe 2 wiederholt das Muster', () => expect(stampCells({ ...b, w: 1, size: 2 }, floor).length).toBe(4));
});
