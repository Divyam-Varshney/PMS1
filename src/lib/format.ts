// ============================================================================
// File: src/lib/format.ts
// Purpose: Shared formatting helpers (currency, dates, order numbers).
// Role: Single source for consistent display formatting across customer &
//       admin UIs.
// ============================================================================

export function formatCurrency(amount: number | string | null | undefined): string {
  const n = Number(amount);
  if (!isFinite(n)) return "Rs. 0.00";
  return `Rs. ${n.toFixed(2)}`;
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// IST (Asia/Kolkata, UTC+5:30) formatters — used everywhere a server-stored
// UTC timestamp needs to be shown to an Indian customer/admin (invoices,
// order detail pages, emails, PDFs). The server may run in UTC; using an
// explicit timeZone option guarantees a correct IST rendering regardless of
// the host machine's local timezone.
// ---------------------------------------------------------------------------

export function formatDateIST(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatDateTimeIST(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d) + " IST";
}

/** Compact IST timestamp for PDF invoices: "DD MMM YYYY, HH:MM AM/PM IST". */
export function formatInvoiceDateTimeIST(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  const fmt = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  // Replace the comma that Intl inserts before the time with " · " for a
  // cleaner PDF look. e.g. "02 Aug 2026 · 03:45 PM IST"
  return fmt.format(d).replace(/, (\d)/, " · $1") + " IST";
}

export function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return formatDate(d);
}

/** Generate a human-friendly order number like PMS-2024-000123 */
export function generateOrderNumber(prefix = "PMS"): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 900000 + 100000);
  return `${prefix}-${year}-${random}`;
}

/** Generate an invoice number like INV-2024-000123 */
export function generateInvoiceNumber(orderNumber: string): string {
  return `INV-${orderNumber.replace(/^PMS-/, "")}`;
}

/**
 * Slugify a product/brand/category name for SEO-friendly URLs.
 *
 * Produces clean, short, readable slugs by:
 *   1. Converting % → "percent"
 *   2. Cutting at marketing separators (|, —, :) to keep only the core name
 *   3. Removing filler words (with, for, the, and, of) when slug > 50 chars
 *   4. Capping at 60 characters (SEO best practice)
 *   5. Removing special characters, collapsing hyphens
 */
export function slugify(text: string): string {
  let slug = text
    .toString()
    .toLowerCase()
    .trim();

  // 1. Convert percentages
  slug = slug.replace(/%/g, " percent ");

  // 2. Cut at marketing separators
  slug = slug.split(/\s*[|—:]\s*/)[0];
  slug = slug.replace(/\s+-\s+.+$/, "");

  // 3. Replace spaces with hyphens
  slug = slug.replace(/[\s_]+/g, "-");

  // 4. Remove special characters
  slug = slug.replace(/[^\w-]+/g, "");

  // 5. Collapse hyphens
  slug = slug.replace(/--+/g, "-");
  slug = slug.replace(/^-+|-+$/g, "");

  // 6. Remove filler words if too long
  if (slug.length > 50) {
    const fillerWords = ["with", "for", "the", "and", "of", "a", "in", "on", "at", "to"];
    const parts = slug.split("-");
    slug = parts.filter((p) => !fillerWords.includes(p)).join("-");
  }

  // 7. Cap at 60 chars
  if (slug.length > 60) {
    slug = slug.slice(0, 60);
    const lastHyphen = slug.lastIndexOf("-");
    if (lastHyphen > 30) slug = slug.slice(0, lastHyphen);
  }

  return slug || "product";
}

/** Get initials from a name (for avatars). */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
