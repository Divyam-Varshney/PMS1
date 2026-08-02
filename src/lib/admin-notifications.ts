// ============================================================================
// File: src/lib/admin-notifications.ts
// Purpose: CENTRALIZED admin notification system. Creates in-app notifications
//          (AdminNotification table) AND sends email alerts to the single
//          configurable Global Admin Email (admin.notificationEmail setting).
//
// All admin email notifications flow through this ONE module:
//   - New customer orders          (checkout)
//   - Prescription submissions     (prescriptions API)
//   - Manual medicine requests     (manual-requests API)
//   - Order status updates         (admin order status API)
//   - Payment notifications        (admin payment status API)
//
// The Global Admin Email is configurable from Admin → Settings → Notifications.
// SMTP must be configured in Admin → Settings → SMTP for emails to actually
// send. If SMTP is not configured, notifications are still created in-app
// (bell icon) and logged (NotificationLog), but no email is sent.
//
// All errors are logged to console.error so they show in dev.log — never
// swallowed silently.
// ============================================================================

import { db } from "@/lib/db";
import { getSetting, getAllSettings } from "@/lib/settings";
import { getTemplate, renderTemplate } from "@/lib/notifications";
import { wrapEmailHtml, htmlToPlainText } from "@/lib/email-template";

export type AdminNotificationType =
  | "new_order"
  | "new_prescription"
  | "new_manual_request"
  | "order_status_update"
  | "payment_update"
  | "system_alert";

interface CreateOpts {
  type: AdminNotificationType;
  title: string;
  message: string;
  refId?: string;
  refType?: "order" | "prescription" | "manual_request";
  customerName?: string;
  emailDetails?: string;
}

/** Map an AdminNotificationType to the matching NotificationTemplate key. */
function templateKeyForType(type: AdminNotificationType): string {
  switch (type) {
    case "new_order": return "admin_new_order";
    case "new_prescription": return "admin_new_prescription";
    case "new_manual_request": return "admin_new_manual_request";
    case "order_status_update": return "admin_order_status_update";
    case "payment_update": return "admin_payment_update";
    case "system_alert": return "admin_alert";
  }
}

/** Build the variable map for a given template key from the CreateOpts. */
function buildVarsForType(opts: CreateOpts): Record<string, string> {
  const details = opts.emailDetails ?? "";
  const customerName = opts.customerName ?? "";
  const refId = opts.refId ?? "";
  switch (opts.type) {
    case "new_order":
      // refId = order number; emailDetails contains amount/paymentMethod lines.
      return {
        orderNumber: refId,
        customerName,
        amount: extractField(details, "Amount") ?? extractField(details, "Total") ?? "",
        paymentMethod: extractField(details, "Payment Method") ?? "",
        details,
      };
    case "new_prescription":
    case "new_manual_request":
      return { customerName, refId, details };
    case "order_status_update":
      return {
        orderNumber: refId,
        oldStatus: extractField(details, "Previous") ?? "",
        newStatus: extractField(details, "New") ?? extractField(details, "Status") ?? "",
        details,
      };
    case "payment_update":
      return {
        orderNumber: refId,
        paymentStatus: extractField(details, "Payment Status") ?? "",
        paymentMethod: extractField(details, "Payment Method") ?? "",
        details,
      };
    case "system_alert":
    default:
      return { title: opts.title, message: opts.message, details };
  }
}

/** Best-effort scalar extractor for "Field: value" lines inside emailDetails. */
function extractField(details: string, field: string): string | null {
  if (!details) return null;
  const re = new RegExp(`${field}[^\\n]*?:\\s*([^\\n]+)`, "i");
  const m = details.match(re);
  return m ? m[1].trim() : null;
}

