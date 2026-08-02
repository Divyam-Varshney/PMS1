// ============================================================================
// File: src/lib/error-capture.ts
// Purpose: Lightweight client-side error capture. Automatically logs uncaught
//          errors + unhandled promise rejections to the ErrorLog table via the
//          /api/admin/error-logs POST endpoint. Used by the customer SPA +
//          admin panel to capture production errors without manual try/catch.
//
// USAGE (call once at app startup):
//   import { initErrorCapture } from "@/lib/error-capture";
//   initErrorCapture({ module: "customer-spa" });
// ============================================================================

let initialized = false;

interface CaptureOptions {
  module?: string;
}

interface ErrorPayload {
  severity?: string;
  module?: string;
  endpoint?: string;
  method?: string;
  message: string;
  stack?: string;
  userAgent?: string;
  requestUrl?: string;
  statusCode?: number;
}

/** Manually capture an error (use in try/catch blocks). */
export async function captureError(error: Error | string, opts: { module?: string; endpoint?: string; severity?: string } = {}): Promise<void> {
  const message = typeof error === "string" ? error : error.message;
  const stack = typeof error === "string" ? undefined : error.stack;

  const payload: ErrorPayload = {
    severity: opts.severity || "error",
    module: opts.module,
    endpoint: opts.endpoint,
    message,
    stack,
    requestUrl: typeof window !== "undefined" ? window.location.href : undefined,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
  };

  try {
    await fetch("/api/admin/error-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });
  } catch {
    // Silently fail — we don't want error capture to cause more errors
  }
}

/** Initialize global error capture (call once at app startup). */
export function initErrorCapture(opts: CaptureOptions = {}) {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  const moduleName = opts.module || "client";

  // Capture uncaught errors
  window.addEventListener("error", (event) => {
    captureError(event.error || event.message, { module: moduleName });
  });

  // Capture unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const error = reason instanceof Error ? reason : new Error(String(reason));
    captureError(error, { module: moduleName, severity: "warning" });
  });
}
