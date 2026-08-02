// ============================================================================
// File: src/app/api/admin/admins/route.ts
// Purpose: List & create admin accounts.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { hashPassword } from "@/lib/auth";
import { ok, err, unauthorized, forbidden, parseBody } from "@/lib/api";
import { ADMIN_PERMISSIONS, AdminPermissionKey } from "@/lib/constants";
import { serializePermissions } from "@/lib/permissions";

export async function GET() {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const items = await db.admin.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      permissions: true,
      lastLoginAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  return ok(items);
}

export async function POST(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  if (admin.role !== "super_admin") return forbidden("Only super admins can create new admins");

  const body = await parseBody<{
    name?: string;
    email?: string;
    phone?: string;
    password?: string;
    role?: string;
    permissions?: string[] | null;
  }>(req);
  if (!body?.name || !body?.email || !body?.password) {
    return err("name, email and password are required", 400);
  }
  const email = body.email.toLowerCase().trim();
  const dupe = await db.admin.findUnique({ where: { email } });
  if (dupe) return err("Email already in use", 400);
  if (!["admin", "super_admin", "manager"].includes(body.role || "admin")) {
    return err("Invalid role", 400);
  }

  // Normalize permissions: super_admin -> null (all perms); otherwise validate
  // against the canonical ADMIN_PERMISSIONS list and JSON-encode.
  const role = body.role || "admin";
  let permissionsValue: string | null = null;
  if (role !== "super_admin") {
    const valid = new Set<string>(ADMIN_PERMISSIONS as readonly string[]);
    const requested = Array.isArray(body.permissions) ? body.permissions : [];
    const filtered = requested.filter((k): k is AdminPermissionKey =>
      typeof k === "string" && valid.has(k)
    );
    permissionsValue = serializePermissions(filtered);
  }

  const created = await db.admin.create({
    data: {
      name: body.name,
      email,
      phone: body.phone || null,
      passwordHash: hashPassword(body.password),
      role,
      permissions: permissionsValue,
    },
    select: {
      id: true, name: true, email: true, phone: true,
      role: true, isActive: true, permissions: true, createdAt: true,
    },
  });
  return ok(created, 201);
}