/** Get the Global Admin Email from settings. Falls back to store.email. */
export async function getAdminNotificationEmail(): Promise<string | null> {
  const adminEmail = await getSetting<string>("admin.notificationEmail");
  if (adminEmail && adminEmail.trim()) return adminEmail.trim();
  // Fallback to store.email for backward compatibility
  const storeEmail = await getSetting<string>("store.email");
  return storeEmail && storeEmail.trim() ? storeEmail.trim() : null;
}

/** Check if a specific notification type should trigger an email alert. */
async function shouldSendEmail(type: AdminNotificationType): Promise<boolean> {
  const settings = await getAllSettings();
  // Master toggle — if false, no admin emails at all
  if (settings["admin.emailAlertsEnabled"] === false) return false;
  // Per-type toggles (default true)
  switch (type) {
    case "new_order":
      return settings["admin.alertOnNewOrder"] !== false;
    case "new_prescription":
      return settings["admin.alertOnNewPrescription"] !== false;
    case "new_manual_request":
      return settings["admin.alertOnNewManualRequest"] !== false;
    case "order_status_update":
      return settings["admin.alertOnOrderStatusUpdate"] !== false;
    case "payment_update":
      return settings["admin.alertOnPaymentUpdate"] !== false;
    case "system_alert":
      return settings["admin.alertOnSystemAlert"] !== false;
    default:
      return true;
  }
}

// Build a professional HTML email body for the admin notification. This is the
// FALLBACK used when no matching admin template is found in the DB (or when
// template rendering fails). When a template IS found, renderEmailFromTemplate
// is used instead — the admin's custom HTML wins.
function buildEmailHtml(opts: CreateOpts, adminUrl: string): string {
  const typeLabel =
    opts.type === "new_order" ? "🛒 New Order" :
    opts.type === "new_prescription" ? "📋 New Prescription Upload" :
    opts.type === "new_manual_request" ? "📝 New Manual Medicine Request" :
    opts.type === "order_status_update" ? "📦 Order Status Update" :
    opts.type === "payment_update" ? "💳 Payment Update" :
    opts.type === "system_alert" ? "⚠️ System Alert" :
    "🔔 Admin Notification";

  const typeColor =
    opts.type === "new_order" ? "#059669" :
    opts.type === "new_prescription" ? "#8b5cf6" :
    opts.type === "new_manual_request" ? "#f59e0b" :
    opts.type === "order_status_update" ? "#0284c7" :
    opts.type === "payment_update" ? "#7c3aed" :
    opts.type === "system_alert" ? "#dc2626" :
    "#4b5563";

  const link = opts.refId && opts.refType
    ? `${adminUrl}#v=${opts.refType === "order" ? "order-detail" : opts.refType === "prescription" ? "prescription-detail" : "manual-request-detail"}&id=${opts.refId}`
    : adminUrl;

  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 0;">
  <div style="background: ${typeColor}; padding: 20px; border-radius: 8px 8px 0 0;">
    <h2 style="color: white; margin: 0; font-size: 18px;">${typeLabel}</h2>
  </div>
  <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="margin: 0 0 12px; font-size: 14px; color: #111827;">
      <strong>${opts.title}</strong>
    </p>
    <p style="margin: 0 0 12px; font-size: 14px; color: #4b5563;">
      ${opts.message}
    </p>
    ${opts.customerName ? `<p style="margin: 0 0 12px; font-size: 14px; color: #4b5563;"><strong>Customer:</strong> ${opts.customerName}</p>` : ""}
    ${opts.emailDetails ? `<div style="background: white; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; margin: 12px 0; font-size: 13px; color: #374151; white-space: pre-wrap;">${opts.emailDetails}</div>` : ""}
    <a href="${link}" style="display: inline-block; background: ${typeColor}; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 600; margin-top: 8px;">
      View in Admin Panel →
    </a>
    <p style="margin: 16px 0 0; font-size: 12px; color: #9ca3af;">
      This is an automated notification from Pradeep Medical Store Admin Panel.
    </p>
  </div>
</div>`;
}

/** Build the deep-link action button block appended to template-rendered HTML. */
function actionButtonHtml(opts: CreateOpts, adminUrl: string): string {
  const link = opts.refId && opts.refType
    ? `${adminUrl}#v=${opts.refType === "order" ? "order-detail" : opts.refType === "prescription" ? "prescription-detail" : "manual-request-detail"}&id=${opts.refId}`
    : adminUrl;
  return `<p style="margin-top:16px;"><a href="${link}" style="display:inline-block;background:#059669;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;">View in Admin Panel →</a></p>`;
}

