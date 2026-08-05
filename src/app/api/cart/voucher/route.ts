// ============================================================================
// File: src/app/api/cart/voucher/route.ts
// Purpose: Apply or remove a voucher code on the customer's cart.
//          POST { code } → apply voucher (validates + saves to cart.voucherCode)
//          DELETE → remove voucher
// ============================================================================

import { db } from "@/lib/db";
import { ok, err, unauthorized, parseBody } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth";
import { buildCartResponse } from "../_lib";

export async function POST(req: Request) {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login to apply a voucher");

  const body = await parseBody<{ code: string }>(req);
  if (!body?.code) return err("Voucher code is required");

  const code = body.code.toUpperCase().trim();
  const voucher = await db.voucher.findUnique({ where: { code } });
  if (!voucher) return err("Invalid voucher code");
  if (!voucher.isActive) return err("This voucher is no longer active");

  // Save the voucher code on the cart so the pricing engine can validate it
  // fully (expiry, usage limits, min order, scope) when building the response.
  await db.cart.update({
    where: { customerId: customer.id },
    data: { voucherCode: code },
  });

  const cart = await buildCartResponse(customer.id);
  // If the engine marked the voucher invalid (min order not met, expired,
  // usage limit hit, scope mismatch, etc.), CLEAR the voucherCode from the
  // cart so it doesn't persist across future cart updates / page refreshes.
  // The customer can re-apply once their cart meets the criteria.
  if (cart.pricing.voucherError) {
    await db.cart.update({
      where: { customerId: customer.id },
      data: { voucherCode: null },
    });
    return err(cart.pricing.voucherError);
  }
  return ok(cart);
}

export async function DELETE() {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login");

  await db.cart.update({
    where: { customerId: customer.id },
    data: { voucherCode: null },
  });

  const cart = await buildCartResponse(customer.id);
  return ok(cart);
}
