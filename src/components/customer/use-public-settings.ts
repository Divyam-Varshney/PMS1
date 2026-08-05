// ============================================================================
// File: src/components/customer/use-public-settings.ts
// Purpose: React Query hook that fetches public store settings and shares them
//          app-wide via the query cache. Also computes isStoreOpen on the
//          client using Intl.DateTimeFormat for reliable IST conversion.
// Role: Powers the open/closed banner, footer info, and payment toggles.
// ============================================================================

"use client";

import { useQuery } from "@tanstack/react-query";
import { api, qk, PublicSettings } from "./api";

/** Get current IST (Asia/Kolkata) time info — works in any browser timezone. */
function getISTInfo() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(now);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const weekday = map.weekday.toLowerCase();
  const hour = parseInt(map.hour, 10);
  const minute = parseInt(map.minute, 10);
  const dateStr = `${map.year}-${map.month}-${map.day}`;
  return { day: weekday, hour, minute, dateStr, nowMin: hour * 60 + minute };
}

function computeOpen(s: PublicSettings | undefined): { open: boolean; message: string } {
  if (!s) return { open: true, message: "" };
  if (!s.store.openStatus) return { open: false, message: s.store.closedMessage || "Store is currently closed." };

  const ist = getISTInfo();

  // Check holidays
  const holidays = (s as any).holidays;
  if (Array.isArray(holidays) && holidays.length > 0) {
    const holiday = holidays.find((h: any) => h.date === ist.dateStr);
    if (holiday) {
      return { open: false, message: `Store Closed Today due to Holiday — ${holiday.name}. We will reopen tomorrow.` };
    }
  }

  // Check weekly schedule
  const weekly = (s as any).weeklySchedule;
  if (weekly && typeof weekly === "object" && weekly[ist.day]) {
    const today = weekly[ist.day];
    if (today.closed) {
      // Find next open day
      const dayOrder = ["sun","mon","tue","wed","thu","fri","sat"];
      const todayIdx = dayOrder.indexOf(ist.day);
      for (let i = 1; i <= 7; i++) {
        const nextDay = dayOrder[(todayIdx + i) % 7];
        const next = weekly[nextDay];
        if (next && !next.closed && next.open) {
          const dayName = i === 1 ? "tomorrow" : nextDay.charAt(0).toUpperCase() + nextDay.slice(1);
          return { open: false, message: `Store Closed. We will reopen at ${next.open} ${dayName}.` };
        }
      }
      return { open: false, message: s.store.closedMessage || "Store is currently closed." };
    }
    if (today.open && today.close) {
      const [oh, om] = String(today.open).split(":").map(Number);
      const [ch, cm] = String(today.close).split(":").map(Number);
      const openMin = oh * 60 + om;
      const closeMin = ch * 60 + cm;
      if (ist.nowMin >= openMin && ist.nowMin < closeMin) {
        return { open: true, message: "" };
      }
      // Past closing time — find next open day
      const dayOrder = ["sun","mon","tue","wed","thu","fri","sat"];
      const todayIdx = dayOrder.indexOf(ist.day);
      for (let i = 1; i <= 7; i++) {
        const nextDay = dayOrder[(todayIdx + i) % 7];
        const next = weekly[nextDay];
        if (next && !next.closed && next.open) {
          const dayName = i === 1 ? "tomorrow" : nextDay.charAt(0).toUpperCase() + nextDay.slice(1);
          return { open: false, message: `Store Closed. We will reopen at ${next.open} ${dayName}.` };
        }
      }
    }
  }

  // Fallback: simple openTime/closeTime
  const { openTime, closeTime } = s.store;
  if (!openTime || !closeTime) return { open: true, message: "" };
  const [oh, om] = openTime.split(":").map(Number);
  const [ch, cm] = closeTime.split(":").map(Number);
  if (ist.nowMin >= oh * 60 + om && ist.nowMin < ch * 60 + cm) {
    return { open: true, message: "" };
  }
  return { open: false, message: s.store.closedMessage || "Store is currently closed." };
}

export function usePublicSettings() {
  const query = useQuery({
    queryKey: qk.publicSettings,
    queryFn: () => api<PublicSettings>("/api/settings/public"),
    // Short staleTime so admin changes reflect quickly on the customer site.
    staleTime: 10 * 1000,
  });
  const status = computeOpen(query.data);
  return {
    settings: query.data,
    isLoading: query.isLoading,
    isStoreOpen: status.open,
    storeStatusMessage: status.message,
  };
}
