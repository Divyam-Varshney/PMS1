// ============================================================================
// File: src/app/api/admin-auth/me/route.ts
// Purpose: Return the currently authenticated admin (or 401).
// CRITICAL: Must be dynamic + no-cache to prevent stale auth state.
// ============================================================================

import { getAdminFromRequest } from "@/lib/auth";
import { okNoCache, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  return okNoCache(admin);
}
