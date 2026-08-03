// ============================================================================
// File: src/app/api/delivery/localities/route.ts
// Purpose: Public endpoint that returns a sorted, de-duplicated list of all
//          locality names defined across active DeliveryZone records. Powers
//          the "Locality / Area" dropdown in the address forms so customers
//          can only pick a serviced area (and so delivery charges are always
//          computed correctly on the server).
// Role: Read-only — called from checkout-view + addresses-view address forms.
// ============================================================================

import { db } from "@/lib/db";
import { ok } from "@/lib/api";

export async function GET() {
  // Fetch all active zones — `localities` is a newline/comma-separated string.
  const zones = await db.deliveryZone.findMany({
    where: { isActive: true },
    select: { localities: true },
  });

  const set = new Set<string>();
  for (const z of zones) {
    if (!z.localities) continue;
    // Split on newlines OR commas (any combination) and trim each entry.
    const parts = z.localities
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const p of parts) set.add(p);
  }

  const localities = Array.from(set).sort((a, b) =>
    a.localeCompare(b, "en", { sensitivity: "base" })
  );

  return ok({ localities });
}
