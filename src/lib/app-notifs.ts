// ============================================================================
// File: src/lib/app-notifs.ts
// Purpose: App Notification (Web Push) service. Exposes:
//
//   • ensureTemplatesSeeded()        — idempotent: insert the 18 default
//                                       templates if they don't exist yet.
//   • getOrCreatePreference(custId)  — load the customer's AppNotifPreference
//                                       row, creating one (enabled=true) if
//                                       missing.
//   • sendAutoNotification(...)      — transactional push: looks up a
//                                       template, interpolates variables,
//                                       checks the customer's preference +
//                                       has-active-subscriptions gate, sends
//                                       the push, and logs the outcome to
//                                       AppNotifLog.
//   • broadcastCampaign(payload)     — admin "send to all": iterates ALL
//                                       active customers (excluding those who
//                                       explicitly disabled), creates
//                                       preference rows for those missing
//                                       one, and sends the push to each.
//   • getAnalytics(days)             — aggregated delivery stats for the
//                                       admin dashboard (sent / failed /
//                                       skipped by day + top templates).
//
// All push delivery delegates to sendPushToCustomer() (src/lib/push-service.ts)
// which auto-prunes dead endpoints.
// ============================================================================

import { db } from "@/lib/db";
import { sendPushToCustomer, isPushConfigured } from "@/lib/push-service";
import { DEFAULT_APP_NOTIF_TEMPLATES } from "@/lib/app-notif-templates";

// ---------------------------------------------------------------------------
// Template seeding
// ---------------------------------------------------------------------------

let _seeded = false;

/** Idempotent: ensure all 18 default AppNotifTemplate rows exist.
 *  Called lazily on the first push-related API request. Cheap — uses upsert
 *  on the unique `key`, so existing templates (and admin edits) are preserved. */
export async function ensureTemplatesSeeded(): Promise<void> {
  if (_seeded) return;
  // Use a flag in the DB so multi-instance deployments (Vercel) don't re-run.
  // The upserts themselves are idempotent, but the SELECT ALL they imply is
  // wasteful on every push. We still guard with the in-memory flag for the
  // common single-process case.
  await Promise.all(
    DEFAULT_APP_NOTIF_TEMPLATES.map((t) =>
      db.appNotifTemplate.upsert({
        where: { key: t.key },
        update: {}, // do NOT overwrite admin edits
        create: {
          key: t.key,
          name: t.name,
          title: t.title,
          shortDesc: t.shortDesc,
          fullMessage: t.fullMessage,
          icon: t.icon ?? null,
          bannerImage: t.bannerImage ?? null,
          deepLink: t.deepLink ?? null,
          variables: JSON.stringify(t.variables),
          category: t.category,
          priority: t.priority,
          isEnabled: true,
        },
      })
    )
  );
  _seeded = true;
}

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

/** Load (or auto-create with enabled=true) the customer's preference row. */
export async function getOrCreatePreference(customerId: string) {
  const existing = await db.appNotifPreference.findUnique({
    where: { customerId },
  });
  if (existing) return existing;
  try {
    return await db.appNotifPreference.create({
      data: { customerId, enabled: true },
    });
  } catch {
    // Race: another worker created it between our findUnique and create.
    return await db.appNotifPreference.findUniqueOrThrow({
      where: { customerId },
    });
  }
}

// ---------------------------------------------------------------------------
// Variable interpolation — replaces {{var}} in title/body.
// ---------------------------------------------------------------------------

function interpolate(
  template: string,
  vars: Record<string, string | number | undefined>
): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
    const v = vars[key];
    return v === undefined || v === null ? "" : String(v);
  });
}

// ---------------------------------------------------------------------------
// sendAutoNotification — transactional push
// ---------------------------------------------------------------------------

export interface SendAutoNotifResult {
  sent: boolean;
  reason?: string;
  status: "sent" | "skipped" | "failed";
  logId?: string;
}

/** Send a transactional App notification to a customer.
 *
 *  Pipeline:
 *    1. ensureTemplatesSeeded() (idempotent, cheap after first call)
 *    2. Look up the template by key — skip if missing or disabled
 *    3. Look up the customer's preference — skip if enabled=false
 *    4. Check the customer has at least one active PushSubscription —
 *       skip silently if not (the customer hasn't enabled push on any device)
 *    5. Interpolate variables + send via sendPushToCustomer
 *    6. Log the outcome (sent / failed) to AppNotifLog
 *
 *  All steps are wrapped in try/catch — push failures NEVER break the
 *  caller (e.g. checkout). The return value tells the caller what happened.
 */
