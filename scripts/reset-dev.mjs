import { execSync, spawn } from "child_process";
import { existsSync, rmSync } from "fs";
import { join } from "path";
import { setTimeout as delay } from "timers/promises";

const cwd = process.cwd();
const nextDir = join(cwd, ".next");

function killPort(port) {
  try {
    execSync(
      `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`,
      { stdio: "ignore" }
    );
  } catch {
    /* ignore */
  }
}

for (const port of [3000, 3001]) {
  killPort(port);
}

await delay(1500);

if (existsSync(nextDir)) {
  rmSync(nextDir, { recursive: true, force: true, maxRetries: 15, retryDelay: 400 });
  console.log("Removed .next cache");
}

console.log("Starting http://localhost:3000 ...\n");

const child = spawn("npx", ["next", "dev"], {
  cwd,
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code) => process.exit(code ?? 0));
