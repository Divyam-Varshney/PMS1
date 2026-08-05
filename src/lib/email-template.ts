// ============================================================================
// File: src/lib/email-template.ts
// Purpose: Shared professional HTML email wrapper applied to EVERY outgoing
//          email from the PMS platform (customer notifications + admin
//          alerts). The wrapper provides:
//            • Emerald/teal accent header bar with the store logo
//            • Clean system-font typography (cross-client compatible)
//            • Table-based layout for maximum Gmail / Outlook / Apple Mail
//              compatibility (no <div> flex / grid — email clients strip it)
//            • Explicit colors (NO transparent backgrounds, NO currentColor)
//              so dark-mode email clients render predictably
//            • Plain-text fallback generation
//            • Footer with store contact info + social links + copyright
//            • Call-to-action button helper (emerald background, white text)
//
// Role: Called by sendNotification() in src/lib/notifications.ts and by
//       buildEmailHtml() in src/lib/admin-notifications.ts.
// ============================================================================

import { getAllSettings } from "@/lib/settings";

export interface EmailWrapperOptions {
  /** Optional preheader text shown in the inbox preview (after the subject).
   *  Hidden inside the email body itself with `display:none`. */
  preheader?: string;
  /** Optional deep-link URL for the primary call-to-action button.
   *  When omitted, no button is rendered. */
  ctaUrl?: string;
  /** Optional label for the CTA button (defaults to "Visit Store"). */
  ctaLabel?: string;
}

interface StoreBranding {
  storeName: string;
  storeTagline: string;
  storeEmail: string;
  storePhone: string;
  storeAddress: string;
  storeLogo: string;
  storeWebsiteUrl: string;
  storeFacebook: string;
  storeInstagram: string;
  storeTwitter: string;
  gstNumber: string;
  license: string;
}

/** Load store branding from the settings table. */
async function loadBranding(): Promise<StoreBranding> {
  const s = await getAllSettings();
  // Prefer the dedicated email logo, then fall back to the main store logo.
  const logo =
    (s["store.emailLogo"] as string | undefined) ||
    (s["store.logo"] as string | undefined) ||
    "";
  return {
    storeName: s["store.name"] ?? "Pradeep Medical Store",
    storeTagline: s["store.tagline"] ?? "",
    storeEmail: s["store.email"] ?? "",
    storePhone: s["store.phone"] ?? "",
    storeAddress: s["store.address"] ?? "",
    storeLogo: logo,
    storeWebsiteUrl: s["store.websiteUrl"] ?? "https://pradeepmedical.com",
    storeFacebook: s["store.facebook"] ?? "",
    storeInstagram: s["store.instagram"] ?? "",
    storeTwitter: s["store.twitter"] ?? "",
    gstNumber: s["store.gstNumber"] ?? "",
    license: s["store.licenseNumber"] ?? "",
  };
}

/** Build the standard email footer (contact info + social + copyright). */
function buildFooter(b: StoreBranding): string {
  const year = new Date().getFullYear();
  const contactParts: string[] = [];
  if (b.storeAddress) contactParts.push(b.storeAddress);
  if (b.storePhone) contactParts.push(`Phone: ${b.storePhone}`);
  if (b.storeEmail) contactParts.push(`Email: ${b.storeEmail}`);
  if (b.gstNumber) contactParts.push(`GSTIN: ${b.gstNumber}`);
  if (b.license) contactParts.push(`DL: ${b.license}`);

  const socialLinks: string[] = [];
  if (b.storeFacebook) {
    socialLinks.push(
      `<a href="${escapeHtml(b.storeFacebook)}" style="display:inline-block;width:32px;height:32px;line-height:32px;text-align:center;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:50%;color:#059669;text-decoration:none;font-size:14px;margin:0 4px;" title="Facebook">f</a>`
    );
  }
  if (b.storeInstagram) {
    socialLinks.push(
      `<a href="${escapeHtml(b.storeInstagram)}" style="display:inline-block;width:32px;height:32px;line-height:32px;text-align:center;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:50%;color:#059669;text-decoration:none;font-size:14px;margin:0 4px;" title="Instagram">i</a>`
    );
  }
  if (b.storeTwitter) {
    socialLinks.push(
      `<a href="${escapeHtml(b.storeTwitter)}" style="display:inline-block;width:32px;height:32px;line-height:32px;text-align:center;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:50%;color:#059669;text-decoration:none;font-size:14px;margin:0 4px;" title="Twitter">t</a>`
    );
  }
  const socialBlock = socialLinks.length
    ? `<div style="text-align:center;margin:12px 0 16px;">${socialLinks.join("")}</div>`
    : "";

  return `
        <tr>
          <td style="background-color:#f9fafb;padding:24px 32px;border-top:1px solid #e5e7eb;">
            ${socialBlock}
            <p style="margin:0 0 8px 0;font-size:13px;color:#4b5563;line-height:1.6;text-align:center;">
              <strong style="color:#111827;">${escapeHtml(b.storeName)}</strong><br />
              ${contactParts.map((p) => escapeHtml(p)).join("<br />")}
            </p>
            <p style="margin:8px 0 0 0;font-size:11px;color:#9ca3af;line-height:1.5;text-align:center;">
              &copy; ${year} ${escapeHtml(b.storeName)}. All rights reserved.<br />
              This is an automated email — please do not reply directly. For help, contact us at ${escapeHtml(b.storeEmail || "care@pradeepmedical.com")}.
            </p>
          </td>
        </tr>`;
}

