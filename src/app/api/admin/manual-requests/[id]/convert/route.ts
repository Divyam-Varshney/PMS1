// ============================================================================
// File: src/app/api/admin/manual-requests/[id]/convert/route.ts
// Purpose: Convert a manual medicine request into a real order. The admin
//          supplies a list of {productId, qty} (the request only contains a
//          free-text medicine list, so the admin maps each requested medicine
//          to a catalog product). Creates an Order + OrderItem snapshots via
//          the centralized Discount Engine, links the order back to the manual
//          request (source = "manual_request", manualRequestId), marks the
//          request as "converted", and sends the order_confirmed notification.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, notFound, parseBody } from "@/lib/api";
import { calculateOrderTotals, EngineLineInput } from "@/lib/pricing-engine";
import { generateOrderNumber } from "@/lib/format";
import { sendOrderNotification } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

interface ConvertBody {
  items: Array<{ productId: string; qty: number }>;
  addressId?: string;
  paymentMethod?: string;
  notes?: string;
}

export async function POST(req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;

  const body = await parseBody<ConvertBody>(req);
  if (!body?.items || body.items.length === 0) {
    return err("At least one product is required to create an order", 400);
  }

  const request = await db.manualRequest.findUnique({
    where: { id },
    include: {
      customer: {
        select: {
          id: true, name: true, email: true, phone: true,
          addresses: { where: { isDefault: true }, take: 1 },
        },
      },
    },
  });
  if (!request) return notFound("Manual request not found");
  if (request.status === "converted") {
    return err("This request has already been converted to an order", 400);
  }
  if (!request.customer) {
    return err("Customer record not found for this request", 400);
  }
  const customer = request.customer;

  let address: any = null;
  if (body.addressId) {
    address = await db.address.findFirst({
      where: { id: body.addressId, customerId: customer.id },
    });
  }
  if (!address) {
    address = customer.addresses?.[0]
      ?? (await db.address.findFirst({ where: { customerId: customer.id } })) ?? null;
  }
  if (!address) {
    return err("Customer has no delivery address. Add one first.", 400);
  }

  const productIds = body.items.map((i) => i.productId);
  const products = await db.product.findMany({ where: { id: { in: productIds } } });
  const inputs: EngineLineInput[] = [];
  for (const item of body.items) {
    const p = products.find((pr) => pr.id === item.productId);
    if (!p) continue;
    inputs.push({
      productId: p.id,
      name: p.name,
      sku: p.sku,
      image: p.primaryImage,
      qty: Math.max(1, item.qty),
      mrp: Number(p.mrp),
      sellingPrice: Number(p.sellingPrice),
      baseDiscountPct: Number(p.baseDiscountPct ?? 0),
      maxDiscountPct: Number(p.maxDiscountPct ?? 0),
      categoryId: p.categoryId,
      brandId: p.brandId,
      isGeneric: p.isGeneric,
    });
  }
  if (inputs.length === 0) return err("No valid products selected", 400);

  const totals = await calculateOrderTotals(inputs, {
    locality: address?.locality ?? undefined,
    pincode: address?.pincode,
  });
  const orderNumber = generateOrderNumber();

  const order = await db.order.create({
    data: {
      orderNumber,
      customerId: customer.id,
      addressId: address.id,
      shipName: customer.name,
      shipPhone: address.phone || customer.phone,
      shipLine1: address.line1,
      shipLine2: address.line2,
      shipCity: address.city,
      shipDistrict: address.district,
      shipState: address.state,
      shipPincode: address.pincode,
      itemsTotal: totals.itemsTotal,
      productDiscount: totals.productDiscount,
      voucherDiscount: totals.voucherDiscount,
      voucherCode: totals.voucherValid ? totals.voucherCode : null,
      deliveryCharge: totals.deliveryCharge,
      taxTotal: totals.taxTotal,
      grandTotal: totals.grandTotal,
      roundOff: totals.roundOff,
      paymentMethod: body.paymentMethod || "cod",
      paymentStatus: "pending",
      source: "manual_request",
      manualRequestId: request.id,
      notes: body.notes || request.notes || undefined,
      estimatedDelivery: new Date(Date.now() + (30 + Math.floor(Math.random() * 21)) * 60 * 1000), // 30-50 min
      items: {
        create: totals.lines.map((l) => ({
          productId: l.productId,
          name: l.name,
          sku: l.sku,
          image: l.image,
          qty: l.qty,
          mrp: l.mrp,
          sellingPrice: l.sellingPrice,
          appliedDiscountPct: l.appliedDiscountPct,
          discountAmount: l.discountAmount,
          lineTotal: l.finalLineTotal,
        })),
      },
      statusHistory: {
        create: {
          status: "pending",
          note: "Order created from manual medicine request",
          createdBy: admin.id,
        },
      },
    },
    include: { items: true },
  });

  await db.manualRequest.update({
    where: { id: request.id },
    data: { status: "converted", convertedOrderId: order.id },
  });

  // Decrement stock for each ordered item — keeps inventory in sync when
  // manual requests are converted to orders. Atomic `decrement` so concurrent
  // admin conversions don't race. Items without a productId are skipped.
  for (const item of order.items) {
    if (item.productId) {
      try {
        await db.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.qty } },
        });
      } catch (e) {
        console.error(`[manual-request-convert] stock decrement failed for product ${item.productId}:`, e);
      }
    }
  }

  await sendOrderNotification(
    { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone },
    "order_confirmed",
    {
      name: customer.name,
      orderNumber: order.orderNumber,
      amount: String(order.grandTotal),
      paymentMethod: order.paymentMethod,
    }
  );

  return ok(order, 201);
}
