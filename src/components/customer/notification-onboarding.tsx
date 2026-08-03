// ============================================================================
// File: src/components/customer/notification-onboarding.tsx
// Purpose: Shows a one-time dialog encouraging the customer to enable push
//          notifications after login/signup. Appears ONLY when:
//            • Customer is logged in
//            • No active push subscription exists on this device
//            • Notification permission is not "granted"
//            • The dialog hasn't been previously dismissed (localStorage)
//
//  Re-show logic: if the customer clears browser data or logs in from a
//  new device, localStorage is empty → dialog shows again (correct behavior).
// ============================================================================

"use client";

import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Bell,
  Truck,
  Package,
  ShieldCheck,
  FileText,
  Tag,
  X,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "./api";

const DISMISS_KEY = "pms_notif_onboarding_done";

const BENEFITS = [
  { icon: Package, title: "Order Status", desc: "Real-time updates when your order is confirmed, packed, or delivered." },
  { icon: Truck, title: "Delivery Updates", desc: "Get notified when your delivery is on the way." },
  { icon: FileText, title: "Prescription Status", desc: "Know the moment your prescription is reviewed and approved." },
  { icon: Tag, title: "Exclusive Offers", desc: "Be the first to know about deals, vouchers, and seasonal discounts." },
];

export function NotificationOnboarding({
  isAuthenticated,
}: {
  isAuthenticated: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shouldCheck, setShouldCheck] = useState(false);

  // Step 1: On mount, check if push is supported and if onboarding was already done
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if push is supported
    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    if (!supported) return;

    // Check if already dismissed/completed
    const done = localStorage.getItem(DISMISS_KEY);
    if (done === "true") return;

    // If notification permission is already granted, don't show onboarding
    if (Notification.permission === "granted") {
      localStorage.setItem(DISMISS_KEY, "true");
      return;
    }

    // Mark for checking — we'll verify subscription when authenticated
    setShouldCheck(true);
  }, []);

  // Step 2: When authenticated + shouldCheck, verify no push subscription exists
  useEffect(() => {
    if (!isAuthenticated || !shouldCheck) return;

    let cancelled = false;

    const checkSubscription = async () => {
      try {
        // Check local browser subscription
        let hasLocalSub = false;
        try {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          hasLocalSub = !!sub;
        } catch {
          // SW not ready — assume no subscription
        }

        if (cancelled) return;

        // If already subscribed, mark as done
        if (hasLocalSub) {
          localStorage.setItem(DISMISS_KEY, "true");
          return;
        }

        // Show the onboarding dialog
        setOpen(true);
      } catch {
        // Silent — onboarding is best-effort
      }
    };

    // Small delay to let the page settle after login
    const timer = setTimeout(checkSubscription, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isAuthenticated, shouldCheck]);

  // Skip handler
  const handleSkip = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, "true");
    } catch {}
    setOpen(false);
  }, []);

  // Enable flow
  const handleEnable = useCallback(async () => {
    setBusy(true);
    try {
      // 1. Request notification permission
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast.error("Notification permission was denied. You can enable it later from Profile → Settings → App Notifications.");
        // Still mark as done so we don't keep pestering
        try { localStorage.setItem(DISMISS_KEY, "true"); } catch {}
        setOpen(false);
        return;
      }

      // 2. Wait for SW
      const reg = await navigator.serviceWorker.ready;

      // 3. Fetch VAPID public key
      const vapidRes = await fetch("/api/push/vapid-public");
      const vapidJson = await vapidRes.json();
      if (!vapidJson.data?.publicKey) {
        toast.error("Push notifications are not configured on the server.");
        return;
      }

      // 4. Convert base64url to Uint8Array
      const applicationServerKey = urlBase64ToUint8Array(vapidJson.data.publicKey);

      // 5. Subscribe via PushManager
      let subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      // 6. POST to backend
      const sub = subscription.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: sub.keys,
        }),
      });

      // 7. Update preference (enable master toggle)
      await api.put("/api/app-notifs/preferences", { enabled: true });

      // Mark as done
      try { localStorage.setItem(DISMISS_KEY, "true"); } catch {}
      qc.invalidateQueries({ queryKey: ["customer", "app-notif-prefs"] });
      toast.success("Notifications enabled! You'll receive order updates and offers on this device.");
      setOpen(false);
    } catch (e: any) {
      console.error("[notif-onboarding] enable failed:", e);
      toast.error(`Failed to enable notifications: ${e?.message || "unknown error"}`);
    } finally {
      setBusy(false);
    }
  }, [qc]);

  if (!isAuthenticated) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleSkip()}>
      <DialogContent className="max-w-md overflow-hidden p-0 sm:rounded-2xl">
        {/* Emerald gradient header */}
        <div className="relative bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-700 px-6 pb-6 pt-7 text-white">
          <button
            onClick={handleSkip}
            className="absolute right-4 top-4 rounded-full bg-white/15 p-1.5 transition hover:bg-white/25"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
          <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/30">
            <Bell className="size-7" />
          </div>
          <h2 className="text-xl font-bold leading-tight">Stay Updated</h2>
          <p className="mt-1.5 text-sm text-emerald-50/90">
            Never miss an important update. Enable push notifications to get
            instant alerts about your orders and prescriptions.
          </p>
        </div>

        {/* Benefits grid */}
        <div className="space-y-3 px-6 py-5">
          {BENEFITS.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <div key={benefit.title} className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{benefit.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{benefit.desc}</p>
                </div>
              </div>
            );
          })}

          <div className="flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50/70 p-3 text-xs text-emerald-900 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-200">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <p>
              Your privacy is protected. We only send transactional updates and
              occasional offers — no spam, ever. You can turn off notifications
              at any time.
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <DialogFooter className="flex-col gap-2 border-t bg-muted/30 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" size="sm" onClick={handleSkip} disabled={busy} className="w-full sm:w-auto">
            Not Now
          </Button>
          <Button
            size="sm"
            onClick={handleEnable}
            disabled={busy}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 sm:w-auto"
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Enabling...
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4" />
                Enable Notifications
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    arr[i] = raw.charCodeAt(i);
  }
  return arr;
}
