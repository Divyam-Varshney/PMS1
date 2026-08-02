// ============================================================================
// File: src/app/api/admin/customers/[id]/route.ts
// Purpose: Get customer detail (profile, stats, addresses, recent orders,
//          prescriptions, manual requests, loyalty history) and toggle active.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, notFound, parseBody } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;

  const customer = await db.customer.findUnique({
    where: { id },
    include: {
      addresses: true,
      // Last 10 orders — used by the "Recent Orders" table on the detail view.
      orders: {
        take: 10,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          paymentMethod: true,
          grandTotal: true,
          createdAt: true,
          items: { select: { id: true, name: true, qty: true } },
        },
      },
      // Last 5 prescriptions — image count is derived from the JSON-array
      // `images` column on the client (or here, see below).
      prescriptions: {
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          notes: true,
          createdAt: true,
          images: true,
        },
      },
      // Last 5 manual medicine requests.
      manualRequests: {
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          notes: true,
          medicineList: true,
          createdAt: true,
        },
      },
      // Last 10 loyalty transactions — the audit trail of every points
      // earn / redeem / adjust on this customer's account.
      loyaltyTxns: {
        take: 10,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          points: true,
          balance: true,
          reason: true,
          orderId: true,
          createdAt: true,
        },
      },
      _count: { select: { orders: true, prescriptions: true, manualRequests: true } },
    },
  });
  if (!customer) return notFound();

  // Aggregate stats from non-cancelled orders — totalSpent, totalOrders,
  // avgOrderValue. Cancelled orders are excluded so the numbers reflect
  // actual revenue the customer has generated.
  const totalSpentRow = await db.order.aggregate({
    where: { customerId: id, status: { not: "cancelled" } },
    _sum: { grandTotal: true },
    _count: true,
  });
  const totalSpent = Number(totalSpentRow._sum.grandTotal ?? 0);
  const nonCancelledCount = totalSpentRow._count;
  const avgOrderValue = nonCancelledCount > 0 ? totalSpent / nonCancelledCount : 0;

  // Parse prescription image JSON arrays up-front so the client can render
  // "N images" without re-parsing. Malformed JSON degrades to an empty array.
  const prescriptions = customer.prescriptions.map((p) => {
    let imageCount = 0;
    try {
      const parsed = JSON.parse(p.images);
      if (Array.isArray(parsed)) imageCount = parsed.length;
    } catch {
      // ignore — imageCount stays 0
    }
    return { id: p.id, status: p.status, notes: p.notes, createdAt: p.createdAt, imageCount };
  });

  // Parse manual request medicine lists — split on newlines / commas to get
  // a medicine count for display ("N medicines requested").
  const manualRequests = customer.manualRequests.map((m) => {
    const medicines = (m.medicineList || "")
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    return {
      id: m.id,
      status: m.status,
      notes: m.notes,
      createdAt: m.createdAt,
      medicineCount: medicines.length,
    };
  });

  return ok({
    ...customer,
    prescriptions,
    manualRequests,
    // Stats row on the customer detail view.
    totalSpent,
    totalOrders: customer._count.orders,
    nonCancelledOrders: nonCancelledCount,
    avgOrderValue,
    ordersCount: customer._count.orders,
    prescriptionsCount: customer._count.prescriptions,
    manualRequestsCount: customer._count.manualRequests,
    loyaltyTxns: customer.loyaltyTxns,
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;

  const body = await parseBody<{ isActive?: boolean; name?: string; phone?: string; whatsappOptIn?: boolean }>(req);
  if (!body) return err("Invalid body", 400);

  const existing = await db.customer.findUnique({ where: { id } });
  if (!existing) return notFound();

  const data: any = {};
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.phone !== undefined) data.phone = body.phone.trim();
  if (typeof body.whatsappOptIn === "boolean") data.whatsappOptIn = body.whatsappOptIn;

  const updated = await db.customer.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, phone: true, isActive: true, whatsappOptIn: true },
  });
  return ok(updated);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;

  const existing = await db.customer.findUnique({ where: { id } });
  if (!existing) return notFound();

  // Delete the customer. Orders are preserved because customerId is nullable
  // with onDelete: SetNull — the order records stay with customerId=null.
  await db.customer.delete({ where: { id } });
  return ok({ deleted: true });
}
