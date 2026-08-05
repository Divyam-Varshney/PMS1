// ============================================================================
// File: src/components/customer/notification-permission-view.tsx
// Purpose: Dedicated Notification Permission onboarding page (Phase 40.2).
//          Replaces the old popup-based onboarding with a premium, full-page
//          experience similar to Amazon/Flipkart/Blinkit onboarding screens.
//
//  Layout:
//    • Centered logo at the top
//    • "Stay Updated" title
//    • Short description with benefit list
//    • ON/OFF toggle switch (not a button)
//    • "Done" (left) + "Not Now" (right) buttons at the bottom
//
//  Workflow:
//    • When toggle is turned ON: request browser permission → register device
//      → complete onboarding.
//    • "Done": if notifications enabled, save registration + continue to app.
//    • "Not Now": skip onboarding + continue to app. Can enable later from
//      Profile → App Notifications.
//
//  The page is shown as a regular SPA view (not a modal). The customer is
//  navigated here by the DeviceRegistrationWizard's validate check, and
//  navigated away (to home) on Done/Not Now.
// ============================================================================

"use client";

import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Bell,
  BellRing,
  Truck,
  Package,
  FileText,
  Tag,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { useUI } from "@/lib/store";
import { useCustomer } from "./use-customer";
import { usePublicSettings } from "./use-public-settings";
import { getDeviceInfo } from "@/lib/device-utils";

const BENEFITS = [
  { icon: Package, title: "Order Updates" },
  { icon: Truck, title: "Delivery Tracking" },
  { icon: FileText, title: "Medicine Request Updates" },
  { icon: Tag, title: "Exclusive Offers" },
];

type ToggleState = "idle" | "requesting" | "subscribing" | "done" | "error";

