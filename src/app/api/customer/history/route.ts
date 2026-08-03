// ============================================================================
// File: src/app/api/customer/history/route.ts
// Purpose: Unified customer history endpoint — merges Orders, Prescriptions,
//          and ManualRequests into a single timeline so the customer's "My
//          Activity" view can show everything that has happened in one place.
//          Each item is normalized to a common shape:
//
//            {
//              id, type, number, date, status, statusLabel,
//              adminRemarks, details
//            }
//
//          - type: "order" | "prescription" | "manual_request"
//          - number: orderNumber | `RX-${last8}` | `MR-${last8}`
//          - date:   ISO createdAt
//          - status: raw status string
//          - statusLabel: human-readable ("Pending", "Under Review", ...)
//          - adminRemarks: adminNotes for prescriptions/requests, null for orders
//          - details: type-specific extras (items for orders, medicines /
//                     images for prescriptions, medicine lines for requests)
//
//          Sorted by date DESC (newest first). Requires customer auth.
// Role: Powers OrdersView's unified-history redesign.
// ============================================================================

import { db } from "@/lib/db";
import { ok, unauthorized } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth";
import { ORDER_STATUS_LABEL, RX_STATUS_LABEL } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Last-8-uppercase slice — used for RX- and MR- prefixes. */
function shortId(id: string): string {
  return id.slice(-8).toUpperCase();
}

/** Status label resolver for orders — falls back to the raw status string. */
function orderStatusLabel(status: string): string {
  return ORDER_STATUS_LABEL[status] ?? status;
}

/** Status label resolver for prescriptions & manual requests. */
function rxStatusLabel(status: string): string {
  return RX_STATUS_LABEL[status] ?? status;
}

/** Safely parse the JSON-encoded images array stored on Prescription. */
function parseImages(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === "string");
    return [];
  } catch {
    return [];
  }
}

/** Split a ManualRequest.medicineList string into trimmed, non-empty lines. */
function splitMedicines(medicineList: string): string[] {
  return medicineList
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Unified item type — exported in the response shape.
// ---------------------------------------------------------------------------
type UnifiedHistoryItem =
  // ---- Order ----
  | {
      id: string;
      type: "order";
      number: string;
      date: string;
      status: string;
      statusLabel: string;
      adminRemarks: null;
      details: {
        grandTotal: number;
        deliveryCharge: number;
        estimatedDelivery: string | null;
        shipLocality: string | null;
        itemsCount: number;
        paymentMethod: string;
        paymentStatus: string;
        items: Array<{ id: string; name: string; qty: number; image?: string | null; lineTotal: number }>;
        source?: string | null;
        prescriptionId?: string | null;
        manualRequestId?: string | null;
      };
    }
  // ---- Prescription ----
  | {
      id: string;
      type: "prescription";
      number: string;
      date: string;
      status: string;
      statusLabel: string;
      adminRemarks: string | null;
      details: {
        images: string[];
        imageCount: number;
        notes?: string | null;
        convertedOrderId?: string | null;
        updatedAt: string;
      };
    }
  // ---- Manual Request ----
  | {
      id: string;
      type: "manual_request";
      number: string;
      date: string;
      status: string;
      statusLabel: string;
      adminRemarks: string | null;
      details: {
        medicines: string[];
        notes?: string | null;
        convertedOrderId?: string | null;
        updatedAt: string;
      };
    };

// ---------------------------------------------------------------------------
// GET /api/customer/history
// ---------------------------------------------------------------------------
export async function GET() {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login to view your activity");

  // Fetch all three sources in parallel — each is scoped to this customer and
  // sorted by createdAt DESC. We re-merge + re-sort after the parallel await
  // because the items come from different tables.
  const [orders, prescriptions, manualRequests] = await Promise.all([
    db.order.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentMethod: true,
        paymentStatus: true,
        grandTotal: true,
        deliveryCharge: true,
        estimatedDelivery: true,
        shipLocality: true,
        createdAt: true,
        source: true,
        prescriptionId: true,
        manualRequestId: true,
        items: {
          select: {
            id: true,
            name: true,
            qty: true,
            image: true,
            lineTotal: true,
          },
          // Cap preview to keep the payload small — the customer can open the
          // detail view for the full list.
          take: 5,
        },
        _count: { select: { items: true } },
      },
    }),
    db.prescription.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        images: true,
        notes: true,
        status: true,
        adminNotes: true,
        convertedOrderId: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.manualRequest.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        medicineList: true,
        notes: true,
        status: true,
        adminNotes: true,
        convertedOrderId: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  // ---- Normalize each source into the unified shape ----
  const orderItems: UnifiedHistoryItem[] = orders.map((o) => ({
    id: o.id,
    type: "order",
    number: o.orderNumber,
    date: o.createdAt.toISOString(),
    status: o.status,
    statusLabel: orderStatusLabel(o.status),
    adminRemarks: null,
    details: {
      grandTotal: Number(o.grandTotal),
      deliveryCharge: Number(o.deliveryCharge),
      estimatedDelivery: o.estimatedDelivery ? o.estimatedDelivery.toISOString() : null,
      shipLocality: o.shipLocality,
      itemsCount: o._count.items,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      items: o.items.map((it) => ({
        id: it.id,
        name: it.name,
        image: it.image,
        qty: it.qty,
        lineTotal: Number(it.lineTotal),
      })),
      source: o.source,
      prescriptionId: o.prescriptionId,
      manualRequestId: o.manualRequestId,
    },
  }));

  const prescriptionItems: UnifiedHistoryItem[] = prescriptions.map((p) => {
    const images = parseImages(p.images);
    return {
      id: p.id,
      type: "prescription",
      number: `RX-${shortId(p.id)}`,
      date: p.createdAt.toISOString(),
      status: p.status,
      statusLabel: rxStatusLabel(p.status),
      adminRemarks: p.adminNotes,
      details: {
        images,
        imageCount: images.length,
        notes: p.notes,
        convertedOrderId: p.convertedOrderId,
        updatedAt: p.updatedAt.toISOString(),
      },
    };
  });

  const manualRequestItems: UnifiedHistoryItem[] = manualRequests.map((r) => ({
    id: r.id,
    type: "manual_request",
    number: `MR-${shortId(r.id)}`,
    date: r.createdAt.toISOString(),
    status: r.status,
    statusLabel: rxStatusLabel(r.status),
    adminRemarks: r.adminNotes,
    details: {
      medicines: splitMedicines(r.medicineList),
      notes: r.notes,
      convertedOrderId: r.convertedOrderId,
      updatedAt: r.updatedAt.toISOString(),
    },
  }));

  // ---- Merge + sort by date DESC ----
  const unified = [...orderItems, ...prescriptionItems, ...manualRequestItems].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return ok({ items: unified, total: unified.length });
}
