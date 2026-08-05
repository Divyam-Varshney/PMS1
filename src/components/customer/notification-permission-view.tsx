// ============================================================================
// File: src/components/customer/notification-permission-view.tsx
// Purpose: Notification Permission onboarding page — simplified + minimal.
//          No logo, no gradient icon, no privacy notes. Just title, 4 benefits,
//          toggle, and Done/Not Now buttons.
// ============================================================================

"use client";

import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Truck,
  Package,
  FileText,
  Tag,
  Loader2,
  CheckCircle2,
  Bell,
} from "lucide-react";
import { toast } from "sonner";
import { useUI } from "@/lib/store";
import { getDeviceInfo } from "@/lib/device-utils";

const BENEFITS = [
  { icon: Package, title: "Order Updates" },
  { icon: Truck, title: "Delivery Tracking" },
  { icon: FileText, title: "Medicine Request Updates" },
  { icon: Tag, title: "Exclusive Offers" },
];

export function NotificationPermissionView() {
  const qc = useQueryClient();
  const navigate = useUI((s) => s.navigate);
  const [busy, setBusy] = useState(false);
  const [isOn, setIsOn] = useState(false);
  const [pushSupported, setPushSupported] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setPushSupported(supported);
    if (supported && Notification.permission === "granted") {
      setIsOn(true);
    }
  }, []);

  const handleToggle = useCallback(async (checked: boolean) => {
    if (!checked) {
      setIsOn(false);
      return;
    }
    setBusy(true);
    try {
      // 1. Request permission
      if (Notification.permission !== "granted") {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          setIsOn(false);
          toast.error("Permission denied. Enable from browser settings.");
          return;
        }
      }

      // 2. Ensure SW active
      let reg: ServiceWorkerRegistration | null = null;
      if (typeof window.__ensurePushReady === "function") {
        reg = await window.__ensurePushReady();
      } else {
        reg = await navigator.serviceWorker.ready;
      }
      if (!reg) throw new Error("Service Worker not active");

      // 3. Get VAPID key + subscribe
      const vapidRes = await fetch("/api/push/vapid-public");
      const vapidJson = await vapidRes.json();
      if (!vapidJson.data?.publicKey) throw new Error("Push not configured");

      let subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidJson.data.publicKey) as BufferSource,
        });
      }

      // 4. POST to backend
      const info = getDeviceInfo();
      const sub = subscription.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: sub.keys,
          userAgent: info.userAgent.slice(0, 500),
        }),
      });

      // 5. Register device
      await fetch("/api/device-registrations/register", {
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

      setIsOn(true);
      qc.invalidateQueries({ queryKey: ["customer", "app-notif-prefs"] });
      toast.success("Notifications enabled!");
    } catch (e: any) {
      setIsOn(false);
      toast.error("Could not enable notifications. Try again later.");
    } finally {
      setBusy(false);
    }
  }, [qc]);

  const handleDone = useCallback(() => navigate({ name: "home" }), [navigate]);

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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-8">
      <div className="w-full max-w-sm space-y-6">
        {/* Icon + Title — compact */}
        <div className="text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
            {isOn ? <CheckCircle2 className="size-6" /> : busy ? <Loader2 className="size-6 animate-spin" /> : <Bell className="size-6" />}
          </div>
          <h1 className="text-xl font-bold tracking-tight">Stay Updated</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Get instant alerts for your orders, deliveries, and exclusive offers.
          </p>
        </div>

        {/* Benefits — inline list, not cards */}
        <div className="grid grid-cols-2 gap-2">
          {BENEFITS.map((b) => {
            const Icon = b.icon;
            return (
              <div key={b.title} className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2">
                <Icon className="size-4 shrink-0 text-emerald-600" />
                <span className="text-xs font-medium">{b.title}</span>
              </div>
            );
          })}
        </div>

        {/* Toggle */}
        {pushSupported && (
          <div className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3">
            <span className="text-sm font-medium">Enable Notifications</span>
            <Switch
              checked={isOn}
              onCheckedChange={handleToggle}
              disabled={busy}
              aria-label="Toggle notifications"
            />
          </div>
        )}

        {!pushSupported && (
          <p className="text-center text-xs text-muted-foreground">
            Push notifications aren't supported in this browser.
          </p>
        )}

        {/* Buttons */}
        <div className="flex gap-2">
          <Button onClick={handleDone} disabled={busy} variant={isOn ? "default" : "outline"} className="flex-1">
            {isOn ? "Done" : "Done"}
          </Button>
          <Button onClick={handleNotNow} disabled={busy} variant="ghost" className="flex-1 text-muted-foreground">
            Not Now
          </Button>
        </div>

        {/* Single line note */}
        <p className="text-center text-xs text-muted-foreground">
          You can change this anytime from Profile → App Notifications.
        </p>
      </div>
    </div>
  );
}

function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
