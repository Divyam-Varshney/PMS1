// ============================================================================
// File: src/app/api/customer/profile/route.ts
// Purpose: Update the current customer's profile (name, phone, whatsappOptIn).
// Role: Powers the ProfileView form.
// ============================================================================

import { db } from "@/lib/db";
import { ok, unauthorized, err, parseBody } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth";

export async function PUT(req: Request) {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login");

  const body = await parseBody<{ name?: string; phone?: string; whatsappOptIn?: boolean }>(req);
  if (!body) return err("Invalid request body");

  const data: { name?: string; phone?: string; whatsappOptIn?: boolean } = {};
  if (body.name) data.name = body.name.trim();
  if (body.phone) {
    const phone = body.phone.trim();
    // Check uniqueness if phone is changing
    if (phone !== customer.phone) {
      const dup = await db.customer.findFirst({ where: { phone, NOT: { id: customer.id } } });
      if (dup) return err("This phone number is already in use");
    }
    data.phone = phone;
  }
  if (typeof body.whatsappOptIn === "boolean") data.whatsappOptIn = body.whatsappOptIn;

  const updated = await db.customer.update({
    where: { id: customer.id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      isEmailVerified: true,
      whatsappOptIn: true,
    },
  });
  return ok(updated);
}
