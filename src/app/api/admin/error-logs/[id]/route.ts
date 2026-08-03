// ============================================================================
// File: src/app/api/admin/error-logs/[id]/route.ts
// Purpose: Update error log status (resolve/ignore) + delete single log.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, notFound, parseBody } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;

  const body = await parseBody<{ status?: string }>(req);
  if (!body?.status) return err("Status is required", 400);
  if (!["open", "resolved", "ignored"].includes(body.status)) {
    return err("Invalid status. Use: open, resolved, or ignored", 400);
  }

  const existing = await db.errorLog.findUnique({ where: { id } });
  if (!existing) return notFound("Error log not found");

  const updated = await db.errorLog.update({
    where: { id },
    data: { status: body.status },
  });
  return ok(updated);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;

  const existing = await db.errorLog.findUnique({ where: { id } });
  if (!existing) return notFound("Error log not found");

  await db.errorLog.delete({ where: { id } });
  return ok({ deleted: true });
}
