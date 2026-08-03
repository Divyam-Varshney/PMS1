// ============================================================================
// File: src/app/api/admin-auth/login/route.ts
// Purpose: Admin login endpoint. Validates credentials, sets cookie, updates
//          lastLoginAt, and sends a security notification email to the
//          configured global admin email with login details.
// ============================================================================

import { db } from "@/lib/db";
import { verifyPassword, signToken, setAdminCookie } from "@/lib/auth";
import { ok, err, parseBody } from "@/lib/api";
import { sendNotification } from "@/lib/notifications";

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

    // --- Security notification email ---
    try {
      const userAgent = req.headers.get("user-agent") || "Unknown";
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        "Unknown";

      // Parse browser/device/OS from user-agent
      let browser = "Unknown";
      let os = "Unknown";
      let device = "Desktop";

      if (userAgent.includes("Edg")) browser = "Microsoft Edge";
      else if (userAgent.includes("Chrome")) browser = "Google Chrome";
      else if (userAgent.includes("Firefox")) browser = "Mozilla Firefox";
      else if (userAgent.includes("Safari")) browser = "Safari";

      if (userAgent.includes("Windows")) os = "Windows";
      else if (userAgent.includes("Mac OS")) os = "macOS";
      else if (userAgent.includes("Android")) { os = "Android"; device = "Mobile"; }
      else if (userAgent.includes("iPhone") || userAgent.includes("iPad")) { os = "iOS"; device = "Mobile"; }
      else if (userAgent.includes("Linux")) os = "Linux";

      const loginDateObj = new Date();
      const loginDate = loginDateObj.toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      const loginTime = loginDateObj.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });

      // Get global admin email from settings
      const { getAllSettings } = await import("@/lib/settings");
      const settings = await getAllSettings();
      const globalAdminEmail = settings["store.email"] as string;

      if (globalAdminEmail) {
        await sendNotification({
          to: globalAdminEmail,
          templateKey: "admin_login_alert",
          vars: {
            adminName: admin.name,
            adminEmail: admin.email,
            loginDate,
            loginTime,
            ipAddress: ip,
            browser,
            os,
            device,
            loginStatus: "Success",
          },
          channel: "email",
        });
      }
    } catch (notifErr) {
      // Best-effort — don't fail login if notification fails
      console.error("[admin-login] notification failed:", notifErr);
    }

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
