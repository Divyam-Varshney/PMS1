// ============================================================================
// File: src/app/api/admin/newsletter/[id]/route.ts
// Purpose: Admin-only endpoints for a single newsletter subscriber.
//          DELETE — permanently remove a subscriber from the list.
//          PATCH  — toggle isActive (soft unsubscribe / re-subscribe).
// Role: Powers the row actions in the Admin Panel → Newsletter view.
// ============================================================================

import { db } from "@/lib/db";
import { ok, err, notFound, parseBody, unauthorized } from "@/lib/api";
import { getAdminFromRequest } from "@/lib/auth";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;

  const existing = await db.newsletterSubscriber.findUnique({ where: { id } });
  if (!existing) return notFound("Subscriber not found");

  await db.newsletterSubscriber.delete({ where: { id } });
  return ok({ success: true });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;

  const body = await parseBody<{ isActive?: boolean }>(req);
  if (!body || typeof body.isActive !== "boolean") {
    return err("isActive (boolean) is required");
  }

  const existing = await db.newsletterSubscriber.findUnique({ where: { id } });
  if (!existing) return notFound("Subscriber not found");

  const updated = await db.newsletterSubscriber.update({
    where: { id },
    data: { isActive: body.isActive },
  });
  return ok(updated);
}
