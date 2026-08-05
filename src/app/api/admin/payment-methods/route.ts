// ============================================================================
// File: src/app/api/admin/payment-methods/route.ts
// Purpose: List + create payment methods (admin-managed, modular).
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, parseBody } from "@/lib/api";

export async function GET() {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const items = await db.paymentMethod.findMany({
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  });
  return ok(items);
}

export async function POST(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const body = await parseBody<{
    key: string;
    label: string;
    description?: string;
    icon?: string;
    gateway?: string;
    config?: Record<string, string>;
    displayOrder?: number;
    isActive?: boolean;
  }>(req);

  if (!body?.key?.trim()) return err("Payment method key is required");
  if (!body?.label?.trim()) return err("Payment method label is required");

  const key = body.key.toLowerCase().trim();
  const existing = await db.paymentMethod.findUnique({ where: { key } });
  if (existing) return err("A payment method with this key already exists");

  const pm = await db.paymentMethod.create({
    data: {
      key,
      label: body.label.trim(),
      description: body.description?.trim() || null,
      icon: body.icon?.trim() || null,
      gateway: body.gateway?.trim() || null,
      config: body.config ? JSON.stringify(body.config) : null,
      displayOrder: Number(body.displayOrder ?? 0),
      isActive: body.isActive ?? true,
    },
  });
  return ok(pm, 201);
}
