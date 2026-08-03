// ============================================================================
// File: src/app/api/customer/loyalty/route.ts
// Purpose: GET returns the current customer's loyalty balance + recent
//          transactions. Powers the Loyalty Points card on the Profile view
//          and the loyalty redemption section on the Checkout view.
// ============================================================================

import { db } from "@/lib/db";
import { ok, unauthorized } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth";
import { getLoyaltyHistory } from "@/lib/loyalty";

export async function GET() {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login");

  // Fetch the authoritative balance (the auth helper's select clause
  // doesn't include loyaltyPoints, so we re-query here).
  const full = await db.customer.findUnique({
    where: { id: customer.id },
    select: { loyaltyPoints: true },
  });
  if (!full) return unauthorized("Please login");

  const transactions = await getLoyaltyHistory(customer.id, 20);

  return ok({
    balance: full.loyaltyPoints,
    // 1 point = Rs. 1 — convenience for the UI.
    balanceValue: full.loyaltyPoints,
    transactions,
  });
}
