// ============================================================================
// File: src/components/customer/notification-preferences.tsx
// Purpose: Customer account → App Notifications settings. Clean toggle with
//          professional description, active device count, and "Send Test" /
//          "Enable on this device" buttons.
//
//  CRITICAL FIX (Phase 39.5 audit):
//    • Use window.__ensurePushReady() to guarantee an ACTIVE SW before
//      subscribing (fixes "no active Service Worker" desktop error).
//    • Cast applicationServerKey as BufferSource to satisfy TS lib.dom.
//    • Send UA on subscribe so device analytics work.
//    • Show "N active device(s)" hint + "Send Test" button when enabled.
//    • Handle the "enabled on another device, not on this one" case with
//      a separate "Enable on this device" button.
//    • Show a clear hint when the browser permission is blocked.
// ============================================================================

"use client";

import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Loader2, ShieldCheck, Info, Send, Smartphone, AlertCircle, MonitorSmartphone } from "lucide-react";
import { toast } from "sonner";

interface NotifPrefs {
  enabled: boolean;
  activeDevices?: number;
}

const QK = ["customer", "app-notif-prefs"] as const;

export function NotificationPreferences() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [enablingOnDevice, setEnablingOnDevice] = useState(false);
  const [pushSupported, setPushSupported] = useState(true);
  const [hasLocalSubscription, setHasLocalSubscription] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPushSupported(
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    );
  }, []);

  // Check if THIS device has an active push subscription. Used to decide
  // whether to show the "Enable on this device" button.
  useEffect(() => {
    if (!pushSupported) return;
    let cancelled = false;
    const check = async () => {
      try {
        const ensureReady = window.__ensurePushReady;
        const reg = ensureReady ? await ensureReady() : await navigator.serviceWorker.ready;
        if (!reg) {
          if (!cancelled) setHasLocalSubscription(false);
          return;
        }
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) setHasLocalSubscription(!!sub);
      } catch {
        if (!cancelled) setHasLocalSubscription(false);
      }
    };
    check();
    return () => { cancelled = true; };
  }, [pushSupported]);

  const { data, isLoading } = useQuery<NotifPrefs>({
    queryKey: QK,
    queryFn: () => api.get<NotifPrefs>("/api/app-notifs/preferences"),
    staleTime: 30_000,
  });

  // Shared subscribe-flow used by both "toggle ON" and "Enable on this device".
  const runSubscribeFlow = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    try {
      // 1. Permission
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast.error("Notification permission denied. Please allow notifications in your browser settings.");
        return false;
      }

      // 2. Ensure SW is registered AND active — fixes the desktop
      //    "no active Service Worker" error.
      let reg: ServiceWorkerRegistration | null = null;
      if (typeof window.__ensurePushReady === "function") {
        reg = await window.__ensurePushReady();
      } else {
        reg = await navigator.serviceWorker.ready;
      }
      if (!reg) {
        toast.error("Service Worker failed to activate. Please refresh the page and try again.");
        return false;
      }

      // 3. Get VAPID public key
      const vapidRes = await fetch("/api/push/vapid-public");
      const vapidJson = await vapidRes.json();
      if (!vapidJson.data?.publicKey) {
        toast.error("Push notifications are not configured on the server.");
        return false;
      }

      const applicationServerKey = urlBase64ToUint8Array(vapidJson.data.publicKey);

      // 4. Subscribe (or reuse existing subscription)
      let subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
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
        toast.error(errData.error || "Failed to save subscription on server");
        return false;
      }

      // 6. Update preference
      await api.put("/api/app-notifs/preferences", { enabled: true });
      setHasLocalSubscription(true);
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

  const enableNotifications = useCallback(async () => {
    await runSubscribeFlow();
  }, [runSubscribeFlow]);

  const disableNotifications = useCallback(async () => {
    setBusy(true);
    try {
      let reg: ServiceWorkerRegistration | null = null;
      if (typeof window.__ensurePushReady === "function") {
        reg = await window.__ensurePushReady();
      } else {
        try { reg = await navigator.serviceWorker.ready; } catch { reg = null; }
      }
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          try { await sub.unsubscribe(); } catch {}
          await fetch("/api/push/unsubscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
        }
      }
      await api.put("/api/app-notifs/preferences", { enabled: false });
      setHasLocalSubscription(false);
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

  const sendTest = useCallback(async () => {
    setTesting(true);
    try {
      const res = await api.post<{ sent: number; message?: string; error?: string }>(
        "/api/app-notifs/test",
        {}
      );
      if (res.sent > 0) {
        toast.success("Test notification sent! Check your device.");
      } else {
        toast.error(res.message || res.error || "Test failed — no active subscription.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Test failed");
    } finally {
      setTesting(false);
    }
  }, []);

  const onToggle = useCallback(async (checked: boolean) => {
    if (checked) await enableNotifications();
    else await disableNotifications();
  }, [enableNotifications, disableNotifications]);

  const enabled = !!data?.enabled;
  const activeDevices = data?.activeDevices ?? 0;
  const browserBlocked = typeof Notification !== "undefined" && Notification.permission === "denied";
  // Show the "Enable on this device" button when:
  //   - preferences.enabled is true (customer wants notifications)
  //   - AND we know there's no local subscription on THIS device
  //   - AND the browser hasn't blocked notifications
  const showEnableOnDevice = enabled && hasLocalSubscription === false && !browserBlocked;

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
          <div className="space-y-3">
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

            {/* Active device count + Send Test button (only when enabled) */}
            {enabled && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
                <div className="flex items-center gap-2 text-xs">
                  <Smartphone className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-muted-foreground">
                    Active on{" "}
                    <span className="font-semibold text-foreground">{activeDevices}</span>{" "}
                    device{activeDevices === 1 ? "" : "s"}
                    {hasLocalSubscription === false && activeDevices > 0 && (
                      <span className="ml-1 text-amber-600 dark:text-amber-400">(other devices)</span>
                    )}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={sendTest}
                  disabled={testing || activeDevices === 0}
                  className="h-7 gap-1.5 text-xs"
                >
                  {testing ? (
                    <><Loader2 className="size-3 animate-spin" /> Sending...</>
                  ) : (
                    <><Send className="size-3" /> Send Test</>
                  )}
                </Button>
              </div>
            )}

            {/* "Enable on this device" — shown when toggle is ON but this device has no subscription */}
            {showEnableOnDevice && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-900/40 dark:bg-amber-950/30">
                <div className="flex items-start gap-2">
                  <MonitorSmartphone className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p className="font-medium text-amber-900 dark:text-amber-200">Not enabled on this device</p>
                    <p className="mt-0.5 text-amber-700 dark:text-amber-300">
                      You've enabled notifications on {activeDevices} other device{activeDevices === 1 ? "" : "s"}. Click below to also receive them on this device.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={async () => { setEnablingOnDevice(true); await runSubscribeFlow(); setEnablingOnDevice(false); }}
                  disabled={enablingOnDevice || busy}
                  variant="outline"
                  className="shrink-0 gap-1.5 border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-900/40"
                >
                  {enablingOnDevice ? <Loader2 className="size-3.5 animate-spin" /> : <MonitorSmartphone className="size-3.5" />}
                  Enable Here
                </Button>
              </div>
            )}

            {busy && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                {enabled ? "Disabling..." : "Requesting permission + registering device..."}
              </p>
            )}

            {/* Browser permission blocked hint */}
            {browserBlocked && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-medium">Browser permission is blocked</p>
                  <p className="mt-0.5">
                    Your browser is blocking notifications. Click the lock icon in your address bar → Site settings → Allow notifications, then refresh this page.
                  </p>
                </div>
              </div>
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
