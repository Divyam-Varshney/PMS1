// ============================================================================
// File: src/app/global-error.tsx
// Purpose: Global error boundary — catches errors that the root layout's
//          error.tsx can't. Must include its own <html> and <body> tags.
//          Clean, NO admin links.
// ============================================================================

"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-amber-50 via-background to-rose-50 p-4">
          <div className="w-full max-w-md text-center">
            {/* Logo */}
            <img
              src="/logo.png"
              alt="Pradeep Medical Store"
              className="mx-auto mb-6 size-16 rounded-xl object-cover shadow-md"
            />

            {/* Error icon */}
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <AlertTriangle className="size-8" />
            </div>

            {/* 500 */}
            <h1 className="text-6xl font-extrabold text-foreground">
              500
            </h1>

            <h2 className="mt-4 text-xl font-bold text-foreground">
              Something Went Wrong
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              An unexpected server error occurred. Please try again in a moment.
            </p>

            {error.digest && (
              <p className="mt-3 text-[10px] text-muted-foreground/60">
                Error ID: {error.digest}
              </p>
            )}

            {/* Action buttons */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button onClick={reset} className="gap-2">
                <RefreshCw className="size-4" /> Try Again
              </Button>
              <Button asChild variant="outline" className="gap-2">
                <a href="/">Go to Homepage</a>
              </Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
