// ============================================================================
// File: src/lib/notifications.ts
// Purpose: Centralized notification service. Renders templates with variables
//          and dispatches via email (real SMTP via nodemailer). All templates
//          are admin-editable (NotificationTemplate table). SMTP is only used
//          when the admin has enabled and configured it in Settings — otherwise
//          notifications are still logged (NotificationLog) so the flow is
//          observable.
// Role: Single notification entry-point so no other module sends emails.
// ============================================================================

import { db } from "@/lib/db";
import { getAllSettings } from "@/lib/settings";
import { DEFAULT_TEMPLATES } from "@/lib/constants";
import { wrapEmailHtml, htmlToPlainText } from "@/lib/email-template";
import nodemailer from "nodemailer";

/** Render a template body by replacing {{variable}} placeholders. */
export function renderTemplate(body: string, vars: Record<string, string | number>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    key in vars ? String(vars[key]) : `{{${key}}}`
  );
}

/** Get a template by key+channel. Tries `${key}_${channel}` first (the seeded
 *  format), then `key` alone, then falls back to DEFAULT_TEMPLATES. */
export async function getTemplate(key: string, channel: string) {
  const row =
    (await db.notificationTemplate.findUnique({ where: { key: `${key}_${channel}` } })) ??
    (await db.notificationTemplate.findUnique({ where: { key } }));
  if (row) return row;
  const def =
    DEFAULT_TEMPLATES.find((t) => t.key === key && t.channel === channel) ||
    DEFAULT_TEMPLATES.find((t) => t.key === key);
  return def ? { ...def } : null;
}

// Reusable SMTP transport cache — nodemailer transports are expensive to create
// and can be reused across sends. We rebuild only when settings change.
let cachedTransport: nodemailer.Transporter | null = null;
let cachedKey = "";

function transportKey(s: Record<string, any>): string {
  return `${s["smtp.host"]}:${s["smtp.port"]}:${s["smtp.username"]}`;
}

