// ============================================================================
// File: src/app/api/admin/vouchers/[id]/route.ts
// Purpose: Update + delete a single voucher.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, parseBody } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;

  const body = await parseBody<{
    code?: string;
    description?: string;
    amount?: number;
    scope?: string;
    targetIds?: string[];
    minOrder?: number;
    maxRedemptions?: number;
    perCustomerLimit?: number;
    validFrom?: string;
    validTo?: string;
    isActive?: boolean;
  }>(req);

  const existing = await db.voucher.findUnique({ where: { id } });
  if (!existing) return err("Voucher not found", 404);

  if (body?.code) {
    const code = body.code.toUpperCase().trim();
    const conflict = await db.voucher.findUnique({ where: { code } });
    if (conflict && conflict.id !== id) return err("A voucher with this code already exists");
  }

  if (body?.scope && !["cart", "product", "category"].includes(body.scope)) {
    return err("Invalid scope");
  }

  const updated = await db.voucher.update({
    where: { id },
    data: {
      ...(body?.code !== undefined && { code: body.code.toUpperCase().trim() }),
      ...(body?.description !== undefined && { description: body.description?.trim() || null }),
      ...(body?.amount !== undefined && { amount: Number(body.amount) }),
      ...(body?.scope !== undefined && { scope: body.scope }),
      ...(body?.targetIds !== undefined && { targetIds: body.targetIds ? JSON.stringify(body.targetIds) : null }),
      ...(body?.minOrder !== undefined && { minOrder: Number(body.minOrder) }),
      ...(body?.maxRedemptions !== undefined && { maxRedemptions: Number(body.maxRedemptions) }),
      ...(body?.perCustomerLimit !== undefined && { perCustomerLimit: Number(body.perCustomerLimit) }),
      ...(body?.validFrom !== undefined && { validFrom: body.validFrom ? new Date(body.validFrom) : new Date() }),
      ...(body?.validTo !== undefined && { validTo: body.validTo ? new Date(body.validTo) : null }),
      ...(body?.isActive !== undefined && { isActive: body.isActive }),
    },
  });
  return ok(updated);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;

  await db.voucher.delete({ where: { id } });
  return ok({ deleted: true });
}
