// ============================================================================
// File: src/app/api/admin/brands/bulk/route.ts
// Purpose: Bulk delete brands by IDs. Brands referenced by products are
//          soft-deleted (status=inactive) instead of hard-deleted.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, parseBody } from "@/lib/api";

export async function POST(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const body = await parseBody<{ ids: string[] }>(req);
  if (!body?.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
    return err("ids array is required", 400);
  }

  let deleted = 0;
  let softDeleted = 0;
  const errors: string[] = [];

  for (const id of body.ids) {
    try {
      const referenced = await db.product.findFirst({ where: { brandId: id } });
      if (referenced) {
        await db.brand.update({ where: { id }, data: { status: "inactive" } });
        softDeleted++;
      } else {
        await db.brand.delete({ where: { id } });
        deleted++;
      }
    } catch (e: any) {
      errors.push(`${id}: ${e?.message ?? "unknown error"}`);
    }
  }

  return ok({ deleted, softDeleted, errors, total: body.ids.length });
}
