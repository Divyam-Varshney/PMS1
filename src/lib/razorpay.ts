// ============================================================================
// File: src/lib/razorpay.ts
// Purpose: Server-side Razorpay integration helpers. Credentials (keyId +
//          keySecret) are stored in the PaymentMethod table where key="razorpay"
//          and config is a JSON string like {"keyId":"...","keySecret":"..."}.
//          This keeps secrets OUT of the global Settings table (admin enters
//          them in the Payment Methods view, not in Settings) and lets multiple
//          gateway accounts coexist if needed.
// Role: Used by:
//   - /api/admin/payment-methods/razorpay-test   (Test Connection button)
//   - /api/checkout/razorpay                      (create order at checkout)
//   - /api/checkout/razorpay/verify               (verify signature + mark paid)
// ============================================================================

import Razorpay from "razorpay";
import crypto from "crypto";
import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Config loading — reads the Razorpay PaymentMethod row from DB and parses the
// config JSON. Throws a friendly error if credentials are missing or invalid.
// ---------------------------------------------------------------------------

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
}

/** Parse the PaymentMethod.config JSON into a RazorpayConfig. */
function parseConfig(raw: string | null | undefined): RazorpayConfig | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as Partial<RazorpayConfig>;
    if (!obj.keyId || !obj.keySecret) return null;
    return { keyId: obj.keyId, keySecret: obj.keySecret };
  } catch {
    return null;
  }
}

/** Load the Razorpay credentials from the DB. Throws if not configured. */
export async function getRazorpayConfig(): Promise<RazorpayConfig> {
  const pm = await db.paymentMethod.findUnique({ where: { key: "razorpay" } });
  const cfg = parseConfig(pm?.config ?? null);
  if (!cfg) {
    throw new Error(
      "Razorpay credentials are not configured. Open Admin → Payment Methods → Razorpay and enter Key ID + Key Secret."
    );
  }
  return cfg;
}

