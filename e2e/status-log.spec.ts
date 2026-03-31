import { test, expect } from '@playwright/test';

test.describe('Status log panel', () => {
  test('log entries include timestamps', async ({ page }) => {
    await page.goto('/');

    const firstEntry = page.locator('#status-log > div').first();
    const text = await firstEntry.textContent();

    // Timestamps are in format HH:MM:SS AM/PM
    expect(text).toMatch(/\d{1,2}:\d{2}:\d{2}\s[AP]M/);
  });

  test('log buffer is limited to 30 entries', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#status-log')).toContainText('Router started');

    // Generate many log entries by navigating rapidly
    for (const route of ['/settings', '/react', '/', '/settings', '/react', '/']) {
      await page.locator(`#app-nav a[href="${route}"]`).click();
      // Wait for navigation to complete
      await expect(page.locator('#status-log')).toContainText(
        `Route transition complete: ${route}`,
      );
    }

    // Status log should not exceed 30 entries
    const entryCount = await page.locator('#status-log > div').count();
    expect(entryCount).toBeLessThanOrEqual(30);
  });

  test('boot failure for broken app is logged', async ({ page }) => {
    await page.goto('/broken');

    const statusLog = page.locator('#status-log');
    await expect(statusLog).toContainText('Boot failed');
    await expect(statusLog).toContainText('app-broken');
  });

  test('initial "loading..." text is replaced by log entries', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#status-log')).toContainText('Boot started');

    // The initial "loading..." text should be gone
    const logText = await page.locator('#status-log').textContent();
    expect(logText).not.toContain('loading...');
  });
});
