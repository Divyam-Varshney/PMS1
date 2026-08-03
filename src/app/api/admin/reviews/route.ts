// ============================================================================
// File: src/app/api/admin/reviews/route.ts
// Purpose: List reviews with status filter.
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
    db.review.count({ where }),
    db.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        product: { select: { id: true, name: true, slug: true } },
        customer: { select: { id: true, name: true } },
      },
    }),
  ]);

  // Hydrate admin reply author names in one batched query (avoids N+1).
  const adminIds = Array.from(
    new Set(
      items
        .map((r) => r.adminReplyBy)
        .filter((x): x is string => typeof x === "string" && x.length > 0)
    )
  );
  const admins = adminIds.length
    ? await db.admin.findMany({
        where: { id: { in: adminIds } },
        select: { id: true, name: true },
      })
    : [];
  const adminMap = new Map(admins.map((a) => [a.id, a.name]));
  const itemsWithAdminName = items.map((r) => ({
    ...r,
    adminReplyByName: r.adminReplyBy ? adminMap.get(r.adminReplyBy) ?? null : null,
  }));

  return ok({ items: itemsWithAdminName, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}
