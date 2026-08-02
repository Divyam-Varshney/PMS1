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

      const loginTime = new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "full",
        timeStyle: "long",
      });

      // Get global admin email from settings
      const { getAllSettings } = await import("@/lib/settings");
      const settings = await getAllSettings();
      const globalAdminEmail = settings["store.email"] as string;

      if (globalAdminEmail) {
        await sendNotification({
          to: globalAdminEmail,
          templateKey: "admin_alert",
          vars: {
            name: "Administrator",
            alertType: "Admin Login Notification",
            message: `An admin account has successfully logged in.\n\nAdmin Name: ${admin.name}\nEmail: ${admin.email}\nLogin Time: ${loginTime}\nBrowser: ${browser}\nDevice: ${device}\nOperating System: ${os}\nIP Address: ${ip}\nLogin Status: Success`,
            details: `Admin: ${admin.name} (${admin.email}) logged in from ${browser} on ${os} (${device}) at ${loginTime}. IP: ${ip}`,
          },
          subjectOverride: `[Security] Admin Login: ${admin.name} (${admin.email})`,
          bodyOverride: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background-color:#0f172a;color:#f1f5f9;padding:24px;border-radius:12px;">
<h2 style="color:#10b981;margin:0 0 16px;">🔐 Admin Login Notification</h2>
<p style="color:#cbd5e1;">An administrator account has successfully logged in to the PMS Admin Panel.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
<tr><td style="padding:8px 12px;color:#94a3b8;border-bottom:1px solid #334155;">Admin Name</td><td style="padding:8px 12px;color:#f1f5f9;font-weight:600;border-bottom:1px solid #334155;">${admin.name}</td></tr>
<tr><td style="padding:8px 12px;color:#94a3b8;border-bottom:1px solid #334155;">Email</td><td style="padding:8px 12px;color:#f1f5f9;font-weight:600;border-bottom:1px solid #334155;">${admin.email}</td></tr>
<tr><td style="padding:8px 12px;color:#94a3b8;border-bottom:1px solid #334155;">Login Time</td><td style="padding:8px 12px;color:#f1f5f9;font-weight:600;border-bottom:1px solid #334155;">${loginTime}</td></tr>
<tr><td style="padding:8px 12px;color:#94a3b8;border-bottom:1px solid #334155;">Browser</td><td style="padding:8px 12px;color:#f1f5f9;font-weight:600;border-bottom:1px solid #334155;">${browser}</td></tr>
<tr><td style="padding:8px 12px;color:#94a3b8;border-bottom:1px solid #334155;">Device</td><td style="padding:8px 12px;color:#f1f5f9;font-weight:600;border-bottom:1px solid #334155;">${device}</td></tr>
<tr><td style="padding:8px 12px;color:#94a3b8;border-bottom:1px solid #334155;">Operating System</td><td style="padding:8px 12px;color:#f1f5f9;font-weight:600;border-bottom:1px solid #334155;">${os}</td></tr>
<tr><td style="padding:8px 12px;color:#94a3b8;border-bottom:1px solid #334155;">IP Address</td><td style="padding:8px 12px;color:#f1f5f9;font-weight:600;border-bottom:1px solid #334155;">${ip}</td></tr>
<tr><td style="padding:8px 12px;color:#94a3b8;">Login Status</td><td style="padding:8px 12px;color:#10b981;font-weight:600;">✅ Success</td></tr>
</table>
<p style="color:#64748b;font-size:12px;margin-top:16px;">This is an automated security notification. If you did not initiate this login, please take immediate action to secure the account.</p>
</div>`,
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
