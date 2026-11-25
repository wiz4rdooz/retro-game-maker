import { test, expect } from '@playwright/test';
import { newProject } from './helpers';

test('Startbildschirm → neues Projekt → Editor im Aufbau von B', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Neues Projekt' })).toBeVisible();
  await newProject(page, 'Insel-Test');
  await expect(page.getByRole('navigation', { name: 'Werkbänke' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Welt' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: 'Regeln' })).toBeDisabled();
  // sechs Werkzeuge und darunter der Knopf „Zeichenebene“
  const rail = page.getByRole('navigation', { name: 'Werkzeuge' });
  await expect(rail.locator('button[aria-pressed]')).toHaveCount(6);
  await expect(rail.getByRole('button')).toHaveCount(7);
  await expect(rail.getByRole('button', { name: /Zeichenebene/ })).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
});
test('Werkzeug-Tasten schalten um, das Hinweis-Kärtchen folgt', async ({ page }) => {
  await page.goto('/'); await newProject(page);
  await page.keyboard.press('k');
  await expect(page.getByRole('button', { name: /Block setzen/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('note')).toContainText('Klick setzt einen Block');
});
test('Tasten lösen beim Tippen nicht aus, F5/Strg+S/Strg+R laden nicht neu (Review Focus 1)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Neues Projekt' }).click();
  await page.getByLabel('Name').fill(''); await page.getByLabel('Name').click(); await page.keyboard.type('kabine');
  await page.getByRole('button', { name: 'Anlegen' }).click();
  await expect(page.getByRole('button', { name: /Kachel malen/ })).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => ((window as any).__marker = 42));
  await page.keyboard.press('F5'); await page.keyboard.press('Escape');
  await page.keyboard.press('Control+s'); await page.keyboard.press('Control+r');
  expect(await page.evaluate(() => (window as any).__marker)).toBe(42);
});
test('speichern, neu laden, aus „Zuletzt geöffnet“ wieder öffnen', async ({ page }) => {
  await page.goto('/'); await newProject(page, 'Wiederkehr');
  await page.evaluate(() => (window as any).__rgm.exec('addFloor', [0, 0, 3, 2, 0]));
  expect(await page.evaluate(() => (window as any).__rgm.flushSave())).toBe(true);
  await page.reload();
  await page.getByRole('button', { name: 'Wiederkehr öffnen' }).click();
  await expect.poll(async () => (await page.evaluate(() => (window as any).__rgm.state())).tiles).toBe(6);
});
test('die Ansicht rendert eine Kachel (Pixeltest)', async ({ page }) => {
  await page.goto('/'); await newProject(page);
  await page.evaluate(() => (window as any).__rgm.exec('addFloor', [-1, -1, 3, 3, 0]));
  await page.evaluate(() => (window as any).__rgm.setCamera(0.5, 5, 0.5, 0, -Math.PI / 2 + 0.01));
  const box = (await page.locator('canvas').boundingBox())!;
  const px = await page.evaluate(([x, y]) => (window as any).__rgm.pixelAt(x, y), [box.width / 2, box.height / 2]);
  expect(px.slice(0, 3)).not.toEqual([0x16, 0x18, 0x1b]);
});
test('nach einem Häkchen im Pinsel-Bereich wirken die Werkzeug-Tasten weiter', async ({ page }) => {
  await page.goto('/'); await newProject(page);
  await page.getByRole('checkbox', { name: 'Beidseitig' }).check();
  await expect(page.getByRole('checkbox', { name: 'Beidseitig' })).toBeFocused();
  await page.keyboard.press('k');
  await expect(page.getByRole('button', { name: /Block setzen/ })).toHaveAttribute('aria-pressed', 'true');
});
