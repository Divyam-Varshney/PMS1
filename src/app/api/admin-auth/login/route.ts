// ============================================================================
// File: src/app/api/admin-auth/login/route.ts
// Purpose: Admin login endpoint. Validates credentials against the Admin table,
//          sets the pms_admin_token cookie, and updates lastLoginAt.
// ============================================================================

import { db } from "@/lib/db";
import { verifyPassword, signToken, setAdminCookie } from "@/lib/auth";
import { ok, err, parseBody } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const body = await parseBody<{ email?: string; password?: string }>(req);
    if (!body?.email || !body?.password) {
      return err("Email and password are required", 400);
    }

    const admin = await db.admin.findUnique({
      where: { email: body.email.toLowerCase().trim() },
    });
    if (!admin) return err("Invalid email or password", 401);
    if (!admin.isActive)
      return err("Your account is disabled. Contact the super admin.", 403);
    if (!verifyPassword(body.password, admin.passwordHash)) {
      return err("Invalid email or password", 401);
    }

    await db.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const token = signToken({
      sub: admin.id,
      type: "admin",
      role: admin.role,
      email: admin.email,
    });
    await setAdminCookie(token);

    return ok({
      id: admin.id,
      name: admin.name,
      email: admin.email,
      phone: admin.phone,
      role: admin.role,
      lastLoginAt: new Date(),
    });
  } catch (e) {
    return err("Login failed. Please try again.", 500);
  }
}
