// ============================================================================
// File: src/app/api/app-notifs/test/route.ts
// Purpose: Customer-facing endpoint — send a TEST push notification to the
//          currently logged-in customer's devices. Used by the "Send Test"
//          button in the customer's notification-preferences card so they
//          can verify push is working end-to-end after enabling it.
//
//  Returns: { sent, failed, pruned } — same shape as sendPushToCustomer.
//  Errors:
//    401 — not logged in
//    400 — push not configured OR customer has no active subscriptions
// ============================================================================

import { ok, err, unauthorized } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth";
import { sendPushToCustomer, isPushConfigured } from "@/lib/push-service";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST() {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login to send a test notification");

  if (!isPushConfigured()) {
    return err("Push notifications are not configured on the server", 503);
  }

  // Check the customer has at least one active subscription — otherwise the
  // test would silently succeed with sent=0, which is confusing.
  const subCount = await db.pushSubscription.count({
    where: { customerId: customer.id, isActive: true },
  });
  if (subCount === 0) {
    return err("You haven't enabled notifications on any device yet. Toggle the switch above first.", 400);
  }

  const result = await sendPushToCustomer(customer.id, {
    title: "✅ Test Notification",
    body: `Hi ${customer.name}, this is a test from Pradeep Medical Store. If you can see this, push notifications are working correctly on your device!`,
    icon: "/icon.png",
    tag: "pms-test",
    deepLink: "/#v=account",
    priority: "normal",
    metadata: { test: true, customerId: customer.id },
  });

  if (result.sent === 0) {
    return err("Test notification could not be delivered. Your device may be offline or the subscription expired. Try disabling and re-enabling notifications.", 502);
  }

  return ok({ ...result, message: "Test notification sent! Check your device." });
}
