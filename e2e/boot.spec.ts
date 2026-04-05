import { test, expect } from '@playwright/test';

test.describe('Framework boot', () => {
  test('셸 페이지를 로드하고 프레임워크를 부트한다', async ({ page }) => {
    await page.goto('/');

    // Navigation bar (app-nav) should be mounted — it's always-active
    const nav = page.locator('#app-nav nav');
    await expect(nav).toBeVisible();
    await expect(nav.locator('strong')).toHaveText('Esmap MFE Demo');

    // Home app should be mounted at "/"
    await expect(page.locator('#app-home h1')).toHaveText('Home Dashboard');
  });

  test('status panel shows lifecycle logs', async ({ page }) => {
    await page.goto('/');

    const statusLog = page.locator('#status-log');
    await expect(statusLog).toContainText('Boot started');
    await expect(statusLog).toContainText('Import map injected');
    await expect(statusLog).toContainText('Router started');
    await expect(statusLog).toContainText('5 apps registered');
  });

  test('nav links are present with correct hrefs', async ({ page }) => {
    await page.goto('/');

    const nav = page.locator('#app-nav nav');
    await expect(nav.locator('a[href="/"]')).toHaveText('Home');
    await expect(nav.locator('a[href="/settings"]')).toHaveText('Settings');
    await expect(nav.locator('a[href="/react"]')).toHaveText('React');
  });

  test('registers all 5 apps on boot', async ({ page }) => {
    await page.goto('/');

    const statusLog = page.locator('#status-log');
    await expect(statusLog).toContainText('5 apps registered');

    // app-nav should transition through full lifecycle
    await expect(statusLog).toContainText('app-nav: NOT_LOADED → LOADING');
    await expect(statusLog).toContainText('app-nav: NOT_MOUNTED → MOUNTED');
  });

  test('home app content has dashboard stats', async ({ page }) => {
    await page.goto('/');

    const home = page.locator('#app-home');
    await expect(home).toContainText('Employees');
    await expect(home).toContainText('142');
    await expect(home).toContainText('Monthly Payroll');
    await expect(home).toContainText('Attendance Rate');
  });
});
