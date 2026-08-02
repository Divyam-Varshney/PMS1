// ============================================================================
// File: src/components/customer/notification-preferences.tsx
// Purpose: Customer account → Notification Preferences card. Shows:
//            • Master toggle for App (push) notifications
//            • Active device count ("You'll receive notifications on N device(s)")
//            • Live enable/disable via the subscribe / unsubscribe flow
//            • Auto-subscribe using the browser's PushManager + VAPID key
//
//  Behavior:
//    • On mount, fetches the preference + active device count.
//    • When the customer toggles ON:
//        1. Request notification permission (Notification.requestPermission).
//        2. Fetch VAPID public key from /api/push/vapid-public.
//        3. Subscribe via the SW's PushManager.
//        4. POST the subscription to /api/push/subscribe.
//        5. PUT /api/app-notifs/preferences { enabled: true }.
//    • When the customer toggles OFF:
//        1. Find the browser's current subscription via SW.
//        2. Unsubscribe from PushManager (stops the browser from receiving pushes).
//        3. POST /api/push/unsubscribe to delete the server-side row.
//        4. PUT /api/app-notifs/preferences { enabled: false }.
// ============================================================================

"use client";

import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, run } from "./api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, Loader2, Smartphone, ShieldCheck, Info } from "lucide-react";
import { toast } from "sonner";

interface NotifPrefs {
  enabled: boolean;
  updatedAt: string;
  activeDevices: number;
}

const QK = ["customer", "app-notif-prefs"] as const;

export function NotificationPreferences() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [pushSupported, setPushSupported] = useState(true);

  // Detect Push API support once on mount (SSR-safe).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setPushSupported(supported);
  }, []);

  const { data, isLoading } = useQuery<NotifPrefs>({
    queryKey: QK,
    queryFn: () => api.get<NotifPrefs>("/api/app-notifs/preferences"),
    staleTime: 30_000,
  });

  // -------------------------------------------------------------------------
  // Enable flow — request permission + subscribe via SW + POST to backend
  // -------------------------------------------------------------------------
  const enableNotifications = useCallback(async () => {
    setBusy(true);
    try {
      // 1. Notification permission
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast.error("Notification permission was denied. Please allow notifications in your browser settings and try again.");
        return false;
      }

      // 2. Wait for SW registration (it's registered on idle in layout).
      const reg = await navigator.serviceWorker.ready;

      // 3. Fetch VAPID public key
      const { publicKey } = await api.get<{ publicKey: string }>("/api/push/vapid-public");
      if (!publicKey) {
        toast.error("Push notifications are not configured on the server.");
        return false;
      }

      // 4. Convert the base64url key to Uint8Array (PushManager requires this).
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

      toast.success("Push notifications enabled. You'll receive order updates + offers on this device.");
      qc.invalidateQueries({ queryKey: QK });
      return true;
    } catch (e: any) {
      console.error("[notif-prefs] enable failed:", e);
      toast.error(`Failed to enable notifications: ${e?.message || "unknown error"}`);
      return false;
    } finally {
      setBusy(false);
    }
  }, [qc]);

  // -------------------------------------------------------------------------
  // Disable flow — unsubscribe via SW + DELETE backend row + turn OFF master
  // -------------------------------------------------------------------------
  const disableNotifications = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        // Stop the browser from receiving pushes
        try { await sub.unsubscribe(); } catch {}
        // Delete the server-side row
        await api.post("/api/push/unsubscribe", { endpoint: sub.endpoint });
      }
      // Turn OFF the master toggle (also deactivates other device subs)
      await api.put("/api/app-notifs/preferences", { enabled: false });
      toast.success("Push notifications disabled.");
      qc.invalidateQueries({ queryKey: QK });
      return true;
    } catch (e: any) {
      console.error("[notif-prefs] disable failed:", e);
      toast.error(`Failed to disable notifications: ${e?.message || "unknown error"}`);
      return false;
    } finally {
      setBusy(false);
    }
  }, [qc]);

  // -------------------------------------------------------------------------
  // Toggle handler — routes to enable / disable based on current state
  // -------------------------------------------------------------------------
  const onToggle = useCallback(
    async (checked: boolean) => {
      if (checked) {
        await enableNotifications();
      } else {
        await disableNotifications();
      }
    },
    [enableNotifications, disableNotifications]
  );

  const enabled = !!data?.enabled;

  return (
    <Card className="overflow-hidden border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${enabled ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
              {enabled ? <Bell className="size-5" /> : <BellOff className="size-5" />}
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base">App Notifications</CardTitle>
              <CardDescription className="mt-1 text-xs">
                Get order updates, payment alerts, and exclusive offers as push notifications on your device.
              </CardDescription>
            </div>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={onToggle}
            disabled={isLoading || busy || !pushSupported}
            aria-label="Toggle push notifications"
          />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {!pushSupported ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            <Info className="size-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Push notifications aren't supported in this browser.</p>
              <p className="mt-0.5 text-amber-700 dark:text-amber-300">
                Try Chrome, Edge, or Firefox on desktop / Android. iOS support requires installing the app to your home screen.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Smartphone className="size-4" />
                Active devices
              </span>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40">
                {data?.activeDevices ?? 0} device{(data?.activeDevices ?? 0) === 1 ? "" : "s"}
              </Badge>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-emerald-50/50 border border-emerald-100 p-3 text-xs text-emerald-900 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-200">
              <ShieldCheck className="size-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              <div className="space-y-1">
                <p className="font-medium">Your privacy is protected</p>
                <p className="text-emerald-800/90 dark:text-emerald-300/80">
                  We only send transactional updates (orders, payments, prescriptions) and occasional offers.
                  You can turn off notifications at any time. No spam, ever.
                </p>
              </div>
            </div>
            {busy && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                {enabled ? "Disabling..." : "Requesting permission..."}
              </p>
            )}
            {enabled && (data?.activeDevices ?? 0) === 0 && !busy && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Notifications are enabled but this device isn't subscribed. Toggle off and back on to re-subscribe.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Utility — convert base64url VAPID key to Uint8Array for PushManager.
// ---------------------------------------------------------------------------
function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  // Pad with '=' to make the length a multiple of 4 (base64 requirement).
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    arr[i] = raw.charCodeAt(i);
  }
  return arr;
}
