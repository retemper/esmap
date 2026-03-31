import { test, expect } from '@playwright/test';

test.describe('KeepAlive advanced behavior', () => {
  test('frozen app DOM content is preserved (not cleared)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#app-home h1')).toHaveText('Home Dashboard');

    // Navigate away — home gets frozen
    await page.locator('#app-nav a[href="/settings"]').click();
    await expect(page.locator('#app-settings h1')).toHaveText('Settings');

    // Frozen home container still has its original content in the DOM
    const homeContent = await page.locator('#app-home').innerHTML();
    expect(homeContent).toContain('Home Dashboard');
    expect(homeContent).toContain('142');
  });

  test('thawed app restores exact same DOM without re-render', async ({ page }) => {
    await page.goto('/');

    // Get original home HTML
    const originalHtml = await page.locator('#app-home').innerHTML();

    // Freeze (navigate away)
    await page.locator('#app-nav a[href="/settings"]').click();
    await expect(page.locator('#app-settings h1')).toHaveText('Settings');

    // Thaw (navigate back)
    await page.locator('#app-nav a[href="/"]').click();
    await expect(page.locator('#app-home h1')).toHaveText('Home Dashboard');

    // DOM should be exactly the same (keepAlive preserves, doesn't re-render)
    const restoredHtml = await page.locator('#app-home').innerHTML();
    expect(restoredHtml).toBe(originalHtml);
  });

  test('multiple apps can be frozen simultaneously', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#app-home h1')).toHaveText('Home Dashboard');

    // Freeze home
    await page.locator('#app-nav a[href="/settings"]').click();
    await expect(page.locator('#app-settings h1')).toHaveText('Settings');

    // Freeze settings
    await page.locator('#app-nav a[href="/react"]').click();
    await expect(page.locator('[data-testid="react-dashboard"] h1')).toHaveText('React Dashboard');

    // Both home and settings should be frozen (hidden but content preserved)
    const homeDisplay = await page.locator('#app-home').evaluate((el) => el.style.display);
    const settingsDisplay = await page.locator('#app-settings').evaluate((el) => el.style.display);

    expect(homeDisplay).toBe('none');
    expect(settingsDisplay).toBe('none');

    // Content still in DOM
    await expect(page.locator('#app-home')).toContainText('Home Dashboard');
    await expect(page.locator('#app-settings')).toContainText('Settings');
  });

  test('freeze/thaw cycle logs MOUNTED → FROZEN → MOUNTED transitions', async ({ page }) => {
    await page.goto('/');

    const statusLog = page.locator('#status-log');

    // Freeze home
    await page.locator('#app-nav a[href="/settings"]').click();
    await expect(page.locator('#app-settings h1')).toHaveText('Settings');
    await expect(statusLog).toContainText('app-home: MOUNTED → FROZEN');

    // Thaw home
    await page.locator('#app-nav a[href="/"]').click();
    await expect(page.locator('#app-home h1')).toHaveText('Home Dashboard');
    await expect(statusLog).toContainText('app-home: FROZEN → MOUNTED');

    // Freeze again
    await page.locator('#app-nav a[href="/react"]').click();
    await expect(page.locator('[data-testid="react-dashboard"] h1')).toHaveText('React Dashboard');

    // Should see a second FROZEN transition
    const logText = await statusLog.textContent();
    const frozenCount = (logText?.match(/app-home: MOUNTED → FROZEN/g) ?? []).length;
    expect(frozenCount).toBeGreaterThanOrEqual(2);
  });
});
