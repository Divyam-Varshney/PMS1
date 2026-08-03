// ============================================================================
// File: src/components/customer/notification-onboarding.tsx
// Purpose: Shows a one-time dialog encouraging the customer to enable push
//          notifications after login. Triggered when:
//            • Customer is logged in
//            • No active push subscription exists on this device
//            • The dialog hasn't been previously dismissed (localStorage flag)
//
//  Behavior:
//    • "Enable Notifications" → runs the same subscribe flow as
//      notification-preferences.tsx (requestPermission → SW subscribe →
//      POST /api/push/subscribe → PUT /api/app-notifs/preferences).
//    • "Skip for Now" → writes localStorage `notif_onboarding_dismissed`
//      = "true" so the dialog never re-appears (until the customer clears
//      browser storage).
//    • The dialog auto-closes on either action or after a successful enable.
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

const DISMISS_KEY = "notif_onboarding_dismissed";
const PREFS_QK = ["customer", "app-notif-prefs"] as const;

interface NotifPrefs {
  enabled: boolean;
  activeDevices: number;
}

const BENEFITS = [
  {
    icon: Package,
    title: "Order Status",
    desc: "Real-time updates when your order is confirmed, packed, or delivered.",
  },
  {
    icon: Truck,
    title: "Delivery Updates",
    desc: "Get notified when your delivery executive is on the way.",
  },
  {
    icon: FileText,
    title: "Prescription Status",
    desc: "Know the moment your prescription is reviewed and approved.",
  },
  {
    icon: Tag,
    title: "Exclusive Offers",
    desc: "Be the first to know about deals, vouchers, and seasonal discounts.",
  },
];

export function NotificationOnboarding({
  isAuthenticated,
}: {
  isAuthenticated: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pushSupported, setPushSupported] = useState(true);
  const [dismissed, setDismissed] = useState(true); // default: don't show
  const [hasSubscription, setHasSubscription] = useState(false);

  // 1) Detect Push API support + read the localStorage dismiss flag on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setPushSupported(supported);
    setDismissed(localStorage.getItem(DISMISS_KEY) === "true");
  }, []);

  // 2) Check the current push subscription state on this device + server pref.
  useEffect(() => {
    if (!isAuthenticated || !pushSupported || dismissed) return;
    let cancelled = false;

    const checkSubscription = async () => {
      try {
        // Local browser subscription check
        let localSub = false;
        try {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          localSub = !!sub;
        } catch {
          // SW not ready yet — assume no subscription
        }

        // Server-side preferences check
        let serverEnabled = false;
        try {
          const prefs = await api.get<NotifPrefs>("/api/app-notifs/preferences");
          serverEnabled = !!prefs?.enabled;
        } catch {
          // not logged in or endpoint unavailable
        }

        if (cancelled) return;
        const hasSub = localSub || serverEnabled;
        setHasSubscription(hasSub);
        // Show only if no subscription exists on this device and not dismissed
        if (!hasSub) {
          setOpen(true);
        }
      } catch (e) {
        // Silent — onboarding is best-effort
      }
    };

    checkSubscription();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, pushSupported, dismissed]);

  // -------------------------------------------------------------------------
  // Skip handler — persist dismissal so the dialog never re-appears.
  // -------------------------------------------------------------------------
  const handleSkip = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, "true");
    } catch {
      // localStorage may be blocked — best-effort
    }
    setDismissed(true);
    setOpen(false);
  }, []);

  // -------------------------------------------------------------------------
  // Enable flow — request permission + subscribe via SW + POST to backend
  // -------------------------------------------------------------------------
  const handleEnable = useCallback(async () => {
    setBusy(true);
    try {
      // 1. Notification permission
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast.error(
          "Notification permission was denied. Please allow notifications in your browser settings and try again."
        );
        return;
      }

      // 2. Wait for SW registration
      const reg = await navigator.serviceWorker.ready;

      // 3. Fetch VAPID public key
      const { publicKey } = await api.get<{ publicKey: string }>(
        "/api/push/vapid-public"
      );
      if (!publicKey) {
        toast.error("Push notifications are not configured on the server.");
        return;
      }

      // 4. Convert the base64url key to Uint8Array
      const applicationServerKey = urlBase64ToUint8Array(publicKey);

      // 5. Subscribe
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      // 6. POST to backend
      const subJson = subscription.toJSON();
      await api.post("/api/push/subscribe", {
        endpoint: subJson.endpoint,
        keys: subJson.keys,
        userAgent: navigator.userAgent,
      });

      // 7. Update preference (turn ON the master toggle)
      await api.put("/api/app-notifs/preferences", { enabled: true });

      // Mark as dismissed so we don't re-show after a successful enable
      try {
        localStorage.setItem(DISMISS_KEY, "true");
      } catch {}
      setDismissed(true);
      setHasSubscription(true);
      qc.invalidateQueries({ queryKey: PREFS_QK });
      toast.success(
        "Push notifications enabled. You'll receive order updates and offers on this device."
      );
      setOpen(false);
    } catch (e: any) {
      console.error("[notif-onboarding] enable failed:", e);
      toast.error(
        `Failed to enable notifications: ${e?.message || "unknown error"}`
      );
    } finally {
      setBusy(false);
    }
  }, [qc]);

  // Don't render anything if conditions aren't met
  if (!isAuthenticated || !pushSupported || dismissed || hasSubscription) {
    return null;
  }

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
                  <Icon className="size-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {benefit.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {benefit.desc}
                  </p>
                </div>
              </div>
            );
          })}

          <div className="flex items-start gap-2 rounded-lg bg-emerald-50/70 border border-emerald-100 p-3 text-xs text-emerald-900 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-200">
            <ShieldCheck className="size-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
            <p>
              Your privacy is protected. We only send transactional updates and
              occasional offers — no spam, ever. You can turn off notifications
              at any time.
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <DialogFooter className="flex-col gap-2 border-t bg-muted/30 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            disabled={busy}
            className="w-full sm:w-auto"
          >
            Skip for Now
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

// ---------------------------------------------------------------------------
// Utility — convert base64url VAPID key to Uint8Array for PushManager.
// ---------------------------------------------------------------------------
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
