// ============================================================================
// File: src/app/api/wishlist/[productId]/route.ts
// Purpose: Remove a single product from the customer's wishlist.
// Role: DELETE endpoint called by the heart toggle when unfavoriting.
// ============================================================================

import { db } from "@/lib/db";
import { getCustomerFromRequest } from "@/lib/auth";
import { ok, unauthorized } from "@/lib/api";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized();
  const { productId } = await params;
  await db.wishlistItem.deleteMany({
    where: { customerId: customer.id, productId },
  });
  return ok({ wished: false, productId });
}
