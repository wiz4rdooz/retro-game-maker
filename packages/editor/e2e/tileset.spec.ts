import { test, expect } from '@playwright/test';
import { newProject, importTileset, hooks } from './helpers';
test('Tileset importieren und Rechteck als Pinsel wählen', async ({ page }) => {
  await page.goto('/'); await newProject(page);
  await importTileset(page, 'kacheln-16.png');
  const panel = page.getByRole('region', { name: 'Tileset' });
  await expect(panel.getByRole('img', { name: /kacheln-16/ })).toBeVisible();
  const img = panel.getByRole('img', { name: /kacheln-16/ }); const b = (await img.boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.1, b.y + b.height * 0.25); await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.4, b.y + b.height * 0.25); await page.mouse.up();
  expect((await hooks(page, 'state')).brush).toMatchObject({ tx: 0, ty: 0, w: 2, h: 1 });
});
test('kein Bild und zu großes Bild melden sich verständlich (Review Focus 2)', async ({ page }) => {
  await page.goto('/'); await newProject(page);
  await importTileset(page, 'kein-bild.png');
  await expect(page.getByRole('alert')).toContainText('Das ist kein Bild');
  await importTileset(page, 'zu-gross-20000x16.png');
  await expect(page.getByRole('alert')).toContainText('zu groß');
});
test('Tileset-Import rückgängig: der Pinsel malt danach nicht mit dem entfernten Tileset weiter', async ({ page }) => {
  await page.goto('/'); await newProject(page);
  await importTileset(page, 'kacheln-16.png');
  await expect.poll(async () => (await hooks(page, 'state')).brush.tileset).toBe(0);
  await page.getByRole('button', { name: 'Welt' }).click();
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await hooks(page, 'state')).brush.tileset).toBe(-1);
});