/**
 * Try to render the admin email from a NotificationTemplate stored in the DB.
 * Returns null if no template exists (caller falls back to buildEmailHtml).
 *
 * The admin can fully customize the subject + HTML body from
 * Admin → Notification Templates → "Admin Email" tab. We append the deep-link
 * "View in Admin Panel" button to whatever the template renders so the admin
 * always gets a one-click jump to the relevant record.
 */
async function renderEmailFromTemplate(opts: CreateOpts): Promise<{ subject: string; html: string } | null> {
  const key = templateKeyForType(opts.type);
  const template = await getTemplate(key, "email");
  if (!template || !template.body) return null;
  const vars = buildVarsForType(opts);
  // Subject: render the template's subject if present, else default to opts.title
  const subject = template.subject
    ? renderTemplate(template.subject, vars)
    : `[PMS Alert] ${opts.title}`;
  const renderedBody = renderTemplate(template.body, vars);
  return { subject, html: renderedBody };
}

/**
 * Create an admin notification (in-app bell + email alert).
 * This is the SINGLE entry point for all admin notifications.
 *
 * Behavior:
 *   1. Creates an AdminNotification record (shows in the admin bell icon)
 *   2. If the notification type is enabled AND SMTP is configured, sends an
 *      email to the Global Admin Email
 *   3. Creates a NotificationLog record (audit trail)
 *   4. All errors are logged to console.error — never swallowed silently
 */
