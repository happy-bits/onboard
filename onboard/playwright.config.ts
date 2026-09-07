// Loads this worktree's .env so PORT/APP_URL/DATABASE_URL are the ones the
// dev server and the assertions both see.
import "dotenv/config";
import { defineConfig } from "@playwright/test";

const port = process.env.PORT ?? "3000";
const baseURL = process.env.APP_URL ?? `http://localhost:${port}`;

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
    // Never adopt an already-running server: the deterministic clock offset and
    // token counters live in that process, and another worktree's server points
    // at a different database. Failing loudly on a busy port beats a silently
    // wrong run.
    reuseExistingServer: false,
    env: { TEST_MODE: "1", PORT: port, APP_URL: baseURL },
  },
});
