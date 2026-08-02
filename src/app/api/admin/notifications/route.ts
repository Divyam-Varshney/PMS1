// ============================================================================
// File: src/app/api/admin/notifications/route.ts
// Purpose: List notification logs with channel filter & search.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, unauthorized, param, paramInt } from "@/lib/api";

export async function GET(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const channel = param(req, "channel");
  const search = param(req, "search")?.trim();
  const page = Math.max(1, paramInt(req, "page", 1));
  const pageSize = Math.min(100, paramInt(req, "pageSize", 20));

  const where: any = {};
  if (channel) where.channel = channel;
  if (search) {
    where.OR = [
      { to: { contains: search } },
      { subject: { contains: search } },
      { templateKey: { contains: search } },
    ];
  }

  const [total, items] = await Promise.all([
    db.notificationLog.count({ where }),
    db.notificationLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { customer: { select: { id: true, name: true } } },
    }),
  ]);

  return ok({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}