/** Build the standard email header (logo + accent bar). */
function buildHeader(b: StoreBranding): string {
  const logoBlock = b.storeLogo
    ? `<img src="${escapeHtml(b.storeLogo)}" alt="${escapeHtml(b.storeName)}" style="height:44px;width:auto;max-width:180px;vertical-align:middle;border:0;" />`
    : `<span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.3px;vertical-align:middle;"><span style="font-size:26px;margin-right:8px;">&#128138;</span>${escapeHtml(b.storeName)}</span>`;

  const taglineBlock = b.storeTagline
    ? `<div style="font-size:11px;color:#d1fae5;margin-top:6px;letter-spacing:1.5px;text-transform:uppercase;">${escapeHtml(b.storeTagline)}</div>`
    : "";

  return `
        <tr>
          <td style="background:linear-gradient(135deg,#065f46 0%,#059669 50%,#0d9488 100%);background-color:#059669;padding:20px 32px;text-align:center;">
            ${logoBlock}
            ${taglineBlock}
          </td>
        </tr>`;
}

/** Build a CTA button block. */
function buildCtaButton(url: string, label: string): string {
  return `
        <tr>
          <td style="padding:8px 32px 24px;text-align:center;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td style="background-color:#059669;border-radius:8px;">
                  <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background-color:#059669;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;border:1px solid #047857;">
                    ${escapeHtml(label)} &rarr;
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
}

/** Escape HTML special chars to prevent template-variable injection. */
function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Wrap a pre-rendered HTML body inside the professional PMS email template.
 *
 * The inner body is expected to be a fragment (no <html>/<body> tags) — it
 * will be placed inside a 600px-wide table cell with consistent padding.
 *
 * Returns the full HTML document (ready to send via nodemailer).
 */
export async function wrapEmailHtml(
  innerHtml: string,
  options: EmailWrapperOptions = {}
): Promise<string> {
  const b = await loadBranding();

  const ctaBlock =
    options.ctaUrl && options.ctaLabel
      ? buildCtaButton(options.ctaUrl, options.ctaLabel)
      : "";

  // Preheader is hidden text shown in inbox previews. Must be the FIRST
  // text in the body for Gmail / Outlook to pick it up.
  const preheaderBlock = options.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f9fafb;opacity:0;">${escapeHtml(options.preheader)}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
  <title>${escapeHtml(b.storeName)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;-webkit-font-smoothing:antialiased;">
  ${preheaderBlock}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f5;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);border:1px solid #e5e7eb;">
          ${buildHeader(b)}
          <tr>
            <td style="padding:32px;font-size:15px;line-height:1.65;color:#374151;">
              ${innerHtml}
            </td>
          </tr>
          ${ctaBlock}
          ${buildFooter(b)}
        </table>
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="padding:16px 0;text-align:center;font-size:11px;color:#9ca3af;line-height:1.5;">
              This email was sent to you by ${escapeHtml(b.storeName)}.<br />
              If you did not expect this email, please ignore it — no action is needed.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Generate a plain-text fallback from a pre-rendered HTML body.
 * Strips tags, converts <br>/<p> to newlines, and trims whitespace.
 */
export function htmlToPlainText(html: string): string {
  return String(html ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
