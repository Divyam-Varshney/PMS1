// ============================================================================
// File: src/app/api/admin/prescriptions/route.ts
// Purpose: List prescriptions with status filter.
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
    db.prescription.count({ where }),
    db.prescription.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  // attach images count
  const withMeta = items.map((p) => {
    let imageCount = 0;
    try {
      imageCount = JSON.parse(p.images).length;
    } catch (e) { console.error("[rx] error:", e); }
    return { ...p, imageCount };
  });

  return ok({ items: withMeta, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}
