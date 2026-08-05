// ============================================================================
// File: src/app/api/admin/manual-requests/route.ts
// Purpose: List manual medicine requests.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, unauthorized, param, paramInt } from "@/lib/api";

export async function GET(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const status = param(req, "status");
  const page = Math.max(1, paramInt(req, "page", 1));
  const pageSize = Math.min(100, paramInt(req, "pageSize", 20));

  const where: any = {};
  if (status) where.status = status;

  const [total, items] = await Promise.all([
    db.manualRequest.count({ where }),
    db.manualRequest.findMany({
      where,
      include: { customer: { select: { id: true, name: true, email: true, phone: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const withMeta = items.map((r) => ({
    ...r,
    medicineCount: r.medicineList.split(/[\n,]/).filter(Boolean).length,
  }));

  return ok({ items: withMeta, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}
