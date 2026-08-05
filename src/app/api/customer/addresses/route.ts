// ============================================================================
// File: src/app/api/customer/addresses/route.ts
// Purpose: List (GET) and create (POST) addresses for the current customer.
// Role: Powers AddressesView and checkout address picker.
// ============================================================================

import { db } from "@/lib/db";
import { ok, unauthorized, err, parseBody } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth";

export async function GET() {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login");
  const addresses = await db.address.findMany({
    where: { customerId: customer.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  return ok(addresses);
}

export async function POST(req: Request) {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login");

  const body = await parseBody<{
    label?: string;
    line1: string;
    line2?: string;
    city?: string;
    district?: string;
    state?: string;
    pincode: string;
    locality?: string;
    phone?: string;
    isDefault?: boolean;
  }>(req);
  if (!body?.line1 || !body?.pincode) return err("Address line and pincode are required");

  // If making this default, unset others first
  if (body.isDefault) {
    await db.address.updateMany({
      where: { customerId: customer.id, isDefault: true },
      data: { isDefault: false },
    });
  }
  // If this is the first address, default it
  const existingCount = await db.address.count({ where: { customerId: customer.id } });

  const address = await db.address.create({
    data: {
      customerId: customer.id,
      label: body.label || "Home",
      line1: body.line1,
      line2: body.line2,
      city: body.city || "Mathura",
      district: body.district || "Mathura",
      state: body.state || "Uttar Pradesh",
      pincode: body.pincode,
      locality: body.locality,
      phone: body.phone,
      isDefault: body.isDefault ?? existingCount === 0,
    },
  });
  return ok(address);
}
