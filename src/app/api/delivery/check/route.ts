// ============================================================================
// File: src/app/api/delivery/check/route.ts
// Purpose: Public endpoint that lets customers check delivery availability
//          and charge for a given pincode BEFORE placing an order. Used by
//          the checkout view to show real-time delivery info when an address
//          is selected. Returns zone name, charge, free-delivery threshold,
//          estimated delivery hours, and serviceability flag.
// ============================================================================

import { db } from "@/lib/db";
import { ok } from "@/lib/api";
import { calculateDeliveryCharge } from "@/lib/pricing-engine";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const pincode = (url.searchParams.get("pincode") || "").trim();
  const subtotal = Number(url.searchParams.get("subtotal")) || 0;

  if (!pincode) return ok({ serviceable: false, message: "Pincode is required" });

  // Use the centralized delivery engine from pricing-engine. It looks up the
  // matching DeliveryZone by pincode (or locality, if provided) and returns
  // the charge, free-delivery flag, zone name, ETA and serviceability.
  const delivery = await calculateDeliveryCharge(subtotal, { pincode });

  // Fetch the matched zone row for the extra metadata the checkout UI shows
  // (minOrder, freeAbove). calculateDeliveryCharge returns the zone name but
  // not the full row, so we look it up by name.
  let zoneMeta: { name: string; estimatedHours: number; minOrder: number; freeAbove: number | null } | null = null;
  if (delivery.zoneName) {
    const zone = await db.deliveryZone.findFirst({
      where: { name: delivery.zoneName, isActive: true },
      select: { name: true, estimatedHours: true, minOrder: true, freeAbove: true },
    });
    if (zone) zoneMeta = {
      name: zone.name,
      estimatedHours: zone.estimatedHours,
      minOrder: Number(zone.minOrder),
      freeAbove: zone.freeAbove != null ? Number(zone.freeAbove) : null,
    };
  }

  return ok({
    serviceable: delivery.serviceable,
    pincode,
    zone: zoneMeta,
    charge: delivery.charge,
    free: delivery.free,
    zoneName: delivery.zone,
    subtotal,
    // ETA as a human-readable string
    etaText: zoneMeta
      ? `Estimated delivery in ${zoneMeta.estimatedHours} hours`
      : delivery.serviceable
        ? "Estimated delivery in 24-48 hours"
        : delivery.message ?? "Delivery not available",
    message: delivery.message,
  });
}
