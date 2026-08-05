// ============================================================================
// File: src/app/api/admin/brands/export/route.ts
// Purpose: Export brands as a CSV file. Supports all or selected (?ids=) export.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { unauthorized } from "@/lib/api";

function csvEscape(value: any): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const url = new URL(req.url);
  const idsParam = url.searchParams.get("ids");
  const where = idsParam ? { id: { in: idsParam.split(",").filter(Boolean) } } : {};

  const brands = await db.brand.findMany({
    where,
    orderBy: { displayOrder: "asc" },
  });

  const headers = ["name", "slug", "description", "displayOrder", "status", "visibility"];
  const rows = brands.map((b) =>
    [b.name, b.slug, b.description, b.displayOrder, b.status, b.visibility].map(csvEscape).join(",")
  );

  const csv = [headers.join(","), ...rows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="brands-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
