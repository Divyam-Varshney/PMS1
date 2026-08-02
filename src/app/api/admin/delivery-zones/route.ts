// ============================================================================
// File: src/app/api/admin/delivery-zones/route.ts
// Purpose: List & create delivery zones (locality-based, centralized system).
//          Each zone has localities (preferred) + optional pincodes (fallback),
//          charge, freeAbove, minOrder, estimatedHours, displayOrder.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, parseBody } from "@/lib/api";
import { invalidateDeliveryZoneCache } from "@/lib/pricing-engine";

export async function GET() {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const items = await db.deliveryZone.findMany({
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
  });
  return ok(items);
}

export async function POST(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const body = await parseBody<{
    name: string;
    localities?: string;
    pincodes?: string;
    charge?: number;
    freeAbove?: number | null;
    minOrder?: number;
    estimatedHours?: number;
    isActive?: boolean;
    displayOrder?: number;
  }>(req);

  if (!body?.name?.trim()) return err("Zone name is required");

  const zone = await db.deliveryZone.create({
    data: {
      name: body.name.trim(),
      localities: body.localities ?? "",
      pincodes: body.pincodes ?? "",
      charge: Number(body.charge ?? 0),
      freeAbove: body.freeAbove != null && String(body.freeAbove) !== "" ? Number(body.freeAbove) : null,
      minOrder: Number(body.minOrder ?? 0),
      estimatedHours: Number(body.estimatedHours ?? 24),
      isActive: body.isActive ?? true,
      displayOrder: Number(body.displayOrder ?? 0),
    },
  });
  invalidateDeliveryZoneCache();
  return ok(zone, 201);
}
