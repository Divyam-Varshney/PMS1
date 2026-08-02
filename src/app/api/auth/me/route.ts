// ============================================================================
// File: src/app/api/auth/me/route.ts
// Purpose: Return the currently logged-in customer (or null).
// Role: Used by the SPA on mount to hydrate the auth state.
// CRITICAL: This route MUST be dynamic and never cached. If Next.js caches a
//           pre-login `null` response, the user will appear logged out even
//           after a successful login. The `dynamic` export + Cache-Control
//           headers ensure every request hits the server with the cookie.
// ============================================================================

import { NextResponse } from "next/server";
import { getCustomerFromRequest } from "@/lib/auth";

// Force dynamic rendering — never cache this route's output.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const customer = await getCustomerFromRequest();
  // Add explicit no-store headers to prevent any browser/proxy caching.
  // Without this, the browser may serve a cached `null` response from before
  // login, causing an automatic logout within seconds of a successful login.
  const res = NextResponse.json({ ok: true, data: customer }, { status: 200 });
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  return res;
}
