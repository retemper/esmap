import { test, expect } from '@playwright/test';

test.describe('React MFE (app-react-dashboard)', () => {
  test('renders dashboard with all widget cards', async ({ page }) => {
    await page.goto('/react');

    const dashboard = page.locator('[data-testid="react-dashboard"]');
    await expect(dashboard).toBeVisible();

    await expect(dashboard.locator('text=Active Users')).toBeVisible();
    await expect(dashboard.locator('text=Revenue')).toBeVisible();
    await expect(dashboard.locator('text=Orders')).toBeVisible();
    await expect(dashboard.locator('text=Returns')).toBeVisible();
  });

  test('shows live indicator after React mount', async ({ page }) => {
    await page.goto('/react');

    // Wait for React's useEffect to run and set mounted=true
    await expect(
      page.locator('[data-testid="react-dashboard"]').locator('text=● Live'),
    ).toBeVisible();
  });

  test('displays tech stack info including @esmap/react', async ({ page }) => {
    await page.goto('/react');

    const dashboard = page.locator('[data-testid="react-dashboard"]');
    await expect(dashboard).toContainText('@esmap/react');
    await expect(dashboard).toContainText('createReactMfeApp');
  });

  test('mounts via SPA navigation from home', async ({ page }) => {
    await page.goto('/');

    await page.locator('#app-nav a[href="/react"]').click();
    await expect(page).toHaveURL('/react');
    await expect(page.locator('[data-testid="react-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="react-dashboard"] h1')).toHaveText('React Dashboard');
  });

  test('lifecycle transitions are tracked in status log', async ({ page }) => {
    await page.goto('/react');

    const statusLog = page.locator('#status-log');
    await expect(statusLog).toContainText('app-react-dashboard: NOT_LOADED → LOADING');
    await expect(statusLog).toContainText('app-react-dashboard: NOT_MOUNTED → MOUNTED');
  });

  test('unmounts and remounts when navigating away and back', async ({ page }) => {
    await page.goto('/react');
    await expect(page.locator('[data-testid="react-dashboard"]')).toBeVisible();

    // Navigate away
    await page.locator('#app-nav a[href="/"]').click();
    await expect(page.locator('#app-home h1')).toHaveText('Home Dashboard');

    // Navigate back — React app should be visible again (thawed from keepAlive)
    await page.locator('#app-nav a[href="/react"]').click();
    await expect(page.locator('[data-testid="react-dashboard"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="react-dashboard"]').locator('text=● Live'),
    ).toBeVisible();
  });

  test('widget values are displayed as formatted numbers', async ({ page }) => {
    await page.goto('/react');

    const dashboard = page.locator('[data-testid="react-dashboard"]');
    await expect(dashboard).toContainText('1,247');
    await expect(dashboard).toContainText('89,400');
  });
});
