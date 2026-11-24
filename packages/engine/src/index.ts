export * as vec3 from './math/vec3';
export * as mat4 from './math/mat4';
export type { Vec3 } from './math/vec3';
export type { Mat4 } from './math/mat4';
export { rayTriangle, rayAabb } from './math/intersect';

export { CHUNK_SIZE, chunkKey, chunkCoords, chunkKeyForPoint } from './world/keys';
export { packBits, unpackBits, type TileData, type Layer, type TileBits } from './world/types';
export { Chunk } from './world/chunk';
export { World, type Facing } from './world/world';
export { quadNormal, quadCentroid } from './geometry/quad';
