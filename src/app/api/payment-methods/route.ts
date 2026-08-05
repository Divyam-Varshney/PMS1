// ============================================================================
// File: src/app/api/payment-methods/route.ts
// Purpose: Public endpoint — returns active payment methods for checkout.
//          Does NOT include gateway config (credentials stay server-side).
// ============================================================================

import { db } from "@/lib/db";
import { ok } from "@/lib/api";

export async function GET() {
  const methods = await db.paymentMethod.findMany({
    where: { isActive: true },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      key: true,
      label: true,
      description: true,
      icon: true,
      displayOrder: true,
    },
  });
  return ok(methods);
}
