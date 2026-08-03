// ============================================================================
// File: src/app/api/admin/orders/[id]/shipping-label/route.ts
// Purpose: Generate a printable PDF shipping label for the order. Includes
//          order info, ship-to address, store info, and package details.
//          A4-compatible, clean, professional layout.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { unauthorized, notFound } from "@/lib/api";
import { generateShippingLabelPdf } from "@/lib/pdf";
import { formatDateTime } from "@/lib/format";
import { getPaymentLabel } from "@/lib/payment-methods";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;

  const order = await db.order.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!order) return notFound("Order not found");

  const labelData = {
    orderNumber: order.orderNumber,
    orderDate: formatDateTime(order.createdAt),
    orderValue: Number(order.grandTotal) || 0,
    paymentMethod: await getPaymentLabel(order.paymentMethod),
    paymentStatus: order.paymentStatus,
    customerName: order.shipName || "Unknown",
    customerPhone: order.shipPhone || "N/A",
    shipLine1: order.shipLine1,
    shipLine2: order.shipLine2 || undefined,
    shipLocality: order.shipLocality || undefined,
    shipCity: order.shipCity,
    shipDistrict: order.shipDistrict,
    shipState: order.shipState,
    shipPincode: order.shipPincode,
    packageNumber: order.orderNumber,
    itemsCount: order.items.length,
    notes: order.notes || undefined,
  };

  const pdf = await generateShippingLabelPdf(labelData);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="shipping-label-${order.orderNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
