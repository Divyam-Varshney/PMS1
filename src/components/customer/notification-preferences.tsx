// ============================================================================
// File: src/components/customer/notification-preferences.tsx
// Purpose: Customer account → App Notifications settings. Clean, simple
//          toggle with professional description. No device count display.
// ============================================================================

"use client";

import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, BellOff, Loader2, ShieldCheck, Info } from "lucide-react";
import { toast } from "sonner";

interface NotifPrefs {
  enabled: boolean;
}

const QK = ["customer", "app-notif-prefs"] as const;

export function NotificationPreferences() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [pushSupported, setPushSupported] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPushSupported(
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    );
  }, []);

  const { data, isLoading } = useQuery<NotifPrefs>({
    queryKey: QK,
    queryFn: () => api.get<NotifPrefs>("/api/app-notifs/preferences"),
    staleTime: 30_000,
  });

  const enableNotifications = useCallback(async () => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast.error("Notification permission denied. Please allow notifications in your browser settings.");
        return false;
      }

      const reg = await navigator.serviceWorker.ready;
      const vapidRes = await fetch("/api/push/vapid-public");
      const vapidJson = await vapidRes.json();
      if (!vapidJson.data?.publicKey) {
        toast.error("Push notifications are not configured on the server.");
        return false;
      }

      const applicationServerKey = urlBase64ToUint8Array(vapidJson.data.publicKey);

      let subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      const sub = subscription.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint, keys: sub.keys }),
      });

      await api.put("/api/app-notifs/preferences", { enabled: true });
      toast.success("Notifications enabled. You'll receive order updates and offers on this device.");
      qc.invalidateQueries({ queryKey: QK });
      return true;
    } catch (e: any) {
      console.error("[notif-prefs] enable failed:", e);
      toast.error(`Failed to enable: ${e?.message || "unknown error"}`);
      return false;
    } finally {
      setBusy(false);
    }
  }, [qc]);

  const disableNotifications = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        try { await sub.unsubscribe(); } catch {}
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
      }
      await api.put("/api/app-notifs/preferences", { enabled: false });
      toast.success("Notifications disabled.");
      qc.invalidateQueries({ queryKey: QK });
      return true;
    } catch (e: any) {
      console.error("[notif-prefs] disable failed:", e);
      toast.error(`Failed to disable: ${e?.message || "unknown error"}`);
      return false;
    } finally {
      setBusy(false);
    }
  }, [qc]);

  const onToggle = useCallback(async (checked: boolean) => {
    if (checked) await enableNotifications();
    else await disableNotifications();
  }, [enableNotifications, disableNotifications]);

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
              <CardTitle className="text-base">Apps Notification's</CardTitle>
              <CardDescription className="mt-1 text-xs">
                Stay informed about your orders, prescriptions, medicine requests, exclusive offers, and important pharmacy announcements.
              </CardDescription>
            </div>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={onToggle}
            disabled={isLoading || busy || !pushSupported}
            aria-label="Toggle app notifications"
          />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {!pushSupported ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            <Info className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">Push notifications aren't supported in this browser.</p>
              <p className="mt-0.5 text-amber-700 dark:text-amber-300">
                Try Chrome, Edge, or Firefox on desktop / Android. iOS support requires installing the app to your home screen.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 text-xs text-emerald-900 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-200">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
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
          </div>
        )}
      </CardContent>
    </Card>
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
