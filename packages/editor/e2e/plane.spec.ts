import { test, expect, type Page } from '@playwright/test';
import { hooks, newProject } from './helpers';

const parts = (page: Page) => {
  const knopf = page.getByRole('navigation', { name: 'Werkzeuge' }).getByRole('button', { name: /Zeichenebene/ });
  const menu = page.getByRole('menu', { name: 'Zeichenebene' });
  return { knopf, menu };
};

test('Zeichenebene als Knopf links: Menü wählt Wand X, Höher hebt sie, Q schaltet weiter', async ({ page }) => {
  await page.goto('/');
  await newProject(page);
  const { knopf, menu } = parts(page);
  await expect(knopf).toContainText('Auto');
  await expect(knopf).toHaveAttribute('aria-keyshortcuts', 'Q');
  // die Ebenen-Wahl rechts im Pinsel-Bereich gibt es nicht mehr
  await expect(page.getByRole('group', { name: 'Zeichenebene' })).toHaveCount(0);

  await knopf.click();
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitemradio', { name: 'Auto' })).toHaveAttribute('aria-checked', 'true');
  await menu.getByRole('menuitemradio', { name: 'Wand X' }).click();
  await expect(menu).toBeHidden();
  await expect(knopf).toContainText('Wand X');
  expect((await hooks(page, 'state')).drawPlane).toBe('x');

  await knopf.click();
  await expect(menu.getByRole('menuitemradio', { name: 'Wand X' })).toHaveAttribute('aria-checked', 'true');
  await menu.getByRole('menuitem', { name: /Höher/ }).click();
  expect((await hooks(page, 'state')).planeLabel).toBe('Wand X = 1');
  await expect(menu).toContainText('Wand X = 1');
  await menu.getByRole('menuitem', { name: /Tiefer/ }).click();
  await menu.getByRole('menuitem', { name: /Tiefer/ }).click();
  expect((await hooks(page, 'state')).planeLabel).toBe('Wand X = -1');

  // Pfeiltasten wählen, Esc schließt und gibt den Fokus an den Knopf zurück
  await page.keyboard.press('ArrowDown');
  await expect(menu.locator(':focus')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(knopf).toBeFocused();

  await page.keyboard.press('q');
  await expect(knopf).toContainText('Wand Z');
  expect((await hooks(page, 'state')).drawPlane).toBe('z');
});

test('Menü offen: Klick in die Ansicht schließt ohne zu malen, Werkzeug-Taste ruht, F5 startet das Spiel (Review Focus 5)', async ({ page }) => {
  await page.goto('/');
  await newProject(page);
  const { knopf, menu } = parts(page);

  await knopf.click();
  await expect(menu).toBeVisible();
  await page.locator('main canvas').click({ position: { x: 400, y: 300 } });
  await expect(menu).toBeHidden();
  expect((await hooks(page, 'state')).tiles).toBe(0);

  await knopf.click();
  await expect(menu).toBeVisible();
  await page.keyboard.press('k');
  expect((await hooks(page, 'state')).tool).toBe('paint');
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('k');
  expect((await hooks(page, 'state')).tool).toBe('block');

  await knopf.click();
  await expect(menu).toBeVisible();
  await page.keyboard.press('F5');
  await expect(menu).toBeHidden();
  await expect.poll(async () => (await hooks(page, 'state')).mode).toBe('play');
});

test('kleines Fenster: das Menü passt ganz hinein, „Tiefer“ ist erreichbar (Review)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 620 });
  await page.goto('/');
  await newProject(page);
  const { knopf, menu } = parts(page);
  await knopf.click();
  const tiefer = menu.getByRole('menuitem', { name: /Tiefer/ });
  const box = (await tiefer.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(620);
  await tiefer.click();
  expect((await hooks(page, 'state')).planeLabel).toBe('Boden y = -1');
});
