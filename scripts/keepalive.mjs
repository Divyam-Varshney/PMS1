#!/usr/bin/env node
// ============================================================================
// scripts/keepalive.mjs
// ----------------------------------------------------------------------------
// A lightweight process supervisor that keeps the Next.js dev server alive
// in sandbox environments where background processes get reaped between
// tool calls.
//
// HOW IT WORKS:
//   1. Starts `bun run dev` as a child process with stdio inherited
//   2. Polls http://localhost:3000/ every 10 seconds
//   3. If the server is unresponsive for 3 consecutive checks (30s), restarts it
//   4. Writes a heartbeat to /tmp/pms-dev-alive so external monitors can verify
//   5. Exits cleanly on SIGINT/SIGTERM
//
// USAGE:
//   node scripts/keepalive.mjs          # foreground (logs to stdout)
//   node scripts/keepalive.mjs --daemon # background (logs to file)
//
// This is a DEV-ONLY utility. Production uses `next start` (or Vercel) which
// has its own process management.
// ============================================================================

import { spawn, execSync } from "node:child_process";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const PORT = 3000;
const HEALTH_URL = `http://localhost:${PORT}/api/health`;
const HEARTBEAT_FILE = "/tmp/pms-dev-alive";
const LOG_FILE = "/home/z/my-project/.zscripts/keepalive.log";
const POLL_INTERVAL_MS = 10_000;
const MAX_FAILURES = 3; // restart after 3 consecutive failed health checks (30s)

let childPid = null;
let failureCount = 0;
let isShuttingDown = false;

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try {
    const existing = existsSync(LOG_FILE) ? readFileSync(LOG_FILE, "utf8") : "";
    writeFileSync(LOG_FILE, existing + line + "\n");
  } catch {}
}

function writeHeartbeat(status) {
  try {
    writeFileSync(HEARTBEAT_FILE, JSON.stringify({ status, ts: Date.now(), pid: childPid }));
  } catch {}
}

async function healthCheck() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(HEALTH_URL, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

function startServer() {
  log("Starting Next.js dev server...");
  const child = spawn("bun", ["run", "dev"], {
    cwd: "/home/z/my-project",
    stdio: "inherit",
    detached: true,
    env: process.env,
  });
  childPid = child.pid;
  log(`Server started (PID: ${childPid})`);

  child.on("exit", (code, signal) => {
    log(`Server exited (code=${code}, signal=${signal})`);
    childPid = null;
    if (!isShuttingDown) {
      log("Server exited unexpectedly — will restart on next health check cycle");
    }
  });

  child.on("error", (err) => {
    log(`Server spawn error: ${err.message}`);
    childPid = null;
  });

  // Detach so the child survives if this supervisor is killed
  child.unref();
}

function killExisting() {
  try {
    const pids = execSync(`pgrep -f "next-server|next dev|bun run dev" 2>/dev/null || true`, { encoding: "utf8" })
      .trim()
      .split("\n")
      .filter(Boolean);
    for (const pid of pids) {
      if (Number(pid) !== process.pid) {
        try {
          process.kill(Number(pid), "SIGTERM");
          log(`Killed existing process ${pid}`);
        } catch {}
      }
    }
  } catch {}
}

async function main() {
  log("=== PMS Dev Server Keepalive Supervisor ===");
  isShuttingDown = false;

  // Kill any existing server instances to avoid EADDRINUSE
  killExisting();
  await new Promise((r) => setTimeout(r, 2000));

  // Start the server
  startServer();

  // Wait for initial startup
  log("Waiting 15s for server to start...");
  await new Promise((r) => setTimeout(r, 15_000));

  // Health check loop
  log(`Starting health monitor (polling every ${POLL_INTERVAL_MS / 1000}s)`);
  while (!isShuttingDown) {
    const healthy = await healthCheck();
    if (healthy) {
      failureCount = 0;
      writeHeartbeat("ok");
    } else {
      failureCount++;
      log(`Health check FAILED (${failureCount}/${MAX_FAILURES})`);
      writeHeartbeat("unhealthy");

      if (failureCount >= MAX_FAILURES) {
        log("Max failures reached — restarting server");
        killExisting();
        await new Promise((r) => setTimeout(r, 3000));
        startServer();
        failureCount = 0;
        log("Waiting 15s for server to restart...");
        await new Promise((r) => setTimeout(r, 15_000));
      }
    }

    // Sleep between checks
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  log("Shutting down...");
  killExisting();
  process.exit(0);
}

process.on("SIGINT", () => {
  isShuttingDown = true;
});
process.on("SIGTERM", () => {
  isShuttingDown = true;
});

main().catch((err) => {
  log(`Fatal error: ${err.message}`);
  process.exit(1);
});
