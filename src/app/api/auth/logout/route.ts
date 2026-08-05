// ============================================================================
// File: src/app/api/auth/logout/route.ts
// Purpose: Clear the customer session cookie + invalidate the in-process
//          identity cache so the next request doesn't see a stale entry.
// Role: Logs the customer out.
// ============================================================================

import { okNoCache } from "@/lib/api";
import { clearCustomerCookie, invalidateCustomerIdentityCache, CUSTOMER_COOKIE } from "@/lib/auth";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST() {
  // Read the token before clearing the cookie so we can invalidate the cache.
  const c = await cookies();
  const token = c.get(CUSTOMER_COOKIE)?.value;
  if (token) {
    invalidateCustomerIdentityCache(token);
  }
  await clearCustomerCookie();
  return okNoCache({ success: true });
}
