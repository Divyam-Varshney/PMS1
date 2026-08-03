// ============================================================================
// File: src/app/api/admin-auth/logout/route.ts
// Purpose: Admin logout endpoint — clears the admin cookie.
// ============================================================================

import { clearAdminCookie } from "@/lib/auth";
import { ok } from "@/lib/api";

export async function POST() {
  await clearAdminCookie();
  return ok({ success: true });
}
