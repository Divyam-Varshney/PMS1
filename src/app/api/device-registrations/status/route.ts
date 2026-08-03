// ============================================================================
// File: src/app/api/device-registrations/status/route.ts
// Purpose: GET — returns the registration status of THIS device for the
//          logged-in customer. The client passes its `deviceId` (from
//          localStorage) in the query string.
//
//  Response shape:
//    {
//      registered: boolean,        // true if a DeviceRegistration row exists
//      status: "pending" | "skipped" | "completed" | "none",
//      shouldShowWizard: boolean,  // true if the wizard should appear
//      reason: string,             // human-readable explanation
//      deviceLabel?: string,       // last-known label for this device
//      completedAt?: string,       // ISO timestamp if status=completed
//    }
//
//  Logic:
//    • No row + customer not authenticated → registered=false, shouldShowWizard=false
//    • No row + authenticated → registered=false, shouldShowWizard=true (new device)
//    • status=completed → registered=true, shouldShowWizard=false
//    • status=skipped  → registered=true, shouldShowWizard=false
//      (skipped means the customer explicitly dismissed; they can re-enable
//       from Profile → Settings. The wizard should NOT nag them.)
//    • status=pending  → registered=true, shouldShowWizard=true
//      (wizard started but not finished — re-prompt)
// ============================================================================

import { db } from "@/lib/db";
import { ok, err, unauthorized } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized();

  const url = new URL(req.url);
  const deviceId = url.searchParams.get("deviceId");
  if (!deviceId || deviceId.length < 8) {
    return err("Missing or invalid deviceId", 400);
  }

  const reg = await db.deviceRegistration.findUnique({
    where: {
      customerId_deviceId: { customerId: customer.id, deviceId },
    },
    select: {
      id: true,
      status: true,
      deviceLabel: true,
      completedAt: true,
      skippedAt: true,
      lastCheckedAt: true,
    },
  });

  if (!reg) {
    return ok({
      registered: false,
      status: "none",
      shouldShowWizard: true,
      reason: "This device hasn't been registered yet.",
    });
  }

  // Bump lastCheckedAt so we can see which devices are still active.
  await db.deviceRegistration.update({
    where: { id: reg.id },
    data: { lastCheckedAt: new Date() },
  }).catch(() => {});

  const shouldShowWizard = reg.status === "pending";

  return ok({
    registered: true,
    status: reg.status,
    shouldShowWizard,
    reason:
      reg.status === "completed"
        ? "Device is registered and ready to receive notifications."
        : reg.status === "skipped"
        ? "Notifications were skipped on this device. Enable them from Profile → Settings."
        : "Registration was started but not completed.",
    deviceLabel: reg.deviceLabel,
    completedAt: reg.completedAt,
    skippedAt: reg.skippedAt,
  });
}
