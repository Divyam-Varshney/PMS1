// ============================================================================
// File: src/app/api/admin/app-notifs/analytics/route.ts
// Purpose: Aggregated delivery analytics for the admin dashboard. Returns
//          totals (sent / failed / skipped), per-day series, per-template
//          breakdown, per-category breakdown, plus subscriber counts.
//          Optional `?days=N` query param (default 30, max 90).
// ============================================================================

import { ok, err, unauthorized, paramInt } from "@/lib/api";
import { getAdminFromRequest } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getAnalytics } from "@/lib/app-notifs";

export async function GET(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  if (!hasPermission(admin, "newsletter")) {
    return err("You don't have permission to view App notification analytics", 403);
  }

  const days = Math.min(90, Math.max(1, paramInt(req, "days", 30)));
  const analytics = await getAnalytics(days);
  return ok(analytics);
}
