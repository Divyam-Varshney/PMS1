// ============================================================================
// File: src/app/api/checkout/route.ts
// Purpose: Place an order from the current customer's cart.
//          - Enforces store open status (isStoreOpen).
//          - Loads cart, builds EngineLineInput[], runs calculateOrderTotals
//            (new pricing engine: margin-protected discount + voucher + delivery).
//          - Creates Order + OrderItem snapshot + OrderStatusHistory (pending).
//          - Increments Voucher.usedCount + creates VoucherUsage record.
//          - Clears the cart.
//          - Sends order_confirmed notification.
// Role: Single end-to-end checkout endpoint for the customer site.
// ============================================================================

import { db } from "@/lib/db";
import { ok, err, unauthorized, parseBody } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth";
import { isStoreOpen, getSetting } from "@/lib/settings";
import { calculateOrderTotals, EngineLineInput } from "@/lib/pricing-engine";
import { sendOrderNotification } from "@/lib/notifications";
import { createAdminNotification } from "@/lib/admin-notifications";
import { sendAutoNotification } from "@/lib/app-notifs";
import { generateOrderNumber } from "@/lib/format";
import { PAYMENT_METHOD, PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { redeemPoints } from "@/lib/loyalty";

export async function POST(req: Request) {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login to place an order");

  // Enforce store open status — closed stores cannot accept orders
  const open = await isStoreOpen();
  if (!open) {
    const closedMessage = await getSetting<string>("store.closedMessage");
    return err(closedMessage || "Store is currently closed.", 400);
  }

  const body = await parseBody<{
    addressId?: string;
    paymentMethod?: string;
    notes?: string;
    loyaltyPoints?: number;
  }>(req);
  if (!body?.addressId) return err("Please select a delivery address");
  if (!body.paymentMethod) return err("Please select a payment method");

  // Validate loyalty redemption request up-front.
  let loyaltyPointsToRedeem = 0;
  if (body.loyaltyPoints != null) {
    const requested = Math.floor(body.loyaltyPoints);
    if (!Number.isFinite(requested) || requested < 0) {
      return err("Invalid loyalty points value");
    }
    if (requested > 0) {
      const loyaltyCustomer = await db.customer.findUnique({
        where: { id: customer.id },
        select: { loyaltyPoints: true },
      });
      if (!loyaltyCustomer) return unauthorized("Please login");
      if (loyaltyCustomer.loyaltyPoints < requested) {
        return err(
          `Insufficient loyalty points. You have ${loyaltyCustomer.loyaltyPoints} point(s).`
        );
      }
      loyaltyPointsToRedeem = requested;
    }
  }

  // Parallel-fetch all the data we need for checkout validation.
  // Previously these were 3-4 sequential awaits, each adding ~30-50ms.
  const needsLoyaltyCheck = loyaltyPointsToRedeem !== null && loyaltyPointsToRedeem > 0;

  const [loyaltyCustomer, pm, address, cart] = await Promise.all([
    needsLoyaltyCheck
      ? db.customer.findUnique({
          where: { id: customer.id },
          select: { loyaltyPoints: true },
        })
      : Promise.resolve(null),
    db.paymentMethod.findUnique({ where: { key: body.paymentMethod } }),
    db.address.findFirst({
      where: { id: body.addressId, customerId: customer.id },
    }),
    db.cart.findUnique({
      where: { customerId: customer.id },
      include: { items: { include: { product: true } } },
    }),
  ]);

  // Validate loyalty points (if requested)
  if (needsLoyaltyCheck) {
    if (!loyaltyCustomer) return unauthorized("Please login");
    if (loyaltyCustomer.loyaltyPoints < loyaltyPointsToRedeem!) {
      return err(
        `Insufficient loyalty points. You have ${loyaltyCustomer.loyaltyPoints} point(s).`
      );
    }
  }

  // Validate payment method
  if (!pm || !pm.isActive) {
    return err("This payment method is not available. Please choose another.");
  }

  // Validate address
  if (!address) return err("Delivery address not found");

  // Validate cart
  if (!cart || cart.items.length === 0) {
    return err("Your cart is empty");
  }

  // Build engine inputs — new margin-protected model fields
  const inputs: EngineLineInput[] = cart.items.map((item) => ({
    productId: item.productId,
    name: item.product.name,
    sku: item.product.sku,
    image: item.product.primaryImage,
    qty: item.quantity,
    mrp: Number(item.product.mrp),
    sellingPrice: Number(item.product.sellingPrice),
    baseDiscountPct: Number(item.product.baseDiscountPct ?? 0),
    maxDiscountPct: Number(item.product.maxDiscountPct ?? 0),
    categoryId: item.product.categoryId,
    brandId: item.product.brandId,
    isGeneric: item.product.isGeneric,
  }));

  const loyaltyDiscount = loyaltyPointsToRedeem;
  const totals = await calculateOrderTotals(inputs, {
    voucherCode: cart.voucherCode ?? undefined,
    customerId: customer.id,
    locality: address.locality ?? undefined,
    pincode: address.pincode,
    loyaltyDiscount,
  });

  // Refuse checkout if delivery is not serviceable for the address
  if (!totals.deliveryCharge && totals.deliveryZone === undefined) {
    // No zone matched — the engine returns charge=0, zone=undefined, serviceable=false
    // Re-run the delivery check to get the message
    return err("Delivery is not available for your selected address. Please choose a different address or contact us.");
  }

  const finalGrandTotal = totals.grandTotal;
  const loyaltyPointsRedeemed =
    loyaltyDiscount > 0 ? Math.round(loyaltyDiscount) : 0;

  // Estimated delivery — unified formula using zone's ETA.
  // Phase 42.3: Single source of truth — no random fallback, no 60min cap.
  // If zone has estimatedHours, use it directly (convert to minutes).
  // If no zone matched, use 45 minutes as a sensible default for Mathura.
  const deliveryMinutes = totals.deliveryEstimatedHours
    ? Math.max(15, Math.round(totals.deliveryEstimatedHours * 60))
    : 45; // default for unmatched zone
  const estimatedDelivery = new Date(Date.now() + deliveryMinutes * 60 * 1000);

  const orderNumber = generateOrderNumber();
  const order = await db.order.create({
    data: {
      orderNumber,
      customerId: customer.id,
      addressId: address.id,
      shipName: customer.name,
      shipPhone: address.phone || customer.phone,
      shipLine1: address.line1,
      shipLine2: address.line2,
      shipCity: address.city,
      shipDistrict: address.district,
      shipState: address.state,
      shipPincode: address.pincode,
      shipLocality: address.locality,
      itemsTotal: totals.itemsTotal,
      productDiscount: totals.productDiscount,
      voucherDiscount: totals.voucherDiscount,
      deliveryCharge: totals.deliveryCharge,
      taxTotal: totals.taxTotal,
      grandTotal: finalGrandTotal,
      roundOff: totals.roundOff,
      loyaltyPointsRedeemed,
      loyaltyDiscount,
      voucherCode: totals.voucherValid ? totals.voucherCode : null,
      status: "pending",
      paymentMethod: body.paymentMethod,
      paymentStatus: "pending",
      source: "cart",
      notes: body.notes,
      estimatedDelivery,
      items: {
        create: totals.lines.map((line) => ({
          productId: line.productId,
          name: line.name,
          sku: line.sku,
          image: line.image,
          qty: line.qty,
          mrp: line.mrp,
          sellingPrice: line.sellingPrice,
          appliedDiscountPct: line.appliedDiscountPct,
          discountAmount: line.discountAmount,
          lineTotal: line.finalLineTotal,
        })),
      },
      statusHistory: {
        create: { status: "pending", note: "Order placed by customer", createdBy: "system" },
      },
    },
    include: { items: true },
  });

  // Decrement stock for each ordered item — done in parallel for performance.
  // We use Prisma's atomic `decrement` operator so concurrent checkouts don't
  // race. Items without a productId are skipped. Stock can go negative only if
  // the catalog was edited between cart-add and checkout; the dashboard's
  // low-stock + out-of-stock alerts surface those.
  await Promise.all(
    order.items
      .filter((item) => item.productId)
      .map((item) =>
        db.product.update({
          where: { id: item.productId! },
          data: { stock: { decrement: item.qty } },
        }).catch((e) => {
          console.error(`[checkout] stock decrement failed for product ${item.productId}:`, e);
        })
      )
  );

  // Increment voucher usage + create VoucherUsage record
  if (totals.voucherValid && totals.voucherCode) {
    const voucher = await db.voucher.findUnique({ where: { code: totals.voucherCode } });
    if (voucher) {
      await db.voucher.update({
        where: { id: voucher.id },
        data: { usedCount: { increment: 1 } },
      });
      await db.voucherUsage.create({
        data: {
          voucherId: voucher.id,
          customerId: customer.id,
          orderId: order.id,
        },
      });
    }
  }

  // Clear the cart
  await db.cartItem.deleteMany({ where: { cartId: cart.id } });
  await db.cart.update({
    where: { id: cart.id },
    data: { voucherCode: null },
  });

  // Deduct redeemed loyalty points
  if (loyaltyPointsRedeemed > 0) {
    try {
      await redeemPoints(customer.id, loyaltyPointsRedeemed, order.id);
    } catch (e) {
      console.error("[loyalty] redeemPoints failed after checkout:", e);
    }
  }

  // Send order placed notification (NOT "order_confirmed" — that template is
  // sent when the admin changes the status to "confirmed". Using "order_placed"
  // here avoids duplicate emails: the customer gets "order_placed" now, and
  // "order_confirmed" when the admin actually confirms the order.)
  const paymentLabel = pm.label;
  await sendOrderNotification(
    { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone },
    "order_placed",
    {
      name: customer.name,
      orderNumber,
      amount: finalGrandTotal.toFixed(2),
      paymentMethod: paymentLabel,
    }
  );

  // Send App (Web Push) notification — order_placed.
  // Skips silently if the customer hasn't subscribed to push on any device
  // or has disabled notifications in their preferences.
  await sendAutoNotification(
    customer.id,
    "order_placed",
    {
      name: customer.name,
      orderNumber,
      amount: finalGrandTotal.toFixed(2),
      paymentMethod: paymentLabel,
    },
    { orderId: order.id, orderNumber, amount: finalGrandTotal.toFixed(2) }
  ).catch((e) => console.error("[checkout] sendAutoNotification failed:", e));

  // Create admin notification
  await createAdminNotification({
    type: "new_order",
    title: `New Order: ${orderNumber}`,
    message: `${customer.name} placed an order of Rs. ${finalGrandTotal.toFixed(2)} (${paymentLabel})`,
    refId: order.id,
    refType: "order",
    customerName: customer.name,
    emailDetails: [
      `Order Number: ${orderNumber}`,
      `Customer: ${customer.name} (${customer.email}, ${customer.phone})`,
      `Payment Method: ${paymentLabel}`,
      `Grand Total: Rs. ${finalGrandTotal.toFixed(2)}`,
      totals.voucherValid && totals.voucherCode
        ? `Voucher Applied: ${totals.voucherCode} (-Rs. ${totals.voucherDiscount.toFixed(2)})`
        : "",
      loyaltyPointsRedeemed > 0
        ? `Loyalty Redeemed: ${loyaltyPointsRedeemed} pts (-Rs. ${loyaltyDiscount.toFixed(2)})`
        : "",
      `Delivery: ${totals.deliveryZoneName ?? "Standard"} (Rs. ${totals.deliveryCharge.toFixed(2)})`,
      `Items: ${inputs.length}`,
      body.notes ? `Notes: ${body.notes}` : "",
    ].filter(Boolean).join("\n"),
  });

  return ok(order);
}
