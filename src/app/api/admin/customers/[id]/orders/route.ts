// ============================================================================
// File: src/app/api/admin/customers/[id]/orders/route.ts
// Purpose: List all orders belonging to a customer.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, unauthorized, paramInt } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;
  const page = Math.max(1, paramInt(req, "page", 1));
  const pageSize = Math.min(100, paramInt(req, "pageSize", 20));

  const [total, items] = await Promise.all([
    db.order.count({ where: { customerId: id } }),
    db.order.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        items: { select: { id: true, name: true, qty: true, lineTotal: true } },
      },
    }),
  ]);

  return ok({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}
