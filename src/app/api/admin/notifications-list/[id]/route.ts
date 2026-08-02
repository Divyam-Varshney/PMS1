// ============================================================================
// File: src/app/api/admin/notifications-list/[id]/route.ts
// Purpose: Mark a single admin notification as read (PATCH) or delete it (DELETE).
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, unauthorized, notFound } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(_req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;

  const existing = await db.adminNotification.findUnique({ where: { id } });
  if (!existing) return notFound();

  await db.adminNotification.update({ where: { id }, data: { isRead: true } });
  return ok({ read: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;

  await db.adminNotification.delete({ where: { id } });
  return ok({ deleted: true });
}
