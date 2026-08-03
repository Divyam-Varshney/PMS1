// ============================================================================
// File: src/app/api/admin/app-notifs/retry/route.ts
// Purpose: Admin endpoint — retry failed App notifications. Finds failed
//          logs with retryCount < 3 and re-sends them via sendPushToCustomer.
//          Used by the admin App Notification Center "Retry Failed" button.
// ============================================================================

import { ok, err, unauthorized, paramInt } from "@/lib/api";
import { getAdminFromRequest } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { retryFailedNotifications } from "@/lib/app-notifs";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  if (!hasPermission(admin, "newsletter")) {
    return err("You don't have permission to retry notifications", 403);
  }

  const limit = Math.min(200, Math.max(1, paramInt(req, "limit", 50)));
  const result = await retryFailedNotifications(limit);

  return ok(result);
}
