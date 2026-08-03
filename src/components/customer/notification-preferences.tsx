// ============================================================================
// File: src/components/customer/notification-preferences.tsx
// Purpose: Customer account → App Notifications settings card. Provides:
//    • Master toggle (enabled/disabled) — reflects AppNotifPreference.
//    • Active device count.
//    • "Send Test" button.
//    • "Browser blocked" warning when Notification.permission === "denied".
//
//  Phase 40 changes:
//    • Removed the inline "Enable on this device" panel + runSubscribeFlow —
//      the new DeviceRegistrationWizard handles initial setup on login. The
//      master toggle here just flips the AppNotifPreference flag (and
//      activates/deactivates existing PushSubscription rows server-side).
//    • When the toggle is ON but the customer has NO active subscription on
//      this device, we show a hint linking them to log out + back in (which
//      re-triggers the wizard).
//    • The existing App Notification Center + automatic notification system
//      are untouched.
// ============================================================================

"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Loader2, ShieldCheck, Info, Send, Smartphone, AlertCircle } from "lucide-react";
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

  // Check if THIS device has an active push subscription.
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

  // Enable = just flip the preference flag. The wizard handles device
  // registration; this is the master toggle.
  const enableNotifications = useCallback(async () => {
    setBusy(true);
    try {
      await api.put("/api/app-notifs/preferences", { enabled: true });
      toast.success("Notifications enabled. You'll receive updates on all your registered devices.");
      qc.invalidateQueries({ queryKey: QK });
    } catch (e: any) {
      toast.error(`Failed to enable: ${e?.message || "unknown error"}`);
    } finally {
      setBusy(false);
    }
  }, [qc]);

  // Disable = flip the preference + deactivate all PushSubscription rows
  // (server-side belt-and-suspenders so the browser stops receiving pushes).
  const disableNotifications = useCallback(async () => {
    setBusy(true);
    try {
      // Also unsubscribe locally if there's a subscription on this device.
      if (typeof window.__ensurePushReady === "function") {
        try {
          const reg = await window.__ensurePushReady();
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
        } catch {}
      }
      await api.put("/api/app-notifs/preferences", { enabled: false });
      setHasLocalSubscription(false);
      toast.success("Notifications disabled. You can re-enable anytime.");
      qc.invalidateQueries({ queryKey: QK });
    } catch (e: any) {
      toast.error(`Failed to disable: ${e?.message || "unknown error"}`);
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
  // Show the "enable on this device" hint when:
  //   - preferences.enabled is true (customer wants notifications)
  //   - AND we know there's no local subscription on THIS device
  //   - AND the browser hasn't blocked notifications
  const showEnableOnDeviceHint = enabled && hasLocalSubscription === false && !browserBlocked;

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

            {/* Active device count + Send Test button */}
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

            {/* Hint: enabled but not on this device */}
            {showEnableOnDeviceHint && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-900/40 dark:bg-amber-950/30">
                <Smartphone className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="space-y-1">
                  <p className="font-medium text-amber-900 dark:text-amber-200">
                    Not enabled on this device
                  </p>
                  <p className="text-amber-700 dark:text-amber-300">
                    You've enabled notifications on {activeDevices} other device{activeDevices === 1 ? "" : "s"}.
                    To also receive them here, log out and log back in — the setup wizard will appear automatically.
                  </p>
                </div>
              </div>
            )}

            {busy && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                {enabled ? "Disabling..." : "Enabling..."}
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
