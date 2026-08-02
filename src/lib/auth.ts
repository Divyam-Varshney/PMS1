// ============================================================================
// File: src/lib/auth.ts
// Purpose: Authentication & authorization helpers for both customers and
//          admins. Uses Node's built-in crypto (scrypt + HMAC) so we have
//          zero external auth dependencies and works in any runtime.
// Role: Password hashing, OTP generation, JWT-like token signing/verifying,
//       and cookie helpers for session management.
// ============================================================================

import crypto from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { OTP_LENGTH, TOKEN_EXPIRY_HOURS } from "@/lib/constants";

// Auth secret for HMAC token signing. In production, this MUST be set via the
// AUTH_SECRET environment variable (generate with `openssl rand -hex 32`).
// The fallback is ONLY for local development convenience and logs a warning.
const SECRET = process.env.AUTH_SECRET || (() => {
  if (process.env.NODE_ENV === "production") {
    console.error("FATAL: AUTH_SECRET environment variable is not set. Token signing is insecure.");
  }
  return "pms-dev-secret-change-in-production";
})();

// ---------------------------------------------------------------------------
// Password hashing (scrypt)
// ---------------------------------------------------------------------------

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const verify = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(verify, "hex"));
}

// ---------------------------------------------------------------------------
// Token signing (HMAC-SHA256)
// ---------------------------------------------------------------------------

function base64url(buf: Buffer | string) {
  return Buffer.from(buf).toString("base64url");
}

export interface TokenPayload {
  sub: string; // user id
  type: "customer" | "admin";
  role?: string;
  email: string;
  exp: number; // epoch ms
}

export function signToken(payload: Omit<TokenPayload, "exp">, expiresHours = TOKEN_EXPIRY_HOURS): string {
  const exp = Date.now() + expiresHours * 60 * 60 * 1000;
  const body = { ...payload, exp };
  const data = base64url(JSON.stringify(body));
  const sig = crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const [data, sig] = token.split(".");
    if (!data || !sig) return null;
    const expected = crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as TokenPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// OTP
// ---------------------------------------------------------------------------

export function generateOtp(): string {
  // Cryptographically secure numeric OTP
  const max = Math.pow(10, OTP_LENGTH) - 1;
  return crypto.randomInt(0, max).toString().padStart(OTP_LENGTH, "0");
}

// ---------------------------------------------------------------------------
// Session helpers (cookies) — server-side
// ---------------------------------------------------------------------------

export const CUSTOMER_COOKIE = "pms_customer_token";
export const ADMIN_COOKIE = "pms_admin_token";

// Cookie `secure` flag: when true, browsers only send the cookie over HTTPS.
// Production deployments with HTTPS (Vercel, cPanel+SSL) should set COOKIE_SECURE=true.
// HTTP-only deployments (sandbox, local dev without SSL) should leave it unset/false.
// Defaulting to NODE_ENV===production was unsafe because it blocked cookies behind
// HTTP reverse proxies, causing the admin panel to silently fail (login succeeds
// but /me returns 401 because the browser never resends the Secure cookie).
const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";

export async function setCustomerCookie(token: string, remember = false) {
  const c = await cookies();
  // "Remember Me" extends the session from 7 days to 30 days.
  const maxAgeHours = remember ? 24 * 30 : TOKEN_EXPIRY_HOURS;
  c.set(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeHours * 60 * 60,
  });
}

export async function setAdminCookie(token: string) {
  const c = await cookies();
  c.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: TOKEN_EXPIRY_HOURS * 60 * 60,
  });
}

export async function clearCustomerCookie() {
  const c = await cookies();
  c.delete(CUSTOMER_COOKIE);
}

export async function clearAdminCookie() {
  const c = await cookies();
  c.delete(ADMIN_COOKIE);
}

// ---------------------------------------------------------------------------
// Customer session lookups
//
// Two tiers exist because the heavy version (with addresses + _count) is only
// needed by `/api/customer/me` for the account page. Every other authenticated
// route (cart, checkout, orders, wishlist, reviews, prescriptions, etc.) only
// needs the customer's identity fields — running the heavy version on every
// request added ~150ms of extra DB roundtrips to Supabase (Tokyo region) which
// was the primary cause of cart slowness after the PostgreSQL migration.
// ---------------------------------------------------------------------------

/** Lightweight customer lookup — identity fields only.
 *  Use this in all cart/checkout/order/wishlist/review/prescription routes.
 *  Does NOT fetch addresses or _count (those are only needed by /api/customer/me). */
export async function getCustomerFromRequest() {
  try {
    const c = await cookies();
    const token = c.get(CUSTOMER_COOKIE)?.value;
    if (!token) return null;
    const payload = verifyToken(token);
    if (!payload || payload.type !== "customer") return null;
    const customer = await db.customer.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isEmailVerified: true,
        isActive: true,
        whatsappOptIn: true,
        createdAt: true,
      },
    });
    if (!customer || !customer.isActive) return null;
    return customer;
  } catch {
    return null;
  }
}

/** Full customer profile — identity + ALL addresses + order/prescription counts.
 *  Use ONLY in `/api/customer/me` (account page hydration). */
export async function getCustomerProfileFromRequest() {
  try {
    const c = await cookies();
    const token = c.get(CUSTOMER_COOKIE)?.value;
    if (!token) return null;
    const payload = verifyToken(token);
    if (!payload || payload.type !== "customer") return null;
    const customer = await db.customer.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isEmailVerified: true,
        isActive: true,
        whatsappOptIn: true,
        createdAt: true,
        addresses: {
          orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        },
        _count: { select: { orders: true, prescriptions: true } },
      },
    });
    if (!customer || !customer.isActive) return null;
    return customer;
  } catch {
    return null;
  }
}

export async function getAdminFromRequest() {
  try {
    const c = await cookies();
    const token = c.get(ADMIN_COOKIE)?.value;
    if (!token) return null;
    const payload = verifyToken(token);
    if (!payload || payload.type !== "admin") return null;
    const admin = await db.admin.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        permissions: true,
      },
    });
    if (!admin || !admin.isActive) return null;
    return admin;
  } catch {
    return null;
  }
}
