// ============================================================================
// File: src/app/api/admin/ai/marketing-broadcast/route.ts
// Purpose: Broadcast an AI-generated HTML marketing email to every active
//          customer with an email address. Used by the "Send to All Customers"
//          button in Admin → AI Email Marketing.
//          POST { subject: string, htmlBody: string } → sends to every active
//          customer. Rate-limited (1s between sends) to respect SMTP provider
//          limits. Returns { sent, failed, total }.
// ============================================================================

import { db } from "@/lib/db";
import { ok, err, parseBody, unauthorized } from "@/lib/api";
import { getAdminFromRequest } from "@/lib/auth";
import { sendNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Sleep helper used to rate-limit outbound sends (1s between each email). */
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** POST /api/admin/ai/marketing-broadcast — broadcast the generated marketing
 *  email to every active customer with an email address. */
export async function POST(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const body = await parseBody<{ subject?: string; htmlBody?: string }>(req);
  const subject = body?.subject?.trim();
  const htmlBody = body?.htmlBody?.trim();

  if (!subject) return err("Subject is required", 400);
  if (!htmlBody) return err("HTML body is required", 400);

  // Fetch every active customer with a non-empty email.
  const customers = await db.customer.findMany({
    where: {
      isActive: true,
      email: { not: "" },
      isEmailVerified: true,
    },
    select: { id: true, name: true, email: true },
    orderBy: { createdAt: "desc" },
  });

  if (customers.length === 0) {
    return err("No active customers with verified emails to send to", 400);
  }

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < customers.length; i++) {
    const c = customers[i];
    try {
      await sendNotification({
        to: c.email,
        templateKey: "marketing_broadcast",
        vars: { name: c.name?.trim() || "Customer" },
        subjectOverride: subject,
        bodyOverride: htmlBody,
        customerId: c.id,
      });
      sent++;
    } catch (e) {
      // sendNotification records failures in NotificationLog and never throws
      // for SMTP errors, but guard against unexpected errors so one bad
      // customer doesn't abort the run.
      console.error(`[ai/marketing-broadcast] failed for ${c.email}:`, e);
      failed++;
    }

    // Rate limit: wait 1s between emails (skip after the last one).
    if (i < customers.length - 1) {
      await sleep(1000);
    }
  }

  return ok({ sent, failed, total: customers.length });
}
