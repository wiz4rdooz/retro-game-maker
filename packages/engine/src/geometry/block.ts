import { cellQuad } from './plane';

export enum BlockFace {
  Top,
  Bottom,
  PosX,
  NegX,
  PosZ,
  NegZ,
}

/** Die sechs Seiten des Würfels [x, x+s] × [y, y+s] × [z, z+s], alle nach außen, Reihenfolge wie BlockFace. */
export function blockQuads(x: number, y: number, z: number, size = 1): Float32Array[] {
  const s = size;
  return [
    cellQuad({ axis: 'y', offset: y + s, facing: 1 }, x, z, s),
    cellQuad({ axis: 'y', offset: y, facing: -1 }, x, z, s),
    cellQuad({ axis: 'x', offset: x + s, facing: 1 }, z, y, s),
    cellQuad({ axis: 'x', offset: x, facing: -1 }, z, y, s),
    cellQuad({ axis: 'z', offset: z + s, facing: 1 }, x, y, s),
    cellQuad({ axis: 'z', offset: z, facing: -1 }, x, y, s),
  ];
}
