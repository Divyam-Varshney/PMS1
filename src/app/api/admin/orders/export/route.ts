// ============================================================================
// File: src/app/api/admin/orders/export/route.ts
// Purpose: Export orders to CSV. Admin-authenticated. If `ids` query param is
//          provided, export only those orders; otherwise export all orders
//          matching the same filters the admin Orders view uses
//          (status, paymentStatus, from, to, search).
// Role: Supports the "Export CSV" bulk action in the admin Orders view.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { unauthorized, param } from "@/lib/api";

/** Escape a CSV field — wraps in quotes if it contains comma, quote, or newline. */
function csvEscape(v: any): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const url = new URL(req.url);
  const idsParam = url.searchParams.get("ids");

  // Build the `where` clause. If `ids` provided, filter by id; otherwise apply
  // the same filters the Orders list view applies.
  const where: any = {};
  if (idsParam) {
    where.id = { in: idsParam.split(",").map((s) => s.trim()).filter(Boolean) };
  } else {
    const status = param(req, "status");
    const paymentStatus = param(req, "paymentStatus");
    const search = param(req, "search")?.trim();
    const from = param(req, "from");
    const to = param(req, "to");

    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }
    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { shipName: { contains: search } },
        { shipPhone: { contains: search } },
        { customer: { name: { contains: search } } },
        { customer: { email: { contains: search } } },
      ];
    }
  }

  const orders = await db.order.findMany({
    where,
    include: {
      customer: { select: { name: true, phone: true } },
      items: { select: { name: true, qty: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Columns required by the bulk-export spec.
  const headers = [
    "OrderNumber",
    "Date",
    "CustomerName",
    "CustomerPhone",
    "Items",
    "Total",
    "Status",
    "PaymentMethod",
    "PaymentStatus",
    "ShipAddress",
  ];

  const rows = orders.map((o) => {
    // Use ship snapshot fields since customer may be null (deleted customer).
    const customerName = o.customer?.name || o.shipName;
    const customerPhone = o.customer?.phone || o.shipPhone;
    const itemsSummary = o.items
      .map((it) => `${it.qty}x ${it.name}`)
      .join("; ");
    const shipAddress = [o.shipLine1, o.shipLine2, o.shipCity, o.shipState, o.shipPincode]
      .filter(Boolean)
      .join(", ");
    const date = o.createdAt.toISOString();
    const total = o.grandTotal.toFixed(2);

    return [
      o.orderNumber,
      date,
      customerName,
      customerPhone,
      itemsSummary,
      total,
      o.status,
      o.paymentMethod,
      o.paymentStatus,
      shipAddress,
    ]
      .map(csvEscape)
      .join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  const filename = `orders-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
