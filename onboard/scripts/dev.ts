import "dotenv/config";
import { spawn } from "child_process";

// `next dev` resolves its port from process.env.PORT while parsing argv, which
// happens before it loads .env — so a per-worktree PORT in .env is ignored
// unless it is passed on the command line. Load .env here and forward it.
const port = process.env.PORT ?? "3000";

const child = spawn("next", ["dev", "--port", port], { stdio: "inherit" });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