/** Non-throwing variant — returns null instead of throwing. */
export async function tryGetRazorpayConfig(): Promise<RazorpayConfig | null> {
  try {
    return await getRazorpayConfig();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Instance factory — returns a Razorpay SDK instance with the loaded creds.
// ---------------------------------------------------------------------------

let cachedInstance: Razorpay | null = null;
let cachedInstanceKey = "";

/** Returns a Razorpay SDK instance using the credentials from PaymentMethod.config. */
export async function getRazorpayInstance(): Promise<Razorpay> {
  const cfg = await getRazorpayConfig();
  // Cache the instance per credential set so repeated requests don't reload.
  const cacheKey = `${cfg.keyId}:${cfg.keySecret.slice(0, 4)}`;
  if (cachedInstance && cachedInstanceKey === cacheKey) return cachedInstance;
  const instance = new Razorpay({
    key_id: cfg.keyId,
    key_secret: cfg.keySecret,
  });
  cachedInstance = instance;
  cachedInstanceKey = cacheKey;
  return instance;
}

/** Expose the public key ID for the checkout modal (safe to send to client). */
export async function getRazorpayKeyId(): Promise<string> {
  const cfg = await getRazorpayConfig();
  return cfg.keyId;
}

// ---------------------------------------------------------------------------
// Order creation — wraps instance.orders.create() with our conventions:
//   - amount: INR rupees → paise (× 100) as required by Razorpay
//   - currency: INR
//   - receipt: the internal orderId (cuid), truncated to 40 chars per Razorpay
//   - notes.orderId: full internal orderId for traceability on the dashboard
// ---------------------------------------------------------------------------

export interface RazorpayOrderResult {
  /** Razorpay order id (e.g. "order_JHD834hjbxzhd38d"). */
  id: string;
  /** Amount in paise (as returned by Razorpay). */
  amount: number;
  currency: string;
  /** Razorpay order status (typically "created" for a fresh order). */
  status: string;
  /** Internal order id we passed as receipt. */
  receipt: string;
}

/** Create a Razorpay order for the given amount (in rupees) + internal orderId. */
export async function createRazorpayOrder(
  amountRupees: number,
  orderId: string
): Promise<RazorpayOrderResult> {
  const instance = await getRazorpayInstance();
  const amountPaise = Math.max(1, Math.round(amountRupees * 100));
  // Razorpay receipts: max 40 chars, alphanumeric + a few symbols. cuid ids
  // are already alphanumeric + safe — but truncate defensively.
  const receipt = orderId.slice(0, 40);
  const created = await instance.orders.create({
    amount: amountPaise,
    currency: "INR",
    receipt,
    notes: { orderId, source: "pms-checkout" },
  });
  // The SDK returns any shape; coerce to our typed result.
  const r = created as unknown as {
    id: string;
    amount: number;
    currency: string;
    status: string;
    receipt?: string;
  };
  if (!r || !r.id) {
    throw new Error("Razorpay did not return an order id");
  }
  return {
    id: r.id,
    amount: r.amount,
    currency: r.currency,
    status: r.status,
    receipt: r.receipt ?? receipt,
  };
}

// ---------------------------------------------------------------------------
// Signature verification — used by the verify endpoint after the customer
// completes the Razorpay checkout modal. Razorpay signs the response with
// HMAC-SHA256(key_secret, `${razorpay_order_id}|${razorpay_payment_id}`).
// We use the SDK's validateWebhookSignature helper (same algorithm) for
// consistency, with a fallback to a manual crypto verify in case the SDK
// signature is unavailable.
// ---------------------------------------------------------------------------

export interface RazorpayVerifyInput {
  razorpayPaymentId: string;
  razorpayOrderId: string;
  razorpaySignature: string;
}

/** Verify the payment signature returned by the Razorpay checkout modal. */
export async function verifyRazorpayPayment(
  paymentId: string,
  orderId: string,
  signature: string
): Promise<boolean> {
  const cfg = await getRazorpayConfig();
  const body = `${orderId}|${paymentId}`;
  // Prefer the SDK helper (matches Razorpay's official algorithm).
  try {
    const valid = Razorpay.validateWebhookSignature(body, signature, cfg.keySecret);
    if (typeof valid === "boolean") return valid;
    if (valid) return true;
  } catch {
    // fall through to manual verify
  }
  // Manual fallback — HMAC-SHA256 hex digest.
  const expected = crypto
    .createHmac("sha256", cfg.keySecret)
    .update(body)
    .digest("hex");
  // timingSafeEqual requires equal-length buffers.
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(signature, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Test connection — used by the admin "Test Connection" button. Creates a
// Rs. 1 test order, verifies the SDK call succeeded, then attempts to cancel
// the order so it doesn't sit around in the merchant's Razorpay dashboard.
// Returns { success: true } or throws with a helpful message.
// ---------------------------------------------------------------------------

export async function testRazorpayConnection(): Promise<{ success: true; orderId: string }> {
  const instance = await getRazorpayInstance();
  const created = await instance.orders.create({
    amount: 100, // Rs. 1 in paise
    currency: "INR",
    receipt: `test-${Date.now()}`,
    notes: { source: "pms-admin-test" },
  });
  const r = created as unknown as { id?: string };
  if (!r?.id) {
    throw new Error("Razorpay accepted the call but returned no order id");
  }
  // Best-effort cancel — failures here don't fail the test (the order was
  // created successfully, which proves the credentials work). The SDK's
  // TypeScript types don't expose `orders.cancel` even though the underlying
  // REST API supports it, so we cast to any to call it.
  try {
    await (instance.orders as unknown as {
      cancel: (orderId: string) => Promise<unknown>;
    }).cancel(r.id);
  } catch {
    // ignore — order auto-expires in Razorpay after a few minutes
  }
  return { success: true, orderId: r.id };
}
