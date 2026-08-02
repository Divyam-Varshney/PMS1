// ============================================================================
// File: src/app/api/app-notifs/preferences/route.ts
// Purpose: Customer-facing App notification preferences. GET returns the
//          customer's preference (auto-creating with default enabled=true
//          if missing). PUT updates the `enabled` master toggle.
// ============================================================================

import { db } from "@/lib/db";
import { ok, err, unauthorized, parseBody } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth";
import { getOrCreatePreference } from "@/lib/app-notifs";

export async function GET() {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login");

  const pref = await getOrCreatePreference(customer.id);
  // Also report how many active device subscriptions exist so the UI can
  // tell the customer "you'll receive notifications on N device(s)".
  const deviceCount = await db.pushSubscription.count({
    where: { customerId: customer.id, isActive: true },
  });
  return ok({
    enabled: pref.enabled,
    updatedAt: pref.updatedAt,
    activeDevices: deviceCount,
  });
}

export async function PUT(req: Request) {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login");

  const body = await parseBody<{ enabled?: boolean }>(req);
  if (body?.enabled === undefined || typeof body.enabled !== "boolean") {
    return err("Missing or invalid 'enabled' field", 400);
  }

  // getOrCreate + update (avoids the unique-customerId race).
  const pref = await getOrCreatePreference(customer.id);
  const updated = await db.appNotifPreference.update({
    where: { id: pref.id },
    data: { enabled: body.enabled },
  });

  // If the customer is turning OFF notifications, also deactivate their
  // device subscriptions so the browser stops receiving pushes entirely
  // (preferences are checked server-side, but this is a belt-and-suspenders
  // approach that also frees FCM/Mozilla quota).
  if (!body.enabled) {
    await db.pushSubscription.updateMany({
      where: { customerId: customer.id },
      data: { isActive: false },
    });
  } else {
    // Turning back ON: reactivate existing subscriptions (the user may need
    // to re-subscribe if their browser expired them, but this preserves
    // any still-valid ones).
    await db.pushSubscription.updateMany({
      where: { customerId: customer.id },
      data: { isActive: true },
    });
  }

  return ok({ enabled: updated.enabled, updatedAt: updated.updatedAt });
}
