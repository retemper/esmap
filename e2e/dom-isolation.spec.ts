import { test, expect } from '@playwright/test';

test.describe('DOM isolation', () => {
  test('app container has isolated DOM context after mount', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#app-home h1')).toHaveText('Home Dashboard');

    // DOM isolation patches document.querySelector inside app context.
    // Verify that each app renders into its own container without cross-contamination.
    const homeHtml = await page.locator('#app-home').innerHTML();
    const navHtml = await page.locator('#app-nav').innerHTML();

    // Home content should not appear in nav container and vice versa
    expect(navHtml).not.toContain('Home Dashboard');
    expect(homeHtml).not.toContain('Esmap MFE Demo');
  });

  test('each app renders in its own dedicated container', async ({ page }) => {
    await page.goto('/');

    // All containers exist as separate DOM elements
    const containers = [
      '#app-nav',
      '#app-home',
      '#app-settings',
      '#app-react-dashboard',
      '#app-broken',
    ];
    for (const selector of containers) {
      const count = await page.locator(selector).count();
      expect(count).toBe(1);
    }
  });

  test('settings app content is isolated in its own container', async ({ page }) => {
    await page.goto('/settings');

    const settingsHtml = await page.locator('#app-settings').innerHTML();
    const navHtml = await page.locator('#app-nav').innerHTML();

    expect(settingsHtml).toContain('Settings');
    expect(settingsHtml).toContain('Dark Mode');
    expect(navHtml).not.toContain('Dark Mode');
  });

  test('dom isolation globalSelectors allow cross-container access to status-log', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#app-home h1')).toHaveText('Home Dashboard');

    // #status-log is configured as a globalSelector — apps can access it
    // Verify it exists outside any app container and is accessible
    const statusLog = page.locator('#status-log');
    await expect(statusLog).toBeVisible();
    await expect(statusLog).toContainText('Boot started');
  });
});
