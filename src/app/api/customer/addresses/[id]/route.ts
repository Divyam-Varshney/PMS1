// ============================================================================
// File: src/app/api/customer/addresses/[id]/route.ts
// Purpose: Update (PUT) or delete (DELETE) a specific address. Ensures the
//          address belongs to the current customer. Toggling isDefault clears
//          other defaults.
// Role: Powers AddressesView edit/delete + default toggle.
// ============================================================================

import { db } from "@/lib/db";
import { ok, unauthorized, err, parseBody, notFound, forbidden } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login");
  const { id } = await params;

  const existing = await db.address.findUnique({ where: { id } });
  if (!existing) return notFound("Address not found");
  if (existing.customerId !== customer.id) return forbidden();

  const body = await parseBody<{
    label?: string;
    line1?: string;
    line2?: string;
    city?: string;
    district?: string;
    state?: string;
    pincode?: string;
    locality?: string;
    phone?: string;
    isDefault?: boolean;
  }>(req);
  if (!body) return err("Invalid request body");

  // If making default, unset others
  if (body.isDefault && !existing.isDefault) {
    await db.address.updateMany({
      where: { customerId: customer.id, isDefault: true },
      data: { isDefault: false },
    });
  }

  const updated = await db.address.update({
    where: { id },
    data: {
      label: body.label,
      line1: body.line1,
      line2: body.line2,
      city: body.city,
      district: body.district,
      state: body.state,
      pincode: body.pincode,
      locality: body.locality,
      phone: body.phone,
      isDefault: body.isDefault,
    },
  });
  return ok(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login");
  const { id } = await params;

  const existing = await db.address.findUnique({ where: { id } });
  if (!existing) return notFound("Address not found");
  if (existing.customerId !== customer.id) return forbidden();

  await db.address.delete({ where: { id } });

  // If we deleted the default, promote another
  if (existing.isDefault) {
    const next = await db.address.findFirst({
      where: { customerId: customer.id },
      orderBy: { createdAt: "asc" },
    });
    if (next) {
      await db.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  }
  return ok({ success: true });
}
