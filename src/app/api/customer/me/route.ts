// ============================================================================
// File: src/app/api/customer/me/route.ts
// Purpose: Return the current customer's profile + addresses + counts.
// Role: Powers AccountView, header account menu, address pickers.
// ============================================================================

import { ok, unauthorized } from "@/lib/api";
import { getCustomerProfileFromRequest } from "@/lib/auth";

export async function GET() {
  // Use the full profile lookup (identity + addresses + _count) — single query.
  // This route is the ONLY consumer of the heavy profile fetch; every other
  // authenticated API uses the lightweight getCustomerFromRequest().
  const customer = await getCustomerProfileFromRequest();
  if (!customer) return unauthorized("Please login");
  return ok(customer);
}
