// ============================================================================
// File: src/app/api/admin/notifications-list/route.ts
// Purpose: List admin notifications (new orders, prescriptions, manual requests).
//          Supports ?since=<iso> for polling (returns only notifications created
//          after the given timestamp, plus the unread count).
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, unauthorized } from "@/lib/api";

export async function GET(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const url = new URL(req.url);
  const since = url.searchParams.get("since");
  const limit = Math.min(50, parseInt(url.searchParams.get("limit") || "50"));

  const where: any = {};
  if (since) {
    where.createdAt = { gt: new Date(since) };
  }

  const [notifications, unreadCount] = await Promise.all([
    db.adminNotification.findMany({
      where: since ? { createdAt: { gt: new Date(since) } } : {},
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    db.adminNotification.count({ where: { isRead: false } }),
  ]);

  return ok({ notifications, unreadCount, total: notifications.length });
}
