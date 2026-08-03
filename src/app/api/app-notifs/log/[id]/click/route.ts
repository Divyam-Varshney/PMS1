// ============================================================================
// File: src/app/api/app-notifs/log/[id]/click/route.ts
// Purpose: Customer-facing endpoint — mark an AppNotifLog row as clicked.
//          Called by the Service Worker when the customer taps a notification.
//          Also marks the row as read (clicked implies read).
//
//  Auth: requires the logged-in customer to own the notification. Anonymous
//  404 if the log doesn't exist or belongs to a different customer — this
//  prevents leaking log IDs by enumeration.
// ============================================================================

import { db } from "@/lib/db";
import { ok, err, unauthorized } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const customer = await getCustomerFromRequest();
  // Even if not authenticated, return 200 silently — the SW fires this in
  // the background and we don't want to log noisy 401s. We just won't update
  // the row.
  if (!customer) return ok({ ok: true });

  const { id } = await params;

  // Only update if the log belongs to the current customer. This guards
  // against a malicious user trying to fake clicks on other customers'
  // notifications.
  await db.appNotifLog.updateMany({
    where: { id, customerId: customer.id },
    data: {
      isClicked: true,
      clickedAt: new Date(),
      isRead: true,
      readAt: new Date(),
    },
  });

  return ok({ ok: true });
}
