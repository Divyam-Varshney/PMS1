// ============================================================================
// File: src/app/api/auth/logout/route.ts
// Purpose: Clear the customer session cookie.
// Role: Logs the customer out.
// ============================================================================

import { okNoCache } from "@/lib/api";
import { clearCustomerCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  await clearCustomerCookie();
  return okNoCache({ success: true });
}
