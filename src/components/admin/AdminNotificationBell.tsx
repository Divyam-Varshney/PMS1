// ============================================================================
// File: src/components/admin/AdminNotificationBell.tsx
// Purpose: Real-time notification bell for the admin topbar. Polls for new
//          notifications every 15s, plays a sound on new items, shows unread
//          count badge, dropdown with recent notifications, mark-read/mark-all,
//          and deep-links to the relevant detail page on click.
// ============================================================================

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, run } from "./api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Bell,
  ShoppingCart,
  FileImage,
  ClipboardList,
  CheckCheck,
  ChevronRight,
} from "lucide-react";
import { useAdminStore } from "./admin-store";
import { timeAgo } from "@/lib/format";

interface AdminNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  refId: string | null;
  refType: string | null;
  customerName: string | null;
  isRead: boolean;
  createdAt: string;
}

const NOTIFICATION_ICONS: Record<string, { icon: typeof Bell; tint: string }> = {
  new_order: { icon: ShoppingCart, tint: "bg-emerald-100 text-emerald-700" },
  new_prescription: { icon: FileImage, tint: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
  new_manual_request: { icon: ClipboardList, tint: "bg-amber-100 text-amber-700" },
};

// Generate a short notification sound via Web Audio API (no external file needed)
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880; // A5
    osc.type = "sine";
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
    // Second tone for a pleasant two-note chime
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.value = 1320; // E6
      osc2.type = "sine";
      gain2.gain.setValueAtTime(0.3, ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc2.start(ctx.currentTime);
      osc2.stop(ctx.currentTime + 0.4);
    }, 150);
  } catch {
    // AudioContext not available (e.g. before user interaction) — silent fallback
  }
}

export function AdminNotificationBell() {
  const navigate = useAdminStore((s) => s.navigate);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const lastCheckRef = useRef<string>(new Date().toISOString());
  const soundEnabledRef = useRef(false);

  // Fetch notifications
  const { data } = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: () => api.get<{ notifications: AdminNotification[]; unreadCount: number }>(
      "/api/admin/notifications-list?limit=30"
    ),
    refetchInterval: 15000, // Poll every 15 seconds
    refetchOnWindowFocus: true,
  });

  // Play sound when new notifications arrive (only after the first poll cycle
  // to avoid playing sound on initial load)
  useEffect(() => {
    if (!data?.notifications) return;
    const newOnes = data.notifications.filter(
      (n) => new Date(n.createdAt) > new Date(lastCheckRef.current)
    );
    if (newOnes.length > 0 && soundEnabledRef.current) {
      playNotificationSound();
    }
    lastCheckRef.current = new Date().toISOString();
    soundEnabledRef.current = true;
  }, [data?.notifications]);

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  // Mark single as read
  const markRead = useCallback(async (id: string) => {
    await run(() => api.patch(`/api/admin/notifications-list/${id}`, {}), { silent: true });
    qc.invalidateQueries({ queryKey: ["admin-notifications"] });
  }, [qc]);

  // Mark all as read
  const markAllRead = useCallback(async () => {
    await run(() => api.post("/api/admin/notifications-list/mark-all-read", {}), {
      success: "All notifications marked as read",
      error: "Failed",
      silent: true,
    });
    qc.invalidateQueries({ queryKey: ["admin-notifications"] });
  }, [qc]);

  // Click a notification → mark read + navigate to detail page
  function handleClick(n: AdminNotification) {
    if (!n.isRead) markRead(n.id);
    setOpen(false);
    if (n.refId && n.refType) {
      if (n.refType === "order") navigate({ name: "order-detail", id: n.refId });
      else if (n.refType === "prescription") navigate({ name: "prescription-detail", id: n.refId });
      else if (n.refType === "manual_request") navigate({ name: "manual-request-detail", id: n.refId });
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white animate-pulse">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 sm:w-96 p-0" align="end">
        {/* Header — title + unread count badge + mark-all-read */}
        <div className="flex items-center justify-between border-b p-3">
          <div className="flex items-center gap-2">
            <Bell className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="bg-rose-100 text-rose-700 text-[10px]">
                {unreadCount} unread
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={markAllRead}>
              <CheckCheck className="size-3.5" /> Mark all read
            </Button>
          )}
        </div>

        {/* Scrollable list — max-h-[500px], custom scrollbar, per-card spacing */}
        <div
          className="max-h-[500px] overflow-y-auto
            [&::-webkit-scrollbar]:w-1.5
            [&::-webkit-scrollbar-track]:bg-transparent
            [&::-webkit-scrollbar-thumb]:rounded-full
            [&::-webkit-scrollbar-thumb]:bg-border
            [&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/40"
        >
          {notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="mx-auto mb-2 size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
              <p className="text-xs text-muted-foreground/70">New orders, prescriptions, and manual requests will appear here.</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => {
                const config = NOTIFICATION_ICONS[n.type] || NOTIFICATION_ICONS.new_order;
                const Icon = config.icon;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`flex w-full items-start gap-2 p-3 text-left transition-colors hover:bg-accent/40 ${
                      !n.isRead ? "bg-accent/30" : "bg-card"
                    }`}
                  >
                    <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${config.tint}`}>
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-1">
                        <p className={`text-sm ${!n.isRead ? "font-semibold" : "font-medium"}`}>
                          {n.title}
                        </p>
                        {!n.isRead && (
                          <span className="mt-1 size-2 shrink-0 rounded-full bg-rose-500" />
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {n.message}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground/60">
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer — "View all" link + auto-refresh hint */}
        {notifications.length > 0 && (
          <div className="border-t p-1.5">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate({ name: "notifications" });
              }}
              className="flex w-full items-center justify-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-accent/40"
            >
              View all notifications
              <ChevronRight className="size-4" />
            </button>
            <p className="px-3 pb-1 text-center text-[10px] text-muted-foreground">
              Updates automatically every 15 seconds
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
