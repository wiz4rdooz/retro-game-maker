import { test, expect } from '@playwright/test';
import { hooks, newProject } from './helpers';

test('Tab schließen mit Ungespeichertem fragt nach', async ({ page }) => {
  await page.goto('/');
  await newProject(page, 'Abschied');
  // Chrome fragt nur nach, wenn auf der Seite schon geklickt wurde
  await page.getByRole('button', { name: 'Welt' }).click();
  await hooks(page, 'exec', 'addFloor', [0, 0, 2, 2, 0]);
  const dialogType = new Promise<string>((resolve) =>
    page.once('dialog', (d) => {
      resolve(d.type());
      void d.dismiss();
    }),
  );
  await page.close({ runBeforeUnload: true });
  const none = new Promise<string>((resolve) => setTimeout(() => resolve('keine Rückfrage'), 3000));
  expect(await Promise.race([dialogType, none])).toBe('beforeunload');
});

test('Wechsel in den Hintergrund speichert sofort', async ({ page }) => {
  await page.goto('/');
  await newProject(page, 'Hintergrund');
  await hooks(page, 'exec', 'addFloor', [0, 0, 2, 2, 0]);
  expect((await hooks(page, 'state')).saveStatus).toBe('ungespeichert');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  // ohne die Ruhezeit von 3 s abzuwarten
  await expect.poll(async () => (await hooks(page, 'state')).saveStatus, { timeout: 1500 }).toBe('gespeichert');
});

test('eine Datei neben dem Tileset-Bereich abgelegt öffnet sie nicht (Seite bleibt)', async ({ page }) => {
  await page.goto('/');
  const prevented = await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array([137, 80, 78, 71])], 'stein.png', { type: 'image/png' }));
    const over = new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true });
    const drop = new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true });
    document.body.dispatchEvent(over);
    document.body.dispatchEvent(drop);
    return [over.defaultPrevented, drop.defaultPrevented];
  });
  expect(prevented).toEqual([true, true]);
});
