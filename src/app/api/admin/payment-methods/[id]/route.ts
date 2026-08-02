// ============================================================================
// File: src/app/api/admin/payment-methods/[id]/route.ts
// Purpose: Update + delete a payment method.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, notFound, parseBody } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;
  const body = await parseBody<{
    label?: string;
    description?: string;
    icon?: string;
    gateway?: string;
    config?: Record<string, string>;
    displayOrder?: number;
    isActive?: boolean;
  }>(req);

  const existing = await db.paymentMethod.findUnique({ where: { id } });
  if (!existing) return notFound("Payment method not found");

  const updated = await db.paymentMethod.update({
    where: { id },
    data: {
      ...(body?.label !== undefined && { label: body.label.trim() }),
      ...(body?.description !== undefined && { description: body.description?.trim() || null }),
      ...(body?.icon !== undefined && { icon: body.icon?.trim() || null }),
      ...(body?.gateway !== undefined && { gateway: body.gateway?.trim() || null }),
      ...(body?.config !== undefined && { config: body.config ? JSON.stringify(body.config) : null }),
      ...(body?.displayOrder !== undefined && { displayOrder: Number(body.displayOrder) }),
      ...(body?.isActive !== undefined && { isActive: body.isActive }),
    },
  });
  return ok(updated);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;

  // Prevent deletion of core payment methods (QR, COD) — they are essential
  // for the checkout flow and should only be disabled, not deleted.
  const pm = await db.paymentMethod.findUnique({ where: { id } });
  if (!pm) return err("Payment method not found", 404);
  if (pm.key === "qr" || pm.key === "cod") {
    return err("Core payment methods (QR Code, COD) cannot be deleted. Disable them instead.", 400);
  }

  await db.paymentMethod.delete({ where: { id } });
  return ok({ deleted: true });
}