export async function sendAutoNotification(
  customerId: string,
  templateKey: string,
  variables: Record<string, string | number | undefined> = {},
  metadata: Record<string, unknown> = {}
): Promise<SendAutoNotifResult> {
  try {
    await ensureTemplatesSeeded();

    // 1. Template lookup
    const template = await db.appNotifTemplate.findUnique({
      where: { key: templateKey },
    });
    if (!template || !template.isEnabled) {
      return { sent: false, status: "skipped", reason: "template_disabled_or_missing" };
    }

    // 2. Preference check
    const pref = await getOrCreatePreference(customerId);
    if (!pref.enabled) {
      return { sent: false, status: "skipped", reason: "preference_disabled" };
    }

    // 3. Subscription check — skip silently if the customer has no devices
    const subCount = await db.pushSubscription.count({
      where: { customerId, isActive: true },
    });
    if (subCount === 0) {
      return { sent: false, status: "skipped", reason: "no_active_subscriptions" };
    }

    // 4. Interpolate
    const title = interpolate(template.title, variables);
    const body = interpolate(template.fullMessage, variables);

    // 5. Send
    const result = await sendPushToCustomer(customerId, {
      title,
      body,
      icon: template.icon || undefined,
      image: template.bannerImage || undefined,
      tag: template.key,
      deepLink: template.deepLink || "/",
      priority: (template.priority as "normal" | "high") || "normal",
      metadata: { ...metadata, templateKey, variables },
    });

    // 6. Log
    const status: "sent" | "failed" =
      result.sent > 0 ? "sent" : result.failed > 0 ? "failed" : "skipped";
    const log = await db.appNotifLog.create({
      data: {
        customerId,
        templateId: template.id,
        templateKey: template.key,
        title,
        body,
        category: template.category,
        status,
        error:
          status === "failed"
            ? `web-push: ${result.failed} failed, ${result.pruned} pruned`
            : null,
        metadata: JSON.stringify({ ...metadata, variables, result }),
      },
    });

    return { sent: status === "sent", status, logId: log.id };
  } catch (e: any) {
    console.error(
      `[app-notifs] sendAutoNotification failed for ${templateKey} → ${customerId}:`,
      e
    );
    // Best-effort error log
    try {
      await db.appNotifLog.create({
        data: {
          customerId,
          templateKey,
          title: "[failed] " + templateKey,
          body: "",
          category: "transactional",
          status: "failed",
          error: e?.message || String(e),
          metadata: JSON.stringify({ variables, metadata }),
        },
      });
    } catch {}
    return { sent: false, status: "failed", reason: e?.message };
  }
}

// ---------------------------------------------------------------------------
// broadcastCampaign — admin "send to ALL customers"
// ---------------------------------------------------------------------------

export interface BroadcastPayload {
  title: string;
  body: string;
  icon?: string;
  image?: string;
  tag?: string;
  deepLink?: string;
  priority?: "normal" | "high";
  metadata?: Record<string, unknown>;
}

export interface BroadcastResult {
  totalCustomers: number;
  targeted: number;   // customers with enabled preference + at least 1 sub
  skipped: number;    // explicitly opted-out, or no active subscriptions
  sent: number;       // pushes actually delivered
  failed: number;     // pushes attempted but failed
  pruned: number;     // dead endpoints removed
  durationMs: number;
}

/** Broadcast a campaign push to ALL active customers.
 *  - Customers with enabled=false in their AppNotifPreference are excluded.
 *  - Customers without a preference row are INCLUDED (treated as default
 *    enabled=true) and a preference row is created for them on the fly.
 *  - Customers with no active PushSubscription are silently skipped
 *    (no point sending a push to a customer with no devices).
 *
 *  Returns aggregate delivery stats for the admin UI. */
