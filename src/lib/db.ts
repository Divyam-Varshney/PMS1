// ============================================================================
// Prisma client singleton.
//
// CONNECTION POOL TUNING (Supabase Postgres via Supavisor transaction pooler):
//   - DATABASE_URL contains `?pgbouncer=true&connection_limit=3` — keep this
//     low for serverless/edge compatibility (Supavisor caps the pool anyway).
//     Under the cart hot-path the connection_limit was NOT the bottleneck;
//     the bottleneck was sequential queries, which we fixed in cart/_lib.ts.
//   - pool_timeout is implicit (PgBouncer default 60s) — fine for our use.
//
// DEV HOT-RELOAD: `globalForPrisma` keeps a single PrismaClient across Next.js
//   dev hot reloads so we don't exhaust Supabase connections by spawning a new
//   client on every file change.
//
// PRODUCTION: We do NOT attach the client to globalThis (no hot reload in prod),
//   and Node's module cache guarantees exactly ONE instance per process.
//   `next start` runs a single long-lived process, so this is safe.
// ============================================================================

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const prismaClientOptions: ConstructorParameters<typeof PrismaClient>[0] = {
  // `error` so failed queries surface in the server log; `warn` for things like
  // slow queries / deprecation notices. We deliberately do NOT enable `query`
  // logging in production — it would flood the log under cart load.
  log:
    process.env.NODE_ENV === 'production'
      ? ['error']
      : ['error', 'warn'],
}

export const db =
  globalForPrisma.prisma ?? new PrismaClient(prismaClientOptions)

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db