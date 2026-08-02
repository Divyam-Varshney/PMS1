// ============================================================================
// File: src/app/api/admin/app-notifs/template-toggle/route.ts
// Purpose: Toggle a template's isEnabled flag without doing a full PUT.
//          Single-purpose endpoint keeps the UI button a one-liner and lets
//          us add audit logging here later without touching the PUT path.
// ============================================================================

import { db } from "@/lib/db";
import { ok, err, unauthorized, parseBody } from "@/lib/api";
import { getAdminFromRequest } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

interface ToggleBody {
  id?: string;
  isEnabled?: boolean;
}

export async function PUT(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  if (!hasPermission(admin, "newsletter")) {
    return err("You don't have permission to manage App notifications", 403);
  }

  const body = await parseBody<ToggleBody>(req);
  if (!body?.id || typeof body.isEnabled !== "boolean") {
    return err("Missing 'id' or 'isEnabled' boolean", 400);
  }

  const existing = await db.appNotifTemplate.findUnique({ where: { id: body.id } });
  if (!existing) return err("Template not found", 404);

  const updated = await db.appNotifTemplate.update({
    where: { id: body.id },
    data: { isEnabled: body.isEnabled },
  });

  return ok(updated);
}
