// ============================================================================
// File: src/app/api/admin/database/tables/[table]/route.ts
// Purpose: Browse records in a specific DB table. Admin-only. Read-only.
//          Uses raw SQL with pagination. Only allows tables that exist in the
//          public schema (validated against pg_class).
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ table: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { table } = await params;

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
  const search = url.searchParams.get("search") || undefined;

  // Validate table exists in public schema (prevent SQL injection)
  const tableCheck = await db.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM pg_class C
      JOIN pg_namespace N ON N.oid = C.relnamespace
      WHERE N.nspname = 'public' AND C.relname = ${table} AND C.relkind = 'r'
    ) AS exists
  `;

  if (!tableCheck[0]?.exists) {
    return err("Table not found", 404);
  }

  // Get column names
  const columns = await db.$queryRaw<Array<{ column_name: string; data_type: string }>>`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table}
    ORDER BY ordinal_position
  `;

  // Build search condition (search all text columns)
  let whereClause = "";
  const queryParams: any[] = [];
  if (search) {
    const textCols = columns.filter((c) =>
      c.data_type.includes("text") || c.data_type.includes("varchar") || c.data_type.includes("char")
    );
    if (textCols.length > 0) {
      const conditions = textCols.map((c) => `${c.column_name}::text ILIKE $${queryParams.length + 1}`).join(" OR ");
      whereClause = `WHERE ${conditions}`;
      queryParams.push(`%${search}%`);
    }
  }

  // Get total count — table name is validated against pg_class above (SQL injection safe)
  const countResult = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count FROM "${table}" ${whereClause}`,
    ...queryParams
  );
  const total = Number(countResult[0]?.count ?? 0);

  // Get records with pagination — all user inputs are parameterized
  queryParams.push((page - 1) * limit, limit);
  const records = await db.$queryRawUnsafe<any[]>(
    `SELECT * FROM "${table}" ${whereClause} ORDER BY 1 LIMIT $${queryParams.length} OFFSET $${queryParams.length - 1}`,
    ...queryParams
  );

  return ok({
    table,
    columns: columns.map((c) => c.column_name),
    records: records.map((r) => {
      // Convert BigInt + Date values for JSON safety
      const safe: any = {};
      for (const [k, v] of Object.entries(r)) {
        if (typeof v === "bigint") safe[k] = Number(v);
        else if (v instanceof Date) safe[k] = v.toISOString();
        else safe[k] = v;
      }
      return safe;
    }),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
