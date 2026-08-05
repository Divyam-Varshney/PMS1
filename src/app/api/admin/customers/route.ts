// ============================================================================
// File: src/app/api/admin/customers/route.ts
// Purpose: List customers with search, pagination, and verified/unverified
//          filter. Also supports bulk delete (POST with ids array) and
//          "delete all unverified" (POST with action: "deleteUnverified").
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, param, paramInt, parseBody } from "@/lib/api";

export async function GET(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const search = param(req, "search")?.trim();
  const verified = param(req, "verified"); // "true" | "false" | undefined
  const page = Math.max(1, paramInt(req, "page", 1));
  const pageSize = Math.min(100, paramInt(req, "pageSize", 20));

  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
      { phone: { contains: search } },
    ];
  }
  if (verified === "true") where.isEmailVerified = true;
  if (verified === "false") where.isEmailVerified = false;

  const [total, customers] = await Promise.all([
    db.customer.count({ where }),
    db.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        isEmailVerified: true,
        whatsappOptIn: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
    }),
  ]);

  const ids = customers.map((c) => c.id);
  const spentRows = await db.order.groupBy({
    by: ["customerId"],
    where: { customerId: { in: ids }, status: { not: "cancelled" } },
    _sum: { grandTotal: true },
  });
  const spentMap = new Map(spentRows.map((r) => [r.customerId, Number(r._sum.grandTotal ?? 0)]));

  const items = customers.map((c) => ({
    ...c,
    ordersCount: c._count.orders,
    totalSpent: Number(spentMap.get(c.id) ?? 0),
    _count: undefined,
  }));

  return ok({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}

/** Bulk delete customers + delete all unverified */
export async function POST(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const body = await parseBody<{ ids?: string[]; action?: string }>(req);

  // Delete all unverified customers
  if (body?.action === "deleteUnverified") {
    const result = await db.customer.deleteMany({
      where: { isEmailVerified: false, orders: { none: {} } },
    });
    return ok({ deleted: result.count });
  }

  // Bulk delete by IDs — orders are preserved (customerId set to null via SetNull)
  if (body?.ids && Array.isArray(body.ids) && body.ids.length > 0) {
    const result = await db.customer.deleteMany({
      where: { id: { in: body.ids } },
    });
    return ok({ deleted: result.count });
  }

  return err("ids array or action is required", 400);
}
