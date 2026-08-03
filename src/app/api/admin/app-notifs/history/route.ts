// ============================================================================
// File: src/app/api/admin/app-notifs/history/route.ts
// Purpose: Admin list of ALL AppNotifLog rows (across all customers) with
//          optional filters (status, category, templateKey, customerId).
//          Used by the admin App Notification Center → History tab.
//          Paginated (default 50, max 100), newest first.
// ============================================================================

import { db } from "@/lib/db";
import { ok, err, unauthorized, paramInt, param } from "@/lib/api";
import { getAdminFromRequest } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export async function GET(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  if (!hasPermission(admin, "newsletter")) {
    return err("You don't have permission to view App notification history", 403);
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || undefined;
  const category = url.searchParams.get("category") || undefined;
  const templateKey = url.searchParams.get("templateKey") || undefined;
  const customerId = url.searchParams.get("customerId") || undefined;
  const page = Math.max(1, paramInt(req, "page", 1));
  const pageSize = Math.min(100, Math.max(1, paramInt(req, "pageSize", 50)));

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (category) where.category = category;
  if (templateKey) where.templateKey = templateKey;
  if (customerId) where.customerId = customerId;

  const [items, total] = await Promise.all([
    db.appNotifLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        customerId: true,
        templateId: true,
        templateKey: true,
        title: true,
        body: true,
        category: true,
        status: true,
        error: true,
        metadata: true,
        createdAt: true,
        customer: { select: { id: true, name: true, email: true, phone: true } },
      },
    }),
    db.appNotifLog.count({ where }),
  ]);

  return ok({
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}
