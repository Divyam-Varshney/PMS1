// ============================================================================
// File: src/app/error.tsx
// Purpose: Next.js App Router error boundary. Catches unexpected runtime
//          errors and shows a friendly error page. Clean, NO admin links.
// ============================================================================

"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
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

        <h2 className="text-2xl font-bold text-foreground">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          An unexpected error occurred while loading this page. Please try again.
          If the problem persists, contact support.
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
            <Link href="/">
              <Home className="size-4" /> Go Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
