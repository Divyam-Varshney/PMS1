// ============================================================================
// File: src/app/api/admin/notifications-list/mark-all-read/route.ts
// Purpose: Mark ALL admin notifications as read in one operation.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, unauthorized } from "@/lib/api";

export async function POST() {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const result = await db.adminNotification.updateMany({
    where: { isRead: false },
    data: { isRead: true },
  });

  return ok({ marked: result.count });
}
