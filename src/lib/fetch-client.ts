// ============================================================================
// File: src/lib/fetch-client.ts
// Purpose: Shared typed fetch client for BOTH the customer SPA and the admin
//          SPA. All PMS API responses use the envelope { ok: boolean, data?: T,
//          error?: string }. This module centralizes JSON / mutation handling
//          and toast feedback so the two SPA api.ts modules stay thin.
// Role: Single source of truth for ApiError / request / api / run. Re-exported
//       by src/components/customer/api.ts and src/components/admin/api.ts —
//       never import this directly from a view component; use your SPA's api.ts.
// ============================================================================

import { toast } from "sonner";

/** Error thrown by the fetch client when a request fails. `status` carries the
 *  HTTP code so callers can branch on 401 / 403 / 404 etc. The message is
 *  guaranteed to be a string (never [object Object]) for safe toast rendering. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    // Defensive: ensure message is always a string to prevent [object Object]
    // from appearing in toasts/UI if the backend sends a non-string error.
    super(typeof message === "string" ? message : String(message ?? "Unknown error"));
    this.status = status;
  }
}

async function request<T>(
  method: string,
  url: string,
  body?: unknown,
  opts: { raw?: boolean; headers?: Record<string, string> } = {}
): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: {
      ...(body && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...opts.headers,
    },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });

  // Raw (binary) response — for PDF / image download
  if (opts.raw) {
    if (!res.ok) throw new ApiError(`Request failed (${res.status})`, res.status);
    return (await res.arrayBuffer()) as unknown as T;
  }

  const json = await res.json().catch(() => ({ ok: false, error: "Invalid JSON" }));
  if (!res.ok || !json.ok) {
    // Ensure error is always a string — backend err() always sends strings,
    // but this guards against any edge case that could render [object Object].
    const errMsg = typeof json.error === "string" ? json.error : `Request failed (${res.status})`;
    throw new ApiError(errMsg, res.status);
  }
  return json.data as T;
}

/** Typed fetch helper. Callable as `api(url)` (GET) AND as `api.get/post/...`.
 *  - `api.get<T>(url)`
 *  - `api.post<T>(url, body?)` / `api.put` / `api.patch`
 *  - `api.del<T>(url)`
 *  - `api.upload<T>(url, formData)`
 *  - `api.raw(url)` → ArrayBuffer (for PDF download)
 */
export const api = Object.assign(
  <T>(url: string) => request<T>("GET", url),
  {
    get: <T>(url: string) => request<T>("GET", url),
    post: <T>(url: string, body?: unknown) => request<T>("POST", url, body),
    put: <T>(url: string, body?: unknown) => request<T>("PUT", url, body),
    patch: <T>(url: string, body?: unknown) => request<T>("PATCH", url, body),
    del: <T>(url: string) => request<T>("DELETE", url),
    upload: <T>(url: string, form: FormData) => request<T>("POST", url, form),
    raw: (url: string) => request<ArrayBuffer>("GET", url, undefined, { raw: true }),
  }
);

/** Run an async action with try/catch + toast feedback. Returns the result on
 *  success, or `null` on error (after toasting). Pass `silent: true` to mute. */
export async function run<T>(
  fn: () => Promise<T>,
  options: { success?: string; error?: string; silent?: boolean } = {}
): Promise<T | null> {
  try {
    const result = await fn();
    if (options.success && !options.silent) toast.success(options.success);
    return result;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Something went wrong";
    if (!options.silent) toast.error(options.error ? `${options.error}: ${msg}` : msg);
    return null;
  }
}
