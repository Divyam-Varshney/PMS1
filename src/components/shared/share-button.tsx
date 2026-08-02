// ============================================================================
// File: src/components/shared/share-button.tsx
// Purpose: Product sharing feature — a polished share icon button that opens
//          a premium, modern share dialog on both desktop and mobile.
//          Options: copy link, native share (mobile), WhatsApp, Telegram,
//          Facebook, X (Twitter), Email.
//
// DESIGN PHILOSOPHY:
//   - Premium glassmorphism trigger button with emerald→teal gradient ring
//   - Elegant dialog: soft gradient header, refined icon tiles, subtle motion
//   - The shared URL uses the clean SEO-friendly /p/<slug> format
//   - WhatsApp share message includes product name + URL + short tagline
//
// RESPONSIVE DESIGN:
//   - Dialog: max-w-[calc(100vw-2rem)] on mobile, max-w-md on sm+
//   - Social tiles: grid-cols-3 on mobile (wraps to 2 rows), grid-cols-5 on sm+
//   - Copy-link row: full width, truncates URL on narrow screens
//   - All touch targets ≥ 44px (Apple/Google accessibility guideline)
//   - Scroll support if content exceeds viewport height
//   - Smooth open/close via Radix Dialog animations
// ============================================================================

"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Share2, Copy, Check, MessageCircle, Send, Facebook, Twitter, Mail, Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ShareButtonProps {
  productName: string;
  slug?: string;
  productId?: string;
  /** Optional short tagline / description shown in the share message
   *  (especially useful for WhatsApp, which supports multi-line messages). */
  tagline?: string;
  variant?: "icon" | "full";
  className?: string;
}

