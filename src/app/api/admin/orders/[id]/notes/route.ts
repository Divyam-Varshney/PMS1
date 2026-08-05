// ============================================================================
// File: src/app/api/admin/orders/[id]/notes/route.ts
// Purpose: Internal order notes (admin-only). Supports:
//            GET    → list notes (newest last so the timeline reads top-down)
//            POST   → add a note (records admin id + name for attribution)
// Role: Powers the "Internal Notes" section in the admin OrderDetailView.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, notFound, parseBody } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;

  const order = await db.order.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!order) return notFound("Order not found");

  const notes = await db.orderNote.findMany({
    where: { orderId: id },
    orderBy: { createdAt: "asc" },
  });
  return ok(notes);
}

export async function POST(req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;

  const body = await parseBody<{ body?: string }>(req);
  if (!body?.body || !body.body.trim()) {
    return err("Note body is required", 400);
  }

  const order = await db.order.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!order) return notFound("Order not found");

  const note = await db.orderNote.create({
    data: {
      orderId: id,
      body: body.body.trim(),
      authorId: admin.id,
      authorName: admin.name,
    },
  });

  return ok(note);
}
