// ============================================================================
// File: src/app/api/device-registrations/skip/route.ts
// Purpose: POST — mark a device registration as "skipped". Called when the
//          customer clicks "Skip for Now" in the wizard. The wizard will
//          NOT re-appear on subsequent logins from this device — the
//          customer can enable notifications later from Profile → Settings.
//
//  Note: skipping does NOT deactivate the customer's AppNotifPreference or
//  any existing PushSubscription rows. It only marks THIS device's wizard
//  flow as dismissed.
// ============================================================================

import { db } from "@/lib/db";
import { ok, err, unauthorized, parseBody } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface SkipBody {
  deviceId?: string;
  deviceLabel?: string;
  browserName?: string;
  osName?: string;
  deviceType?: string;
}

export async function POST(req: Request) {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized();

  const body = await parseBody<SkipBody>(req);
  if (!body?.deviceId || body.deviceId.length < 8) {
    return err("Missing or invalid deviceId", 400);
  }

  const browserName = (body.browserName || "Other").slice(0, 40);
  const osName = (body.osName || "Other").slice(0, 40);
  const deviceType = ["desktop", "mobile", "tablet", "pwa"].includes(body.deviceType || "")
    ? body.deviceType!
    : "desktop";
  const deviceLabel = (body.deviceLabel || `${browserName} · ${osName}`).slice(0, 120);

  // Upsert with status=skipped. If a row already exists (e.g. status=pending
  // from an earlier incomplete run), update it to skipped.
  const reg = await db.deviceRegistration.upsert({
    where: {
      customerId_deviceId: { customerId: customer.id, deviceId: body.deviceId },
    },
    update: {
      deviceLabel,
      browserName,
      osName,
      deviceType,
      status: "skipped",
      skippedAt: new Date(),
      lastCheckedAt: new Date(),
    },
    create: {
      customerId: customer.id,
      deviceId: body.deviceId,
      deviceLabel,
      browserName,
      osName,
      deviceType,
      status: "skipped",
      skippedAt: new Date(),
      lastCheckedAt: new Date(),
    },
  });

  return ok({
    registration: { id: reg.id, status: reg.status },
    skipped: true,
  });
}
