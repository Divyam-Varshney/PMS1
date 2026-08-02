// ============================================================================
// File: src/app/api/admin/delivery-zones/[id]/route.ts
// Purpose: Get / update / delete a delivery zone (locality-based model).
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, notFound, parseBody } from "@/lib/api";
import { invalidateDeliveryZoneCache } from "@/lib/pricing-engine";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;
  const z = await db.deliveryZone.findUnique({ where: { id } });
  if (!z) return notFound();
  return ok(z);
}

export async function PUT(req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;
  const body = await parseBody<any>(req);
  if (!body) return err("Invalid body", 400);
  const existing = await db.deliveryZone.findUnique({ where: { id } });
  if (!existing) return notFound();

  const updated = await db.deliveryZone.update({
    where: { id },
    data: {
      name: body.name ?? existing.name,
      localities: body.localities ?? existing.localities,
      pincodes: body.pincodes ?? existing.pincodes,
      charge: body.charge != null ? Number(body.charge) : existing.charge,
      freeAbove: body.freeAbove !== undefined
        ? (body.freeAbove != null && String(body.freeAbove) !== "" ? Number(body.freeAbove) : null)
        : existing.freeAbove,
      minOrder: body.minOrder != null ? Number(body.minOrder) : existing.minOrder,
      estimatedHours: body.estimatedHours != null ? Number(body.estimatedHours) : existing.estimatedHours,
      isActive: body.isActive ?? existing.isActive,
      displayOrder: body.displayOrder != null ? Number(body.displayOrder) : existing.displayOrder,
    },
  });
  invalidateDeliveryZoneCache();
  return ok(updated);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;
  await db.deliveryZone.delete({ where: { id } });
  invalidateDeliveryZoneCache();
  return ok({ deleted: true });
}
