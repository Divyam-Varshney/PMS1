// ============================================================================
// File: src/app/api/customer/refill-reminders/route.ts
// Purpose: GET lists the customer's prescription refill reminders (sorted by
//          nextRefillDate ascending). POST manually creates a refill reminder.
//          DELETE removes a reminder by id (passed via ?id=).
//
// Auto-creation hook: when an admin marks an order as "delivered" and the
// order contains prescriptionRequired items, a RefillReminder is auto-created
// for each unique Rx product. That hook lives in
// src/app/api/admin/orders/[id]/status/route.ts (added by Task 7).
// ============================================================================

import { db } from "@/lib/db";
import { ok, err, unauthorized, parseBody, param } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DEFAULT_DAYS_SUPPLY = 30;

export async function GET() {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login");

  const reminders = await db.refillReminder.findMany({
    where: { customerId: customer.id, isActive: true },
    orderBy: [{ nextRefillDate: "asc" }],
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          primaryImage: true,
          sellingPrice: true,
          mrp: true,
          stock: true,
          prescriptionRequired: true,
          brand: { select: { id: true, name: true } },
        },
      },
    },
  });

  return ok({ items: reminders });
}

export async function POST(req: Request) {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login");

  const body = await parseBody<{
    productId?: string;
    orderId?: string | null;
    daysSupply?: number;
    lastOrdered?: string;
  }>(req);
  if (!body) return err("Invalid request body");
  if (!body.productId) return err("productId is required");

  // Verify product exists + belongs to this customer's world
  const product = await db.product.findUnique({
    where: { id: body.productId },
    select: { id: true, name: true, prescriptionRequired: true },
  });
  if (!product) return err("Product not found");

  const daysSupply = Math.max(1, Math.min(365, Number(body.daysSupply) || DEFAULT_DAYS_SUPPLY));
  const lastOrdered = body.lastOrdered ? new Date(body.lastOrdered) : new Date();
  if (Number.isNaN(lastOrdered.getTime())) return err("Invalid lastOrdered");

  const nextRefillDate = new Date(lastOrdered);
  nextRefillDate.setDate(nextRefillDate.getDate() + daysSupply);

  // De-dupe: if there's already an active reminder for this customer+product,
  // update it instead of creating a duplicate.
  const existing = await db.refillReminder.findFirst({
    where: { customerId: customer.id, productId: body.productId, isActive: true },
  });

  if (existing) {
    const updated = await db.refillReminder.update({
      where: { id: existing.id },
      data: {
        orderId: body.orderId ?? existing.orderId,
        lastOrdered,
        nextRefillDate,
        daysSupply,
        notifiedAt: null,
      },
    });
    return ok(updated);
  }

  const reminder = await db.refillReminder.create({
    data: {
      customerId: customer.id,
      productId: body.productId,
      orderId: body.orderId ?? null,
      lastOrdered,
      nextRefillDate,
      daysSupply,
      isActive: true,
    },
  });
  return ok(reminder);
}

export async function DELETE(req: Request) {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login");
  const id = param(req, "id");
  if (!id) return err("id query parameter is required");

  const existing = await db.refillReminder.findUnique({ where: { id } });
  if (!existing || existing.customerId !== customer.id) {
    return err("Refill reminder not found", 404);
  }

  // Soft-delete by marking inactive (preserves audit trail)
  await db.refillReminder.update({ where: { id }, data: { isActive: false } });
  return ok({ id });
}
