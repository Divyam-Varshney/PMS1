// ============================================================================
// File: src/lib/api.ts
// Purpose: Shared API helpers — typed JSON responses, error handling, and
//          request body parsing for Next.js App Router route handlers.
// Role: Standardize every API response so the frontend can rely on a
//       consistent shape { ok, data?, error? }.
// ============================================================================

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

/** No-cache headers to prevent browser/proxy caching of sensitive responses. */
const NO_CACHE_HEADERS: HeadersInit = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

/**
 * Recursively convert Prisma Decimal objects to JS numbers in any data structure.
 * This ensures all monetary fields (mrp, sellingPrice, grandTotal, etc.) arrive
 * as `number` on the frontend, preventing string-concatenation bugs in
 * arithmetic and `===` comparison failures.
 *
 * Also converts BigInt (from raw SQL COUNT(*)) to number for safe JSON serialization.
 */
function serializeData(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Prisma.Decimal.isDecimal(value)) {
    return Number(value);
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(serializeData);
  }
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = serializeData(v);
    }
    return result;
  }
  return value;
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data: serializeData(data) }, { status });
}

/** Like ok() but with public CDN/browser caching. Use ONLY for genuinely public,
 *  rarely-changing data (catalog lists, brands, categories). NEVER use for
 *  cart, checkout, auth, or anything user-specific. */
export function okCached<T>(data: T, opts: { sMaxage?: number; swr?: number } = {}) {
  const sMaxage = opts.sMaxage ?? 60;
  const swr = opts.swr ?? 300;
  return NextResponse.json(
    { ok: true, data: serializeData(data) },
    {
      status: 200,
      headers: {
        "Cache-Control": `public, s-maxage=${sMaxage}, stale-while-revalidate=${swr}`,
      },
    }
  );
}

/** Like ok() but with no-cache headers. Use for auth/session routes where
 *  caching a stale response would cause security or UX bugs (e.g. cached
 *  pre-login null response causing auto-logout after login). */
export function okNoCache<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data: serializeData(data) }, { status, headers: NO_CACHE_HEADERS });
}

export function err(message: string, status = 400, details?: any) {
  // Defensive: ensure message is always a string to prevent [object Object]
  // from reaching the frontend. If a route accidentally passes a non-string
  // (e.g. an Error object or undefined), coerce it to a readable string.
  const msg = typeof message === "string" && message.length > 0
    ? message
    : typeof message === "object" && message !== null && "message" in message
      ? String((message as any).message)
      : "An error occurred";
  return NextResponse.json({ ok: false, error: msg, details }, { status });
}

export function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ ok: false, error: message }, { status: 401, headers: NO_CACHE_HEADERS });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ ok: false, error: message }, { status: 403 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ ok: false, error: message }, { status: 404 });
}

/** Safely parse a JSON body, returning null on failure. */
export async function parseBody<T = any>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

/** Get a search param as string. */
export function param(req: Request, key: string): string | undefined {
  const url = new URL(req.url);
  return url.searchParams.get(key) ?? undefined;
}

/** Get a search param as number. */
export function paramInt(req: Request, key: string, def = 0): number {
  const v = param(req, key);
  const n = v ? parseInt(v, 10) : def;
  return Number.isFinite(n) ? n : def;
}
