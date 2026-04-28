import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the web app.
 *
 * The only suite that lives here today is `tests/e2e/no-polling-after-signout.spec.ts`,
 * which guards against the regression class fixed in tasks #22–#25
 * (background polls / setIntervals that keep firing authenticated
 * requests after the user signs out). See that spec for context.
 *
 * The test boots the regular Vite dev server because the app's bundle
 * contains the very providers (`AppContext`, the leads reconciler) we
 * need to exercise. We do NOT need a backend — the spec stubs every
 * `/api/v1/**` route via `page.route`.
 */
export default defineConfig({
  testDir: './tests/e2e',
  // The signed-in→signed-out wait window is intentionally ~35s, plus
  // dev-server boot, login flow, and a small safety margin.
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  use: {
    baseURL: 'http://localhost:5000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5000',
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
