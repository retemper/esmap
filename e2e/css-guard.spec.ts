import { test, expect } from '@playwright/test';

test.describe('CSS Guard (style isolation)', () => {
  test('mounted app container has data-esmap-scope attribute', async ({ page }) => {
    await page.goto('/');

    // Guard plugin applies CSS scope after mount via lifecycle hooks (async)
    await expect(page.locator('#app-home')).toHaveAttribute('data-esmap-scope');
  });

  test('nav container gets CSS scope attribute', async ({ page }) => {
    await page.goto('/');

    // app-nav is excluded from sandbox, but guard plugin applies CSS scope to all mounted apps
    await expect(page.locator('#app-nav')).toHaveAttribute('data-esmap-scope');
  });

  test('CSS scope attribute is applied to settings after navigation', async ({ page }) => {
    await page.goto('/');

    await page.locator('#app-nav a[href="/settings"]').click();
    await expect(page.locator('#app-settings h1')).toHaveText('Settings');

    await expect(page.locator('#app-settings')).toHaveAttribute('data-esmap-scope');
  });

  test('CSS scope attribute is applied to React dashboard', async ({ page }) => {
    await page.goto('/react');

    await expect(page.locator('[data-testid="react-dashboard"]')).toBeVisible();
    await expect(page.locator('#app-react-dashboard')).toHaveAttribute('data-esmap-scope');
  });
});
