// ============================================================================
// File: src/app/api/admin/database/tables/route.ts
// Purpose: Database management — list all tables with row counts + sizes.
//          Admin-only. Read-only (no editing through this endpoint).
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const tables = await db.$queryRaw<Array<{
    tableName: string; rowCount: bigint; sizeBytes: string;
  }>>`
    SELECT
      C.relname AS "tableName",
      COALESCE(S.n_live_tup, 0) AS "rowCount",
      pg_size_pretty(pg_total_relation_size(C.oid)) AS "sizeBytes"
    FROM pg_class C
    LEFT JOIN pg_namespace N ON (N.oid = C.relnamespace)
    LEFT JOIN pg_stat_user_tables S ON S.relid = C.oid
    WHERE N.nspname = 'public'
      AND C.relkind = 'r'
    ORDER BY C.relname
  `;

  const totalSize = await db.$queryRaw<Array<{ size: string }>>`
    SELECT pg_size_pretty(pg_database_size(current_database())) AS size
  `;

  return ok({
    tables: tables.map((t) => ({
      name: t.tableName,
      rowCount: Number(t.rowCount),
      size: t.sizeBytes,
    })),
    totalSize: totalSize[0]?.size || "unknown",
    tableCount: tables.length,
  });
}
