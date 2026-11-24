import { test, expect } from '@playwright/test';
import { hooks } from './helpers';
test('Test-Insel: Aufbau, Zeichenaufrufe und Dreiecke im Budget', async ({ page }) => {
  await page.goto('/');
  const t0 = Date.now(); await page.getByRole('button', { name: 'Test-Insel (Leistungstest)' }).click();
  await expect.poll(async () => (await hooks(page, 'state')).mode, { timeout: 30_000 }).toBe('edit');
  await expect.poll(async () => (await hooks(page, 'renderStats')).visibleChunks, { timeout: 30_000 }).toBeGreaterThan(0);
  const ms = Date.now() - t0; console.log(`Insel bereit nach ${ms} ms`);
  expect(ms).toBeLessThan(10_000); // Regressionsschutz in CI; Spec-Ziel (< 5 s) prüft Task 19 auf echter Hardware
  await page.evaluate(() => (window as any).__rgm.setCamera(250, 12, 250, 0.7, -0.2));
  const s = await hooks(page, 'renderStats'); console.log(JSON.stringify(s));
  expect(s.drawCalls).toBeLessThanOrEqual(200); expect(s.triangles).toBeLessThanOrEqual(200_000);
});
