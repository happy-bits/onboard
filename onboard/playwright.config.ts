import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://onboard:onboard@localhost:55432/onboard_test';

export default defineConfig({
  testDir: './tests',
  // All tests share one database, so run them one at a time.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Creates the test database + schema if needed, then starts the app against it.
    command: 'node scripts/prepare-db.js && node src/server.js',
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(PORT), DATABASE_URL: TEST_DATABASE_URL, SESSION_SECRET: 'test-session-secret' },
  },
});
