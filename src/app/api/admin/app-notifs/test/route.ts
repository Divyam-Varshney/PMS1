// ============================================================================
// File: src/app/api/admin/app-notifs/test/route.ts
// Purpose: Admin endpoint — send a TEST push notification to a SPECIFIC
//          customer (selected by ID). Used by the admin App Notification
//          Center "Send Test" button so admins can verify a single customer's
//          push setup before broadcasting to everyone.
//
//  Body: { customerId: string }
//  Permission: "newsletter" (same as broadcast)
// ============================================================================

import { db } from "@/lib/db";
import { ok, err, unauthorized, parseBody } from "@/lib/api";
import { getAdminFromRequest } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { sendPushToCustomer, isPushConfigured } from "@/lib/push-service";

export const dynamic = "force-dynamic";

interface TestBody {
  customerId?: string;
}

export async function POST(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  if (!hasPermission(admin, "newsletter")) {
    return err("You don't have permission to send test notifications", 403);
  }

  if (!isPushConfigured()) {
    return err("Push notifications are not configured on the server (missing VAPID keys)", 503);
  }

  const body = await parseBody<TestBody>(req);
  if (!body?.customerId) {
    return err("Missing customerId", 400);
  }

  const customer = await db.customer.findUnique({
    where: { id: body.customerId },
    select: { id: true, name: true, isActive: true },
  });
  if (!customer) {
    return err("Customer not found", 404);
  }
  if (!customer.isActive) {
    return err("Customer is deactivated — cannot send test", 400);
  }

  const subCount = await db.pushSubscription.count({
    where: { customerId: customer.id, isActive: true },
  });
  if (subCount === 0) {
    return err("This customer has no active push subscriptions. They may not have enabled notifications on any device.", 400);
  }

  const result = await sendPushToCustomer(customer.id, {
    title: "🧪 Admin Test Notification",
    body: `Hi ${customer.name}, this is a test push from the PMS admin team. Your notifications are working correctly.`,
    icon: "/icon.png",
    tag: "pms-admin-test",
    deepLink: "/#v=home",
    priority: "normal",
    metadata: { adminTest: true, sentBy: admin.id, sentByName: admin.name },
  });

  // Log the test send so it appears in the admin history view.
  try {
    await db.appNotifLog.create({
      data: {
        customerId: customer.id,
        templateKey: "admin_test",
        title: "🧪 Admin Test Notification",
        body: `Test sent by ${admin.name}`,
        category: "system",
        status: result.sent > 0 ? "sent" : "failed",
        error: result.sent > 0 ? null : `${result.failed} failed, ${result.pruned} pruned`,
        metadata: JSON.stringify({ adminTest: true, sentBy: admin.id, ...result }),
        sentAt: result.sent > 0 ? new Date() : null,
      },
    });
  } catch {}

  if (result.sent === 0) {
    return err("Test could not be delivered. The customer's device may be offline or all subscriptions expired.", 502);
  }

  return ok({ ...result, customerName: customer.name });
}
