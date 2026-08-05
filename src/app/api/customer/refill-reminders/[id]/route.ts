// ============================================================================
// File: src/app/api/customer/refill-reminders/[id]/route.ts
// Purpose: PATCH a refill reminder — currently supports "snooze" (postpone
//          nextRefillDate by N days, default 7) and "dismiss" (soft-delete by
//          setting isActive=false). Requires customer auth + ownership check.
// ============================================================================

import { db } from "@/lib/db";
import { ok, err, unauthorized, notFound, parseBody } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login");
  const { id } = await params;

  const existing = await db.refillReminder.findUnique({ where: { id } });
  if (!existing || existing.customerId !== customer.id) {
    return notFound("Refill reminder not found");
  }

  const body = await parseBody<{ snoozeDays?: number; isActive?: boolean }>(req);
  if (!body) return err("Invalid request body");

  const data: Record<string, unknown> = {};

  if (body.snoozeDays !== undefined) {
    const days = Math.max(1, Math.min(90, Number(body.snoozeDays) || 7));
    const base = existing.nextRefillDate < new Date() ? new Date() : existing.nextRefillDate;
    const next = new Date(base);
    next.setDate(next.getDate() + days);
    data.nextRefillDate = next;
    data.notifiedAt = null;
  }

  if (body.isActive !== undefined) {
    data.isActive = Boolean(body.isActive);
  }

  if (Object.keys(data).length === 0) {
    return err("Nothing to update — provide snoozeDays or isActive");
  }

  const updated = await db.refillReminder.update({ where: { id }, data });
  return ok(updated);
}
