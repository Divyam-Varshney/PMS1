// ============================================================================
// File: src/components/customer/notification-preferences.tsx
// Purpose: Customer profile → App Notifications settings. Simplified to just
//          a toggle + short professional description (Phase 40.2).
//
//  Removed:
//    • Active device count
//    • "Send Test" button
//    • "Enable on this device" panel
//    • "Browser blocked" technical warning
//    • All developer/debug information
//
//  Kept:
//    • ON/OFF toggle (master preference)
//    • Short professional description
// ============================================================================

"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface NotifPrefs {
  enabled: boolean;
}

const QK = ["customer", "app-notif-prefs"] as const;

export function NotificationPreferences() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery<NotifPrefs>({
    queryKey: QK,
    queryFn: () => api.get<NotifPrefs>("/api/app-notifs/preferences"),
    staleTime: 30_000,
  });

  const enabled = !!data?.enabled;

  const onToggle = useCallback(async (checked: boolean) => {
    setBusy(true);
    try {
      await api.put("/api/app-notifs/preferences", { enabled: checked });
      if (checked) {
        toast.success("Notifications enabled. You'll receive updates on your registered devices.");
      } else {
        toast.success("Notifications disabled. You can re-enable anytime.");
      }
      qc.invalidateQueries({ queryKey: QK });
    } catch (e: any) {
      toast.error(`Failed to update: ${e?.message || "unknown error"}`);
    } finally {
      setBusy(false);
    }
  }, [qc]);

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
                Stay informed with order updates, delivery notifications, medicine requests, exclusive offers, and pharmacy announcements. You can enable or disable App Notifications at any time.
              </CardDescription>
            </div>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={onToggle}
            disabled={isLoading || busy}
            aria-label="Toggle app notifications"
          />
        </div>
      </CardHeader>
      {busy && (
        <CardContent className="pt-0">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            {enabled ? "Disabling..." : "Enabling..."}
          </p>
        </CardContent>
      )}
    </Card>
  );
}
