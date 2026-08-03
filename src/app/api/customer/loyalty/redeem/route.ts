// ============================================================================
// File: src/app/api/customer/loyalty/redeem/route.ts
// Purpose: POST { points } — pre-validates that the customer has enough
//          loyalty points to redeem the requested amount at checkout.
//          Does NOT actually deduct — the deduction happens in the
//          /api/checkout route via redeemPoints() when the order is placed.
// Role: Used by the Checkout view's "Apply" button to preview whether the
//       requested redemption is valid before the customer clicks "Place order".
// ============================================================================

import { db } from "@/lib/db";
import { ok, err, unauthorized, parseBody } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth";
import { POINT_VALUE_RUPEES } from "@/lib/loyalty";

export async function POST(req: Request) {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login");

  const body = await parseBody<{ points?: number }>(req);
  if (!body || typeof body.points !== "number") {
    return err("Points to redeem is required");
  }

  const points = Math.floor(body.points);
  if (!Number.isFinite(points) || points <= 0) {
    return err("Points to redeem must be a positive number");
  }

  const full = await db.customer.findUnique({
    where: { id: customer.id },
    select: { loyaltyPoints: true },
  });
  if (!full) return unauthorized("Please login");

  if (full.loyaltyPoints < points) {
    return err(
      `Insufficient loyalty points. You have ${full.loyaltyPoints} point(s).`
    );
  }

  const discount = points * POINT_VALUE_RUPEES;
  return ok({
    valid: true,
    points,
    discount,
    remainingBalance: full.loyaltyPoints - points,
  });
}
