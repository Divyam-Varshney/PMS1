// ============================================================================
// File: src/components/customer/notification-onboarding.tsx
// Purpose: One-time onboarding dialog for App Notifications. Uses a toggle
//          switch instead of a button. Handles the full subscribe flow:
//            __ensurePushReady → requestPermission → getSubscription →
//            subscribe (if needed) → POST /api/push/subscribe → PUT preferences
//
//  CRITICAL FIX (Phase 39.5 audit):
//  --------------------------------
//  Previously, the toggle called `navigator.serviceWorker.ready` which could
//  resolve BEFORE the SW was actually active — causing:
//
//    "Failed to execute 'subscribe' on 'PushManager':
//     Subscription failed - no active Service Worker"
//
//  Fix: use the new `window.__ensurePushReady()` helper from sw-register.tsx,
//  which guarantees an ACTIVE ServiceWorkerRegistration before subscribing.
//
//  Key design decisions:
//    • Toggle switch (not button) — smoother UX, no double-click issue
//    • "Done" button closes the dialog (not the toggle action)
//    • Toggle handles permission + subscription in one async flow
//    • If permission already granted, skip re-requesting
//    • If subscription already exists, don't re-create it
//    • localStorage flag prevents re-showing on same device
// ============================================================================

"use client";

import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Bell,
  Truck,
  Package,
  FileText,
  Tag,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import { toast } from "sonner";

const DISMISS_KEY = "pms_notif_onboarding_done";

const BENEFITS = [
  { icon: Package, title: "Order Updates", desc: "Real-time updates when your order is confirmed, packed, or delivered." },
  { icon: Truck, title: "Delivery Status", desc: "Get notified when your delivery is on the way." },
  { icon: FileText, title: "Prescription Updates", desc: "Know the moment your prescription is reviewed and approved." },
  { icon: Tag, title: "Exclusive Offers", desc: "Be the first to know about deals, vouchers, and seasonal discounts." },
];

type ToggleState = "idle" | "requesting" | "subscribing" | "done" | "error";

