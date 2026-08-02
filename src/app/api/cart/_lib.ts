// ============================================================================
// File: src/app/api/cart/_lib.ts
// Purpose: Shared cart-building helper used by all cart endpoints. Loads the
//          customer's cart with items, maps CartItem → EngineLineInput, and
//          runs the pricing engine + delivery engine to produce a full Cart
//          response ready for the UI.
// Role: Single source of truth for cart shape returned to the customer SPA.
// ============================================================================

import { db } from "@/lib/db";
import {
  calculatePricing,
  calculateDeliveryCharge,
  EngineLineInput,
} from "@/lib/pricing-engine";

/** Product fields needed for pricing + display. */
const PRODUCT_SELECT = {
  id: true,
  name: true,
  slug: true,
  mrp: true,
  sellingPrice: true,
  baseDiscountPct: true,
  maxDiscountPct: true,
  primaryImage: true,
  stock: true,
  prescriptionRequired: true,
  isGeneric: true,
  unit: true,
  packSize: true,
  categoryId: true,
  brandId: true,
  sku: true,
  brand: { select: { name: true } },
} as const;

/** Fetch or create a cart for a customer, with product details per item. */
export async function getCartWithItems(customerId: string) {
  let cart = await db.cart.findUnique({
    where: { customerId },
    include: {
      items: { include: { product: { select: PRODUCT_SELECT } } },
    },
  });
  if (!cart) {
    cart = await db.cart.create({
      data: { customerId },
      include: {
        items: { include: { product: { select: PRODUCT_SELECT } } },
      },
    });
  }
  return cart;
}

/** Build engine inputs from cart items. */
export function cartItemsToEngineInputs(
  cart: Awaited<ReturnType<typeof getCartWithItems>>
): EngineLineInput[] {
  return cart.items.map((item) => ({
    productId: item.productId,
    name: item.product.name,
    sku: item.product.sku,
    image: item.product.primaryImage,
    qty: item.quantity,
    mrp: Number(item.product.mrp),
    sellingPrice: Number(item.product.sellingPrice),
    baseDiscountPct: Number(item.product.baseDiscountPct ?? 0),
    maxDiscountPct: Number(item.product.maxDiscountPct ?? 0),
    categoryId: item.product.categoryId,
    brandId: item.product.brandId,
    isGeneric: item.product.isGeneric,
  }));
}

/** Full cart + pricing + delivery response.
 *  Uses the customer's default address (locality + pincode) for delivery-zone lookup.
 *
 *  PERFORMANCE: After the Supabase migration (Tokyo, ~150ms RTT/query) the
 *  original 5 sequential queries here dominated cart latency. Now:
 *    1. getCartWithItems  → 1 query
 *    2. Promise.all([calculatePricing, defaultAddr]) → 1–2 queries in parallel
 *       (calculatePricing reads settings from a 30s cache + 1 voucher query;
 *        defaultAddr is 1 address query)
 *    3. calculateDeliveryCharge → 0 queries (60s delivery-zone cache)
 *    4. freeAbove lookup → 0 queries (returned by calculateDeliveryCharge)
 *  Total: 2–3 queries (was 5). */
export async function buildCartResponse(customerId: string) {
  const cart = await getCartWithItems(customerId);
  if (cart.items.length === 0) {
    return {
      id: cart.id,
      voucherCode: cart.voucherCode,
      items: cart.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        quantity: i.quantity,
        product: i.product,
      })),
      pricing: {
        lines: [],
        itemsTotal: 0,
        productDiscount: 0,
        subtotalAfterDiscount: 0,
        voucherDiscount: 0,
        voucherCode: cart.voucherCode ?? undefined,
        voucherValid: false,
        voucherError: undefined,
        totalAfterVoucher: 0,
        upgradeThreshold: 0,
        upgraded: false,
      },
      delivery: { charge: 0, free: true, serviceable: true, freeAbove: null },
      grandTotal: 0,
    };
  }

  const inputs = cartItemsToEngineInputs(cart);

  // Run pricing + default-address lookup IN PARALLEL — they have no data
  // dependency on each other. calculatePricing internally reads cached
  // settings (30s TTL) + does 1 voucher lookup; defaultAddr is 1 query.
  const [pricing, defaultAddr] = await Promise.all([
    calculatePricing(inputs, {
      voucherCode: cart.voucherCode ?? undefined,
      customerId,
    }),
    db.address.findFirst({
      where: { customerId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      select: { locality: true, pincode: true },
    }),
  ]);

  // Delivery-zone lookup uses the 60s in-process cache (0 DB queries on hit).
  // calculateDeliveryCharge now also returns the matched zone's `freeAbove`,
  // so we no longer need a separate deliveryZone.findFirst query for it.
  const delivery = await calculateDeliveryCharge(
    pricing.totalAfterVoucher,
    { locality: defaultAddr?.locality, pincode: defaultAddr?.pincode }
  );
  const grandTotal = pricing.totalAfterVoucher + Number(delivery.charge);

  return {
    id: cart.id,
    voucherCode: cart.voucherCode,
    items: cart.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      quantity: i.quantity,
      product: i.product,
    })),
    pricing,
    delivery: {
      charge: delivery.charge,
      free: delivery.free,
      zone: delivery.zone,
      zoneName: delivery.zoneName,
      estimatedHours: delivery.estimatedHours,
      serviceable: delivery.serviceable,
      message: delivery.message,
      freeAbove: delivery.freeAbove ?? null,
    },
    grandTotal,
  };
}
