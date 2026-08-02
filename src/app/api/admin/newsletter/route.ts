// ============================================================================
// File: src/app/api/admin/newsletter/route.ts
// Purpose: Admin-only endpoints for managing newsletter subscribers.
//          GET   — list subscribers with pagination + search filter.
//          POST  — send a custom HTML email to a single subscriber.
// Role: Powers the Admin Panel → Newsletter view (list + per-subscriber email).
//       The bulk broadcast endpoint lives at /api/admin/newsletter/bulk.
// ============================================================================

import { db } from "@/lib/db";
import { ok, err, parseBody, param, paramInt, unauthorized } from "@/lib/api";
import { getAdminFromRequest } from "@/lib/auth";
import { sendNotification } from "@/lib/notifications";

/** GET /api/admin/newsletter — list subscribers with pagination + search. */
export async function GET(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const page = Math.max(1, paramInt(req, "page", 1));
  const pageSize = Math.min(100, Math.max(1, paramInt(req, "pageSize", 20)));
  const search = (param(req, "search") ?? "").trim();
  const activeOnly = param(req, "activeOnly") === "true";

  const where: { OR?: Array<Record<string, unknown>>; isActive?: boolean } = {};
  if (search) {
    where.OR = [
      { email: { contains: search } },
      { name: { contains: search } },
    ];
  }
  if (activeOnly) where.isActive = true;

  const [items, total, activeCount] = await Promise.all([
    db.newsletterSubscriber.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.newsletterSubscriber.count({ where }),
    db.newsletterSubscriber.count({ where: { isActive: true } }),
  ]);

  return ok({
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    activeCount,
  });
}

/** POST /api/admin/newsletter — send a custom HTML email to a single
 *  subscriber. Body: { id, subject, htmlBody }.
 *
 *  The plain-text "test email" variant (`{ id, subject, message }`) was
 *  removed — admin smoke-tests should use the per-subscriber HTML email
 *  dialog or the bulk broadcast endpoint instead. */
export async function POST(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const body = await parseBody<{
    id?: string;
    subject?: string;
    htmlBody?: string;
  }>(req);
  if (!body?.id) return err("Subscriber id is required");
  if (!body.htmlBody?.trim()) return err("HTML body is required");
  if (!body.subject?.trim()) return err("Subject is required");

  const sub = await db.newsletterSubscriber.findUnique({ where: { id: body.id } });
  if (!sub) return err("Subscriber not found", 404);

  const subject = body.subject.trim();
  const htmlBody = body.htmlBody.trim();
  const displayName = sub.name?.trim() || "Subscriber";

  // sendNotification records the attempt in NotificationLog regardless of
  // whether SMTP is configured (logged-only when SMTP is off). We pass
  // bodyOverride so the pre-built HTML is used verbatim instead of falling
  // back to a (non-existent) template → no raw JSON.
  const log = await sendNotification({
    to: sub.email,
    templateKey: "newsletter_individual",
    vars: { name: displayName },
    subjectOverride: subject,
    bodyOverride: htmlBody,
  });

  return ok({
    sent: log.status === "sent",
    status: log.status,
    error: log.error,
    logId: log.id,
  });
}
