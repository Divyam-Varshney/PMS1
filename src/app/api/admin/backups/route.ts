// ============================================================================
// File: src/app/api/admin/backups/route.ts
// Purpose: Backup management — database table statistics + storage file
//          inventory. Admin-only. Provides an overview of what can be backed
//          up (DB tables + storage categories) with sizes.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, unauthorized } from "@/lib/api";
import { getStorageConfig } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  // Get table statistics — row counts + approximate sizes
  // Use pg_stat_user_tables for row counts (n_live_tup lives there, not in pg_class)
  const tableStats = await db.$queryRaw<Array<{
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
    ORDER BY pg_total_relation_size(C.oid) DESC
  `;

  const tables = tableStats.map((t) => ({
    name: t.tableName,
    rowCount: Number(t.rowCount),
    size: t.sizeBytes,
  }));

  // Total DB size
  const totalDbSize = await db.$queryRaw<Array<{ size: string }>>`
    SELECT pg_size_pretty(pg_database_size(current_database())) AS size
  `;

  // Storage config summary
  const storageConfig = await getStorageConfig();
  const isCloudActive = storageConfig.enabled && storageConfig.provider !== "local";

  // Storage file counts by category (from DB)
  const [
    productImages, brandLogos, categoryImages, prescriptions, screenshots,
  ] = await Promise.all([
    db.productImage.count(),
    db.brand.count({ where: { logo: { not: null } } }),
    db.category.count({ where: { image: { not: null } } }),
    db.prescription.count(),
    db.order.count({ where: { paymentScreenshot: { not: null } } }),
  ]);

  return ok({
    database: {
      totalSize: totalDbSize[0]?.size || "unknown",
      tables,
      tableCount: tables.length,
    },
    storage: {
      provider: storageConfig.provider,
      enabled: storageConfig.enabled,
      isCloudActive,
      files: {
        productImages,
        brandLogos,
        categoryImages,
        prescriptions,
        screenshots,
      },
    },
  });
}