export function ShareButton({
  productName,
  slug,
  productId,
  tagline,
  variant = "icon",
  className,
}: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  // Resolve origin on the client (avoids SSR window access).
  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  // Generate the clean SEO-friendly URL: /p/<slug>
  // This is the canonical product URL that should be shared and indexed.
  // The /p/[slug] route renders SEO metadata then redirects to the SPA.
  const shareUrl = origin && slug
    ? `${origin}/p/${slug}`
    : origin && productId
      ? `${origin}/p/${productId}`
      : "";

  // Build a friendly WhatsApp / social share message that includes the
  // product name, a short tagline (if provided), and the URL on its own
  // line so WhatsApp linkifies it cleanly.
  const buildShareText = useCallback(
    (includeTagline: boolean) => {
      const lines = [`Check out *${productName}* on Pradeep Medical Store`];
      if (includeTagline && tagline) {
        lines.push(tagline);
      }
      return lines.join("\n");
    },
    [productName, tagline]
  );

  const copyLink = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = shareUrl;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    toast.success("Link copied to clipboard");
    setTimeout(() => setCopied(false), 2500);
  }, [shareUrl]);

  const nativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: productName,
          text: buildShareText(true),
          url: shareUrl,
        });
        setOpen(false);
      } catch {
        // User cancelled — keep the dialog open so they can pick another option.
      }
    } else {
      copyLink();
    }
  }, [productName, buildShareText, shareUrl, copyLink]);

  const shareOptions = [
    {
      label: "WhatsApp",
      icon: MessageCircle,
      bg: "bg-[#25D366]",
      hoverBg: "hover:bg-[#1da851]",
      onClick: () => {
        // WhatsApp supports multi-line + *bold* — include the tagline here.
        const text = buildShareText(true);
        const url = `https://wa.me/?text=${encodeURIComponent(`${text}\n${shareUrl}`)}`;
        window.open(url, "_blank", "noopener,noreferrer");
      },
    },
    {
      label: "Telegram",
      icon: Send,
      bg: "bg-[#0088cc]",
      hoverBg: "hover:bg-[#006699]",
      onClick: () =>
        window.open(
          `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(buildShareText(true))}`,
          "_blank",
          "noopener,noreferrer"
        ),
    },
    {
      label: "Facebook",
      icon: Facebook,
      bg: "bg-[#1877f2]",
      hoverBg: "hover:bg-[#0d5fb8]",
      onClick: () =>
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
          "_blank",
          "noopener,noreferrer"
        ),
    },
    {
      label: "X",
      icon: Twitter,
      bg: "bg-black dark:bg-zinc-900",
      hoverBg: "hover:bg-zinc-800 dark:hover:bg-zinc-800",
      onClick: () =>
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(buildShareText(false))}&url=${encodeURIComponent(shareUrl)}`,
          "_blank",
          "noopener,noreferrer"
        ),
    },
    {
      label: "Email",
      icon: Mail,
      bg: "bg-muted",
      hoverBg: "hover:bg-muted/70",
      onClick: () => {
        window.location.href = `mailto:?subject=${encodeURIComponent(productName)}&body=${encodeURIComponent(`${buildShareText(true)}\n\n${shareUrl}`)}`;
      },
    },
  ];

  const hasNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <>
      <Button
        variant="ghost"
        size={variant === "icon" ? "icon" : "sm"}
        className={cn(
          "group/share-btn relative transition-all duration-300",
          "hover:bg-primary/10 hover:text-primary",
          variant === "icon" && "rounded-full",
          className
        )}
        onClick={() => setOpen(true)}
        aria-label={`Share ${productName}`}
      >
        <Share2 className={cn(
          "transition-transform duration-300 group-hover/share-btn:rotate-12",
          variant === "icon" ? "size-4" : "size-3.5"
        )} />
        {variant === "full" && <span className="ml-1.5">Share</span>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md p-0 overflow-hidden gap-0">
          {/* Header — premium gradient with subtle decorative blob */}
          <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-700 px-5 py-5 text-white">
            {/* Decorative soft glow */}
            <div className="pointer-events-none absolute -right-8 -top-12 size-32 rounded-full bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute -left-6 -bottom-10 size-24 rounded-full bg-teal-300/20 blur-2xl" />
            <div className="relative flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
                <Share2 className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="flex items-center gap-2 text-base font-semibold leading-tight">
                  Share this product
                </DialogTitle>
                <DialogDescription className="mt-1 line-clamp-2 text-xs text-emerald-50/90">
                  {productName}
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Body — scrollable if needed */}
          <div className="max-h-[calc(80vh-6rem)] overflow-y-auto p-4 space-y-4">
            {/* Copy link — full-width row, premium feel */}
            <button
              onClick={copyLink}
              className="group/copy flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-all hover:border-primary/40 hover:shadow-sm active:scale-[0.98]"
            >
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors",
                  copied
                    ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground group-hover/copy:bg-primary/10 group-hover/copy:text-primary"
                )}
              >
                {copied ? <Check className="size-5" /> : <Link2 className="size-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {copied ? "Copied to clipboard" : "Copy product link"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {shareUrl || "Loading…"}
                </p>
              </div>
              {copied ? (
                <Check className="size-4 shrink-0 text-emerald-500" />
              ) : (
                <Copy className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/copy:opacity-100" />
              )}
            </button>

            {/* Native share — shown on mobile devices that support it */}
            {hasNativeShare && (
              <button
                onClick={nativeShare}
                className="group/native flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-all hover:border-primary/40 hover:shadow-sm active:scale-[0.98]"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 transition-colors group-hover/native:bg-primary group-hover/native:text-primary-foreground dark:bg-emerald-950/40 dark:text-emerald-300">
                  <Share2 className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">More options…</p>
                  <p className="text-xs text-muted-foreground">Use your device share menu</p>
                </div>
              </button>
            )}

            {/* Divider */}
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Share via
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Social share buttons — responsive grid
                Mobile: 3 cols (2 rows: 3 + 2) — larger touch targets
                sm+:   5 cols (1 row) — compact, fits all in one row */}
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 sm:gap-2">
              {shareOptions.map((opt) => (
                <button
                  key={opt.label}
                  onClick={opt.onClick}
                  className={cn(
                    "group/opt flex flex-col items-center justify-center gap-1.5 rounded-xl p-2.5 text-white transition-all duration-200 hover:scale-105 hover:shadow-lg active:scale-95 sm:p-2",
                    opt.bg, opt.hoverBg
                  )}
                  style={{ minHeight: "64px" }}
                  title={`Share via ${opt.label}`}
                  aria-label={`Share via ${opt.label}`}
                >
                  <opt.icon className="size-5 shrink-0 transition-transform duration-200 group-hover/opt:scale-110 sm:size-4" />
                  <span className="text-[10px] font-medium leading-none sm:text-[9px]">
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Tagline preview (if provided) — shows what recipients will see */}
            {tagline && (
              <div className="rounded-lg border border-dashed border-border/70 bg-accent/30 p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Message preview
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-foreground/80">
                  {buildShareText(true)}
                </p>
              </div>
            )}

            {/* Footer note */}
            <p className="pt-1 text-center text-[10px] text-muted-foreground">
              The clean <span className="font-mono text-foreground/70">/p/&lt;slug&gt;</span> link opens the product page directly
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
