import { test, expect } from '@playwright/test';

test.describe('SPA routing', () => {
  test('navigates to Settings via nav link', async ({ page }) => {
    await page.goto('/');

    await page.locator('#app-nav a[href="/settings"]').click();
    await expect(page).toHaveURL('/settings');
    await expect(page.locator('#app-settings h1')).toHaveText('Settings');
  });

  test('navigates to React dashboard via nav link', async ({ page }) => {
    await page.goto('/');

    await page.locator('#app-nav a[href="/react"]').click();
    await expect(page).toHaveURL('/react');
    await expect(page.locator('[data-testid="react-dashboard"] h1')).toHaveText('React Dashboard');
  });

  test('navigates back to Home from Settings', async ({ page }) => {
    await page.goto('/');

    await page.locator('#app-nav a[href="/settings"]').click();
    await expect(page.locator('#app-settings h1')).toHaveText('Settings');

    await page.locator('#app-nav a[href="/"]').click();
    await expect(page).toHaveURL('/');
    await expect(page.locator('#app-home h1')).toHaveText('Home Dashboard');
  });

  test('browser back/forward navigation works', async ({ page }) => {
    await page.goto('/');

    // Home → Settings → React
    await page.locator('#app-nav a[href="/settings"]').click();
    await expect(page.locator('#app-settings h1')).toHaveText('Settings');

    await page.locator('#app-nav a[href="/react"]').click();
    await expect(page.locator('[data-testid="react-dashboard"] h1')).toHaveText('React Dashboard');

    // Back to Settings
    await page.goBack();
    await expect(page).toHaveURL('/settings');
    await expect(page.locator('#app-settings h1')).toHaveText('Settings');

    // Back to Home
    await page.goBack();
    await expect(page).toHaveURL('/');
    await expect(page.locator('#app-home h1')).toHaveText('Home Dashboard');

    // Forward to Settings
    await page.goForward();
    await expect(page).toHaveURL('/settings');
    await expect(page.locator('#app-settings h1')).toHaveText('Settings');
  });

  test('full page navigation mounts each route correctly', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#app-home h1')).toHaveText('Home Dashboard');

    await page.goto('/settings');
    await expect(page.locator('#app-settings h1')).toHaveText('Settings');

    await page.goto('/react');
    await expect(page.locator('[data-testid="react-dashboard"] h1')).toHaveText('React Dashboard');

    await page.goto('/');
    await expect(page.locator('#app-home h1')).toHaveText('Home Dashboard');
  });

  test('history.pushState triggers the esmap router', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(() => history.pushState(null, '', '/settings'));
    await expect(page.locator('#app-settings h1')).toHaveText('Settings');
  });

  test('direct URL navigation mounts the correct app', async ({ page }) => {
    await page.goto('/settings');

    await expect(page.locator('#app-settings h1')).toHaveText('Settings');
    await expect(page.locator('#app-nav nav')).toBeVisible();
  });

  test('status log records lifecycle transitions on route change', async ({ page }) => {
    await page.goto('/');

    const statusLog = page.locator('#status-log');

    await page.locator('#app-nav a[href="/settings"]').click();
    await expect(page.locator('#app-settings h1')).toHaveText('Settings');

    await expect(statusLog).toContainText('app-settings: NOT_LOADED → LOADING');
    await expect(statusLog).toContainText('app-settings: NOT_MOUNTED → MOUNTED');
    await expect(statusLog).toContainText('Route transition complete: /settings');
  });

  test('route guard is invoked on navigation', async ({ page }) => {
    await page.goto('/');

    await page.locator('#app-nav a[href="/settings"]').click();
    await expect(page.locator('#app-settings h1')).toHaveText('Settings');

    await expect(page.locator('#status-log')).toContainText('Route guard: / → /settings');
  });

  test('keepAlive freezes the previous app instead of unmounting', async ({ page }) => {
    await page.goto('/');

    await page.locator('#app-nav a[href="/settings"]').click();
    await expect(page.locator('#app-settings h1')).toHaveText('Settings');

    // Home should be FROZEN, not fully unmounted
    await expect(page.locator('#status-log')).toContainText('app-home: MOUNTED → FROZEN');
  });

  test('frozen app container is hidden via display:none', async ({ page }) => {
    await page.goto('/');

    await page.locator('#app-nav a[href="/settings"]').click();
    await expect(page.locator('#app-settings h1')).toHaveText('Settings');

    // Home container should be hidden (frozen with keepAlive)
    const homeDisplay = await page.locator('#app-home').evaluate((el) => el.style.display);
    expect(homeDisplay).toBe('none');
  });

  test('thawed app container becomes visible again', async ({ page }) => {
    await page.goto('/');

    // Go to settings (freeze home)
    await page.locator('#app-nav a[href="/settings"]').click();
    await expect(page.locator('#app-settings h1')).toHaveText('Settings');

    // Go back to home (thaw home)
    await page.locator('#app-nav a[href="/"]').click();
    await expect(page.locator('#app-home h1')).toHaveText('Home Dashboard');

    // Home container should be visible again
    const homeDisplay = await page.locator('#app-home').evaluate((el) => el.style.display);
    expect(homeDisplay).toBe('');
  });

  test('rapid sequential navigation resolves to the final destination', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(() => {
      history.pushState(null, '', '/settings');
      history.pushState(null, '', '/react');
    });

    await expect(page).toHaveURL('/react');
    await expect(page.locator('[data-testid="react-dashboard"] h1')).toHaveText('React Dashboard');
  });
});
