// ============================================================================
// File: src/app/api/admin/ai/marketing-test-email/route.ts
// Purpose: Send an AI-generated HTML marketing email to a single test
//          recipient. Used by the "Send Test Email" feature in Admin →
//          AI Email Marketing so the admin can preview the actual email
//          delivery before broadcasting to all customers.
//          POST { to: string, subject: string, htmlBody: string } →
//          sends one email via the same notification pipeline used for
//          customer emails. Returns { ok: true, to }.
// ============================================================================

import { ok, err, parseBody, unauthorized } from "@/lib/api";
import { getAdminFromRequest } from "@/lib/auth";
import { sendNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** POST /api/admin/ai/marketing-test-email — send a single test email. */
export async function POST(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const body = await parseBody<{ to?: string; subject?: string; htmlBody?: string }>(req);
  const to = body?.to?.trim().toLowerCase();
  const subject = body?.subject?.trim();
  const htmlBody = body?.htmlBody?.trim();

  if (!to || !EMAIL_RE.test(to)) return err("A valid recipient email is required", 400);
  if (!subject) return err("Subject is required", 400);
  if (!htmlBody) return err("HTML body is required", 400);

  try {
    await sendNotification({
      to,
      templateKey: "marketing_broadcast",
      vars: { name: "Test Recipient" },
      subjectOverride: subject,
      bodyOverride: htmlBody,
    });
    return ok({ ok: true, to });
  } catch (e: any) {
    console.error("[ai/marketing-test-email] failed:", e);
    return err(e?.message || "Failed to send test email", 500);
  }
}
