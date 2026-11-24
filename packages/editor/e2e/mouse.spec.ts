import { test, expect } from '@playwright/test';
import { hooks, newProject } from './helpers';

test('Rechtsklick in der Ansicht nimmt die Kachel auf, Rechts-Ziehen sieht sich nur um', async ({ page }) => {
  await page.goto('/');
  await newProject(page);
  await hooks(page, 'exec', 'addFloor', [-1, -1, 3, 3, 0]); // Drehung 0
  await hooks(page, 'setCamera', 0.5, 5, 0.5, 0, -Math.PI / 2 + 0.01);
  await page.keyboard.press('r');
  expect((await hooks(page, 'state')).brush.rot).toBe(1);

  const box = (await page.locator('main canvas').boundingBox())!;
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.click(cx, cy, { button: 'right' });
  expect((await hooks(page, 'state')).brush.rot).toBe(0);

  await page.keyboard.press('r');
  await page.mouse.move(cx, cy);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(cx + 60, cy, { steps: 6 });
  await page.mouse.up({ button: 'right' });
  expect((await hooks(page, 'state')).brush.rot).toBe(1);
});
