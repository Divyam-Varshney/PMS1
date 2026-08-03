// ============================================================================
// File: src/app/api/admin/admins/[id]/route.ts
// Purpose: Toggle admin active, update permissions, or delete admin (cannot
//          delete self). Super admins have all permissions implicitly and
//          their permissions field cannot be changed.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, forbidden, notFound, parseBody } from "@/lib/api";
import { ADMIN_PERMISSIONS, AdminPermissionKey } from "@/lib/constants";
import { serializePermissions } from "@/lib/permissions";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  // Only super admins can modify other admin accounts.
  if (admin.role !== "super_admin") return forbidden("Only super admins can modify admins");
  const { id } = await params;
  const body = await parseBody<{
    isActive?: boolean;
    permissions?: string[] | null;
  }>(req);
  if (typeof body?.isActive !== "boolean" && body?.permissions === undefined) {
    return err("isActive or permissions required", 400);
  }

  const target = await db.admin.findUnique({ where: { id } });
  if (!target) return notFound();

  // Build update payload — only fields actually provided in the body.
  const data: { isActive?: boolean; permissions?: string | null } = {};
  if (typeof body.isActive === "boolean") {
    data.isActive = body.isActive;
  }
  if (body.permissions !== undefined) {
    // Super admin permissions are implicit — refuse to set the field on a
    // super_admin row so the UI can't accidentally lock them out.
    if (target.role === "super_admin") {
      return err("Super admins have all permissions implicitly and cannot be restricted", 400);
    }
    const valid = new Set<string>(ADMIN_PERMISSIONS as readonly string[]);
    const requested = Array.isArray(body.permissions) ? body.permissions : [];
    const filtered = requested.filter((k): k is AdminPermissionKey =>
      typeof k === "string" && valid.has(k)
    );
    data.permissions = serializePermissions(filtered);
  }

  const updated = await db.admin.update({
    where: { id },
    data,
    select: {
      id: true, name: true, email: true, role: true,
      isActive: true, permissions: true,
    },
  });
  return ok(updated);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;
  if (admin.id === id) return err("You cannot delete your own account", 400);
  if (admin.role !== "super_admin") return forbidden("Only super admins can delete admins");

  const target = await db.admin.findUnique({ where: { id } });
  if (!target) return notFound();
  if (target.role === "super_admin") {
    // ensure not the last super_admin
    const count = await db.admin.count({ where: { role: "super_admin", isActive: true } });
    if (count <= 1) return err("Cannot delete the last super admin", 400);
  }

  await db.admin.delete({ where: { id } });
  return ok({ deleted: true });
}
