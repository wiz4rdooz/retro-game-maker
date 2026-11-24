import { test } from 'vitest';
import { World, buildChunkMesh, generateTestIsland, raycastWorld, type TilesetInfo } from '../src';

const OPTS = { layer: 1, tileset: 0, columns: 8, rows: 4 };
const tilesets = new Map<number, TilesetInfo>([[0, { id: 0, tileSize: 16, imageWidth: 128, imageHeight: 64 }]]);

const island = (): World => {
  const w = new World();
  w.addLayer('a');
  generateTestIsland(w, OPTS);
  return w;
};
const world = island();

test('Welt (Test-Insel)', async ({ bench }) => {
  await bench(`Test-Insel erzeugen (${world.tileCount()} Kacheln)`, () => {
    island();
  }).run({ iterations: 3, time: 0 });

  await bench(`alle ${world.chunks.size} Chunks meshen`, () => {
    for (const chunk of world.chunks.values()) buildChunkMesh(chunk, tilesets, () => true);
  }).run({ iterations: 5, time: 0 });

  // 1.000 Strahlen von oben über die Insel verteilt
  const origins: [number, number, number][] = [];
  for (let i = 0; i < 1000; i++) origins.push([(i * 37) % 500 + 0.5, 40, (i * 91) % 500 + 0.5]);
  const down = [0, -1, 0];
  await bench('1.000 Raycasts senkrecht nach unten', () => {
    for (const o of origins) raycastWorld(world, o, down, 100, () => true);
  }).run({ iterations: 10, time: 0 });
});
