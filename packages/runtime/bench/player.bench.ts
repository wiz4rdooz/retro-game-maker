import { test } from 'vitest';
import { World, generateTestIsland } from '@rgm/engine';
import { FpsController, findSpawn } from '../src';

const world = new World();
world.addLayer('a');
generateTestIsland(world, { layer: 1, tileset: 0, columns: 8, rows: 4 });
const input = { moveX: 0.3, moveZ: 1, run: true, jump: false, lookDX: 0.004, lookDY: 0 };

test('Spielfigur auf der Test-Insel', async ({ bench }) => {
  await bench('600 Controller-Schritte (10 s bei 60 Bildern/s)', () => {
    const p = new FpsController(world, findSpawn(world, [250, 40, 250]), 0);
    for (let i = 0; i < 600; i++) p.update(1 / 60, { ...input, jump: i % 90 === 0 });
  }).run({ iterations: 5, time: 0 });
});
