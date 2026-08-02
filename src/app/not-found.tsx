// ============================================================================
// File: src/app/not-found.tsx
// Purpose: Custom 404 page — shown when a user visits a route that doesn't
//          exist. Clean, user-friendly, NO admin links.
// ============================================================================

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-emerald-50 via-background to-teal-50 p-4">
      <div className="w-full max-w-md text-center">
        {/* Logo */}
        <img
          src="/logo.png"
          alt="Pradeep Medical Store"
          className="mx-auto mb-6 size-16 rounded-xl object-cover shadow-md"
        />

        {/* 404 big number */}
        <h1 className="bg-linear-to-br from-emerald-600 to-teal-700 bg-clip-text text-8xl font-extrabold text-transparent">
          404
        </h1>

        <h2 className="mt-4 text-xl font-bold text-foreground">
          Page Not Found
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Let&apos;s get you back to safety.
        </p>

        {/* Action buttons */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild className="gap-2">
            <Link href="/">
              <Home className="size-4" /> Go to Homepage
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link href="/#v=shop">
              <Search className="size-4" /> Browse Medicines
            </Link>
          </Button>
        </div>

        {/* Helpful links */}
        <div className="mt-8 flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <Link href="/" className="hover:text-primary">Home</Link>
          <span>·</span>
          <Link href="/#v=about" className="hover:text-primary">About</Link>
          <span>·</span>
          <Link href="/#v=contact" className="hover:text-primary">Contact</Link>
        </div>
      </div>
    </div>
  );
}