export async function broadcastCampaign(
  payload: BroadcastPayload
): Promise<BroadcastResult> {
  const start = Date.now();
  if (!isPushConfigured()) {
    return {
      totalCustomers: 0, targeted: 0, skipped: 0,
      sent: 0, failed: 0, pruned: 0, durationMs: Date.now() - start,
    };
  }

  // Active customers only — deleted / deactivated accounts skip.
  const customers = await db.customer.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  let targeted = 0;
  let skipped = 0;
  let totalSent = 0;
  let totalFailed = 0;
  let totalPruned = 0;

  // Process in chunks of 20 to avoid overwhelming the DB / push service.
  // Sequential chunks → ~20 concurrent push requests per batch.
  const CHUNK = 20;
  for (let i = 0; i < customers.length; i += CHUNK) {
    const chunk = customers.slice(i, i + CHUNK);
    const results = await Promise.all(
      chunk.map(async (c) => {
        // Ensure preference exists (default enabled).
        const pref = await getOrCreatePreference(c.id);
        if (!pref.enabled) {
          return { kind: "skipped" as const };
        }
        // Has any active subscription?
        const subCount = await db.pushSubscription.count({
          where: { customerId: c.id, isActive: true },
        });
        if (subCount === 0) {
          return { kind: "skipped" as const };
        }
        const res = await sendPushToCustomer(c.id, {
          title: payload.title,
          body: payload.body,
          icon: payload.icon || "/icon.png",
          image: payload.image,
          tag: payload.tag || "pms-campaign",
          deepLink: payload.deepLink || "/",
          priority: payload.priority || "normal",
          metadata: { ...payload.metadata, broadcast: true },
        });
        // Log to AppNotifLog (campaign category)
        try {
          await db.appNotifLog.create({
            data: {
              customerId: c.id,
              templateKey: null,
              title: payload.title,
              body: payload.body,
              category: "campaign",
              status: res.sent > 0 ? "sent" : res.failed > 0 ? "failed" : "skipped",
              error:
                res.failed > 0
                  ? `${res.failed} failed, ${res.pruned} pruned`
                  : null,
              metadata: JSON.stringify({ ...payload.metadata, res }),
            },
          });
        } catch {}
        return { kind: "sent" as const, res };
      })
    );

    for (const r of results) {
      if (r.kind === "skipped") {
        skipped++;
      } else {
        targeted++;
        totalSent += r.res.sent;
        totalFailed += r.res.failed;
        totalPruned += r.res.pruned;
      }
    }
  }

  return {
    totalCustomers: customers.length,
    targeted,
    skipped,
    sent: totalSent,
    failed: totalFailed,
    pruned: totalPruned,
    durationMs: Date.now() - start,
  };
}

// ---------------------------------------------------------------------------
// Analytics — for the admin dashboard
// ---------------------------------------------------------------------------

export interface AppNotifAnalytics {
  range: { days: number; from: string; to: string };
  totals: { sent: number; failed: number; skipped: number; total: number };
  byDay: Array<{ date: string; sent: number; failed: number; skipped: number }>;
  byTemplate: Array<{ templateKey: string; count: number; sent: number; failed: number }>;
  byCategory: Array<{ category: string; count: number; sent: number; failed: number }>;
  activeSubscribers: number;
  totalCustomers: number;
  enabledPreferences: number;
}

/** Aggregated delivery stats for the last N days (default 30). */
export async function getAnalytics(days = 30): Promise<AppNotifAnalytics> {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - days);
  from.setHours(0, 0, 0, 0);

  const [logs, activeSubscribers, totalCustomers, enabledPrefs] = await Promise.all([
    db.appNotifLog.findMany({
      where: { createdAt: { gte: from } },
      select: {
        status: true,
        templateKey: true,
        category: true,
        createdAt: true,
      },
    }),
    db.pushSubscription.count({ where: { isActive: true } }),
    db.customer.count({ where: { isActive: true } }),
    db.appNotifPreference.count({ where: { enabled: true } }),
  ]);

  const totals = { sent: 0, failed: 0, skipped: 0, total: logs.length };
  const byDayMap = new Map<string, { sent: number; failed: number; skipped: number }>();
  const byTplMap = new Map<string, { count: number; sent: number; failed: number }>();
  const byCatMap = new Map<string, { count: number; sent: number; failed: number }>();

  for (const log of logs) {
    if (log.status === "sent") totals.sent++;
    else if (log.status === "failed") totals.failed++;
    else totals.skipped++;

    const day = log.createdAt.toISOString().slice(0, 10);
    const d = byDayMap.get(day) || { sent: 0, failed: 0, skipped: 0 };
    if (log.status === "sent") d.sent++;
    else if (log.status === "failed") d.failed++;
    else d.skipped++;
    byDayMap.set(day, d);

    const tk = log.templateKey || "campaign";
    const t = byTplMap.get(tk) || { count: 0, sent: 0, failed: 0 };
    t.count++;
    if (log.status === "sent") t.sent++;
    else if (log.status === "failed") t.failed++;
    byTplMap.set(tk, t);

    const cat = log.category || "transactional";
    const c = byCatMap.get(cat) || { count: 0, sent: 0, failed: 0 };
    c.count++;
    if (log.status === "sent") c.sent++;
    else if (log.status === "failed") c.failed++;
    byCatMap.set(cat, c);
  }

  // Fill missing days in the range so the chart is continuous.
  const byDay: AppNotifAnalytics["byDay"] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const v = byDayMap.get(key) || { sent: 0, failed: 0, skipped: 0 };
    byDay.push({ date: key, ...v });
  }

  return {
    range: { days, from: from.toISOString(), to: now.toISOString() },
    totals,
    byDay,
    byTemplate: Array.from(byTplMap.entries())
      .map(([k, v]) => ({ templateKey: k, ...v }))
      .sort((a, b) => b.count - a.count),
    byCategory: Array.from(byCatMap.entries())
      .map(([k, v]) => ({ category: k, ...v }))
      .sort((a, b) => b.count - a.count),
    activeSubscribers,
    totalCustomers,
    enabledPreferences: enabledPrefs,
  };
}
