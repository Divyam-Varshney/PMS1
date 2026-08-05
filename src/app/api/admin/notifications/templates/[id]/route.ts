// ============================================================================
// File: src/app/api/admin/notifications/templates/[id]/route.ts
// Purpose: Edit a notification template (subject / body / variables / isActive).
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, notFound, parseBody } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;
  const body = await parseBody<any>(req);
  if (!body) return err("Invalid body", 400);

  const existing = await db.notificationTemplate.findUnique({ where: { id } });
  if (!existing) return notFound();

  const updated = await db.notificationTemplate.update({
    where: { id },
    data: {
      subject: body.subject !== undefined ? body.subject || null : existing.subject,
      body: body.body ?? existing.body,
      variables:
        body.variables !== undefined
          ? Array.isArray(body.variables)
            ? JSON.stringify(body.variables)
            : body.variables
          : existing.variables,
      isActive: body.isActive ?? existing.isActive,
    },
  });
  return ok(updated);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;
  const existing = await db.notificationTemplate.findUnique({ where: { id } });
  if (!existing) return notFound();
  await db.notificationTemplate.delete({ where: { id } });
  return ok({ deleted: true });
}
