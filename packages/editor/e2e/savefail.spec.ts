import { test, expect, type Page } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import { readFile } from 'node:fs/promises';
import { hooks, newProject } from './helpers';

const projectMenu = (page: Page) => page.getByRole('button', { name: /^Projekt Fehlschlag/ });

test('Speichern scheitert: Meldung, Schließen fragt nach, ZIP enthält den Stand im Arbeitsspeicher (Review Focus 3)', async ({ page }) => {
  await page.goto('/');
  await newProject(page, 'Fehlschlag');
  // ab jetzt scheitert jeder Schreibversuch in IndexedDB (Speicher voll)
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = function () {
      throw new DOMException('Speicher voll', 'QuotaExceededError');
    };
  });
  await hooks(page, 'exec', 'addFloor', [0, 0, 4, 4, 0]);
  await page.keyboard.press('Control+s');
  await expect(page.getByRole('alert')).toContainText('Nicht gespeichert');

  // Schließen fragt nach; Abbrechen bleibt im Editor
  await projectMenu(page).click();
  await page.getByRole('menuitem', { name: 'Projekt schließen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nicht gespeichert' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.getByRole('navigation', { name: 'Werkbänke' })).toBeVisible();

  // Der ZIP-Export kommt aus dem Arbeitsspeicher: alle 16 Kacheln sind drin
  await projectMenu(page).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: 'Als ZIP exportieren' }).click(),
  ]);
  const zip = unzipSync(new Uint8Array(await readFile((await download.path())!)));
  const tiles = Object.keys(zip)
    .filter((p) => p.includes('/chunks/'))
    .reduce((n, p) => n + (JSON.parse(strFromU8(zip[p])) as { tiles: unknown[] }).tiles.length, 0);
  expect(tiles).toBe(16);

  // Ohne Speichern schließen führt zum Startbildschirm
  await projectMenu(page).click();
  await page.getByRole('menuitem', { name: 'Projekt schließen' }).click();
  await page.getByRole('dialog', { name: 'Nicht gespeichert' }).getByRole('button', { name: 'Ohne Speichern schließen' }).click();
  await expect(page.getByRole('button', { name: 'Neues Projekt' })).toBeVisible();
});
