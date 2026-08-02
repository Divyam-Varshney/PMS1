// ============================================================================
// File: src/lib/loyalty.ts
// Purpose: Loyalty points engine — earn on delivery, redeem at checkout,
//          claw back on cancel/return. All mutations are idempotent and
//          create a LoyaltyTransaction audit row with a running balance.
// Rules:
//   - Earn:   3 points per Rs. 50 spent on grandTotal (rounded down).
//             Awarded when order status becomes "delivered".
//   - Redeem: 1 point = Rs. 1 discount at checkout.
//   - Refund: If a delivered order is cancelled/returned, deduct the
//             previously-earned points (clamped at 0).
// Role: Single source of truth for every loyalty point mutation. Used by
//       the admin order-status route, the checkout route, and the customer
//       loyalty API endpoints.
// ============================================================================

import { db } from "@/lib/db";

/** Earn rate: 3 points per Rs. 50 spent on the order's grandTotal. */
const POINTS_PER_BATCH = 3;
const BATCH_DENOMINATOR = 50;

/** Cash value of a single loyalty point (in Rs.). */
export const POINT_VALUE_RUPEES = 1;

/**
 * Award loyalty points when an order is delivered.
 *
 * Idempotent — if a LoyaltyTransaction of type "earn" already exists for
 * this order, the function returns immediately without re-awarding.
 *
 * Creates a LoyaltyTransaction (type=earn) and increments Customer.loyaltyPoints.
 * Orders without a customer (deleted/anonymised) are skipped silently.
 */
export async function awardOrderPoints(orderId: string): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, orderNumber: true, grandTotal: true, customerId: true },
  });
  if (!order || !order.customerId) return;

  // Idempotency guard — never double-award for the same order.
  const existing = await db.loyaltyTransaction.findFirst({
    where: { orderId: order.id, type: "earn" },
    select: { id: true },
  });
  if (existing) return;

  const points = Math.floor(Number(order.grandTotal) / BATCH_DENOMINATOR) * POINTS_PER_BATCH;
  if (points <= 0) return; // Nothing to award for sub-Rs.10 orders.

  // Atomic: read current balance, write transaction + update customer.
  await db.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({
      where: { id: order.customerId! },
      select: { id: true, loyaltyPoints: true },
    });
    if (!customer) return;

    const newBalance = customer.loyaltyPoints + points;

    await tx.loyaltyTransaction.create({
      data: {
        customerId: customer.id,
        type: "earn",
        points,
        balance: newBalance,
        reason: `Order ${order.orderNumber} delivered`,
        orderId: order.id,
      },
    });

    await tx.customer.update({
      where: { id: customer.id },
      data: { loyaltyPoints: newBalance },
    });
  });
}

/**
 * Deduct previously-earned points if a delivered order is cancelled or returned.
 *
 * Idempotent — looks up the original "earn" transaction for this order and
 * only deducts once. Balance is clamped at 0 (partial deduction if the
 * customer has already spent some of the earned points).
 *
 * Creates a LoyaltyTransaction (type=adjust, negative points) and updates
 * Customer.loyaltyPoints.
 */
export async function clawbackOrderPoints(orderId: string): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, orderNumber: true, customerId: true },
  });
  if (!order || !order.customerId) return;

  // Find the original earn transaction for this order.
  const earnTxn = await db.loyaltyTransaction.findFirst({
    where: { orderId: order.id, type: "earn" },
    select: { id: true, points: true },
  });
  if (!earnTxn) return; // Nothing was ever awarded — nothing to claw back.

  // Idempotency guard — has a clawback already been recorded for this order?
  const existingClawback = await db.loyaltyTransaction.findFirst({
    where: { orderId: order.id, type: "adjust", reason: { startsWith: "Clawback" } },
    select: { id: true },
  });
  if (existingClawback) return;

  await db.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({
      where: { id: order.customerId! },
      select: { id: true, loyaltyPoints: true },
    });
    if (!customer) return;

    // Clamp at 0 — the customer may have already redeemed some of these points.
    const deduction = Math.min(earnTxn.points, customer.loyaltyPoints);
    if (deduction <= 0) return; // Balance already at 0; record nothing.

    const newBalance = customer.loyaltyPoints - deduction;

    await tx.loyaltyTransaction.create({
      data: {
        customerId: customer.id,
        type: "adjust",
        points: -deduction,
        balance: newBalance,
        reason: `Clawback: order ${order.orderNumber} cancelled/returned`,
        orderId: order.id,
      },
    });

    await tx.customer.update({
      where: { id: customer.id },
      data: { loyaltyPoints: newBalance },
    });
  });
}

/**
 * Redeem loyalty points at checkout.
 *
 * Validates the customer has sufficient balance, deducts the points, and
 * creates a LoyaltyTransaction (type=redeem, negative points) linked to
 * the supplied orderId.
 *
 * @returns The discount amount in Rs. (points × POINT_VALUE_RUPEES).
 * @throws Error if points <= 0 or the customer's balance is insufficient.
 */
export async function redeemPoints(
  customerId: string,
  points: number,
  orderId: string
): Promise<number> {
  if (!Number.isInteger(points) || points <= 0) {
    throw new Error("Points to redeem must be a positive integer");
  }

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { orderNumber: true, customerId: true },
  });
  if (!order) throw new Error("Order not found");
  if (order.customerId !== customerId) {
    throw new Error("Order does not belong to this customer");
  }

  await db.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({
      where: { id: customerId },
      select: { loyaltyPoints: true },
    });
    if (!customer) throw new Error("Customer not found");
    if (customer.loyaltyPoints < points) {
      throw new Error(
        `Insufficient loyalty points (have ${customer.loyaltyPoints}, need ${points})`
      );
    }

    const newBalance = customer.loyaltyPoints - points;

    await tx.loyaltyTransaction.create({
      data: {
        customerId,
        type: "redeem",
        points: -points,
        balance: newBalance,
        reason: `Redeemed on order ${order.orderNumber}`,
        orderId,
      },
    });

    await tx.customer.update({
      where: { id: customerId },
      data: { loyaltyPoints: newBalance },
    });
  });

  // 1 point = Rs. 1 discount.
  return points * POINT_VALUE_RUPEES;
}

/**
 * Get a customer's loyalty transaction history (newest first).
 *
 * Returns an array of LoyaltyTransaction records — caller may shape them
 * for display. Returns an empty array for unknown customers.
 */
export async function getLoyaltyHistory(
  customerId: string,
  limit = 20
): Promise<any[]> {
  return db.loyaltyTransaction.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Compute how many points a given order's grandTotal would earn.
 * Pure helper — does not write to the DB. Used for "You'll earn X points"
 * prompts on the cart/checkout UI.
 */
export function computeEarnablePoints(grandTotal: number): number {
  if (!Number.isFinite(grandTotal) || grandTotal <= 0) return 0;
  return Math.floor(grandTotal / BATCH_DENOMINATOR) * POINTS_PER_BATCH;
}
