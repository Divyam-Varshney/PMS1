// ============================================================================
// File: src/lib/pricing-engine.ts
// Purpose: CENTRALIZED PRICING ENGINE — the single source of truth for all
//          pricing calculations across cart, checkout, prescription orders,
//          admin-created orders, invoices, and reports.
//
// Design (margin-protected discount model):
//   1. Every product has a baseDiscountPct (shown to customer) and a
//      maxDiscountPct (hard ceiling — total discount never exceeds this).
//   2. The engine applies the base discount to each line.
//   3. If the cart subtotal reaches the configured upgrade threshold, products
//      with baseDiscountPct < maxDiscountPct are upgraded to maxDiscountPct
//      (reserve margin released). Products already at their ceiling stay.
//   4. A Voucher (if applied) deducts a FLAT amount from the post-discount
//      subtotal. Vouchers do NOT increase product discounts — they reduce the
//      final payable amount directly. Vouchers can be scoped to cart, product,
//      or category.
//   5. Delivery charge is computed by the delivery engine (locality/pincode).
//   6. Grand total = subtotalAfterDiscount − voucherDiscount − loyaltyDiscount
//                    + deliveryCharge + taxTotal
//
// INVARIANTS (never violated):
//   - A product's total discount NEVER exceeds its maxDiscountPct.
//   - Voucher deduction never makes a line or the cart negative.
//   - Voucher deduction is capped at the eligible lines' subtotal.
//   - If maxDiscountPct = 0, the product is always sold at MRP (no discount).
//   - If maxDiscountPct = baseDiscountPct, the product never gets extra discount.
//
// Every other module MUST call this engine — never recompute discounts.
// ============================================================================

import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";

// ---------------------------------------------------------------------------
// In-process delivery-zone cache.
//
// Delivery zones rarely change (admin edits them maybe once a week), but
// calculateDeliveryCharge() ran `db.deliveryZone.findMany` on EVERY cart
// operation — a 150ms round-trip to Supabase Tokyo on every add/update/remove.
// Caching for 60s eliminates that query from the hot path entirely while still
// picking up admin edits within a minute.
// ---------------------------------------------------------------------------

let dzCache: { rows: Awaited<ReturnType<typeof db.deliveryZone.findMany>>; ts: number } | null = null;
const DZ_CACHE_TTL = 60_000; // 60 seconds

async function getActiveDeliveryZones() {
  if (dzCache && Date.now() - dzCache.ts < DZ_CACHE_TTL) return dzCache.rows;
  const rows = await db.deliveryZone.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
  });
  dzCache = { rows, ts: Date.now() };
  return rows;
}

