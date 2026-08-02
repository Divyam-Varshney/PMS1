// ============================================================================
// File: src/app/api/admin/newsletter/bulk/route.ts
// Purpose: Admin-only endpoint for sending a single newsletter email to ALL
//          active subscribers at once. Used by the "Send Newsletter" button
//          in the Admin Panel → Newsletter view.
//          POST { subject, htmlBody } → sends to every active subscriber.
// Role: Loops through NewsletterSubscriber rows (isActive=true), calling
//       sendNotification() with bodyOverride so the admin-authored HTML is
//       sent verbatim (no template lookup). A 1-second delay between sends
//       avoids hammering the SMTP server and helps stay under provider rate
//       limits (e.g. Resend's free tier). Returns { sent, failed }.
// ============================================================================

import { db } from "@/lib/db";
import { ok, err, parseBody, unauthorized } from "@/lib/api";
import { getAdminFromRequest } from "@/lib/auth";
import { sendNotification } from "@/lib/notifications";

/** Sleep helper used to rate-limit outbound sends (1s between each email). */
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** POST /api/admin/newsletter/bulk — broadcast a newsletter to all active
 *  subscribers. Body: { subject: string, htmlBody: string }. */
export async function POST(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const body = await parseBody<{ subject?: string; htmlBody?: string }>(req);
  const subject = body?.subject?.trim();
  const htmlBody = body?.htmlBody?.trim();

  if (!subject) return err("Subject is required");
  if (!htmlBody) return err("HTML body is required");

  // Fetch every active subscriber. For very large lists this could be paginated
  // but newsletters are typically in the hundreds/thousands — fine in memory.
  const subscribers = await db.newsletterSubscriber.findMany({
    where: { isActive: true },
    select: { id: true, email: true, name: true },
    orderBy: { createdAt: "desc" },
  });

  if (subscribers.length === 0) {
    return err("No active subscribers to send to");
  }

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < subscribers.length; i++) {
    const sub = subscribers[i];
    try {
      await sendNotification({
        to: sub.email,
        templateKey: "newsletter_bulk",
        vars: { name: sub.name?.trim() || "Subscriber" },
        subjectOverride: subject,
        bodyOverride: htmlBody,
      });
      sent++;
    } catch (e) {
      // sendNotification already records the failure in NotificationLog and
      // never throws for SMTP errors, but we guard against unexpected errors
      // (e.g. DB write failure) so one bad subscriber doesn't abort the run.
      console.error(`[newsletter/bulk] failed for ${sub.email}:`, e);
      failed++;
    }

    // Rate limit: wait 1s between emails (skip after the last one).
    if (i < subscribers.length - 1) {
      await sleep(1000);
    }
  }

  return ok({ sent, failed, total: subscribers.length });
}
