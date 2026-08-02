// ============================================================================
// File: src/app/api/customer/orders/route.ts
// Purpose: List the current customer's past orders, newest first, with items.
// Role: Powers the OrdersView list.
// ============================================================================

import { db } from "@/lib/db";
import { ok, unauthorized } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth";

export async function GET() {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login");

  const orders = await db.order.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentMethod: true,
      paymentStatus: true,
      grandTotal: true,
      deliveryCharge: true,
      createdAt: true,
      // Stage timestamps for the tracking timeline
      confirmedAt: true,
      packedAt: true,
      outForDeliveryAt: true,
      deliveredAt: true,
      cancelledAt: true,
      // ETA + delivery zone
      estimatedDelivery: true,
      shipLocality: true,
      // Pricing breakdown
      voucherCode: true,
      voucherDiscount: true,
      loyaltyDiscount: true,
      // Product-level discount (MRP - selling * qty aggregated for the order).
      // Used by the profile view to compute "Total Savings".
      productDiscount: true,
      // Source links
      source: true,
      prescriptionId: true,
      items: {
        select: {
          id: true,
          name: true,
          qty: true,
          image: true,
          lineTotal: true,
        },
        take: 4,
      },
      _count: { select: { items: true } },
    },
  });
  return ok(orders);
}
