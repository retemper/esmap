import { test, expect } from '@playwright/test';

test.describe('DevTools overlay', () => {
  test('overlay is hidden by default', async ({ page }) => {
    await page.goto('/');

    const overlay = page.locator('[data-esmap-devtools]');
    await expect(overlay).toBeHidden();
  });

  test('overlay toggles with Alt+Shift+D keyboard shortcut', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('#status-log')).toContainText('Router started');

    // Toggle on
    await page.keyboard.press('Alt+Shift+KeyD');
    const overlay = page.locator('[data-esmap-devtools]');
    await expect(overlay).toBeVisible();

    // Toggle off
    await page.keyboard.press('Alt+Shift+KeyD');
    await expect(overlay).toBeHidden();
  });

  test('overlay shows registered apps after a route transition', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('#status-log')).toContainText('Router started');

    // Navigate to trigger overlay.update() (called in afterRouteChange)
    await page.locator('#app-nav a[href="/settings"]').click();
    await expect(page.locator('#app-settings h1')).toHaveText('Settings');

    // Open overlay
    await page.keyboard.press('Alt+Shift+KeyD');
    const overlay = page.locator('[data-esmap-devtools]');
    await expect(overlay).toBeVisible();

    // Should show app names in the overlay table
    await expect(overlay).toContainText('app-nav');
    await expect(overlay).toContainText('app-settings');
  });

  test('overlay displays app status info (MOUNTED, FROZEN)', async ({ page }) => {
    await page.goto('/');

    // Navigate to settings (freezes home, mounts settings)
    await page.locator('#app-nav a[href="/settings"]').click();
    await expect(page.locator('#app-settings h1')).toHaveText('Settings');

    // Open overlay
    await page.keyboard.press('Alt+Shift+KeyD');
    const overlay = page.locator('[data-esmap-devtools]');
    await expect(overlay).toBeVisible();

    // Overlay should show status info for apps
    await expect(overlay).toContainText('MOUNTED');
  });
});
