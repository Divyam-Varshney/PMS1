// ============================================================================
// File: src/app/api/invoice/[orderId]/route.ts
// Purpose: Generate a PDF invoice for an order. Requires auth + ownership.
// Role: Returns application/pdf with Content-Disposition attachment so the
//       browser downloads the invoice.
// ============================================================================

import { db } from "@/lib/db";
import { unauthorized, forbidden, notFound } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth";
import { generateInvoicePdf, InvoiceData } from "@/lib/pdf";
import { generateInvoiceNumber, formatInvoiceDateTimeIST } from "@/lib/format";
import { getPaymentLabel } from "@/lib/payment-methods";
import { ORDER_STATUS_LABEL } from "@/lib/constants";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login");
  const { orderId } = await params;

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) return notFound("Order not found");
  if (order.customerId !== customer.id) return forbidden();

  const invoiceData: InvoiceData = {
    orderNumber: order.orderNumber,
    invoiceNumber: generateInvoiceNumber(order.orderNumber),
    orderDate: formatInvoiceDateTimeIST(order.createdAt),
    status: ORDER_STATUS_LABEL[order.status] ?? order.status,
    paymentMethod: await getPaymentLabel(order.paymentMethod),
    paymentStatus: order.paymentStatus,
    paymentTxnId: order.paymentTxnId ?? undefined,
    paymentGateway: order.paymentGateway ?? undefined,
    customerName: order.shipName,
    customerPhone: order.shipPhone,
    customerEmail: customer.email,
    shipLine1: order.shipLine1,
    shipLine2: order.shipLine2 ?? undefined,
    shipCity: order.shipCity,
    shipState: order.shipState,
    shipPincode: order.shipPincode,
    shipDistrict: order.shipDistrict,
    shipLocality: order.shipLocality ?? undefined,
    lines: order.items.map((i) => ({
      name: i.name,
      sku: i.sku,
      qty: i.qty,
      mrp: Number(i.mrp),
      unitPrice: Number(i.sellingPrice),
      appliedDiscountPct: Number(i.appliedDiscountPct),
      lineTotal: Number(i.lineTotal),
    })),
    itemsTotal: Number(order.itemsTotal),
    productDiscount: Number(order.productDiscount),
    voucherDiscount: Number(order.voucherDiscount),
    voucherCode: order.voucherCode ?? undefined,
    loyaltyPointsRedeemed: order.loyaltyPointsRedeemed,
    loyaltyDiscount: Number(order.loyaltyDiscount),
    deliveryCharge: Number(order.deliveryCharge),
    taxTotal: Number(order.taxTotal),
    grandTotal: Number(order.grandTotal),
    source: order.source,
    prescriptionId: order.prescriptionId,
    notes: order.notes,
  };

  const pdfBytes = await generateInvoicePdf(invoiceData);
  return new Response(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${order.orderNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
