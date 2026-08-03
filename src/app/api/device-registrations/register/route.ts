// ============================================================================
// File: src/app/api/device-registrations/register/route.ts
// Purpose: POST — final step of the Device Registration Wizard. Called by
//          the client AFTER:
//            1. Notification permission has been granted
//            2. The Service Worker has been registered + activated
//            3. A push subscription has been created
//            4. The subscription has been POSTed to /api/push/subscribe
//
//  This endpoint:
//    • Receives the device info (deviceId, browserName, osName, deviceType,
//      deviceLabel, pushEndpoint).
//    • Upserts the DeviceRegistration row with status=completed.
//    • Marks the customer's AppNotifPreference as enabled=true.
//    • Sends a welcome test push via sendPushToCustomer so the customer
//      can verify the setup works.
//    • Returns the test push result + the registration record.
//
//  If the test push fails, we STILL mark the registration as completed — the
//  subscription was created successfully, the failure is likely just because
//  the push service is rate-limited or the device is offline. The customer
//  can re-test from Profile → Settings later.
// ============================================================================

import { db } from "@/lib/db";
import { ok, err, unauthorized, parseBody } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth";
import { getOrCreatePreference } from "@/lib/app-notifs";
import { sendPushToCustomer, isPushConfigured } from "@/lib/push-service";

export const dynamic = "force-dynamic";

interface RegisterBody {
  deviceId?: string;
  deviceLabel?: string;
  browserName?: string;
  osName?: string;
  deviceType?: string;
  pushEndpoint?: string;
}

export async function POST(req: Request) {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized();

  const body = await parseBody<RegisterBody>(req);
  if (!body?.deviceId || body.deviceId.length < 8) {
    return err("Missing or invalid deviceId", 400);
  }

  // Basic validation of the device fields.
  const browserName = (body.browserName || "Other").slice(0, 40);
  const osName = (body.osName || "Other").slice(0, 40);
  const deviceType = ["desktop", "mobile", "tablet", "pwa"].includes(body.deviceType || "")
    ? body.deviceType!
    : "desktop";
  const deviceLabel = (body.deviceLabel || `${browserName} · ${osName}`).slice(0, 120);
  const pushEndpoint = body.pushEndpoint?.slice(0, 500) || null;

  // Upsert the DeviceRegistration row.
  const reg = await db.deviceRegistration.upsert({
    where: {
      customerId_deviceId: { customerId: customer.id, deviceId: body.deviceId },
    },
    update: {
      deviceLabel,
      browserName,
      osName,
      deviceType,
      pushEndpoint,
      status: "completed",
      completedAt: new Date(),
      skippedAt: null,
      lastCheckedAt: new Date(),
    },
    create: {
      customerId: customer.id,
      deviceId: body.deviceId,
      deviceLabel,
      browserName,
      osName,
      deviceType,
      pushEndpoint,
      status: "completed",
      completedAt: new Date(),
      lastCheckedAt: new Date(),
    },
  });

  // Ensure the customer's AppNotifPreference is enabled=true.
  await getOrCreatePreference(customer.id);
  await db.appNotifPreference.updateMany({
    where: { customerId: customer.id },
    data: { enabled: true },
  }).catch(() => {});

  // Send the welcome test push so the customer can verify setup.
  let testResult = { sent: 0, failed: 0, pruned: 0 };
  if (isPushConfigured()) {
    try {
      testResult = await sendPushToCustomer(customer.id, {
        title: "Welcome to PMS Pharmacy",
        body: "App Notifications are now enabled successfully. You'll receive order updates, delivery notifications, medicine request updates, and exclusive offers.",
        icon: "/icon.png",
        tag: "pms-welcome",
        deepLink: "/#v=home",
        priority: "high",
        metadata: { type: "welcome", deviceId: body.deviceId },
      });
    } catch (e: any) {
      console.error("[device-registrations] welcome push failed:", e);
    }
  }

  return ok({
    registration: {
      id: reg.id,
      status: reg.status,
      deviceLabel: reg.deviceLabel,
      completedAt: reg.completedAt,
    },
    testPush: testResult,
    welcomed: testResult.sent > 0,
  });
}
