import { expect, type Page } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

/** Legt über den Dialog „Neues Projekt“ ein Projekt im Browser an und wartet auf den Editor. */
export async function newProject(page: Page, name = 'E2E'): Promise<void> {
  await page.getByRole('button', { name: 'Neues Projekt' }).click();
  await page.getByLabel('Name').fill(name);
  await page.getByRole('radio', { name: 'Im Browser' }).check();
  await page.getByRole('button', { name: 'Anlegen' }).click();
  await expect(page.getByRole('navigation', { name: 'Werkbänke' })).toBeVisible();
}

/** Ruft window.__rgm[name](...args) auf und gibt das Ergebnis zurück. */
export async function hooks<T = unknown>(page: Page, name: string, ...args: unknown[]): Promise<T> {
  return page.evaluate(
    ([n, a]) => (window as unknown as { __rgm: Record<string, (...x: unknown[]) => unknown> }).__rgm[n](...a),
    [name, args] as [string, unknown[]],
  ) as Promise<T>;
}

/** Lädt e2e/fixtures/<file> über das Datei-Feld im Bereich „Tileset“. */
export async function importTileset(page: Page, file: string): Promise<void> {
  await page.getByRole('region', { name: 'Tileset' }).locator('input[type="file"]').setInputFiles(join(fixtures, file));
}
