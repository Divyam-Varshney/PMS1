// ============================================================================
// File: src/app/api/cart/route.ts
// Purpose: GET returns the current customer's cart with full pricing breakdown
//          via the pricing engine. Returns an empty cart if not logged in
//          (guest browsing allowed).
// Role: Powers CartSheet, CartView, and the header cart count.
// ============================================================================

import { ok } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth";
import { buildCartResponse } from "./_lib";

export async function GET() {
  const customer = await getCustomerFromRequest();
  if (!customer) {
    // Guest browsing — return an empty cart so the UI doesn't 401
    return ok({
      id: null,
      voucherCode: null,
      items: [],
      pricing: {
        lines: [],
        itemsTotal: 0,
        productDiscount: 0,
        subtotalAfterDiscount: 0,
        voucherDiscount: 0,
        voucherValid: false,
        voucherError: undefined,
        totalAfterVoucher: 0,
        upgradeThreshold: 0,
        upgraded: false,
      },
      delivery: { charge: 0, free: true, serviceable: true, freeAbove: null },
      grandTotal: 0,
    });
  }
  const cart = await buildCartResponse(customer.id);
  return ok(cart);
}
