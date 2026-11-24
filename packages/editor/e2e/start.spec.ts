import { test, expect, type Page } from '@playwright/test';
import { hooks, newProject } from './helpers';

/** Anzahl Dateien in allen Browser-Projekt-Datenbanken (fehlende oder leere zählen 0). */
const browserProjectFiles = (page: Page) =>
  page.evaluate(async () => {
    let n = 0;
    for (const info of await indexedDB.databases()) {
      if (!info.name?.startsWith('rgm-projekt-')) continue;
      n += await new Promise<number>((resolve) => {
        const q = indexedDB.open(info.name!);
        q.onupgradeneeded = () => {
          q.transaction?.abort();
          resolve(0);
        };
        q.onerror = () => resolve(0);
        q.onsuccess = () => {
          const db = q.result;
          if (!db.objectStoreNames.contains('dateien')) {
            db.close();
            resolve(0);
            return;
          }
          const c = db.transaction('dateien').objectStore('dateien').count();
          c.onsuccess = () => {
            db.close();
            resolve(c.result);
          };
          c.onerror = () => {
            db.close();
            resolve(0);
          };
        };
      });
    }
    return n;
  });

test('ein Browser-Projekt verschwindet nur nach Rückfrage – und dann ganz', async ({ page }) => {
  await page.goto('/');
  await newProject(page, 'Wegwerf');
  await hooks(page, 'exec', 'addFloor', [0, 0, 2, 2, 0]);
  expect(await hooks(page, 'flushSave')).toBe(true);
  await page.getByRole('button', { name: /^Projekt Wegwerf/ }).click();
  await page.getByRole('menuitem', { name: 'Projekt schließen' }).click();
  expect(await browserProjectFiles(page)).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Wegwerf löschen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Projekt löschen' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.getByRole('button', { name: 'Wegwerf öffnen' })).toBeVisible();

  await page.getByRole('button', { name: 'Wegwerf löschen' }).click();
  await page.getByRole('dialog', { name: 'Projekt löschen' }).getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByRole('button', { name: 'Wegwerf öffnen' })).toHaveCount(0);
  expect(await browserProjectFiles(page)).toBe(0);
});
