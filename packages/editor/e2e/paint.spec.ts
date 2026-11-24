import { test, expect } from '@playwright/test';
import { newProject, importTileset, hooks } from './helpers';
test('malen, rückgängig, wiederholen in der echten Oberfläche', async ({ page }) => {
  await page.goto('/'); await newProject(page); await importTileset(page, 'kacheln-16.png');
  await page.keyboard.press('b');
  const c = (await page.locator('main canvas').boundingBox())!; // nur die 3D-Ansicht (das Tileset-Bild ist auch ein canvas)
  await page.mouse.click(c.x + c.width / 2, c.y + c.height / 2 + 120);
  expect((await hooks(page, 'state')).tiles).toBe(1);
  await page.keyboard.press('Control+z'); expect((await hooks(page, 'state')).tiles).toBe(0);
  await page.keyboard.press('Control+y'); expect((await hooks(page, 'state')).tiles).toBe(1);
});
