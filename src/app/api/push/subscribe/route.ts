// ============================================================================
// File: src/app/api/push/subscribe/route.ts
// Purpose: Register a new browser/device push subscription for the logged-in
//          customer. The browser calls PushManager.subscribe() with the VAPID
//          public key, then POSTs the resulting subscription object here.
//
//  Handles 3 cases:
//    1. New subscription — create row, ensure preference exists.
//    2. Same browser re-subscribing (endpoint unchanged) — refresh keys +
//       reactivate. Idempotent upsert by unique `endpoint`.
//    3. Endpoint rotation (pushsubscriptionchange) — oldEndpoint provided.
//       Deactivate the old row + create a new one (or upsert if the new
//       endpoint already exists for this customer).
//
//  Also ensures the customer's AppNotifPreference exists (default
//  enabled=true) so the master toggle is set up before the first push.
// ============================================================================

import { db } from "@/lib/db";
import { ok, err, unauthorized, parseBody } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth";
import { getOrCreatePreference } from "@/lib/app-notifs";

interface SubscribeBody {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
  userAgent?: string;
  oldEndpoint?: string; // present when browser rotated the endpoint
}

export async function POST(req: Request) {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login to enable push notifications");

  const body = await parseBody<SubscribeBody>(req);
  if (!body?.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return err("Missing endpoint or keys (p256dh, auth)", 400);
  }

  // If the browser rotated the endpoint (pushsubscriptionchange), mark the
  // old subscription as inactive so we don't keep sending to a dead URL.
  if (body.oldEndpoint && body.oldEndpoint !== body.endpoint) {
    try {
      await db.pushSubscription.updateMany({
        where: { endpoint: body.oldEndpoint, customerId: customer.id },
        data: { isActive: false },
      });
    } catch {}
  }

  // Capture the browser UA for device analytics (Android / iOS / Windows / Mac).
  const userAgent =
    body.userAgent ||
    (req.headers.get("user-agent") ?? "").slice(0, 500) ||
    null;

  // Upsert by unique endpoint. This handles:
  //   • Same browser re-subscribing → refresh keys + reactivate.
  //   • A different customer reusing a recycled endpoint (rare) → ownership
  //     transfers to the new customer.
  const sub = await db.pushSubscription.upsert({
    where: { endpoint: body.endpoint },
    update: {
      customerId: customer.id,
      p256dhKey: body.keys.p256dh,
      authKey: body.keys.auth,
      userAgent,
      isActive: true,
    },
    create: {
      customerId: customer.id,
      endpoint: body.endpoint,
      p256dhKey: body.keys.p256dh,
      authKey: body.keys.auth,
      userAgent,
      isActive: true,
    },
  });

  // Ensure the preference row exists (default enabled). Cheap and idempotent.
  await getOrCreatePreference(customer.id);

  return ok({ id: sub.id, subscribed: true });
}
