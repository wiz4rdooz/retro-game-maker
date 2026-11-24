import { test, expect, type Page } from '@playwright/test';
import { hooks } from './helpers';

/** Der Ordner-Dialog liefert immer denselben Ordner (im privaten Dateisystem des Browsers). */
async function stubFolderPicker(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker = async () =>
      (await navigator.storage.getDirectory()).getDirectoryHandle('mein-ordner', { create: true });
  });
}

async function newFolderProject(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Neues Projekt' }).click();
  await page.getByLabel('Name').fill(name);
  await page.getByRole('radio', { name: 'In einem Ordner auf dem PC' }).check();
  await page.getByRole('button', { name: 'Anlegen' }).click();
}

/**
 * Headless-Chrome beendet sich beim Zurücklesen eines OPFS-Ordners aus IndexedDB (echte Ordner aus dem
 * Dialog sind davon nicht betroffen). Darum wird „Zuletzt geöffnet“ geleert, bevor der Startbildschirm es liest.
 */
const forgetRecent = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const q = indexedDB.open('rgm-register');
        q.onerror = () => reject(q.error);
        q.onsuccess = () => {
          const tx = q.result.transaction('projekte', 'readwrite');
          tx.objectStore('projekte').clear();
          tx.oncomplete = () => {
            q.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );

const savedName = (page: Page) =>
  page.evaluate(async () => {
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('mein-ordner');
    return JSON.parse(await (await (await dir.getFileHandle('projekt.json')).getFile()).text()).name as string;
  });

test('„Neues Projekt“ in einem Ordner mit Projekt überschreibt es nicht', async ({ page }) => {
  await stubFolderPicker(page);
  await page.goto('/');
  await newFolderProject(page, 'Erstes');
  await expect(page.getByRole('navigation', { name: 'Werkbänke' })).toBeVisible();
  await hooks(page, 'exec', 'addFloor', [0, 0, 3, 3, 0]);
  expect(await hooks(page, 'flushSave')).toBe(true);
  await forgetRecent(page);
  await page.getByRole('button', { name: /^Projekt Erstes/ }).click();
  await page.getByRole('menuitem', { name: 'Projekt schließen' }).click();
  await expect(page.getByRole('button', { name: 'Neues Projekt' })).toBeVisible();

  await newFolderProject(page, 'Zweites');
  await expect(page.getByRole('alert')).toContainText('In diesem Ordner liegt schon ein Projekt');
  await expect(page.getByRole('navigation', { name: 'Werkbänke' })).toHaveCount(0);
  expect(await savedName(page)).toBe('Erstes');

  // das vorhandene Projekt lässt sich weiter öffnen, mit allen Kacheln
  await page.getByRole('button', { name: 'Ordner öffnen…' }).click();
  await expect.poll(async () => (await hooks(page, 'state')).tiles).toBe(9);
});