async function getTransport(s: Record<string, any>): Promise<nodemailer.Transporter | null> {
  if (!s["smtp.enabled"] || !s["smtp.host"] || !s["smtp.username"]) return null;
  const key = transportKey(s);
  if (cachedTransport && cachedKey === key) return cachedTransport;
  // Close any stale transport
  if (cachedTransport) {
    try { await cachedTransport.close(); } catch (e) { console.error("[smtp] transport close error:", e); }
    cachedTransport = null;
  }
  const port = Number(s["smtp.port"]) || 587;
  cachedTransport = nodemailer.createTransport({
    host: s["smtp.host"],
    port,
    secure: port === 465,  // SSL for 465, TLS for 587/2587
    auth: { user: s["smtp.username"], pass: s["smtp.password"] },
    // Give a clear error if connection fails (don't hang forever)
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  cachedKey = key;
  return cachedTransport;
}

/** Build the "from" address. For providers like Resend, username is "resend"
 *  (not an email), so we MUST use senderEmail. If senderEmail is empty, fall
 *  back to username only if it looks like an email (Gmail). */
function buildFromAddress(s: Record<string, any>): string {
  const senderName = s["smtp.senderName"] || "Pradeep Medical Store";
  const senderEmail = s["smtp.senderEmail"]?.trim();
  const username = s["smtp.username"]?.trim();
  // Use senderEmail if set. Otherwise use username IF it looks like an email.
  const email = senderEmail || (username && username.includes("@") ? username : "");
  if (!email) {
    throw new Error(
      'SMTP "Sender Email" is required. Set it in Admin → Settings → SMTP. ' +
      'For Resend, use a verified sender email (e.g. care@pradeepmedical.com or onboarding@resend.dev).'
    );
  }
  return `"${senderName}" <${email}>`;
}

/** Test the SMTP connection. Returns { success, error }.
 *  Used by the Admin → Settings → SMTP "Test Connection" button. */
export async function testSmtpConnection(): Promise<{ success: boolean; error?: string }> {
  const settings = await getAllSettings();
  if (!settings["smtp.enabled"]) {
    return { success: false, error: "SMTP is not enabled. Enable it first." };
  }
  if (!settings["smtp.host"]) {
    return { success: false, error: "SMTP host is not set." };
  }
  if (!settings["smtp.username"]) {
    return { success: false, error: "SMTP username is not set." };
  }
  // For providers like Resend, username is "resend" (not an email) — senderEmail is required
  const senderEmail = settings["smtp.senderEmail"]?.trim();
  const username = settings["smtp.username"]?.trim();
  if (!senderEmail && (!username || !username.includes("@"))) {
    return {
      success: false,
      error: 'Sender Email is required for this SMTP provider. Set it in Admin → Settings → SMTP. For Resend, use a verified sender email (e.g. onboarding@resend.dev).',
    };
  }

  try {
    // Force a fresh transport (don't use cache for the test)
    if (cachedTransport) {
      try { await cachedTransport.close(); } catch (e) { console.error("[smtp] transport close error:", e); }
      cachedTransport = null;
    }
    const transport = await getTransport(settings);
    if (!transport) {
      return { success: false, error: "Could not create SMTP transport. Check settings." };
    }
    // verify() connects to the SMTP server and authenticates without sending an email
    await transport.verify();
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message ?? String(e) };
  }
}

interface SendOptions {
  to: string;
  templateKey: string;
  vars: Record<string, string | number>;
  customerId?: string;
  /** Always "email" — kept for backwards-compat with stored NotificationLog
   *  rows that may still reference the legacy "whatsapp" channel. */
  channel?: "email";
  subjectOverride?: string;
  /** Pre-rendered HTML body. When provided, bypasses template lookup and is
   *  sent as the email body verbatim. Useful for callers that build a custom
   *  HTML email (e.g. newsletter send) instead of relying on a stored
   *  template. */
  bodyOverride?: string;
}

/**
 * Send a notification. Returns the created NotificationLog record.
 * Email: sent via real SMTP (nodemailer) when smtp.enabled + host + username
 *        are configured by the admin. Otherwise logged only.
 * The NotificationLog always records the attempt (sent/failed) so admin &
 * customer can audit the history.
 *
 * EMAIL WRAPPING: every outgoing email is wrapped in the professional PMS
 * email template (header with dynamic store logo, emerald accent bar,
 * footer with store contact info + social links). Templates that are already
 * full HTML documents (the default customer notification templates) are sent
 * as-is — they already have their own professional header/footer. Template
 * fragments (admin alerts, newsletters, bodyOverride) are wrapped.
 *
 * STORE BRANDING VARS: the following variables are auto-injected into every
 * template render so admin-edited templates can use {{storeName}},
 * {{storePhone}}, {{storeEmail}}, {{storeAddress}}, {{storeLogo}} without
 * the caller having to pass them: storeName, storeTagline, storePhone,
 * storeEmail, storeAddress, storeLogo, storeWebsiteUrl.
 */
export async function sendNotification(opts: SendOptions) {
  const channel: "email" = "email";
  const template = await getTemplate(opts.templateKey, channel);

  // Auto-inject store branding vars so any template (default or admin-edited)
  // can reference {{storeName}}, {{storeLogo}}, etc. without the caller
  // passing them explicitly. Caller-provided vars take precedence.
  const settings = await getAllSettings();
  const brandingVars: Record<string, string> = {
    storeName: String(settings["store.name"] ?? "Pradeep Medical Store"),
    storeTagline: String(settings["store.tagline"] ?? ""),
    storePhone: String(settings["store.phone"] ?? ""),
    storeEmail: String(settings["store.email"] ?? ""),
    storeAddress: String(settings["store.address"] ?? ""),
    storeLogo: String(
      (settings["store.emailLogo"] as string | undefined) ||
      (settings["store.logo"] as string | undefined) ||
      ""
    ),
    storeWebsiteUrl: String(settings["store.websiteUrl"] ?? "https://pradeepmedical.com"),
  };
  const mergedVars: Record<string, string | number> = { ...brandingVars, ...opts.vars };

  const subject = opts.subjectOverride
    ?? (template ? renderTemplate(template.subject ?? opts.templateKey, mergedVars) : opts.templateKey);

  // Render the body. If bodyOverride is provided (e.g. pre-built admin
  // notification HTML or newsletter), use it directly. Otherwise render the
  // template body with the merged variables.
  const rawBody = opts.bodyOverride
    ?? (template ? renderTemplate(template.body, mergedVars) : JSON.stringify(opts.vars));

  // Wrap fragment bodies with the professional PMS email template. If the
  // body is already a full HTML document (the default customer notification
  // templates are), send it as-is to avoid double-wrapping.
  const isFullHtmlDoc = /^\s*<!DOCTYPE|^\s*<html[\s>]/i.test(rawBody);
  let body: string;
  let textBody: string;
  if (isFullHtmlDoc) {
    body = rawBody;
    textBody = htmlToPlainText(rawBody);
  } else {
    body = await wrapEmailHtml(rawBody, {
      preheader: subject,
    });
    textBody = htmlToPlainText(rawBody);
  }

  let status: "sent" | "failed" = "sent";
  let error: string | undefined;

  try {
    const transport = await getTransport(settings);
    if (transport) {
      const from = buildFromAddress(settings);
      await transport.sendMail({
        from,
        to: opts.to,
        subject,
        html: body,
        text: textBody,
      });
    } else {
      // SMTP not configured — mark as "logged" so the flow is still auditable
      // but distinguish from a real send. We keep status="sent" so dependent
      // flows (e.g. OTP) proceed; the admin sees the message in the log.
      status = "sent";
      error = "SMTP not configured — logged only";
    }
  } catch (e: any) {
    status = "failed";
    error = e?.message ?? String(e);
  }

  const log = await db.notificationLog.create({
    data: {
      customerId: opts.customerId,
      recipient: opts.to,
      channel,
      subject,
      body,
      status,
      templateKey: opts.templateKey,
      error,
    },
  });

  return log;
}

/** Convenience: send OTP to a customer via email.
 *  NOTE: customerId is optional because during registration the Customer record
 *  does not exist yet (data is held in OTP.pendingData until verification).
 *  The customer's phone + whatsappOptIn fields are accepted for backwards-
 *  compatibility with call sites, but WhatsApp dispatch was removed — only
 *  email is sent. */
export async function sendOtp(
  customer: { id?: string; name: string; email: string; phone?: string; whatsappOptIn?: boolean },
  otp: string,
  purpose: "register" | "login" | "reset",
  expiryMinutes: number
) {
  const key = purpose === "login" ? "login_otp" : "registration_otp";
  const vars = { name: customer.name, otp, expiry: String(expiryMinutes) };
  // customerId is undefined for registration (no Customer yet).
  await sendNotification({
    to: customer.email,
    templateKey: key,
    vars,
    customerId: customer.id,
    channel: "email",
  });
}

/** Convenience: send an order status notification via email. */
export async function sendOrderNotification(
  customer: { id: string; name: string; email: string; phone?: string },
  templateKey: string,
  vars: Record<string, string | number>
) {
  await sendNotification({
    to: customer.email,
    templateKey,
    vars,
    customerId: customer.id,
    channel: "email",
  });
}
