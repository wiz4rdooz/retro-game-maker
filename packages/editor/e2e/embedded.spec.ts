import { test, expect } from '@playwright/test';

// Die Testversion läuft eingebettet in einer Sandbox (ohne allow-forms, ohne Ordner-Zugriff).
test('läuft eingebettet in einer Sandbox: Projekt anlegen und malen', async ({ page }) => {
  await page.setContent(
    '<iframe id="f" sandbox="allow-scripts allow-same-origin allow-pointer-lock" src="http://localhost:4173/" style="border:0;width:1400px;height:860px"></iframe>',
  );
  const f = page.frameLocator('#f');
  await f.getByRole('button', { name: 'Neues Projekt' }).click();
  await expect(f.getByRole('radio', { name: 'In einem Ordner auf dem PC' })).toHaveCount(0);
  await expect(f.getByRole('button', { name: 'Ordner öffnen…' })).toHaveCount(0);
  await f.getByLabel('Name').fill('Eingebettet');
  await f.getByLabel('Name').press('Enter');
  await expect(f.getByRole('navigation', { name: 'Werkbänke' })).toBeVisible();
  const box = (await f.locator('main canvas').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2 + 120);
  await expect.poll(async () => page.frames()[1].evaluate(() => (window as any).__rgm.state().tiles)).toBe(1);
});
