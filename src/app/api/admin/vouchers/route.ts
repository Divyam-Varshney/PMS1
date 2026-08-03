// ============================================================================
// File: src/app/api/admin/vouchers/route.ts
// Purpose: List + create vouchers. Vouchers give a flat-amount deduction
//          (not a percentage) and can be scoped to cart/product/category.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, parseBody } from "@/lib/api";

export async function GET() {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const vouchers = await db.voucher.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { usages: true } } },
  });
  return ok(vouchers);
}

export async function POST(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const body = await parseBody<{
    code: string;
    description?: string;
    amount: number;
    scope?: string;
    targetIds?: string[];
    minOrder?: number;
    maxRedemptions?: number;
    perCustomerLimit?: number;
    validFrom?: string;
    validTo?: string;
    isActive?: boolean;
  }>(req);

  if (!body?.code?.trim()) return err("Voucher code is required");
  if (!body.amount || body.amount <= 0) return err("Voucher amount must be greater than 0");

  const code = body.code.toUpperCase().trim();
  const existing = await db.voucher.findUnique({ where: { code } });
  if (existing) return err("A voucher with this code already exists");

  const scope = body.scope || "cart";
  if (!["cart", "product", "category"].includes(scope)) {
    return err("Invalid scope — must be cart, product, or category");
  }
  if ((scope === "product" || scope === "category") && (!body.targetIds || body.targetIds.length === 0)) {
    return err(`Target ${scope} IDs are required when scope is ${scope}`);
  }

  const voucher = await db.voucher.create({
    data: {
      code,
      description: body.description?.trim() || null,
      amount: Number(body.amount),
      scope,
      targetIds: body.targetIds ? JSON.stringify(body.targetIds) : null,
      minOrder: Number(body.minOrder) || 0,
      maxRedemptions: Number(body.maxRedemptions) || 0,
      perCustomerLimit: Number(body.perCustomerLimit) || 0,
      validFrom: body.validFrom ? new Date(body.validFrom) : new Date(),
      validTo: body.validTo ? new Date(body.validTo) : null,
      isActive: body.isActive ?? true,
    },
  });
  return ok(voucher);
}
