import { test, expect } from '@playwright/test';
import { hooks, newProject } from './helpers';

test('grünen Pfeil nach oben ziehen hebt die Auswahl im Raster, Strg+Z stellt her', async ({ page }) => {
  await page.goto('/');
  await newProject(page);
  await hooks(page, 'exec', 'addFloor', [0, 0, 1, 1, 0]);
  await hooks(page, 'setCamera', 3.5, 3, 6.5, Math.atan2(3, 6), -0.4);
  await page.keyboard.press('a');
  await page.keyboard.press('Control+a');
  await expect(page.getByRole('note')).toContainText('Pfeile');

  const g = await hooks(page, 'gizmo');
  expect(g.axes[1].visible).toBe(true);
  const box = (await page.locator('main canvas').boundingBox())!;
  const mx = box.x + (g.centerPx[0] + g.axes[1].tipPx[0]) / 2;
  const my = box.y + (g.centerPx[1] + g.axes[1].tipPx[1]) / 2;
  await page.mouse.move(mx, my);
  await page.mouse.down();
  await page.mouse.move(mx, my - 120, { steps: 8 });
  await page.mouse.up();

  const ys = (await hooks(page, 'tileCorners')).map((c: number[]) => c[1]);
  expect(ys[0]).toBeGreaterThanOrEqual(1);
  expect(Number.isInteger(ys[0])).toBe(true);
  await page.keyboard.press('Control+z');
  expect((await hooks(page, 'tileCorners')).map((c: number[]) => c[1])[0]).toBe(0);
});

test('Quadrat in Augenhöhe über den Horizont ziehen: die Kachel springt nicht hinter die Kamera (Review)', async ({ page }) => {
  await page.goto('/');
  await newProject(page);
  await hooks(page, 'exec', 'addFloor', [0, 0, 1, 1, 0]);
  await hooks(page, 'setCamera', 0.5, 1.6, 6, 0, -0.15);
  await page.keyboard.press('a');
  await page.keyboard.press('Control+a');
  const g = await hooks(page, 'gizmo');
  expect(g.planes[1].visible).toBe(true);
  const c = g.planes[1].cornersPx as number[];
  const box = (await page.locator('main canvas').boundingBox())!;
  const sx = box.x + (c[0] + c[2] + c[4] + c[6]) / 4;
  const sy = box.y + (c[1] + c[3] + c[5] + c[7]) / 4;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx, box.y + 4, { steps: 12 });
  await page.mouse.up();
  const zs = (await hooks(page, 'tileCorners'))[0].filter((_: number, i: number) => i % 3 === 2);
  expect(zs.every(Number.isFinite)).toBe(true);
  expect(Math.max(...zs)).toBeLessThan(6);
});