export function NotificationPermissionView() {
  const qc = useQueryClient();
  const navigate = useUI((s) => s.navigate);
  const { customer } = useCustomer();
  const { settings } = usePublicSettings();
  const [toggleState, setToggleState] = useState<ToggleState>("idle");
  const [isOn, setIsOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pushSupported, setPushSupported] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setPushSupported(supported);
    // If already granted + has subscription, reflect that.
    if (supported && Notification.permission === "granted") {
      setIsOn(true);
      setToggleState("done");
    }
  }, []);

  // Full subscribe flow — called when the toggle is turned ON.
  const runSubscribeFlow = useCallback(async () => {
    setBusy(true);
    setToggleState("requesting");
    try {
      // 1. Request browser permission
      if (Notification.permission !== "granted") {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          setToggleState("error");
          setIsOn(false);
          setBusy(false);
          toast.error("Notification permission was denied. You can enable it later from your browser settings.");
          return;
        }
      }

      setToggleState("subscribing");

      // 2. Ensure SW is registered + active
      let reg: ServiceWorkerRegistration | null = null;
      if (typeof window.__ensurePushReady === "function") {
        reg = await window.__ensurePushReady();
      } else {
        reg = await navigator.serviceWorker.ready;
      }
      if (!reg) {
        throw new Error("Service Worker failed to activate.");
      }

      // 3. Get VAPID public key
      const vapidRes = await fetch("/api/push/vapid-public");
      const vapidJson = await vapidRes.json();
      if (!vapidJson.data?.publicKey) {
        throw new Error("Push notifications are not configured on the server.");
      }

      const applicationServerKey = urlBase64ToUint8Array(vapidJson.data.publicKey);

      // 4. Create push subscription (or reuse existing)
      let subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as BufferSource,
        });
      }

      // 5. POST subscription to backend
      const info = getDeviceInfo();
      const sub = subscription.toJSON();
      const subscribeRes = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: sub.keys,
          userAgent: info.userAgent.slice(0, 500),
        }),
      });
      if (!subscribeRes.ok) {
        throw new Error("Failed to save subscription on server");
      }

      // 6. Register device + send welcome push
      const registerRes = await fetch("/api/device-registrations/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: info.deviceId,
          deviceLabel: info.deviceLabel,
          browserName: info.browserName,
          osName: info.osName,
          deviceType: info.deviceType,
          pushEndpoint: sub.endpoint,
        }),
      });
      if (!registerRes.ok) {
        throw new Error("Failed to register device");
      }

      setToggleState("done");
      setIsOn(true);
      qc.invalidateQueries({ queryKey: ["customer", "app-notif-prefs"] });
      toast.success("Notifications enabled! You'll receive order updates and offers on this device.");
    } catch (e: any) {
      console.error("[notif-permission-page] subscribe failed:", e);
      setToggleState("error");
      setIsOn(false);
      toast.error("We couldn't enable notifications. Please try again later.");
    } finally {
      setBusy(false);
    }
  }, [qc]);

  // Toggle handler
  const handleToggle = useCallback(async (checked: boolean) => {
    if (!checked) {
      // Turning OFF — just update UI state
      setIsOn(false);
      setToggleState("idle");
      return;
    }
    // Turning ON — run the full subscribe flow
    await runSubscribeFlow();
  }, [runSubscribeFlow]);

  // Done button — navigate to home
  const handleDone = useCallback(() => {
    navigate({ name: "home" });
  }, [navigate]);

  // Not Now button — skip + navigate to home
  const handleNotNow = useCallback(async () => {
    setBusy(true);
    try {
      const info = getDeviceInfo();
      await fetch("/api/device-registrations/skip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: info.deviceId,
          deviceLabel: info.deviceLabel,
          browserName: info.browserName,
          osName: info.osName,
          deviceType: info.deviceType,
        }),
      });
    } catch {}
    setBusy(false);
    navigate({ name: "home" });
  }, [navigate]);

  const logoUrl = settings?.store?.logo;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/50 via-background to-background dark:from-emerald-950/10 dark:via-background dark:to-background">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col px-6 py-10 sm:py-16">
        {/* Logo — centered at top */}
        <div className="flex justify-center">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={settings?.store?.name || "PMS Pharmacy"}
              className="h-14 w-auto object-contain"
            />
          ) : (
            <div className="flex h-14 items-center gap-2 text-emerald-600">
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
                <BellRing className="size-5" />
              </div>
              <span className="text-lg font-bold">{settings?.store?.name || "PMS Pharmacy"}</span>
            </div>
          )}
        </div>

        {/* Main content — centered */}
        <div className="flex flex-1 flex-col items-center justify-center py-10">
          {/* Icon */}
          <div className="mb-6 flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30">
            {toggleState === "done" ? (
              <CheckCircle2 className="size-10" />
            ) : busy ? (
              <Loader2 className="size-10 animate-spin" />
            ) : (
              <BellRing className="size-10" />
            )}
          </div>

          {/* Title */}
          <h1 className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Stay Updated
          </h1>

          {/* Description */}
          <p className="mt-3 text-center text-sm text-muted-foreground sm:text-base">
            Get instant alerts for your orders, deliveries, and exclusive offers.
          </p>

          {/* Benefits — clean 2x2 grid, no descriptions */}
          <div className="mt-6 grid w-full grid-cols-2 gap-3">
            {BENEFITS.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <div
                  key={benefit.title}
                  className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-card px-4 py-3"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                    <Icon className="size-4" />
                  </div>
                  <p className="text-sm font-medium text-foreground">{benefit.title}</p>
                </div>
              );
            })}
          </div>

          {/* Toggle section */}
          {pushSupported && (
            <div className="mt-8 w-full rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Enable Notifications</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {toggleState === "requesting" && "Requesting browser permission..."}
                    {toggleState === "subscribing" && "Registering your device..."}
                    {toggleState === "done" && "Notifications enabled on this device."}
                    {toggleState === "idle" && "Turn on to receive push notifications."}
                    {toggleState === "error" && "Permission denied. Enable from browser settings."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {toggleState === "requesting" || toggleState === "subscribing" ? (
                    <Loader2 className="size-4 animate-spin text-emerald-600" />
                  ) : toggleState === "done" ? (
                    <CheckCircle2 className="size-5 text-emerald-600" />
                  ) : toggleState === "error" ? (
                    <AlertCircle className="size-5 text-amber-500" />
                  ) : null}
                  <Switch
                    checked={isOn}
                    onCheckedChange={handleToggle}
                    disabled={busy || toggleState === "requesting" || toggleState === "subscribing"}
                    aria-label="Toggle notifications"
                  />
                </div>
              </div>
            </div>
          )}

          {!pushSupported && (
            <div className="mt-8 w-full rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
              <p className="font-medium">Push notifications aren't supported in this browser.</p>
              <p className="mt-1 text-xs">Try Chrome, Edge, or Firefox on desktop / Android. iOS requires installing the app to your home screen.</p>
            </div>
          )}

          {/* Privacy note + settings info */}
          <div className="mt-6 space-y-2">
            <div className="flex items-start gap-2 rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              <p>
                We only send transactional updates and occasional offers — no spam.
              </p>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-xs text-emerald-900 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-200">
              <Info className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              <p>
                You can enable or disable App Notifications at any time from{" "}
                <span className="font-medium">Profile → App Notifications</span> after completing setup.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom buttons */}
        <div className="flex gap-3">
          <Button
            onClick={handleDone}
            disabled={busy}
            className="flex-1 gap-1.5"
            variant={toggleState === "done" ? "default" : "outline"}
          >
            {toggleState === "done" ? (
              <>
                <CheckCircle2 className="size-4" /> Done
              </>
            ) : (
              <>
                Done <ArrowRight className="size-4" />
              </>
            )}
          </Button>
          <Button
            onClick={handleNotNow}
            disabled={busy}
            variant="ghost"
            className="flex-1 text-muted-foreground"
          >
            Not Now
          </Button>
        </div>
      </div>
    </div>
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