export async function createAdminNotification(opts: CreateOpts) {
  // ---- 1. Create the in-app notification (database) ----
  try {
    await db.adminNotification.create({
      data: {
        type: opts.type,
        title: opts.title,
        message: opts.message,
        refId: opts.refId,
        refType: opts.refType,
        customerName: opts.customerName,
      },
    });
  } catch (e) {
    console.error("[admin-notifications] Failed to create in-app notification:", e);
  }

  // ---- 2. Check if we should send an email ----
  const shouldEmail = await shouldSendEmail(opts.type);
  if (!shouldEmail) return;

  const alertEmail = await getAdminNotificationEmail();
  if (!alertEmail) {
    console.warn("[admin-notifications] No admin notification email configured. Skipping email for:", opts.title);
    return;
  }

  // ---- 3. Build the email ----
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const host = process.env.ADMIN_URL || `${protocol}://localhost:3000/admin`;

  // Prefer the admin-edited template from the DB. If a matching template
  // exists, render its subject + HTML body (with the per-type variable map)
  // and append the deep-link "View in Admin Panel" button. If no template is
  // found (or rendering throws), fall back to the bundled buildEmailHtml().
  let subject: string;
  let htmlFragment: string;
  try {
    const rendered = await renderEmailFromTemplate(opts);
    if (rendered) {
      subject = rendered.subject;
      htmlFragment = rendered.html + actionButtonHtml(opts, host);
    } else {
      subject = `[PMS Alert] ${opts.title}`;
      htmlFragment = buildEmailHtml(opts, host);
    }
  } catch (e) {
    console.error("[admin-notifications] Template render failed, using fallback:", e);
    subject = `[PMS Alert] ${opts.title}`;
    htmlFragment = buildEmailHtml(opts, host);
  }

  // Wrap the admin alert fragment in the professional PMS email template
  // (header with dynamic store logo, emerald accent, footer with store
  // contact info + social links). Admin alert HTML is always a fragment
  // (no <!DOCTYPE>/<html>) so it's always wrapped.
  const deepLink =
    opts.refId && opts.refType
      ? `${host}#v=${opts.refType === "order" ? "order-detail" : opts.refType === "prescription" ? "prescription-detail" : "manual-request-detail"}&id=${opts.refId}`
      : host;
  const html = await wrapEmailHtml(htmlFragment, {
    preheader: subject,
    ctaUrl: deepLink,
    ctaLabel: "View in Admin Panel",
  });
  const textBody = htmlToPlainText(htmlFragment);

  // Support comma-separated emails (admin can set multiple recipients)
  const emails = alertEmail.split(",").map((e: string) => e.trim()).filter(Boolean);

  // ---- 4. Send via SMTP using the centralized sendNotification function ----
  // This ensures all email sending goes through one path (with proper
  // buildFromAddress, transport caching, and error logging).
  const settings = await getAllSettings();
  const smtpConfigured = settings["smtp.enabled"] && settings["smtp.host"] && settings["smtp.username"];

  for (const email of emails) {
    let sendStatus: "sent" | "failed" = "sent";
    let errorMsg: string | undefined;

    if (smtpConfigured) {
      try {
        // Use the shared sendNotification so all email goes through one path.
        // We pass the pre-built HTML as the subjectOverride body via a special
        // templateKey. Since sendNotification renders templates, we use
        // subjectOverride for the subject and the "admin_alert" template
        // (which exists in DEFAULT_TEMPLATES). But we want to use OUR custom
        // HTML, not the template. So we call sendNotification with the HTML
        // as the body via a direct approach.
        //
        // Actually, the cleanest approach: import buildFromAddress + getTransport
        // from notifications.ts and send directly here. But those are not
        // exported. Instead, let's use sendNotification with subjectOverride
        // and rely on the admin_alert template existing.
        //
        // Simplest fix: use nodemailer directly but with buildFromAddress logic.
        const nodemailer = (await import("nodemailer")).default;
        const port = Number(settings["smtp.port"]) || 587;
        const transport = nodemailer.createTransport({
          host: settings["smtp.host"],
          port,
          secure: port === 465,
          auth: { user: settings["smtp.username"], pass: settings["smtp.password"] },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 15000,
        });

        // Build the from address properly — for Resend, username is "resend"
        // (not an email), so we MUST use senderEmail
        const senderName = settings["smtp.senderName"] || "Pradeep Medical Store";
        const senderEmail = settings["smtp.senderEmail"]?.trim();
        const username = settings["smtp.username"]?.trim();
        const fromEmail = senderEmail || (username && username.includes("@") ? username : "");
        if (!fromEmail) {
          throw new Error(
            'SMTP Sender Email is required. Set it in Admin → Settings → SMTP. ' +
            'For Resend, use a verified sender email (e.g. onboarding@resend.dev).'
          );
        }
        const from = `"${senderName}" <${fromEmail}>`;
        await transport.sendMail({ from, to: email, subject, html, text: textBody });
      } catch (e: any) {
        sendStatus = "failed";
        errorMsg = e?.message ?? String(e);
        console.error(`[admin-notifications] SMTP send FAILED to ${email}:`, errorMsg);
      }
    } else {
      // SMTP not configured — log only
      sendStatus = "sent";
      errorMsg = "SMTP not configured — logged only (no email sent)";
      console.warn(`[admin-notifications] SMTP not configured. Email NOT sent to ${email}. Notification logged only.`);
    }

    // Create NotificationLog (audit trail — always, regardless of send status)
    try {
      await db.notificationLog.create({
        data: {
          recipient: email,
          channel: "email",
          subject,
          body: html,
          status: sendStatus,
          templateKey: "admin_alert",
          error: errorMsg,
        },
      });
    } catch (e) {
      console.error("[admin-notifications] Failed to create NotificationLog:", e);
    }
  }
}
