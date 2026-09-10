import { defineConfig } from "@playwright/test";

// Port is overridable so several worktrees can run their own dev server and
// their own suite at the same time. Defaults to 3000 for normal single-app use.
const port = process.env.PORT ?? "3000";
const baseURL = process.env.BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "./tests",
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL,
  },
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    env: { TEST_MODE: "1", PORT: port },
  },
});
