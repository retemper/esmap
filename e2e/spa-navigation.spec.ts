import { test, expect } from '@playwright/test';

test.describe('SPA navigation (data-link + history API)', () => {
  test('nav links use data-link attribute for SPA navigation', async ({ page }) => {
    await page.goto('/');

    // All nav anchors should have data-link attribute (prevents full page reload)
    const links = page.locator('#app-nav a[data-link]');
    await expect(links).toHaveCount(3);
  });

  test('clicking data-link does not trigger full page reload', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#app-home h1')).toHaveText('Home Dashboard');

    // Inject a marker into the page to detect full reload
    await page.evaluate(() => {
      (window as unknown as Record<string, boolean>).__SPA_MARKER__ = true;
    });

    // Click a data-link nav item
    await page.locator('#app-nav a[href="/settings"]').click();
    await expect(page.locator('#app-settings h1')).toHaveText('Settings');

    // Marker should still exist (no full page reload)
    const markerExists = await page.evaluate(
      () => (window as unknown as Record<string, boolean>).__SPA_MARKER__ === true,
    );
    expect(markerExists).toBe(true);
  });

  test('history.replaceState triggers the esmap router', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#app-home h1')).toHaveText('Home Dashboard');

    await page.evaluate(() => history.replaceState(null, '', '/settings'));
    await expect(page.locator('#app-settings h1')).toHaveText('Settings');

    // replaceState should not add to history stack — back should not go to "/"
    // (it goes to whatever was before the initial page.goto)
    await expect(page).toHaveURL('/settings');
  });

  test('popstate event triggers router on back/forward', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#app-home h1')).toHaveText('Home Dashboard');

    // Push two states
    await page.evaluate(() => history.pushState(null, '', '/settings'));
    await expect(page.locator('#app-settings h1')).toHaveText('Settings');

    await page.evaluate(() => history.pushState(null, '', '/react'));
    await expect(page.locator('[data-testid="react-dashboard"] h1')).toHaveText('React Dashboard');

    // Trigger popstate via back()
    await page.goBack();
    await expect(page).toHaveURL('/settings');
    await expect(page.locator('#app-settings h1')).toHaveText('Settings');
  });

  test('afterRouteChange callback fires for each navigation', async ({ page }) => {
    await page.goto('/');

    const statusLog = page.locator('#status-log');
    await expect(statusLog).toContainText('Route transition complete: /');

    await page.locator('#app-nav a[href="/settings"]').click();
    await expect(statusLog).toContainText('Route transition complete: /settings');

    await page.locator('#app-nav a[href="/react"]').click();
    await expect(statusLog).toContainText('Route transition complete: /react');
  });
});
