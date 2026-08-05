// ============================================================================
// File: src/app/api/device-registrations/validate/route.ts
// Purpose: POST — called on every customer login to validate that an
//          existing DeviceRegistration is still healthy. If the registration
//          is "completed" but the push subscription no longer exists on the
//          server (e.g. browser cleared site data, subscription expired, or
//          the customer revoked permission), we mark the registration as
//          "pending" again so the wizard re-appears.
//
//  Body:
//    { deviceId, hasBrowserPermission: boolean, hasLocalSubscription: boolean }
//
//  Logic:
//    1. Look up the DeviceRegistration by (customerId, deviceId).
//    2. If no row exists → return { shouldShowWizard: true, reason: "new_device" }.
//    3. If status="skipped" → return { shouldShowWizard: false }.
//    4. If status="completed":
//       a. Check if the customer still has an active PushSubscription on the
//          server. If not → mark registration as "pending" → wizard re-shows.
//       b. Check if the browser still has notification permission
//          (hasBrowserPermission from client). If not → mark as "pending".
//       c. If both are healthy → return { shouldShowWizard: false }.
//    5. If status="pending" → return { shouldShowWizard: true }.
//
//  This endpoint is idempotent — the client can call it on every page load
//  without side effects (only the lastCheckedAt timestamp is bumped when
//  everything is healthy).
// ============================================================================

import { db } from "@/lib/db";
import { ok, err, unauthorized, parseBody } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface ValidateBody {
  deviceId?: string;
  hasBrowserPermission?: boolean;
  hasLocalSubscription?: boolean;
}

export async function POST(req: Request) {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized();

  const body = await parseBody<ValidateBody>(req);
  if (!body?.deviceId || body.deviceId.length < 8) {
    return err("Missing or invalid deviceId", 400);
  }

  const reg = await db.deviceRegistration.findUnique({
    where: {
      customerId_deviceId: { customerId: customer.id, deviceId: body.deviceId },
    },
    select: {
      id: true,
      status: true,
      deviceLabel: true,
      completedAt: true,
      pushEndpoint: true,
    },
  });

  // No row → new device, show wizard.
  if (!reg) {
    return ok({
      shouldShowWizard: true,
      reason: "new_device",
      status: "none",
    });
  }

  // Skipped → never nag. Customer can re-enable from settings.
  if (reg.status === "skipped") {
    await db.deviceRegistration.update({
      where: { id: reg.id },
      data: { lastCheckedAt: new Date() },
    }).catch(() => {});
    return ok({
      shouldShowWizard: false,
      reason: "skipped",
      status: "skipped",
      deviceLabel: reg.deviceLabel,
    });
  }

  // Pending → wizard was started but not finished, re-prompt.
  if (reg.status === "pending") {
    return ok({
      shouldShowWizard: true,
      reason: "incomplete",
      status: "pending",
      deviceLabel: reg.deviceLabel,
    });
  }

  // Completed → validate the push subscription still exists server-side.
  const serverSubCount = await db.pushSubscription.count({
    where: { customerId: customer.id, isActive: true },
  });

  const browserPermissionOk = body.hasBrowserPermission !== false;
  const localSubscriptionOk = body.hasLocalSubscription !== false;
  const serverSubscriptionOk = serverSubCount > 0;

  if (browserPermissionOk && localSubscriptionOk && serverSubscriptionOk) {
    // Everything is healthy — bump lastCheckedAt, no wizard.
    await db.deviceRegistration.update({
      where: { id: reg.id },
      data: { lastCheckedAt: new Date() },
    }).catch(() => {});
    return ok({
      shouldShowWizard: false,
      reason: "healthy",
      status: "completed",
      deviceLabel: reg.deviceLabel,
      completedAt: reg.completedAt,
    });
  }

  // Something is broken — mark as pending so the wizard re-shows.
  let reason = "unknown";
  if (!browserPermissionOk) reason = "permission_revoked";
  else if (!localSubscriptionOk) reason = "local_subscription_missing";
  else if (!serverSubscriptionOk) reason = "server_subscription_missing";

  await db.deviceRegistration.update({
    where: { id: reg.id },
    data: {
      status: "pending",
      lastCheckedAt: new Date(),
    },
  }).catch(() => {});

  return ok({
    shouldShowWizard: true,
    reason,
    status: "pending",
    deviceLabel: reg.deviceLabel,
  });
}
