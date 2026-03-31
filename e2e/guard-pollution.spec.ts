import { test, expect } from '@playwright/test';

test.describe('Guard plugin (global pollution detection)', () => {
  test('detects global pollution injected after all guards are established', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#app-home h1')).toHaveText('Home Dashboard');

    // Wait for all guards to be established (all apps mounted)
    await expect(page.locator('#status-log')).toContainText('Router started');

    // Inject a new global AFTER all guard snapshots are taken —
    // this guarantees at least one guard will flag it as pollution.
    await page.evaluate(() => {
      (window as unknown as Record<string, string>)['__INJECTED_POLLUTION__'] = 'leaked';
    });

    // The guard polls on a ~1000ms interval — wait for the violation.
    await expect(page.locator('#status-log')).toContainText('Global pollution detected', {
      timeout: 10_000,
    });
  });

  test('guard applies data-esmap-scope CSS attribute to mounted apps', async ({ page }) => {
    await page.goto('/');

    // Guard plugin applies CSS scope attribute to app containers after mount
    await expect(page.locator('#app-home')).toHaveAttribute('data-esmap-scope');
    await expect(page.locator('#app-nav')).toHaveAttribute('data-esmap-scope');
  });

  test('CSS scope attribute value matches the app name', async ({ page }) => {
    await page.goto('/');

    const homeScope = await page.locator('#app-home').getAttribute('data-esmap-scope');
    const navScope = await page.locator('#app-nav').getAttribute('data-esmap-scope');

    expect(homeScope).toBe('app-home');
    expect(navScope).toBe('app-nav');
  });

  test('CSS scope attribute is removed after unmount', async ({ page }) => {
    await page.goto('/');

    // Navigate to settings via pushState to trigger unmount of home
    // (If home is in keepAlive, it freezes — check settings which we haven't visited)
    await page.locator('#app-nav a[href="/settings"]').click();
    await expect(page.locator('#app-settings h1')).toHaveText('Settings');

    // Settings should now have the scope attribute
    await expect(page.locator('#app-settings')).toHaveAttribute('data-esmap-scope');
  });
});
