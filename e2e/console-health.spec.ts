import { test, expect } from '@playwright/test';

test.describe('Console health (no unexpected errors)', () => {
  test('home page loads without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/');
    await expect(page.locator('#app-home h1')).toHaveText('Home Dashboard');

    expect(errors).toStrictEqual([]);
  });

  test('settings page loads without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/settings');
    await expect(page.locator('#app-settings h1')).toHaveText('Settings');

    expect(errors).toStrictEqual([]);
  });

  test('react dashboard loads without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/react');
    await expect(page.locator('[data-testid="react-dashboard"]')).toBeVisible();

    expect(errors).toStrictEqual([]);
  });

  test('multi-route navigation produces no unexpected errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/');
    await expect(page.locator('#app-home h1')).toHaveText('Home Dashboard');

    await page.locator('#app-nav a[href="/settings"]').click();
    await expect(page.locator('#app-settings h1')).toHaveText('Settings');

    await page.locator('#app-nav a[href="/react"]').click();
    await expect(page.locator('[data-testid="react-dashboard"] h1')).toHaveText('React Dashboard');

    await page.locator('#app-nav a[href="/"]').click();
    await expect(page.locator('#app-home h1')).toHaveText('Home Dashboard');

    expect(errors).toStrictEqual([]);
  });
});
