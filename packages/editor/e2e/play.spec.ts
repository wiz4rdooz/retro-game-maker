import { test, expect } from '@playwright/test';
import { newProject, hooks } from './helpers';
test('F5 startet Play, W läuft, Wand stoppt, Esc kehrt an dieselbe Stelle zurück', async ({ page }) => {
  await page.goto('/'); await newProject(page);
  await page.evaluate(() => { const r = (window as any).__rgm; r.exec('addFloor', [-5, -10, 10, 15, 0]); r.exec('addWall', [-5, -6, 10, 3]); r.setCamera(0.5, 1.7, 0.5, 0, 0); });
  const camBefore = (await hooks(page, 'state')).camera;
  await page.keyboard.press('F5'); await expect.poll(async () => (await hooks(page, 'state')).mode).toBe('play');
  await page.keyboard.down('w'); await page.waitForTimeout(2500); await page.keyboard.up('w');
  const p = await hooks(page, 'player'); expect(p.z).toBeLessThan(-4); expect(p.z).toBeGreaterThan(-6 + 0.28);
  await page.keyboard.press('Escape'); await expect.poll(async () => (await hooks(page, 'state')).mode).toBe('edit');
  expect((await hooks(page, 'state')).camera).toEqual(camBefore);
});