export function NotificationOnboarding({
  isAuthenticated,
}: {
  isAuthenticated: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [toggleState, setToggleState] = useState<ToggleState>("idle");
  const [isOn, setIsOn] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pushSupported, setPushSupported] = useState(true);

  // Step 1: Check push support + localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    setPushSupported(supported);
    if (!supported) return;

    // Already dismissed?
    const done = localStorage.getItem(DISMISS_KEY);
    if (done === "true") return;

    // Permission already granted? Auto-dismiss.
    if (Notification.permission === "granted") {
      localStorage.setItem(DISMISS_KEY, "true");
      return;
    }
  }, []);

  // Step 2: When authenticated, check for existing subscription then show
  useEffect(() => {
    if (!isAuthenticated || !pushSupported) return;

    let cancelled = false;

    const check = async () => {
      try {
        // Check localStorage dismiss
        if (localStorage.getItem(DISMISS_KEY) === "true") return;

        // Check permission
        if (Notification.permission === "granted") {
          // Check if we have a subscription (use the helper — it ensures the
          // SW is registered AND active before checking).
          let hasSub = false;
          try {
            const ensureReady = window.__ensurePushReady;
            const reg = ensureReady ? await ensureReady() : await navigator.serviceWorker.ready;
            if (reg) {
              const sub = await reg.pushManager.getSubscription();
              hasSub = !!sub;
            }
          } catch {}

          if (hasSub) {
            localStorage.setItem(DISMISS_KEY, "true");
            return;
          }
        }

        if (!cancelled) {
          // Show the dialog after a short delay
          setTimeout(() => !cancelled && setOpen(true), 1500);
        }
      } catch {
        // Best-effort — if anything fails, just don't show
      }
    };

    check();
    return () => { cancelled = true; };
  }, [isAuthenticated, pushSupported]);

  // Step 3: Toggle handler — the full subscribe flow
  const handleToggle = useCallback(async (checked: boolean) => {
    if (!checked) {
      // Turning OFF — just update UI state
      setIsOn(false);
      setToggleState("idle");
      setErrorMsg(null);
      return;
    }

    // Turning ON
    setIsOn(true);
    setErrorMsg(null);
    setToggleState("requesting");

    try {
      // 1. Check if permission already granted
      if (Notification.permission !== "granted") {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          setToggleState("error");
          setErrorMsg("Notification permission was denied. Please allow notifications in your browser settings to enable this feature.");
          setIsOn(false);
          return;
        }
      }

      setToggleState("subscribing");

      // 2. Ensure the SW is registered AND active. This is the critical fix —
      //    navigator.serviceWorker.ready can resolve before the SW is active,
      //    causing "no active Service Worker" errors from pushManager.subscribe.
      //    The __ensurePushReady helper guarantees an active registration.
      let reg: ServiceWorkerRegistration | null = null;
      if (typeof window.__ensurePushReady === "function") {
        reg = await window.__ensurePushReady();
      } else {
        // Fallback — direct ready call (less robust)
        reg = await navigator.serviceWorker.ready;
      }
      if (!reg) {
        throw new Error("Service Worker failed to activate. Please refresh the page and try again.");
      }

      // 3. Check if already subscribed (avoid duplicate registration error)
      let subscription = await reg.pushManager.getSubscription();

      // 4. If no existing subscription, create one
      if (!subscription) {
        // Fetch VAPID public key
        const vapidRes = await fetch("/api/push/vapid-public");
        const vapidJson = await vapidRes.json();
        if (!vapidJson.data?.publicKey) {
          throw new Error("Push notifications are not configured on the server.");
        }

        const applicationServerKey = urlBase64ToUint8Array(vapidJson.data.publicKey);

        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as BufferSource,
        });
      }

      // 5. POST to backend
      const sub = subscription.toJSON();
      const subscribeRes = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: sub.keys,
          userAgent: navigator.userAgent.slice(0, 500),
        }),
      });

      if (!subscribeRes.ok) {
        const errData = await subscribeRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to save subscription on server");
      }

      // 6. Update preference
      await fetch("/api/app-notifs/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true }),
      });

      setToggleState("done");
      qc.invalidateQueries({ queryKey: ["customer", "app-notif-prefs"] });
      toast.success("Notifications enabled! You'll receive order updates and offers on this device.");
    } catch (e: any) {
      console.error("[notif-onboarding] subscribe failed:", e);
      setToggleState("error");
      setErrorMsg(e?.message || "Failed to enable notifications. Please try again later.");
      setIsOn(false);
    }
  }, [qc]);

  // Done button — closes dialog + saves localStorage
  const handleDone = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, "true");
    } catch {}
    setOpen(false);
  }, []);

  if (!isAuthenticated || !pushSupported) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleDone(); }}>
      <DialogContent className="max-w-md overflow-hidden p-0 sm:rounded-2xl">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-700 px-6 pb-6 pt-7 text-white">
          <button
            onClick={handleDone}
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
            Enable App Notifications to receive important updates about your orders and prescriptions.
          </p>
        </div>

        {/* Benefits */}
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
        </div>

        {/* Toggle section */}
        <div className="border-t bg-muted/30 px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Enable Notifications</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {toggleState === "requesting" && "Requesting browser permission..."}
                {toggleState === "subscribing" && "Registering your device..."}
                {toggleState === "done" && "Notifications enabled on this device."}
                {toggleState === "idle" && "Turn on to receive push notifications."}
                {toggleState === "error" && (errorMsg || "Failed to enable.")}
              </p>
            </div>

            {/* Toggle switch */}
            <div className="flex items-center gap-2">
              {toggleState === "requesting" || toggleState === "subscribing" ? (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              ) : toggleState === "done" ? (
                <CheckCircle2 className="size-5 text-emerald-600" />
              ) : toggleState === "error" ? (
                <AlertCircle className="size-5 text-amber-500" />
              ) : null}
              <Switch
                checked={isOn}
                onCheckedChange={handleToggle}
                disabled={toggleState === "requesting" || toggleState === "subscribing"}
                aria-label="Toggle notifications"
              />
            </div>
          </div>

          {/* Error message */}
          {toggleState === "error" && errorMsg && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
              {errorMsg}
            </div>
          )}

          {/* Privacy note */}
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 text-xs text-emerald-900 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-200">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <p>
              We only send transactional updates and occasional offers — no spam. You can change your preference at any time from{" "}
              <span className="font-medium">Profile → Settings → App Notifications</span>.
            </p>
          </div>
        </div>

        {/* Done button */}
        <div className="border-t px-6 py-4">
          <Button
            onClick={handleDone}
            className="w-full"
            variant={toggleState === "done" ? "default" : "outline"}
          >
            {toggleState === "done" ? "Done" : "Skip for Now"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Convert base64url VAPID key to Uint8Array
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
