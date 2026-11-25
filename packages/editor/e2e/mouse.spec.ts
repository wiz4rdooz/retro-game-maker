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

test('rechte Taste halten + W fliegt sofort, auch wenn das erste Bild vor dem Tastendruck begann', async ({ page }) => {
  await page.goto('/');
  await newProject(page);
  await hooks(page, 'setCamera', 0, 2, 5, 0, 0);
  const box = (await page.locator('main canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down({ button: 'right' });
  // Bildzeit liegt vor der Zeit des Tastendrucks (wie bei voller Hauptschleife): das erste Bild hat dt = 0
  await page.evaluate(() => {
    const now = performance.now.bind(performance);
    performance.now = () => now() + 40;
  });
  await page.keyboard.down('w');
  await page.waitForTimeout(600);
  await page.keyboard.up('w');
  await page.mouse.up({ button: 'right' });
  expect((await hooks(page, 'state')).camera.z).toBeLessThan(5 - 1);
});
