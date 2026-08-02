// ============================================================================
// File: src/app/api/push/unsubscribe/route.ts
// Purpose: Remove (or deactivate) a push subscription for the logged-in
//          customer. Called when:
//            • the customer turns off notifications in their browser
//            • the customer explicitly disables notifications from the UI
//            • the SW receives a pushsubscriptionchange event (the browser
//              rotated the endpoint)
//
//          We DELETE the row by endpoint so a re-subscribe later is clean.
//          Belongs-to check via customerId guards against a malicious user
//          trying to unsubscribe another customer's device.
// ============================================================================

import { db } from "@/lib/db";
import { ok, err, unauthorized, parseBody } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth";

interface UnsubscribeBody {
  endpoint?: string;
}

export async function POST(req: Request) {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login");

  const body = await parseBody<UnsubscribeBody>(req);
  if (!body?.endpoint) {
    return err("Missing endpoint", 400);
  }

  // Only delete subscriptions belonging to the logged-in customer.
  await db.pushSubscription.deleteMany({
    where: { endpoint: body.endpoint, customerId: customer.id },
  });

  return ok({ unsubscribed: true });
}
