export * as vec3 from './math/vec3';
export * as mat4 from './math/mat4';
export type { Vec3 } from './math/vec3';
export type { Mat4 } from './math/mat4';
export { rayTriangle, rayAabb } from './math/intersect';

export { CHUNK_SIZE, chunkKey, chunkCoords, chunkKeyForPoint } from './world/keys';
export { packBits, unpackBits, type TileData, type Layer, type TileBits } from './world/types';
export { Chunk } from './world/chunk';
export { World, type Facing } from './world/world';
export { coveredTiles } from './world/coveredTiles';
export { quadNormal, quadCentroid, quadArea, quadIsFinite, quadIsDegenerate } from './geometry/quad';
export { cellQuad, worldToPlane, planeToWorld, planeOfQuad, axisIndex, type DrawPlane, type PlaneAxis } from './geometry/plane';
export { tileUVs, type TilesetInfo } from './geometry/uv';
export { tileLocalUVs } from './geometry/tileFrame';
export { BlockFace, blockQuads } from './geometry/block';
export { buildChunkMesh, faceShade, type ChunkMeshPart } from './mesh/chunkMesher';
export { overlapRanks, MAX_RANK } from './mesh/overlapRanks';
export { raycastWorld, rayPlane, type RayHit } from './pick/raycast';
export { Camera, type ViewKind } from './render/camera';
export { extractFrustum, aabbInFrustum, selectVisibleChunks, type ChunkBounds } from './render/frustum';
export { createGl } from './render/gl';
export { TileRenderer, CHECKER_TILESET, DEPTH_STEP_NDC, type RenderStats, type FogOptions } from './render/tileRenderer';
export { LineRenderer } from './render/lineRenderer';
export { closestPointOnTriangle, closestSegmentSegment, closestSegmentTriangle } from './collision/closest';
export { collectTriangles } from './collision/triangles';
export { resolveCapsule, type CapsuleResult } from './collision/capsule';
export {
  FORMAT_VERSION,
  FormatError,
  encodeWorldMeta,
  decodeWorldMeta,
  encodeChunk,
  decodeChunkInto,
  chunkFileName,
  type FormatMessages,
  type WorldMeta,
} from './world/serialize';
export { floodCoplanar } from './geometry/adjacency';
export {
  translateTiles,
  rotateTiles90,
  scaleTiles,
  moveVertices,
  mergeVertices,
  selectionPivot,
  type TileChange,
} from './geometry/transform';
export { extrudeTiles } from './geometry/extrude';
export { generateTestIsland, mulberry32, type TestIslandOptions } from './world/testIsland';
