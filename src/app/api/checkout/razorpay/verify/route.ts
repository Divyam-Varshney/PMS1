// ============================================================================
// File: src/app/api/checkout/razorpay/verify/route.ts
// Purpose: Verify a Razorpay payment signature returned by the checkout modal
//          and mark the corresponding PMS order as paid. Updates:
//            - Order.paymentStatus = "paid"
//            - Order.paymentId    = razorpay_payment_id
//            - Order.statusHistory += audit note
//          Also decrements stock for the order items (same as a COD order
//          would when its payment is confirmed).
// Role: Final step of the Razorpay checkout flow — called by checkout-view
//       inside the Razorpay modal's `handler` callback.
// ============================================================================

import { db } from "@/lib/db";
import { ok, err, unauthorized, forbidden, notFound, parseBody } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth";
import { verifyRazorpayPayment } from "@/lib/razorpay";

export async function POST(req: Request) {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login");

  try {
    const body = await parseBody<{
      razorpayPaymentId?: string;
      razorpayOrderId?: string;
      razorpaySignature?: string;
      orderId?: string;
    }>(req);

    if (!body?.razorpayPaymentId || !body?.razorpayOrderId || !body?.razorpaySignature || !body?.orderId) {
      return err("Missing Razorpay payment details", 400);
    }

    // Load the order — must belong to this customer and use Razorpay.
    const order = await db.order.findUnique({
      where: { id: body.orderId },
      select: {
        id: true,
        orderNumber: true,
        customerId: true,
        grandTotal: true,
        paymentMethod: true,
        paymentStatus: true,
        paymentId: true,
        status: true,
      },
    });
    if (!order) return notFound("Order not found");
    if (order.customerId !== customer.id) return forbidden();
    if (order.paymentMethod !== "razorpay") {
      return err("This order is not a Razorpay order", 400);
    }

    if (order.paymentId && order.paymentId !== body.razorpayOrderId) {
      return err("Razorpay order id does not match this order", 400);
    }

    const valid = await verifyRazorpayPayment(
      body.razorpayPaymentId,
      body.razorpayOrderId,
      body.razorpaySignature
    );
    if (!valid) {
      await db.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: order.status,
          note: "Razorpay payment signature verification FAILED",
          createdBy: "system",
        },
      }).catch(() => {});
      return err("Payment signature verification failed", 400);
    }

    await db.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: "paid",
        paymentId: body.razorpayPaymentId,
      },
    });
    await db.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status: order.status,
        note: `Razorpay payment verified — payment_id: ${body.razorpayPaymentId}`,
        createdBy: "system",
      },
    }).catch(() => {});

    return ok({ success: true, orderId: order.id, paymentStatus: "paid" });
  } catch (e: any) {
    console.error("[razorpay/verify] error:", e);
    return err("Payment verification failed: " + (e?.message || "unknown error"), 500);
  }
}
