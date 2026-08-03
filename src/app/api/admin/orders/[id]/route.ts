// ============================================================================
// File: src/app/api/admin/orders/[id]/route.ts
// Purpose: Get a full order detail — items, customer, address, status history,
//          internal notes (OrderNote), customer's lifetime order stats, and
//          (when linked) the source prescription so the admin can verify it
//          without leaving the order detail page.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, unauthorized, notFound } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;

  const order = await db.order.findUnique({
    where: { id },
    include: {
      customer: {
        select: { id: true, name: true, email: true, phone: true, isActive: true },
      },
      address: true,
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              primaryImage: true,
              stock: true,
              prescriptionRequired: true,
            },
          },
        },
      },
      statusHistory: { orderBy: { createdAt: "asc" } },
      orderNotes: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) return notFound("Order not found");

  // Look up the source prescription (if any) in a separate query — we
  // keep it as a plain String? FK on Order rather than adding a Prisma
  // relation so we don't have to maintain a back-relation on Prescription
  // (which already has convertedOrderId as a denormalized reverse pointer).
  let prescription: any = null;
  if (order.prescriptionId) {
    prescription = await db.prescription.findUnique({
      where: { id: order.prescriptionId },
      select: {
        id: true,
        images: true,
        notes: true,
        status: true,
        adminNotes: true,
        createdAt: true,
      },
    });
    if (prescription) {
      try {
        prescription.images = JSON.parse(prescription.images || "[]");
      } catch {
        prescription.images = [];
      }
    }
  }

  // Customer's lifetime order stats (so the detail page can show
  // "X previous orders · Rs. Y total spent" without a follow-up call).
  let customerStats: { orderCount: number; totalSpent: number } | null = null;
  if (order.customerId) {
    const agg = await db.order.aggregate({
      where: {
        customerId: order.customerId,
        status: { notIn: ["cancelled"] },
      },
      _count: { _all: true },
      _sum: { grandTotal: true },
    });
    customerStats = {
      orderCount: agg._count._all,
      totalSpent: Number(agg._sum.grandTotal ?? 0),
    };
  }

  return ok({ ...order, prescription, customerStats });
}
