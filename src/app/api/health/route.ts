// ============================================================================
// File: src/app/api/health/route.ts
// Purpose: Lightweight health check endpoint for load balancers, uptime
//          monitors, and the dev keepalive supervisor. Returns 200 if the
//          server is alive and the database is reachable.
//
//          This endpoint is PUBLIC (no auth) and intentionally minimal —
//          it doesn't load any heavy modules or run expensive queries.
//          A single `SELECT 1` via Prisma is the fastest DB round-trip.
// ============================================================================

import { db } from "@/lib/db";
import { ok } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function GET() {
  const checks: Record<string, "ok" | "fail"> = {
    server: "ok",
  };

  // Database ping — fastest possible query
  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "fail";
  }

  const allOk = Object.values(checks).every((v) => v === "ok");

  return ok({
    status: allOk ? "healthy" : "degraded",
    uptime: process.uptime(),
    memory: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024), // MB
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    },
    checks,
    timestamp: new Date().toISOString(),
  });
}
