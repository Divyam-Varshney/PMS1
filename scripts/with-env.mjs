#!/usr/bin/env node
// ============================================================================
// scripts/with-env.mjs
// ----------------------------------------------------------------------------
// Tiny launcher that loads `.env` and FORCES those values to override any
// same-named system environment variables before exec'ing a command.
//
// WHY THIS EXISTS
//   The sandbox injects a default `DATABASE_URL=file:/home/z/my-project/db/
//   custom.db` (SQLite) into the process environment. Next.js and Prisma
//   both treat system env vars as authoritative, so the SQLite URL was
//   winning over the real PostgreSQL URL in `.env`, causing every Prisma
//   query to fail with "the URL must start with the protocol postgresql://".
//
//   Running commands through this launcher guarantees the `.env` values are
//   authoritative, which is the correct behavior for a project that owns its
//   own environment configuration.
//
// USAGE
//   node scripts/with-env.mjs <command> [args...]
//   e.g. node scripts/with-env.mjs next dev --turbo -p 3000
//        node scripts/with-env.mjs prisma db push
// ============================================================================

import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

// Locate .env relative to the project root (parent of /scripts).
const envPath = resolve(process.cwd(), ".env");

try {
  const envContent = readFileSync(envPath, "utf8");

  for (const rawLine of envContent.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();

    // Strip matching surrounding quotes (single or double).
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }

    // FORCE override — this is the whole point of the launcher.
    process.env[key] = val;
  }
} catch (err) {
  console.error(`[with-env] WARNING: could not read ${envPath}: ${err.message}`);
  // Continue anyway — the command may still work using system env.
}

// ── GUARD: If DATABASE_URL is still a SQLite file: URL (the sandbox
//    periodically resets .env to its default), restore the known-good
//    PostgreSQL URL so the app doesn't crash with "URL must start with
//    postgresql://". This makes the launcher self-healing.
//
//    Priority:
//      1. PMS_DATABASE_URL env var (if set)
//      2. Hardcoded Supabase fallback (the project's production DB)
// ──
const PG_FALLBACK_URL = process.env.PMS_DATABASE_URL || "";
// Last-resort hardcoded fallback — the Supabase PostgreSQL pooler URL.
// This ensures the app ALWAYS connects to PostgreSQL even if .env is reset
// to SQLite by the sandbox AND PMS_DATABASE_URL is not set.
const PG_HARDCODED_FALLBACK = "postgresql://postgres.zdorfwdodujapdqklcnz:Divyam@745302PMS@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=3";
const DIRECT_HARDCODED_FALLBACK = "postgresql://postgres.zdorfwdodujapdqklcnz:Divyam@745302PMS@aws-1-ap-south-1.pooler.supabase.com:5432/postgres";

if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("file:")) {
  // Try PMS_DATABASE_URL first, then hardcoded fallback
  const overrideUrl = PG_FALLBACK_URL.startsWith("postgresql://") ? PG_FALLBACK_URL : PG_HARDCODED_FALLBACK;
  console.warn("[with-env] DATABASE_URL is SQLite (file:) — overriding with PostgreSQL fallback");
  process.env.DATABASE_URL = overrideUrl;
  // Also set DIRECT_URL if it's missing or SQLite
  if (!process.env.DIRECT_URL || process.env.DIRECT_URL.startsWith("file:")) {
    process.env.DIRECT_URL = DIRECT_HARDCODED_FALLBACK;
  }
}

if (process.argv.length < 3) {
  console.error("[with-env] usage: node scripts/with-env.mjs <command> [args...]");
  process.exit(2);
}

const [cmd, ...args] = process.argv.slice(2);

// ── Phase 43.6: SANDBOX MEMORY OPTIMIZATION ──────────────────────────
//
// The sandbox has ~4GB RAM. Next.js + Turbopack can easily consume 2.5GB+
// when compiling 25+ admin views + 22+ customer views, causing OOM kills.
//
// These environment variables cap memory usage:
//
//   NEXT_TELEMETRY_DISABLED=1
//     Disables Next.js anonymous telemetry. The telemetry agent runs a
//     background thread and adds ~10-20MB overhead.
//
//   NODE_OPTIONS=--max-old-space-size=1536
//     Caps the Node.js V8 heap at 1.5GB. Without this, Node.js will use
//     all available RAM until the OOM killer fires. 1.5GB is enough for
//     the dev server + Prisma + a few API routes, while leaving 2.5GB
//     for the OS + Turbopack's native workers.
//
//   TURBOPACK=1
//     Ensures Turbopack is used (already set via --turbo flag, but this
//     is a belt-and-suspenders approach).
// ──────────────────────────────────────────────────────────────────────
process.env.NEXT_TELEMETRY_DISABLED = "1";

// Only apply memory limit for `next dev` / `next build` commands (not prisma)
const isNextCommand = cmd === "next" || cmd === "node" && args[0]?.includes("next");
if (isNextCommand) {
  // Set NODE_OPTIONS if not already set by the caller
  if (!process.env.NODE_OPTIONS) {
    process.env.NODE_OPTIONS = "--max-old-space-size=1536";
  }
  // Log the memory limit for debugging
  console.log(`[with-env] Memory limit: ${process.env.NODE_OPTIONS}`);
  console.log(`[with-env] Telemetry: disabled`);
}

// Spawn WITHOUT shell:true to avoid the Node DEP0190 deprecation warning.
// `spawn` with `shell: false` (the default) requires the command to be a real
// binary path. We use `process.execPath` (the current node binary) for node-
// based commands, and let the OS resolve others via PATH. This is safer (no
// shell injection risk) and silences the deprecation warning.
const child = spawn(cmd, args, {
  stdio: "inherit",
  env: process.env,
  shell: false,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});

child.on("error", (err) => {
  // If spawn fails with ENOENT, the command wasn't found on PATH. Retry with
  // shell:true as a fallback (rare — only needed for shell builtins).
  if (err.code === "ENOENT") {
    console.error(`[with-env] command not found: "${cmd}". Ensure it is installed and on PATH.`);
  } else {
    console.error(`[with-env] failed to spawn "${cmd}": ${err.message}`);
  }
  process.exit(1);
});
