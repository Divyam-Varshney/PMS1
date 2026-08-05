// ============================================================================
// File: src/app/api/admin/customers/[id]/loyalty/route.ts
// Purpose: Admin-only manual adjustment of a customer's loyalty points
//          balance. Each adjustment is recorded as a LoyaltyTransaction
//          (type="adjust") with a running balance, so the audit trail stays
//          intact regardless of who mutates the balance (engine vs admin).
// Rules:
//   - POST { points, reason } — points can be positive (credit) or negative
//     (debit). The resulting balance is clamped at 0 — a debit larger than
//     the current balance simply zeros it out.
//   - Returns the new balance + the created transaction row.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, notFound, parseBody } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;

  const body = await parseBody<{ points?: number; reason?: string }>(req);
  if (!body) return err("Invalid body", 400);

  const points = Number(body.points);
  if (!Number.isFinite(points) || points === 0) {
    return err("points must be a non-zero number", 400);
  }
  const reason = (body.reason || "").trim();
  if (!reason) {
    return err("reason is required", 400);
  }
  if (reason.length > 200) {
    return err("reason must be 200 characters or fewer", 400);
  }

  // Run as a transaction so the balance read + LoyaltyTransaction insert +
  // customer update stay consistent — no concurrent order-delivery point
  // award can interleave and leave a wrong running balance.
  const result = await db.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({
      where: { id },
      select: { id: true, name: true, loyaltyPoints: true },
    });
    if (!customer) return { notFound: true } as const;

    // Clamp at 0 — never let a debit push the balance negative.
    const newBalance = Math.max(0, customer.loyaltyPoints + points);
    const actualDelta = newBalance - customer.loyaltyPoints;

    // If the clamp ate part of the delta (e.g. -50 from a balance of 30 →
    // actualDelta is -30, not -50), record the actual delta applied so the
    // audit trail reflects what really happened to the balance.
    const txn = await tx.loyaltyTransaction.create({
      data: {
        customerId: customer.id,
        type: "adjust",
        points: actualDelta,
        balance: newBalance,
        reason: `Admin adjustment by ${admin.email}: ${reason}`,
      },
    });

    const updated = await tx.customer.update({
      where: { id: customer.id },
      data: { loyaltyPoints: newBalance },
      select: { id: true, loyaltyPoints: true },
    });

    return {
      notFound: false as const,
      previousBalance: customer.loyaltyPoints,
      newBalance: updated.loyaltyPoints,
      pointsApplied: actualDelta,
      pointsRequested: points,
      transaction: txn,
    };
  });

  if ("notFound" in result && result.notFound) return notFound("Customer not found");

  return ok(result);
}
