import { test, expect } from '@playwright/test';

test.describe('Performance monitoring', () => {
  test('performance summary is logged after boot', async ({ page }) => {
    await page.goto('/');

    const statusLog = page.locator('#status-log');

    // boot.ts logs performance summary 500ms after boot via setTimeout
    await expect(async () => {
      const logText = await statusLog.textContent();
      expect(logText).toMatch(/app-\w+:\s+\d+ms/);
    }).toPass({ timeout: 3000 });
  });

  test('performance data is collected for both nav and home apps', async ({ page }) => {
    await page.goto('/');

    const statusLog = page.locator('#status-log');

    await expect(async () => {
      const logText = await statusLog.textContent();
      expect(logText).toMatch(/app-nav:\s+\d+ms/);
      expect(logText).toMatch(/app-home:\s+\d+ms/);
    }).toPass({ timeout: 3000 });
  });

  test('lifecycle hooks fire before and after mount', async ({ page }) => {
    await page.goto('/');

    const statusLog = page.locator('#status-log');

    // The beforeEach('mount') hook in boot.ts logs "preparing to mount"
    // and sets globalState.currentApp, which logs "Current app: ..."
    await expect(statusLog).toContainText('app-home preparing to mount');
    await expect(statusLog).toContainText('Current app: app-home');
  });

  test('lifecycle hooks fire for apps mounted via navigation', async ({ page }) => {
    await page.goto('/');

    await page.locator('#app-nav a[href="/settings"]').click();
    await expect(page.locator('#app-settings h1')).toHaveText('Settings');

    const statusLog = page.locator('#status-log');
    await expect(statusLog).toContainText('app-settings preparing to mount');
    await expect(statusLog).toContainText('Current app: app-settings');
  });
});
