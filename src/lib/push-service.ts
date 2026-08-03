// ============================================================================
// File: src/lib/push-service.ts
// Purpose: Low-level Web Push delivery. Wraps the `web-push` library with
//          VAPID auth (keys from env), and exposes:
//            • isPushConfigured() — true if VAPID env vars are present
//            • getVapidPublicKey() — the public key to pass to the browser's
//              PushSubscription.subscribe() call (base64url)
//            • sendPushToCustomer(customerId, payload) — fan-out to all
//              active subscriptions for a customer, auto-pruning dead ones
// ============================================================================

import webpush, { type PushSubscription as WpSubscription } from "web-push";
import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// VAPID setup — configure once on first import. The keys live in .env.
// ---------------------------------------------------------------------------

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || "mailto:admin@pradeepmedicalstore.in";

let _configured = false;
function ensureVapidConfigured() {
  if (_configured) return;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    _configured = true;
  } catch (err) {
    console.error("[push-service] VAPID config failed:", err);
  }
}

/** True when VAPID env vars are present and the push service is usable. */
export function isPushConfigured(): boolean {
  return Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
}

/** The public VAPID key (base64url). Pass to PushManager.subscribe(). */
export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

// ---------------------------------------------------------------------------
// Payload type — what sendPushToCustomer accepts.
// ---------------------------------------------------------------------------

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  image?: string;
  tag?: string;
  deepLink?: string;
  priority?: "normal" | "high";
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// sendPushToCustomer — fan-out + auto-prune dead endpoints.
// Returns { sent, failed, pruned } counts.
// ---------------------------------------------------------------------------

export async function sendPushToCustomer(
  customerId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number; pruned: number }> {
  if (!isPushConfigured()) return { sent: 0, failed: 0, pruned: 0 };
  ensureVapidConfigured();
  if (!_configured) return { sent: 0, failed: 0, pruned: 0 };

  const subs = await db.pushSubscription.findMany({
    where: { customerId, isActive: true },
  });
  if (subs.length === 0) return { sent: 0, failed: 0, pruned: 0 };

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || "/icon.png",
    image: payload.image,
    tag: payload.tag || "pms-notification",
    deepLink: payload.deepLink || "/",
    priority: payload.priority || "normal",
    metadata: payload.metadata,
  });

  let sent = 0;
  let failed = 0;
  let pruned = 0;

  await Promise.all(
    subs.map(async (sub) => {
      const wpSub: WpSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dhKey, auth: sub.authKey },
      };
      try {
        await webpush.sendNotification(wpSub, message);
        sent++;
      } catch (e: any) {
        const status = e?.statusCode ?? 0;
        if (status === 404 || status === 410) {
          try {
            await db.pushSubscription.update({
              where: { id: sub.id },
              data: { isActive: false },
            });
            pruned++;
          } catch {}
        } else {
          console.error(`[push] send failed (status=${status}):`, e?.message);
          failed++;
        }
      }
    })
  );

  return { sent, failed, pruned };
}
