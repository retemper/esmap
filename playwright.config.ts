import { defineConfig } from '@playwright/test';

/**
 * Playwright E2E configuration.
 * Runs against the multi-mfe example (shell + 4 MFE apps).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: process.env['CI'] ? 'github' : 'list',

  use: {
    baseURL: 'http://localhost:3100',
    trace: 'on-first-retry',
  },

  webServer: {
    command: 'pnpm --filter @esmap-examples/multi-mfe preview',
    url: 'http://localhost:3100',
    reuseExistingServer: !process.env['CI'],
    timeout: 60_000,
  },

  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
