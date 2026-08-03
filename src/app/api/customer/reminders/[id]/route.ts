// ============================================================================
// File: src/app/api/customer/reminders/[id]/route.ts
// Purpose: PATCH updates a medicine reminder (toggle isActive, edit fields).
//          DELETE removes a reminder. Both require customer auth and verify
//          ownership (the reminder must belong to the requesting customer).
// ============================================================================

import { db } from "@/lib/db";
import { ok, err, unauthorized, notFound, parseBody } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

const FREQ_VALUES = new Set(["daily", "twice-daily", "weekly", "custom"]);
const MAX_TIMES = 8;

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login");
  const { id } = await params;

  const existing = await db.medicineReminder.findUnique({ where: { id } });
  if (!existing || existing.customerId !== customer.id) {
    return notFound("Reminder not found");
  }

  const body = await parseBody<{
    productName?: string;
    dosage?: string | null;
    frequency?: string;
    times?: string[];
    startDate?: string;
    endDate?: string | null;
    isActive?: boolean;
  }>(req);
  if (!body) return err("Invalid request body");

  const data: Record<string, unknown> = {};

  if (body.productName !== undefined) {
    const productName = body.productName.trim();
    if (!productName) return err("Product name cannot be empty");
    if (productName.length > 255) return err("Product name is too long (max 255 chars)");
    data.productName = productName;
  }

  if (body.dosage !== undefined) {
    const dosage = body.dosage?.trim() || null;
    if (dosage && dosage.length > 100) return err("Dosage is too long (max 100 chars)");
    data.dosage = dosage;
  }

  if (body.frequency !== undefined) {
    if (!FREQ_VALUES.has(body.frequency)) {
      return err("Invalid frequency. Must be one of: daily, twice-daily, weekly, custom");
    }
    data.frequency = body.frequency;
  }

  if (body.times !== undefined) {
    let times: string[] = [];
    if (Array.isArray(body.times)) {
      times = body.times
        .filter((t) => typeof t === "string" && /^\d{2}:\d{2}$/.test(t))
        .slice(0, MAX_TIMES);
    }
    data.times = JSON.stringify(times);
  }

  if (body.startDate !== undefined) {
    const startDate = new Date(body.startDate);
    if (Number.isNaN(startDate.getTime())) return err("Invalid startDate");
    data.startDate = startDate;
  }

  if (body.endDate !== undefined) {
    const endDate = body.endDate ? new Date(body.endDate) : null;
    if (endDate && Number.isNaN(endDate.getTime())) return err("Invalid endDate");
    data.endDate = endDate;
  }

  if (body.isActive !== undefined) {
    data.isActive = Boolean(body.isActive);
  }

  const updated = await db.medicineReminder.update({ where: { id }, data });
  return ok(updated);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login");
  const { id } = await params;

  const existing = await db.medicineReminder.findUnique({ where: { id } });
  if (!existing || existing.customerId !== customer.id) {
    return notFound("Reminder not found");
  }

  await db.medicineReminder.delete({ where: { id } });
  return ok({ id });
}
