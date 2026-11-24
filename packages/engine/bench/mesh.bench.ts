import { test } from 'vitest';
import { World, buildChunkMesh, cellQuad, chunkKeyForPoint, type TileData } from '../src';

const tile = (corners: Float32Array): TileData => ({
  layer: 1, tileset: 0, tx: 0, ty: 0, rot: 0, flipX: false, flipY: false, doubleSided: false, ghost: false, corners,
});

const world = new World();
world.addLayer('a');
for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) world.addTile(tile(cellQuad({ axis: 'y', offset: 0, facing: 1 }, x, z)));
let walls = 0;
for (let z = 1; z < 32 && walls < 3000; z += 2) {
  for (let x = 0; x < 32 && walls < 3000; x++) {
    for (let y = 0; y < 6 && walls < 3000; y++) {
      world.addTile(tile(cellQuad({ axis: 'z', offset: z, facing: 1 }, x, y)));
      walls++;
    }
  }
}
const chunk = world.chunks.get(chunkKeyForPoint(16, 1, 16))!;
const tilesets = new Map([[0, { id: 0, tileSize: 16, imageWidth: 128, imageHeight: 64 }]]);

test('Mesher', async ({ bench }) => {
  await bench(`Chunk mit ${chunk.count} Kacheln meshen`, () => {
    buildChunkMesh(chunk, tilesets, () => true);
  }).run();
});
