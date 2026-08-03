// ============================================================================
// File: src/app/api/app-notifs/log/[id]/delivered/route.ts
// Purpose: Customer-facing endpoint — mark an AppNotifLog row as delivered
//          (i.e. the push event actually fired on the device and the SW
//          showed the notification). Called by the Service Worker's push
//          event handler. Used to compute accurate delivery rates.
//
//  Auth: same as the /click endpoint — silent 200 if not authenticated.
// ============================================================================

import { db } from "@/lib/db";
import { ok } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const customer = await getCustomerFromRequest();
  if (!customer) return ok({ ok: true });

  const { id } = await params;

  // Only update the sentAt timestamp if it's not already set — this avoids
  // repeatedly bumping the row when the same notification is delivered to
  // multiple devices (each device fires its own beacon).
  await db.appNotifLog.updateMany({
    where: { id, customerId: customer.id, sentAt: null },
    data: { sentAt: new Date() },
  });

  return ok({ ok: true });
}
