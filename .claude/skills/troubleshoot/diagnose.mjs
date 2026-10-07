#!/usr/bin/env node
// Read-only diagnostics for the onboard app. Prints ONE JSON object to stdout.
// Never modifies anything: no installs, no migrations, no container starts.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../..");
const app = path.join(repo, "onboard");
const checks = [];

const add = (category, id, status, title, detail = "", fix = "") =>
  checks.push({ category, id, status, title, detail, fix });

const run = (cmd, args, opts = {}) => {
  try {
    return { ok: true, out: execFileSync(cmd, args, { encoding: "utf8", timeout: 15000, stdio: ["ignore", "pipe", "pipe"], ...opts }).trim() };
  } catch (e) {
    return { ok: false, out: String(e.stderr || e.message || "").trim(), missing: e.code === "ENOENT" };
  }
};

const portOpen = (port, host = "127.0.0.1") =>
  new Promise((resolve) => {
    const s = net.connect({ port, host, timeout: 1500 });
    s.on("connect", () => (s.destroy(), resolve(true)));
    s.on("error", () => resolve(false));
    s.on("timeout", () => (s.destroy(), resolve(false)));
  });

// ---- Node ----
const major = Number(process.versions.node.split(".")[0]);
major >= 20
  ? add("Node", "node-version", "ok", `Node ${process.versions.node}`)
  : add("Node", "node-version", "fail", `Node ${process.versions.node} is too old`, "Next.js 16 needs Node 20.9+", "Install Node 20 or newer");
const npm = run("npm", ["-v"]);
npm.ok ? add("Node", "npm", "ok", `npm ${npm.out}`) : add("Node", "npm", "fail", "npm not found", npm.out, "Install Node (includes npm)");

// ---- Project files ----
if (!existsSync(app)) {
  add("Project", "app-dir", "fail", "onboard/ app folder not found", app);
} else {
  existsSync(path.join(app, "node_modules"))
    ? add("Project", "node-modules", "ok", "node_modules installed")
    : add("Project", "node-modules", "fail", "node_modules missing", "", "cd onboard && npm install");
  existsSync(path.join(app, "node_modules/.prisma/client")) || existsSync(path.join(app, "node_modules/@prisma/client/index.js"))
    ? add("Project", "prisma-client", "ok", "Prisma client package present")
    : add("Project", "prisma-client", "warn", "Prisma client not found", "", "cd onboard && npx prisma generate");
}

// ---- Env ----
let dbUrl = process.env.DATABASE_URL;
const envFile = path.join(app, ".env");
if (existsSync(envFile)) {
  add("Config", "env-file", "ok", ".env exists");
  const m = readFileSync(envFile, "utf8").match(/^\s*DATABASE_URL\s*=\s*"?([^"\n]+)"?/m);
  if (m) dbUrl = m[1].trim();
} else {
  add("Config", "env-file", "fail", ".env missing", "", "cd onboard && cp .env.example .env");
}
let dbPort = 5434;
if (dbUrl) {
  try {
    const u = new URL(dbUrl);
    dbPort = Number(u.port || 5432);
    add("Config", "database-url", dbPort === 5434 ? "ok" : "warn", `DATABASE_URL → ${u.hostname}:${dbPort}/${u.pathname.slice(1)}`,
      dbPort === 5434 ? "" : "Docker Postgres is published on 5434; this URL points elsewhere (maybe a local Postgres)",
      dbPort === 5434 ? "" : "Set the port to 5434 as in .env.example");
  } catch {
    add("Config", "database-url", "fail", "DATABASE_URL is not a valid URL", "", "Compare with .env.example");
  }
} else {
  add("Config", "database-url", "fail", "DATABASE_URL not set", "", "Add it to onboard/.env (see .env.example)");
}

// ---- Docker ----
const dockerV = run("docker", ["--version"]);
let dockerUp = false;
if (!dockerV.ok) {
  add("Docker", "docker-installed", "fail", "Docker not installed", dockerV.missing ? "docker command not found" : dockerV.out, "Install Docker Desktop");
} else {
  add("Docker", "docker-installed", "ok", dockerV.out);
  const info = run("docker", ["info", "--format", "{{.ServerVersion}}"]);
  dockerUp = info.ok;
  info.ok
    ? add("Docker", "docker-running", "ok", `Docker daemon running (server ${info.out})`)
    : add("Docker", "docker-running", "fail", "Docker daemon not running", info.out.split("\n")[0], "Start Docker Desktop");
}
if (dockerUp) {
  const ps = run("docker", ["compose", "ps", "--format", "json"], { cwd: app });
  if (!ps.ok) {
    add("Docker", "container", "fail", "Could not query docker compose", ps.out.split("\n")[0], "Check that the docker compose plugin is installed");
  } else {
    const rows = ps.out.split("\n").filter(Boolean).flatMap((l) => { try { const j = JSON.parse(l); return Array.isArray(j) ? j : [j]; } catch { return []; } });
    const db = rows.find((r) => r.Service === "db");
    db && db.State === "running"
      ? add("Docker", "container", "ok", "db container running", db.Status || "")
      : add("Docker", "container", "fail", db ? `db container is ${db.State}` : "db container not created", "", "cd onboard && docker compose up -d");
  }
}