/** Invalidate the delivery-zone cache (call after admin mutates zones). */
export function invalidateDeliveryZoneCache() {
  dzCache = null;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EngineLineInput {
  productId: string;
  name: string;
  sku?: string | null;
  image?: string | null;
  qty: number;
  mrp: number;
  sellingPrice: number;       // price after base discount (= MRP * (1 - baseDiscountPct/100))
  baseDiscountPct: number;    // default discount shown to customer
  maxDiscountPct: number;     // hard ceiling — total discount never exceeds this
  categoryId?: string | null;
  brandId?: string | null;
  isGeneric?: boolean;
}

export interface EngineLineOutput extends EngineLineInput {
  appliedDiscountPct: number;   // final discount % applied (after upgrade)
  discountAmount: number;       // MRP-based discount amount for this line
  lineMrpTotal: number;         // MRP * qty
  lineTotal: number;            // final line total after discount
  upgraded: boolean;            // true if discount was upgraded from base to max
  voucherDiscountShare: number; // proportional share of voucher deduction
  finalLineTotal: number;       // lineTotal − voucherDiscountShare
}

export interface PricingResult {
  lines: EngineLineOutput[];
  itemsTotal: number;           // sum of lineMrpTotal (MRP * qty across all lines)
  productDiscount: number;      // total MRP-based discount
  subtotalAfterDiscount: number; // itemsTotal − productDiscount
  voucherDiscount: number;      // flat-amount deducted by voucher
  voucherCode?: string;
  voucherValid: boolean;
  voucherError?: string;
  totalAfterVoucher: number;    // subtotalAfterDiscount − voucherDiscount
  upgradeThreshold: number;     // the configured cart threshold (for UI display)
  upgraded: boolean;            // whether ANY line was upgraded
}

export interface EngineOptions {
  voucherCode?: string;
  customerId?: string;
}

// ---------------------------------------------------------------------------
// Core pricing function
// ---------------------------------------------------------------------------

/**
 * Calculate pricing for a set of line items using the margin-protected model.
 *
 * Steps:
 *   1. Apply baseDiscountPct to each line (compute lineTotal from MRP).
 *   2. If subtotal ≥ upgrade threshold, upgrade eligible lines to maxDiscountPct.
 *   3. Apply voucher (flat-amount deduction, scoped to cart/product/category).
 *   4. Return full breakdown.
 */
export async function calculatePricing(
  inputs: EngineLineInput[],
  options: EngineOptions = {}
): Promise<PricingResult> {
  // ---- 1. Read the cart-upgrade threshold from settings ----
  const upgradeThreshold = await getSetting<number>("discount.cartThresholdForUpgrade");

  // ---- 2. Apply base discount + upgrade if threshold met ----
  // First pass: apply baseDiscountPct to compute initial subtotal.
  let lines: EngineLineOutput[] = inputs.map((inp) => {
    const lineMrpTotal = inp.mrp * inp.qty;
    // The effective discount is the MRP→sellingPrice delta — the customer
    // must NEVER pay more than sellingPrice. This is the minimum discount
    // floor; maxDiscountPct only caps the additional upgrade discount, not
    // the base MRP→sellingPrice discount. (Without this floor, products
    // with maxDiscountPct=0 but sellingPrice < MRP would be sold at MRP,
    // which is a data/config inconsistency we cannot let leak through to
    // the customer.)
    const effectivePct =
      inp.mrp > inp.sellingPrice
        ? ((inp.mrp - inp.sellingPrice) / inp.mrp) * 100
        : 0;
    // basePct: at least the configured baseDiscountPct (or effectivePct,
    // whichever is higher); capped at maxDiscountPct — but never below
    // effectivePct, so the customer always pays ≤ sellingPrice.
    const basePct = Math.max(
      effectivePct,
      Math.min(
        Math.max(inp.baseDiscountPct, effectivePct),
        inp.maxDiscountPct
      )
    );
    const discountAmount = (lineMrpTotal * basePct) / 100;
    const lineTotal = lineMrpTotal - discountAmount;
    return {
      ...inp,
      appliedDiscountPct: basePct,
      discountAmount,
      lineMrpTotal,
      lineTotal,
      upgraded: false,
      voucherDiscountShare: 0,
      finalLineTotal: lineTotal,
    };
  });

  const initialSubtotal = lines.reduce((s, l) => s + l.lineTotal, 0);

  // Second pass: if the subtotal meets the threshold, upgrade eligible lines
  // from baseDiscountPct to maxDiscountPct (release reserve margin).
  const shouldUpgrade =
    upgradeThreshold > 0 && initialSubtotal >= upgradeThreshold;

  if (shouldUpgrade) {
    for (const line of lines) {
      // Only upgrade if there's reserve margin (max > base) and not already at max.
      if (line.maxDiscountPct > line.appliedDiscountPct) {
        const newPct = line.maxDiscountPct;
        const newDiscountAmount = (line.lineMrpTotal * newPct) / 100;
        line.appliedDiscountPct = newPct;
        line.discountAmount = newDiscountAmount;
        line.lineTotal = line.lineMrpTotal - newDiscountAmount;
        line.upgraded = true;
      }
    }
  }

  const itemsTotal = lines.reduce((s, l) => s + l.lineMrpTotal, 0);
  const productDiscount = lines.reduce((s, l) => s + l.discountAmount, 0);
  const subtotalAfterDiscount = itemsTotal - productDiscount;
  const anyUpgraded = lines.some((l) => l.upgraded);

  // ---- 3. Voucher (flat-amount deduction) ----
  let voucherDiscount = 0;
  let voucherValid = false;
  let voucherError: string | undefined;
  let voucherCode: string | undefined;
  let voucherScope: "cart" | "product" | "category" = "cart";
  let voucherTargetIds: string[] = [];
  let voucherAmount = 0;

  if (options.voucherCode) {
    voucherCode = options.voucherCode.toUpperCase().trim();
    const voucher = await db.voucher.findUnique({ where: { code: voucherCode } });
    const now = new Date();
    if (!voucher) {
      voucherError = "Invalid voucher code";
    } else if (!voucher.isActive) {
      voucherError = "This voucher is no longer active";
    } else if (voucher.validFrom && now < voucher.validFrom) {
      voucherError = "This voucher is not yet valid";
    } else if (voucher.validTo && now > voucher.validTo) {
      voucherError = "This voucher has expired";
    } else if (voucher.maxRedemptions > 0 && voucher.usedCount >= voucher.maxRedemptions) {
      voucherError = "This voucher redemption limit has been reached";
    } else if (subtotalAfterDiscount < Number(voucher.minOrder)) {
      voucherError = `Minimum order of Rs. ${Number(voucher.minOrder)} required for this voucher`;
    } else if (voucher.perCustomerLimit > 0 && options.customerId) {
      // Check per-customer usage limit
      const customerUsageCount = await db.voucherUsage.count({
        where: { voucherId: voucher.id, customerId: options.customerId },
      });
      if (customerUsageCount >= voucher.perCustomerLimit) {
        voucherError = `You have already used this voucher ${customerUsageCount} time(s). Limit: ${voucher.perCustomerLimit}`;
      } else {
        // Parse scope + targets
        voucherScope = voucher.scope as "cart" | "product" | "category";
        try {
          voucherTargetIds = voucher.targetIds ? JSON.parse(voucher.targetIds) : [];
        } catch {
          voucherTargetIds = [];
        }
        voucherAmount = Number(voucher.amount);
        voucherValid = true;
      }
    } else {
      // Parse scope + targets
      voucherScope = voucher.scope as "cart" | "product" | "category";
      try {
        voucherTargetIds = voucher.targetIds ? JSON.parse(voucher.targetIds) : [];
      } catch {
        voucherTargetIds = [];
      }
      voucherAmount = Number(voucher.amount);
      voucherValid = true;
    }
  }

  // Compute the eligible subtotal for the voucher (depends on scope)
  if (voucherValid) {
    let eligibleSubtotal = subtotalAfterDiscount;
    if (voucherScope === "product") {
      eligibleSubtotal = lines
        .filter((l) => voucherTargetIds.includes(l.productId))
        .reduce((s, l) => s + l.lineTotal, 0);
    } else if (voucherScope === "category") {
      eligibleSubtotal = lines
        .filter((l) => l.categoryId && voucherTargetIds.includes(l.categoryId))
        .reduce((s, l) => s + l.lineTotal, 0);
    }

    if (eligibleSubtotal <= 0) {
      voucherError = "This voucher is not applicable to items in your cart";
      voucherValid = false;
    } else {
      // Voucher deduction is capped at the eligible subtotal (never negative).
      voucherDiscount = Math.min(voucherAmount, eligibleSubtotal);

      // Distribute voucher discount proportionally across eligible lines
      const totalEligible = eligibleSubtotal || 1;
      for (const line of lines) {
        const isEligible =
          voucherScope === "cart" ||
          (voucherScope === "product" && voucherTargetIds.includes(line.productId)) ||
          (voucherScope === "category" && line.categoryId && voucherTargetIds.includes(line.categoryId));
        if (isEligible) {
          const ratio = line.lineTotal / totalEligible;
          line.voucherDiscountShare = voucherDiscount * ratio;
          line.finalLineTotal = line.lineTotal - line.voucherDiscountShare;
        }
      }
    }
  }

  const totalAfterVoucher = Math.max(0, subtotalAfterDiscount - voucherDiscount);

  return {
    lines,
    itemsTotal,
    productDiscount,
    subtotalAfterDiscount,
    voucherDiscount,
    voucherCode: voucherValid ? voucherCode : undefined,
    voucherValid,
    voucherError,
    totalAfterVoucher,
    upgradeThreshold,
    upgraded: anyUpgraded,
  };
}

// ---------------------------------------------------------------------------
// Full order totals (pricing + delivery + tax + round-off)
// ---------------------------------------------------------------------------

/**
 * Full order pricing: discounts + voucher + delivery + tax + round-off.
 * Used by checkout, admin order creation, and invoice generation.
 */
export async function calculateOrderTotals(
  inputs: EngineLineInput[],
  options: EngineOptions & { locality?: string; pincode?: string; loyaltyDiscount?: number } = {}
) {
  const pricing = await calculatePricing(inputs, options);

  // Loyalty discount (flat-amount deduction from loyalty points redemption).
  // Capped at the post-voucher subtotal so the customer cannot redeem more
  // points than the order is worth. NOTE: loyalty is a *payment* discount —
  // it does NOT reduce the subtotal used for the delivery-zone lookup, so
  // redeeming points cannot accidentally drop the customer below the
  // free-delivery threshold they would otherwise qualify for.
  const loyaltyDiscount = Math.min(
    options.loyaltyDiscount ?? 0,
    pricing.totalAfterVoucher
  );

  // Delivery charge (locality-based, falls back to pincode). Computed on the
  // full post-voucher subtotal — loyalty redemption never affects it.
  const delivery = await calculateDeliveryCharge(
    pricing.totalAfterVoucher,
    { locality: options.locality, pincode: options.pincode }
  );

  // Tax is inclusive in our model (MRP-based).
  const taxTotal = 0;

  const grandTotal =
    pricing.totalAfterVoucher - loyaltyDiscount + Number(delivery.charge) + taxTotal;
  const rounded = Math.round(grandTotal);
  const roundOff = Math.round((rounded - grandTotal) * 100) / 100;

  return {
    ...pricing,
    loyaltyDiscount,
    deliveryCharge: delivery.charge,
    deliveryFree: delivery.free,
    deliveryZone: delivery.zone,
    deliveryZoneName: delivery.zoneName,
    deliveryEstimatedHours: delivery.estimatedHours,
    taxTotal,
    grandTotal: rounded,
    roundOff,
  };
}

// ---------------------------------------------------------------------------
// Delivery charge engine (locality-based, single centralized system)
// ---------------------------------------------------------------------------

export interface DeliveryResult {
  charge: number;
  free: boolean;
  zone?: string;       // zone name (matched)
  zoneName?: string;   // alias for zone (for UI)
  estimatedHours?: number;
  serviceable: boolean;
  message?: string;
  freeAbove?: number | null; // matched zone's free-delivery threshold (for UI progress bar)
}

/**
 * Calculate delivery charge based on locality (preferred) or pincode (fallback).
 * Searches all active DeliveryZone records for a match.
 *
 * Matching priority:
 *   1. address.locality matches one of the zone's localities (case-insensitive)
 *   2. address.pincode matches one of the zone's pincodes
 *
 * If no zone matches, returns serviceable=false with the default message.
 * The admin configures all delivery logic via DeliveryZone records — there are
 * NO global "default charge" settings anymore (removed from Admin Settings).
 *
 * PERFORMANCE: Reads delivery zones from the in-process 60s cache (see
 * getActiveDeliveryZones) instead of hitting the DB on every cart operation.
 * The matched zone's `freeAbove` is also returned so callers don't need to
 * re-query the zone just to render the "Add ₹X more for FREE delivery" bar.
 */
export async function calculateDeliveryCharge(
  subtotal: number,
  address: { locality?: string | null; pincode?: string | null }
): Promise<DeliveryResult> {
  const zones = await getActiveDeliveryZones();

  const localityLc = address.locality?.trim().toLowerCase();
  const pincode = address.pincode?.trim();

  // Find the first matching zone (locality takes priority over pincode)
  let matchedZone: typeof zones[number] | null = null;
  for (const zone of zones) {
    // Check locality match
    if (localityLc) {
      const localities = zone.localities
        .split(/[\n,]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (localities.includes(localityLc)) {
        matchedZone = zone;
        break;
      }
    }
    // Check pincode match
    if (pincode) {
      const pincodes = zone.pincodes
        .split(/[\n,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (pincodes.includes(pincode)) {
        matchedZone = zone;
        break;
      }
    }
  }

  if (!matchedZone) {
    return {
      charge: 0,
      free: false,
      serviceable: false,
      freeAbove: null,
      message: "Delivery not available for this location. Please contact us.",
    };
  }

  const freeAbove =
    matchedZone.freeAbove != null ? Number(matchedZone.freeAbove) : null;

  // Check minimum order
  if (subtotal < Number(matchedZone.minOrder)) {
    return {
      charge: Number(matchedZone.charge),
      free: false,
      zone: matchedZone.name,
      zoneName: matchedZone.name,
      estimatedHours: matchedZone.estimatedHours,
      serviceable: true,
      freeAbove,
      message: `Minimum order of Rs. ${Number(matchedZone.minOrder)} required for delivery to ${matchedZone.name}.`,
    };
  }

  // Check free-delivery threshold
  if (matchedZone.freeAbove != null && subtotal >= Number(matchedZone.freeAbove)) {
    return {
      charge: 0,
      free: true,
      zone: matchedZone.name,
      zoneName: matchedZone.name,
      estimatedHours: matchedZone.estimatedHours,
      serviceable: true,
      freeAbove,
    };
  }

  return {
    charge: Number(matchedZone.charge),
    free: Number(matchedZone.charge) === 0,
    zone: matchedZone.name,
    zoneName: matchedZone.name,
    estimatedHours: matchedZone.estimatedHours,
    serviceable: true,
    freeAbove,
  };
}
