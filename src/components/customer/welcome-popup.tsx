"use client";

// ============================================================================
// File: src/components/customer/welcome-popup.tsx
// Purpose: Professional welcome popup for first-time visitors per session.
//
// Behavior:
//   - Appears 1.5 seconds after the website opens.
//   - Uses sessionStorage (not localStorage) — appears once per browsing
//     session. When the customer closes the tab/browser and returns, it
//     appears again.
//   - Close (✕) button dismisses for the current session.
//   - Two CTAs: "Browse Medicines" (navigates to shop) and "Upload Prescription"
//   - Premium design with emerald gradient, smooth animations, mobile responsive.
// ============================================================================

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Pill, Upload, Search, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUI } from "@/lib/store";

const SESSION_KEY = "pms:welcome-shown";
const APPEAR_DELAY_MS = 1500;

export function WelcomePopup() {
  const [visible, setVisible] = useState(false);
  const navigate = useUI((s) => s.navigate);

  useEffect(() => {
    // Check sessionStorage — only show once per session
    try {
      const shown = window.sessionStorage.getItem(SESSION_KEY);
      if (shown) return; // Already shown this session
    } catch {
      // sessionStorage unavailable — proceed
    }

    const timer = window.setTimeout(() => setVisible(true), APPEAR_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      window.sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // ignore
    }
  };

  const goToShop = () => {
    dismiss();
    navigate({ name: "shop" });
  };

  const goToPrescription = () => {
    dismiss();
    navigate({ name: "prescription" });
  };

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop — semi-transparent, click to dismiss */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={dismiss}
          />

          {/* Popup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-emerald-200/60 bg-background shadow-2xl"
            role="dialog"
            aria-label="Welcome to Pradeep Medical Store"
          >
            {/* Header with gradient */}
            <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-700 px-5 py-5 text-white">
              {/* Decorative pattern */}
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
                  backgroundSize: "20px 20px",
                }}
              />
              <div className="relative flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm ring-1 ring-white/20">
                    <Pill className="size-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold leading-tight">Welcome to Pradeep Medical Store!</h2>
                    <p className="text-xs text-emerald-100">Your trusted online pharmacy in Mathura</p>
                  </div>
                </div>
                <button
                  onClick={dismiss}
                  aria-label="Close welcome popup"
                  className="rounded-lg p-1.5 transition-colors hover:bg-white/20"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="space-y-4 p-5">
              <p className="text-sm leading-relaxed text-foreground">
                We provide a wide range of <strong>genuine medicines</strong>, healthcare products,
                wellness essentials, and pharmacy services — delivered to your doorstep.
              </p>

              <div className="space-y-2.5">
                <div className="flex items-start gap-2.5 rounded-lg bg-accent/40 p-2.5">
                  <Search className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  <p className="text-xs text-muted-foreground">
                    <strong className="text-foreground">Can't find a medicine?</strong> Use our{" "}
                    <strong className="text-emerald-700 dark:text-emerald-400">Medicine Request</strong> feature
                    and our team will arrange it for you.
                  </p>
                </div>
                <div className="flex items-start gap-2.5 rounded-lg bg-accent/40 p-2.5">
                  <Upload className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  <p className="text-xs text-muted-foreground">
                    <strong className="text-foreground">Have a prescription?</strong> Upload it and our
                    pharmacist will prepare your order for fast delivery.
                  </p>
                </div>
                <div className="flex items-start gap-2.5 rounded-lg bg-accent/40 p-2.5">
                  <Heart className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  <p className="text-xs text-muted-foreground">
                    <strong className="text-foreground">Same-day delivery</strong> in Mathura, 2-3 days nationwide.
                    Licensed pharmacy with qualified pharmacists.
                  </p>
                </div>
              </div>

              {/* CTAs */}
              <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                <button
                  onClick={goToShop}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-600/20 transition-all",
                    "hover:shadow-lg hover:shadow-emerald-600/30 active:scale-95"
                  )}
                >
                  <Search className="size-4" />
                  Browse Medicines
                </button>
                <button
                  onClick={goToPrescription}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border/60 bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-all hover:bg-accent/50 active:scale-95"
                >
                  <Upload className="size-4" />
                  Upload Prescription
                </button>
              </div>

              <button
                onClick={dismiss}
                className="w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Continue browsing →
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
