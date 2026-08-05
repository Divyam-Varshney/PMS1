// ============================================================================
// File: src/app/api/admin/orders/[id]/notes/[noteId]/route.ts
// Purpose: Edit or delete a single internal order note.
//            PATCH   → update body (keeps original author + createdAt)
//            DELETE  → remove the note entirely
// Role: Powers the per-note edit/delete buttons in the admin OrderDetailView.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, notFound, parseBody } from "@/lib/api";

type Ctx = { params: Promise<{ id: string; noteId: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id, noteId } = await params;

  const body = await parseBody<{ body?: string }>(req);
  if (!body?.body || !body.body.trim()) {
    return err("Note body is required", 400);
  }

  const existing = await db.orderNote.findUnique({
    where: { id: noteId },
    select: { orderId: true },
  });
  if (!existing || existing.orderId !== id) {
    return notFound("Note not found");
  }

  const updated = await db.orderNote.update({
    where: { id: noteId },
    data: { body: body.body.trim() },
  });

  // Touch the audit-trail so other admins see who last edited the note.
  await db.orderStatusHistory
    .create({
      data: {
        orderId: id,
        status: (await db.order.findUnique({ where: { id }, select: { status: true } }))?.status || "pending",
        note: `Note ${noteId.slice(-6)} edited by ${admin.name}`,
        createdBy: admin.id,
      },
    })
    .catch(() => {});

  return ok(updated);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id, noteId } = await params;

  const existing = await db.orderNote.findUnique({
    where: { id: noteId },
    select: { orderId: true },
  });
  if (!existing || existing.orderId !== id) {
    return notFound("Note not found");
  }

  await db.orderNote.delete({ where: { id: noteId } });
  return ok({ deleted: true });
}
