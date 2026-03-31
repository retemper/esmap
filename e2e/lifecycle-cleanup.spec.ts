import { test, expect } from '@playwright/test';

test.describe('Lifecycle cleanup and unmount hooks', () => {
  test('keepAlive freeze replaces unmount for configured apps', async ({ page }) => {
    await page.goto('/');

    const statusLog = page.locator('#status-log');
    await expect(page.locator('#app-home h1')).toHaveText('Home Dashboard');

    // Navigate to settings — home is in keepAlive so it freezes instead of unmounting
    await page.locator('#app-nav a[href="/settings"]').click();
    await expect(page.locator('#app-settings h1')).toHaveText('Settings');

    await expect(statusLog).toContainText('app-home: MOUNTED → FROZEN');
  });

  test('nav app remains mounted across all route changes', async ({ page }) => {
    await page.goto('/');

    // Navigate through all routes — nav should always be visible
    const nav = page.locator('#app-nav nav');

    await expect(nav).toBeVisible();
    await page.locator('#app-nav a[href="/settings"]').click();
    await expect(nav).toBeVisible();

    await page.locator('#app-nav a[href="/react"]').click();
    await expect(nav).toBeVisible();

    await page.locator('#app-nav a[href="/"]').click();
    await expect(nav).toBeVisible();

    // Nav should never have FROZEN status (it's always active)
    const logText = await page.locator('#status-log').textContent();
    expect(logText).not.toContain('app-nav: MOUNTED → FROZEN');
  });

  test('app-nav is excluded from sandbox (no sandbox proxy created)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#app-nav nav')).toBeVisible();

    // app-nav is configured with exclude: ['app-nav'] in sandboxPlugin
    // So it should NOT have a sandbox proxy
    const hasSandbox = await page.evaluate(() => {
      const sandboxes = window.__ESMAP_SANDBOXES__;
      return sandboxes?.has('app-nav') ?? false;
    });

    expect(hasSandbox).toBe(false);
  });

  test('unmount cleanup fires when navigating from broken app', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#app-home h1')).toHaveText('Home Dashboard');

    // Navigate to broken route
    await page.evaluate(() => history.pushState(null, '', '/broken'));

    // Wait for broken app lifecycle to start
    await expect(page.locator('#status-log')).toContainText('app-broken');

    // Navigate back to home
    await page.locator('#app-nav a[href="/"]').click();
    await expect(page.locator('#app-home h1')).toHaveText('Home Dashboard');

    // Framework recovered successfully
    await expect(page.locator('#status-log')).toContainText('Route transition complete: /');
  });
});
