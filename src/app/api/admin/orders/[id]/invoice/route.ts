// ============================================================================
// File: src/app/api/admin/orders/[id]/invoice/route.ts
// Purpose: Generate a downloadable PDF invoice for the order. Reuses
//          generateInvoicePdf from lib/pdf.ts.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { unauthorized, notFound } from "@/lib/api";
import { generateInvoicePdf, InvoiceLine } from "@/lib/pdf";
import { generateInvoiceNumber, formatInvoiceDateTimeIST } from "@/lib/format";
import { getAllSettings } from "@/lib/settings";
import { getPaymentLabel } from "@/lib/payment-methods";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;

  const order = await db.order.findUnique({
    where: { id },
    include: { customer: true, items: true },
  });
  if (!order) return notFound("Order not found");

  const settings = await getAllSettings();
  const lines: InvoiceLine[] = order.items.map((it) => ({
    name: it.name,
    sku: it.sku,
    qty: it.qty,
    mrp: Number(it.mrp),
    unitPrice: it.qty > 0 ? Number(it.lineTotal) / it.qty : 0,
    appliedDiscountPct: Number(it.appliedDiscountPct),
    lineTotal: Number(it.lineTotal),
  }));

  const invoiceData = {
    orderNumber: order.orderNumber,
    invoiceNumber: generateInvoiceNumber(order.orderNumber),
    orderDate: formatInvoiceDateTimeIST(order.createdAt),
    status: order.status,
    paymentMethod: await getPaymentLabel(order.paymentMethod),
    paymentStatus: order.paymentStatus,
    paymentTxnId: order.paymentTxnId ?? undefined,
    paymentGateway: order.paymentGateway ?? undefined,
    customerName: order.shipName || order.customer?.name || "Unknown",
    customerPhone: order.shipPhone || order.customer?.phone || "N/A",
    customerEmail: order.customer?.email || "N/A",
    shipLine1: order.shipLine1,
    shipLine2: order.shipLine2 || undefined,
    shipCity: order.shipCity,
    shipState: order.shipState,
    shipPincode: order.shipPincode,
    shipDistrict: order.shipDistrict,
    shipLocality: order.shipLocality ?? undefined,
    lines,
    itemsTotal: Number(order.itemsTotal),
    productDiscount: Number(order.productDiscount),
    voucherDiscount: Number(order.voucherDiscount),
    voucherCode: order.voucherCode || undefined,
    loyaltyPointsRedeemed: order.loyaltyPointsRedeemed,
    loyaltyDiscount: Number(order.loyaltyDiscount),
    deliveryCharge: Number(order.deliveryCharge),
    taxTotal: Number(order.taxTotal),
    grandTotal: Number(order.grandTotal),
  };
  void settings; // settings are read inside generateInvoicePdf

  const pdf = await generateInvoicePdf(invoiceData);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${order.orderNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
