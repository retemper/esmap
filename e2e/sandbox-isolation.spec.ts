import { test, expect } from '@playwright/test';

test.describe('Sandbox isolation', () => {
  test('Home app sets its own sandbox variable on mount', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('#app-home')).toContainText(
      'sandbox.__HOME_APP_DATA__ = "home-active"',
    );
  });

  test('Settings app sets its own sandbox variable on mount', async ({ page }) => {
    await page.goto('/settings');

    await expect(page.locator('#app-settings')).toContainText(
      'sandbox.__SETTINGS_APP_DATA__ = "settings-active"',
    );
  });

  test('Home app does not see Settings sandbox variable on fresh load', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('#app-home')).toContainText(
      'sandbox.__SETTINGS_APP_DATA__ = "undefined (isolated)"',
    );
  });

  test('Settings app does not see Home sandbox variable on fresh load', async ({ page }) => {
    await page.goto('/settings');

    await expect(page.locator('#app-settings')).toContainText(
      'sandbox.__HOME_APP_DATA__ = "undefined (isolated)"',
    );
  });

  test('sandbox isolation check section is rendered in Home', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#app-home h4')).toContainText('Sandbox Isolation Check');
  });

  test('sandbox isolation check section is rendered in Settings', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('#app-settings h4')).toContainText('Sandbox Isolation Check');
  });

  test('cross-navigation sandbox check renders correctly', async ({ page }) => {
    // Visit home first (sets __HOME_APP_DATA__ in home's sandbox)
    await page.goto('/');
    await expect(page.locator('#app-home')).toContainText(
      'sandbox.__HOME_APP_DATA__ = "home-active"',
    );

    // Navigate to settings (sets __SETTINGS_APP_DATA__ in settings' sandbox)
    await page.locator('#app-nav a[href="/settings"]').click();
    await expect(page.locator('#app-settings h1')).toHaveText('Settings');
    await expect(page.locator('#app-settings')).toContainText(
      'sandbox.__SETTINGS_APP_DATA__ = "settings-active"',
    );
  });
});
