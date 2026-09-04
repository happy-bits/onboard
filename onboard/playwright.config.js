import { defineConfig, devices } from '@playwright/test';

const PORT = 3317;
export const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  // All tests share one database, so they must not overlap.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    // The bulk of the suite: real Postgres, real HTTP, no browser. Declared
    // first so the fast layer reports before the slow one.
    {
      name: 'integration',
      testDir: './tests/integration',
    },
    // A thin layer of full user journeys through a real browser.
    {
      name: 'e2e',
      testDir: './tests/e2e',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'node src/server.js',
    url: `${BASE_URL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      PORT: String(PORT),
      APP_BASE_URL: BASE_URL,
      ONBOARD_TEST_SUPPORT: '1',
    },
  },
});
