// ============================================================================
// File: src/lib/payment-methods.ts
// Purpose: Server-side helpers for resolving payment method labels from the
//          DB (PaymentMethod table). Falls back to a hardcoded map for
//          legacy orders / speed. Used by invoice PDF, admin views, and
//          customer-facing order displays so that payment method labels
//          are always consistent with the admin-configured PaymentMethod table.
// ============================================================================

import { db } from "@/lib/db";

/** Hardcoded fallback labels (used for legacy orders + fast resolution). */
export const PAYMENT_LABEL_FALLBACK: Record<string, string> = {
  cod: "Cash on Delivery",
  qr: "QR Code Payment",
  upi: "UPI Payment",
  online: "Online Payment",
  razorpay: "Razorpay",
  cashfree: "Cashfree",
};

/** Cache of payment-method key → label, loaded once from DB. */
let labelCache: Record<string, string> | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 60_000; // 1 minute

/** Load all payment methods into a key→label map (cached for 60s). */
async function getLabelMap(): Promise<Record<string, string>> {
  if (labelCache && Date.now() < cacheExpiry) return labelCache;
  const methods = await db.paymentMethod.findMany({
    select: { key: true, label: true },
  });
  labelCache = { ...PAYMENT_LABEL_FALLBACK };
  for (const m of methods) {
    labelCache[m.key] = m.label;
  }
  cacheExpiry = Date.now() + CACHE_TTL;
  return labelCache;
}

/** Resolve a payment method key to its human-readable label. */
export async function getPaymentLabel(key: string): Promise<string> {
  if (!key) return "Unknown";
  const map = await getLabelMap();
  return map[key] ?? key.toUpperCase();
}

/** Synchronous fallback (for client-side use where async isn't possible). */
export function getPaymentLabelSync(key: string): string {
  if (!key) return "Unknown";
  return PAYMENT_LABEL_FALLBACK[key] ?? key.toUpperCase();
}
