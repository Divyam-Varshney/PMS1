// ============================================================================
// File: src/app/api/checkout/razorpay/route.ts
// Purpose: Create a Razorpay order for an existing PMS order (placed via
//          /api/checkout with paymentMethod="razorpay"). Returns the details
//          the client needs to open the Razorpay checkout modal:
//            { razorpayOrderId, amount, currency, keyId }
// Role: Called by the checkout page AFTER /api/checkout succeeds, immediately
//       before opening the Razorpay modal.
// ============================================================================

import { db } from "@/lib/db";
import { ok, err, unauthorized, forbidden, notFound, parseBody } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth";
import { createRazorpayOrder, getRazorpayKeyId, tryGetRazorpayConfig } from "@/lib/razorpay";

export async function POST(req: Request) {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login to pay");

  const body = await parseBody<{ orderId?: string }>(req);
  if (!body?.orderId) return err("Order id is required");

  // Load the order — must belong to this customer and use the Razorpay method.
  const order = await db.order.findUnique({
    where: { id: body.orderId },
    select: {
      id: true,
      orderNumber: true,
      customerId: true,
      grandTotal: true,
      paymentMethod: true,
      paymentStatus: true,
      status: true,
    },
  });
  if (!order) return notFound("Order not found");
  if (order.customerId !== customer.id) return forbidden();
  if (order.paymentMethod !== "razorpay") {
    return err("This order is not a Razorpay order", 400);
  }

  // Refuse if the order is already paid or has been cancelled — re-initiating
  // a Razorpay order for those states makes no sense and would confuse the
  // customer (and create dangling orders in the Razorpay dashboard).
  if (order.paymentStatus === "paid") {
    return err("This order has already been paid", 400);
  }
  if (order.status === "cancelled") {
    return err("This order has been cancelled", 400);
  }

  // Verify Razorpay is configured before we do anything else — saves a
  // round-trip to Razorpay if creds are missing.
  const cfg = await tryGetRazorpayConfig();
  if (!cfg) {
    return err(
      "Online payments are not configured. Please choose another payment method or contact support.",
      503
    );
  }

  // Create the Razorpay order (amount in rupees → SDK converts to paise).
  let razorpayOrder;
  try {
    razorpayOrder = await createRazorpayOrder(Number(order.grandTotal), order.id);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to create Razorpay order";
    return err(message, 502);
  }

  // Persist the Razorpay order id on our order so the verify endpoint can
  // cross-check it. We store it in paymentId (which is nullable) — the verify
  // endpoint will overwrite this with the actual razorpay_payment_id once
  // payment succeeds. We also stash the full id in a status-history note for
  // auditability in case the customer abandons the modal.
  await db.order.update({
    where: { id: order.id },
    data: { paymentId: razorpayOrder.id },
  });
  await db.orderStatusHistory.create({
    data: {
      orderId: order.id,
      status: order.status,
      note: `Razorpay order created: ${razorpayOrder.id} (Rs. ${Number(order.grandTotal).toFixed(2)})`,
      createdBy: "system",
    },
  });

  const keyId = await getRazorpayKeyId();
  return ok({
    razorpayOrderId: razorpayOrder.id,
    amount: razorpayOrder.amount, // paise — passed straight to the modal
    currency: razorpayOrder.currency,
    keyId,
    orderId: order.id,
    orderNumber: order.orderNumber,
  });
}
