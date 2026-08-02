// ============================================================================
// File: src/app/api/app-notifs/history/route.ts
// Purpose: Customer-facing list of their own App notifications (push log).
//          Used by the account page to show "Recent notifications" — a
//          list of pushes the customer received (transactional + campaign).
//          Returns newest first, capped at 50 to keep the payload small.
// ============================================================================

import { db } from "@/lib/db";
import { ok, unauthorized } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth";

export async function GET() {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login");

  const logs = await db.appNotifLog.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      templateKey: true,
      title: true,
      body: true,
      category: true,
      status: true,
      createdAt: true,
    },
  });

  return ok({ items: logs });
}
