// ============================================================================
// File: src/app/api/admin/orders/route.ts
// Purpose: List orders with filters and pagination. Supports:
//            - search (order #, customer name, phone, email)
//            - status (single) + statuses (comma-separated multi-select)
//            - paymentStatus (single) + paymentStatuses (multi-select)
//            - paymentMethod
//            - date range (from / to)
//            - prescriptionRequired (boolean — true: only orders with a
//              linked prescription OR Rx items; false: no filter)
//            - hasNotes (boolean — true: only orders with adminNotes or
//              customer notes)
//          Each item includes the first 3 line-item images + names so the
//          admin list can show thumbnails without a follow-up request.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, unauthorized, param, paramInt } from "@/lib/api";

export async function GET(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const status = param(req, "status");
  const statusesParam = param(req, "statuses");
  const paymentStatus = param(req, "paymentStatus");
  const paymentStatusesParam = param(req, "paymentStatuses");
  const paymentMethod = param(req, "paymentMethod");
  const search = param(req, "search")?.trim();
  const from = param(req, "from");
  const to = param(req, "to");
  const prescriptionRequired = param(req, "prescriptionRequired");
  const hasNotes = param(req, "hasNotes");
  const page = Math.max(1, paramInt(req, "page", 1));
  const pageSize = Math.min(100, Math.max(1, paramInt(req, "pageSize", 20)));

  const where: any = {};

  // Multi-select statuses take precedence over single status (UI uses
  // multi-select when the user ticks more than one chip).
  if (statusesParam) {
    const arr = statusesParam.split(",").map((s) => s.trim()).filter(Boolean);
    if (arr.length > 0) where.status = { in: arr };
  } else if (status) {
    where.status = status;
  }

  if (paymentStatusesParam) {
    const arr = paymentStatusesParam.split(",").map((s) => s.trim()).filter(Boolean);
    if (arr.length > 0) where.paymentStatus = { in: arr };
  } else if (paymentStatus) {
    where.paymentStatus = paymentStatus;
  }

  if (paymentMethod) where.paymentMethod = paymentMethod;

  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) {
      // Include the entire `to` day (23:59:59) so an admin picking
      // "to = today" sees today's orders too.
      const endDate = new Date(to);
      endDate.setHours(23, 59, 59, 999);
      where.createdAt.lte = endDate;
    }
  }

  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: "insensitive" } },
      { shipName: { contains: search, mode: "insensitive" } },
      { shipPhone: { contains: search } },
      { customer: { name: { contains: search, mode: "insensitive" } } },
      { customer: { email: { contains: search, mode: "insensitive" } } },
      { customer: { phone: { contains: search } } },
    ];
  }

  if (prescriptionRequired === "true") {
    // Either the order was created from a prescription, OR any of its
    // line items links to a product that requires an Rx. We model this
    // with a relation filter so Prisma generates the right EXISTS clause.
    where.OR = where.OR
      ? [
          ...where.OR,
          { prescriptionId: { not: null } },
          { source: "prescription" },
          { items: { some: { product: { prescriptionRequired: true } } } },
        ]
      : [
          { prescriptionId: { not: null } },
          { source: "prescription" },
          { items: { some: { product: { prescriptionRequired: true } } } },
        ];
  }

  if (hasNotes === "true") {
    where.OR = where.OR
      ? [
          ...where.OR,
          { adminNotes: { not: null } },
          { notes: { not: null } },
        ]
      : [
          { adminNotes: { not: null } },
          { notes: { not: null } },
        ];
  }

  const [total, items, itemCounts] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        items: {
          select: {
            id: true,
            name: true,
            qty: true,
            image: true,
          },
          // Cap to first 5 items per order — the list view only shows
          // up to 3 thumbnails + a "+N more" pill, so don't pull all.
          take: 5,
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    // Total item count per order — runs in parallel so the list view
    // can show an accurate "+N more" pill even when the take=5 cap
    // truncated the items array.
    db.order.findMany({
      where,
      select: { id: true, _count: { select: { items: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const countById = new Map(itemCounts.map((o) => [o.id, o._count.items]));

  // Compute item-count + first-thumbnail summary for each order so the
  // frontend can render thumbnails + a "+N" pill without fetching the
  // full item list.
  const enriched = items.map((o) => ({
    ...o,
    itemCount: countById.get(o.id) ?? o.items.length,
    previewItems: o.items.slice(0, 3),
  }));

  return ok({ items: enriched, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}
