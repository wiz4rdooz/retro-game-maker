import { test, expect } from '@playwright/test';
import { newProject, hooks } from './helpers';
// exact: true, weil Playwright Namen sonst als Teilstring vergleicht („Ruine“ träfe auch „Ruine ausblenden“)
test('Ebenen: anlegen, umbenennen, aktiv, ausblenden, sperren, löschen mit undo', async ({ page }) => {
  await page.goto('/'); await newProject(page);
  const panel = page.getByRole('region', { name: 'Ebenen' });
  await panel.getByRole('button', { name: 'Ebene hinzufügen' }).click();
  await panel.getByRole('button', { name: 'Ebene 2', exact: true }).dblclick();
  await page.keyboard.type('Ruine'); await page.keyboard.press('Enter');   // tippt „k“-freien Text, Werkzeug bleibt
  await expect(panel.getByRole('button', { name: 'Ruine', exact: true })).toHaveAttribute('aria-current', 'true');
  await page.evaluate(() => (window as any).__rgm.exec('addFloor', [0, 0, 2, 2, 0]));
  expect((await hooks(page, 'state')).layers.find((l: any) => l.name === 'Ruine')).toBeTruthy();
  await panel.getByRole('button', { name: 'Ruine ausblenden' }).click();
  expect((await hooks(page, 'renderStats')).triangles).toBe(0);
  await panel.getByRole('button', { name: 'Ruine löschen' }).click();
  await page.getByRole('button', { name: 'Löschen', exact: true }).click();
  expect((await hooks(page, 'state')).tiles).toBe(0);
  await page.keyboard.press('Control+z'); expect((await hooks(page, 'state')).tiles).toBe(4);
});
test('beim Umbenennen schalten Buchstaben kein Werkzeug um (Review Focus 1)', async ({ page }) => {
  await page.goto('/'); await newProject(page);
  const panel = page.getByRole('region', { name: 'Ebenen' });
  await panel.getByRole('button', { name: 'Ebene 1', exact: true }).dblclick(); await page.keyboard.type('kabige'); await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /Kachel malen/ })).toHaveAttribute('aria-pressed', 'true');
});