// ---- Ports ----
const dbPortOpen = await portOpen(dbPort);
dbPortOpen
  ? add("Ports", "db-port", "ok", `Something is listening on ${dbPort}`)
  : add("Ports", "db-port", "fail", `Nothing listening on ${dbPort}`, "Postgres is unreachable", "Start the container: cd onboard && docker compose up -d");

let devServer = "none";
let testMode = null;
if (await portOpen(3000)) {
  try {
    const r = await fetch("http://localhost:3000/api/dev/clock", { signal: AbortSignal.timeout(4000) });
    const t = await fetch("http://localhost:3000/login", { signal: AbortSignal.timeout(4000) });
    devServer = t.ok ? "onboard" : `other (HTTP ${t.status})`;
    testMode = r.status !== 404;
  } catch { devServer = "unknown"; }
  devServer === "onboard"
    ? add("Ports", "dev-server", "ok", "Dev server responding on :3000", testMode ? "TEST_MODE is ON (frozen clock, deterministic tokens)" : "TEST_MODE is off")
    : add("Ports", "dev-server", "warn", "Port 3000 is in use but doesn't look like onboard", devServer, "Free the port or stop the other process (lsof -i :3000)");
  if (testMode) add("Ports", "test-mode", "warn", "Server is running in TEST_MODE", "Clock is frozen at 2026-01-01; invitations/sessions may look expired in real use", "Restart without TEST_MODE=1 for normal use");
} else {
  add("Ports", "dev-server", "warn", "Dev server not running on :3000", "", "cd onboard && npm run dev");
}

// ---- Database ----
if (dbPortOpen && dbUrl && existsSync(path.join(app, "node_modules/pg"))) {
  const { Client } = createRequire(path.join(app, "package.json"))("pg");
  const client = new Client({ connectionString: dbUrl, connectionTimeoutMillis: 4000 });
  try {
    await client.connect();
    add("Database", "connect", "ok", "Connected to Postgres");
    const q = async (sql) => (await client.query(sql)).rows;
    const tables = (await q("select table_name from information_schema.tables where table_schema='public'")).map((r) => r.table_name);
    const expected = ["User", "Team", "Invitation", "OnboardingProgress", "Session", "Email"];
    const missing = expected.filter((t) => !tables.includes(t));
    missing.length
      ? add("Database", "tables", "fail", `Missing tables: ${missing.join(", ")}`, "", "cd onboard && npx prisma migrate dev")
      : add("Database", "tables", "ok", "All expected tables exist");

    const migDir = path.join(app, "prisma/migrations");
    const onDisk = existsSync(migDir) ? readdirSync(migDir).filter((d) => !d.includes(".")) : [];
    if (tables.includes("_prisma_migrations")) {
      const applied = (await q("select migration_name from _prisma_migrations where finished_at is not null")).map((r) => r.migration_name);
      const pending = onDisk.filter((m) => !applied.includes(m));
      pending.length
        ? add("Database", "migrations", "fail", `${pending.length} unapplied migration(s)`, pending.join(", "), "cd onboard && npx prisma migrate dev")
        : add("Database", "migrations", "ok", `${applied.length} migration(s) applied`);
    } else {
      add("Database", "migrations", "fail", "No migration history", "", "cd onboard && npx prisma migrate dev");
    }

    if (!missing.includes("User")) {
      const roles = Object.fromEntries((await q('select role, count(*)::int n from "User" group by role')).map((r) => [r.role, r.n]));
      const admin = await q(`select 1 from "User" where email='admin@onboard.local'`);
      admin.length
        ? add("Database", "superadmin", "ok", "Seeded Superadmin exists", `Users by role: ${JSON.stringify(roles)}`)
        : add("Database", "superadmin", "fail", "Seeded Superadmin missing", `Users by role: ${JSON.stringify(roles)}`, "cd onboard && npm run seed (wipes all data)");
      const leader = await q(`select 1 from "User" where email='leader@onboard.local'`);
      if (!leader.length) add("Database", "leader", "warn", "Seed Leader (leader@onboard.local) not present", "Only needed for the leader/member flows", "cd onboard && npm run seed superadmin+leader (wipes all data)");
    }
  } catch (e) {
    add("Database", "connect", "fail", "Cannot connect to Postgres", String(e.message).split("\n")[0], "Check credentials in DATABASE_URL and that the container is healthy (docker compose logs db)");
  } finally {
    await client.end().catch(() => {});
  }
} else {
  add("Database", "connect", "fail", "Database checks skipped", !dbPortOpen ? `Port ${dbPort} not reachable` : !dbUrl ? "No DATABASE_URL" : "pg module missing (npm install)");
}

// ---- Playwright (only matters for E2E) ----
const pw = run("npx", ["--no-install", "playwright", "--version"], { cwd: app });
if (pw.ok) {
  const cache = [path.join(process.env.HOME || "", "Library/Caches/ms-playwright"), path.join(process.env.HOME || "", ".cache/ms-playwright")];
  const hasChromium = cache.some((d) => existsSync(d) && readdirSync(d).some((n) => n.startsWith("chromium")));
  hasChromium
    ? add("E2E", "chromium", "ok", "Playwright Chromium installed")
    : add("E2E", "chromium", "warn", "Playwright Chromium not found", "Only needed for npm run test:e2e", "cd onboard && npx playwright install chromium");
}

const summary = { ok: 0, warn: 0, fail: 0 };
for (const c of checks) summary[c.status]++;
console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  healthy: summary.fail === 0,
  summary,
  checks,
}, null, 2));
