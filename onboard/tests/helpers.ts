import { execSync } from "child_process";
import { readFileSync, mkdirSync } from "fs";
import { scryptSync } from "crypto";
import path from "path";

const root = path.resolve(__dirname, "..");

export const EPOCH = "2026-01-01T00:00:00.000Z";
export const EPOCH_PLUS_24H = "2026-01-02T00:00:00.000Z";

// Invitation emails embed this, so the dump assertions cannot hardcode a port —
// each worktree runs its dev server on its own. Mirrors the fallback in
// app/api/invitations/route.ts.
export const APP_URL =
  process.env.APP_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;

const FIXED_SALT = "6f6e626f6172642d66697865642d73616c74";

export function hash(password: string): string {
  return `${FIXED_SALT}:${scryptSync(password, FIXED_SALT, 32).toString("hex")}`;
}

export function seedDatabase(scenario: "superadmin" | "superadmin+leader") {
  execSync(`npx tsx scripts/seed.ts ${scenario}`, { cwd: root });
}

export function dumpDatabase(name: string): unknown {
  const dir = path.join(root, "dumps");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.json`);
  execSync(`npx tsx scripts/dump.ts ${file}`, { cwd: root });
  return JSON.parse(readFileSync(file, "utf8"));
}
