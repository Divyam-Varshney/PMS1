// ============================================================================
// File: src/app/api/admin-auth/logout/route.ts
// Purpose: Admin logout endpoint — clears the admin cookie + invalidates the
//          in-process identity cache.
// ============================================================================

import { clearAdminCookie, invalidateAdminIdentityCache, ADMIN_COOKIE } from "@/lib/auth";
import { ok } from "@/lib/api";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST() {
  const c = await cookies();
  const token = c.get(ADMIN_COOKIE)?.value;
  if (token) {
    invalidateAdminIdentityCache(token);
  }
  await clearAdminCookie();
  return ok({ success: true });
}
