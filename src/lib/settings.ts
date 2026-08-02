// ============================================================================
// File: src/lib/settings.ts
// Purpose: Settings engine — a typed key/value store backed by the Setting
//          table. All admin-configurable values live here. Falls back to
//          DEFAULT_SETTINGS when a key is missing from the DB.
// Role: The single read-point for any configurable business rule so the rest
//       of the codebase never reads raw constants for runtime config.
// ============================================================================

import { db } from "@/lib/db";
import { DEFAULT_SETTINGS } from "@/lib/constants";

// In-process cache to avoid hitting DB on every settings read within a request.
// TTL is bumped to 30s in production (settings rarely change; admin edits
// invalidate via setSetting/updateSettings below) and kept at 5s in dev so
// admin panel edits show up quickly during local testing. Pre-optimization
// this was 5s everywhere, which meant settings were re-fetched from Supabase
// Tokyo (~150ms RTT) up to 12x/minute on the cart hot path.
const CACHE_TTL = process.env.NODE_ENV === "production" ? 30_000 : 5_000;

let cache: Record<string, any> | null = null;
let cacheTs = 0;

function parseValue(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** Load all settings from DB merged with defaults. Cached briefly. */
export async function getAllSettings(): Promise<Record<string, any>> {
  if (cache && Date.now() - cacheTs < CACHE_TTL) return cache;
  const rows = await db.setting.findMany();
  const fromDb: Record<string, any> = {};
  for (const r of rows) fromDb[r.key] = parseValue(r.value);

  const merged: Record<string, any> = {};
  for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
    merged[key] = key in fromDb ? fromDb[key] : def.value;
  }
  // include any extra keys present in DB but not in defaults
  for (const [key, val] of Object.entries(fromDb)) {
    if (!(key in merged)) merged[key] = val;
  }
  cache = merged;
  cacheTs = Date.now();
  return merged;
}

/** Get a single setting value (with fallback to default). */
export async function getSetting<T = any>(key: string): Promise<T> {
  const all = await getAllSettings();
  return all[key] as T;
}

/** Get a group of settings by prefix. */
export async function getSettingsByPrefix(prefix: string): Promise<Record<string, any>> {
  const all = await getAllSettings();
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(all)) {
    if (k.startsWith(prefix)) out[k] = v;
  }
  return out;
}

/** Update (upsert) a single setting. Invalidates cache. */
export async function setSetting(key: string, value: any, category?: string) {
  const cat = category ?? DEFAULT_SETTINGS[key]?.category ?? "general";
  await db.setting.upsert({
    where: { key },
    update: { value: JSON.stringify(value) },
    create: { key, value: JSON.stringify(value), category: cat },
  });
  cache = null;
}

/** Bulk update settings from a form payload. */
export async function updateSettings(payload: Record<string, any>) {
  // Only allow keys that exist in DEFAULT_SETTINGS — prevents arbitrary key
  // injection that could collide with future features or cause subtle bugs.
  for (const [key, value] of Object.entries(payload)) {
    if (!(key in DEFAULT_SETTINGS)) {
      // Skip unknown keys silently — admin panel should only send known keys.
      continue;
    }
    const cat = DEFAULT_SETTINGS[key].category;
    await db.setting.upsert({
      where: { key },
      update: { value: JSON.stringify(value) },
      create: { key, value: JSON.stringify(value), category: cat },
    });
  }
  cache = null;
}

/** Get the current IST (Asia/Kolkata) time as { day, hour, minute, dateStr }.
 *  Uses Intl.DateTimeFormat which correctly handles timezone conversion
 *  regardless of the server's local timezone. */
function getISTInfo() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short", // Mon, Tue, ...
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
  const weekday = map.weekday.toLowerCase(); // mon, tue, ...
  const hour = parseInt(map.hour, 10);
  const minute = parseInt(map.minute, 10);
  const dateStr = `${map.year}-${map.month}-${map.day}`; // YYYY-MM-DD
  return { day: weekday, hour, minute, dateStr, nowMin: hour * 60 + minute };
}

/**
 * Is the store currently open? Checks:
 * 1. store.openStatus master toggle
 * 2. store.holidays (if today is a holiday → closed)
 * 3. store.weeklySchedule (per-day open/close times + closed flag)
 * Falls back to store.openTime/closeTime if weeklySchedule is not configured.
 * All times are in IST (Asia/Kolkata).
 */
export async function isStoreOpen(): Promise<boolean> {
  const open = await getSetting<boolean>("store.openStatus");
  if (!open) return false;

  const ist = getISTInfo();

  // Check holidays
  const holidays = await getSetting<any[]>("store.holidays");
  if (Array.isArray(holidays) && holidays.length > 0) {
    const isHoliday = holidays.some((h: any) => h.date === ist.dateStr);
    if (isHoliday) return false;
  }

  // Check weekly schedule (per-day)
  const weekly = await getSetting<any>("store.weeklySchedule");
  if (weekly && typeof weekly === "object") {
    const today = weekly[ist.day];
    if (today) {
      if (today.closed) return false;
      if (!today.open || !today.close) return false;
      const [oh, om] = String(today.open).split(":").map(Number);
      const [ch, cm] = String(today.close).split(":").map(Number);
      const openMin = oh * 60 + om;
      const closeMin = ch * 60 + cm;
      return ist.nowMin >= openMin && ist.nowMin < closeMin;
    }
  }

  // Fallback: use store.openTime / store.closeTime (same hours every day)
  const openTime = await getSetting<string>("store.openTime");
  const closeTime = await getSetting<string>("store.closeTime");
  if (openTime && closeTime) {
    const [oh, om] = openTime.split(":").map(Number);
    const [ch, cm] = closeTime.split(":").map(Number);
    return ist.nowMin >= oh * 60 + om && ist.nowMin < ch * 60 + cm;
  }

  return true; // No time restrictions configured → open
}

/** Get a human-readable store status message for the customer. */
export async function getStoreStatusMessage(): Promise<{ open: boolean; message: string }> {
  const open = await isStoreOpen();
  if (open) return { open: true, message: "" };

  const ist = getISTInfo();
  const closedMessage = await getSetting<string>("store.closedMessage");

  // Check if it's a holiday
  const holidays = await getSetting<any[]>("store.holidays");
  if (Array.isArray(holidays) && holidays.length > 0) {
    const holiday = holidays.find((h: any) => h.date === ist.dateStr);
    if (holiday) {
      return { open: false, message: `Store Closed Today due to Holiday — ${holiday.name}. We will reopen tomorrow.` };
    }
  }

  // Check weekly schedule for today's closing
  const weekly = await getSetting<any>("store.weeklySchedule");
  if (weekly && weekly[ist.day]) {
    const today = weekly[ist.day];
    if (today.closed) {
      // Find next open day
      const dayOrder = ["sun","mon","tue","wed","thu","fri","sat"];
      const todayIdx = dayOrder.indexOf(ist.day);
      for (let i = 1; i <= 7; i++) {
        const nextDay = dayOrder[(todayIdx + i) % 7];
        const next = weekly[nextDay];
        if (next && !next.closed && next.open) {
          const dayName = nextDay.charAt(0).toUpperCase() + nextDay.slice(1);
          return { open: false, message: `Store Closed. We will reopen on ${dayName} at ${next.open}.` };
        }
      }
    }
    if (today.close) {
      // Store is closed because it's past closing time — find next open day
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

  return { open: false, message: closedMessage || "Store is currently closed." };
}
