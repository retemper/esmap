import { test, expect } from '@playwright/test';

test.describe('Settings app form controls', () => {
  test('renders Dark Mode checkbox (unchecked by default)', async ({ page }) => {
    await page.goto('/settings');

    const checkbox = page
      .locator('#app-settings label', { hasText: 'Dark Mode' })
      .locator('input[type="checkbox"]');
    await expect(checkbox).toBeVisible();
    await expect(checkbox).not.toBeChecked();
  });

  test('renders Enable Notifications checkbox (checked by default)', async ({ page }) => {
    await page.goto('/settings');

    const checkbox = page
      .locator('#app-settings label', { hasText: 'Enable Notifications' })
      .locator('input[type="checkbox"]');
    await expect(checkbox).toBeVisible();
    await expect(checkbox).toBeChecked();
  });

  test('renders Language dropdown with Korean/English/Japanese options', async ({ page }) => {
    await page.goto('/settings');

    const select = page.locator('#app-settings select');
    await expect(select).toBeVisible();

    const options = select.locator('option');
    await expect(options).toHaveCount(3);
    await expect(options.nth(0)).toHaveText('Korean');
    await expect(options.nth(1)).toHaveText('English');
    await expect(options.nth(2)).toHaveText('日本語');
  });

  test('Dark Mode checkbox can be toggled', async ({ page }) => {
    await page.goto('/settings');

    const checkbox = page
      .locator('#app-settings label', { hasText: 'Dark Mode' })
      .locator('input[type="checkbox"]');
    await checkbox.check();
    await expect(checkbox).toBeChecked();

    await checkbox.uncheck();
    await expect(checkbox).not.toBeChecked();
  });

  test('Language dropdown can be changed', async ({ page }) => {
    await page.goto('/settings');

    const select = page.locator('#app-settings select');
    await select.selectOption('English');
    await expect(select).toHaveValue('English');
  });

  test('settings form preserves state with keepAlive freeze/thaw', async ({ page }) => {
    await page.goto('/settings');

    // Toggle dark mode on
    const darkMode = page
      .locator('#app-settings label', { hasText: 'Dark Mode' })
      .locator('input[type="checkbox"]');
    await darkMode.check();
    await expect(darkMode).toBeChecked();

    // Change language
    const select = page.locator('#app-settings select');
    await select.selectOption('English');

    // Navigate away (freezes settings via keepAlive)
    await page.locator('#app-nav a[href="/"]').click();
    await expect(page.locator('#app-home h1')).toHaveText('Home Dashboard');

    // Navigate back (thaws settings)
    await page.locator('#app-nav a[href="/settings"]').click();
    await expect(page.locator('#app-settings h1')).toHaveText('Settings');

    // State should be preserved (DOM was kept alive, not re-rendered)
    await expect(darkMode).toBeChecked();
    await expect(select).toHaveValue('English');
  });
});
