// ============================================================================
// File: src/app/api/delivery/calculate/route.ts
// Purpose: Public endpoint that calculates delivery charge for a given
//          locality + pincode + subtotal. Used by the checkout view so the
//          delivery charge can refresh when the customer picks a non-default
//          address (without round-tripping the whole cart).
// Role: Lightweight delivery calculator — returns the same shape as the
//       `delivery` block on /api/cart but with one extra `freeAbove` field
//       so the UI can show "Add ₹X more for FREE delivery" progress.
// ============================================================================

import { ok, err, parseBody } from "@/lib/api";
import { calculateDeliveryCharge } from "@/lib/pricing-engine";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const body = await parseBody<{
    locality?: string | null;
    pincode?: string | null;
    subtotal?: number;
  }>(req);
  if (!body) return err("Invalid request body");

  const locality = body.locality?.trim() || null;
  const pincode = body.pincode?.trim() || null;
  const subtotal = Number.isFinite(body.subtotal) ? Number(body.subtotal) : 0;

  // If neither is provided, we can't match a zone.
  if (!locality && !pincode) {
    return ok({
      charge: 0,
      free: false,
      serviceable: false,
      message: "Please select an address with a locality or pincode.",
      freeAbove: null,
      zoneName: null,
      estimatedHours: null,
    });
  }

  const delivery = await calculateDeliveryCharge(subtotal, { locality, pincode });

  // Look up the matched zone to expose its `freeAbove` for the UI progress bar.
  let freeAbove: number | null = null;
  if (delivery.zoneName) {
    const zone = await db.deliveryZone.findFirst({
      where: { name: delivery.zoneName, isActive: true },
      select: { freeAbove: true },
    });
    freeAbove = zone?.freeAbove != null ? Number(zone.freeAbove) : null;
  }

  return ok({
    charge: delivery.charge,
    free: delivery.free,
    zoneName: delivery.zoneName ?? null,
    zone: delivery.zone ?? null,
    estimatedHours: delivery.estimatedHours ?? null,
    serviceable: delivery.serviceable,
    message: delivery.message ?? null,
    freeAbove,
  });
}
