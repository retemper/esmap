import { test, expect } from '@playwright/test';

test.describe('Error boundary', () => {
  test('깨진 앱 라우트를 셸 크래시 없이 정상 처리한다', async ({ page }) => {
    await page.goto('/broken');

    // The framework should not crash — nav should still work
    await expect(page.locator('#app-nav nav')).toBeVisible();

    // Status log should mention app-broken lifecycle
    const statusLog = page.locator('#status-log');
    await expect(statusLog).toContainText('app-broken');
  });

  test('can recover from broken route by navigating to a valid route', async ({ page }) => {
    await page.goto('/broken');

    await expect(page.locator('#app-nav nav')).toBeVisible();

    // Navigate to a working page
    await page.locator('#app-nav a[href="/"]').click();
    await expect(page).toHaveURL('/');
    await expect(page.locator('#app-home h1')).toHaveText('Home Dashboard');
  });

  test('unmatched route does not crash the framework', async ({ page }) => {
    await page.goto('/nonexistent-route');

    // app-nav should still be mounted (activeWhen: () => true)
    await expect(page.locator('#app-nav nav')).toBeVisible();
    await expect(page.locator('#status-log')).toContainText('Router started');
  });

  test('can navigate to valid route after unmatched route', async ({ page }) => {
    await page.goto('/nonexistent-route');

    await page.locator('#app-nav a[href="/settings"]').click();
    await expect(page).toHaveURL('/settings');
    await expect(page.locator('#app-settings h1')).toHaveText('Settings');
  });
});
