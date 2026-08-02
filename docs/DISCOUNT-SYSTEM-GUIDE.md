# Discount & Coupon System — Complete Guide

## Currently Supported Discount Types

### 1. Percentage Discount (Product-Level)
**How it works**: Each product has `baseDiscountPct` (e.g., 15%) applied to MRP.
**Example**: MRP ₹100, baseDiscountPct 15% → selling price ₹85
**Admin**: Set in Product Edit → Pricing tab → Base Discount %
**Customer sees**: "15% OFF" badge on product card

### 2. Cart Upgrade Discount (Threshold-Based)
**How it works**: If cart subtotal ≥ configurable threshold, eligible products upgrade from base to max discount.
**Example**: Cart ₹1000 (threshold), product base 15% → max 20% → customer gets 20% off
**Admin**: Settings → Discount → "Cart Threshold for Upgrade"
**Customer sees**: "Upgraded to 20% off!" in cart

### 3. Flat Amount Voucher (Cart-Level)
**How it works**: Voucher deducts flat ₹ amount from cart total.
**Example**: Code `SAVE100` → ₹100 off if cart ≥ ₹500
**Admin**: Admin → Marketing → Vouchers → Create
**Customer**: Enters code at checkout → ₹100 deducted

### 4. Product-Specific Voucher
**How it works**: Voucher only applies to specific products.
**Example**: Code `DIABETES50` → ₹50 off Metformin only (scope: product, targetIds: [metformin_id])
**Admin**: Voucher → scope: product → select target products
**Customer**: Enters code → discount applied only to eligible products

### 5. Category-Specific Voucher
**How it works**: Voucher only applies to products in a specific category.
**Example**: Code `BABY10` → ₹100 off Baby Care products only
**Admin**: Voucher → scope: category → select target categories

### 6. Minimum Order Value Coupon
**How it works**: Voucher requires minimum cart subtotal.
**Example**: `WELCOME100` → ₹100 off, minOrder ₹500 → rejected if cart < ₹500

### 7. One-Time Use Coupon (Per Customer)
**How it works**: `perCustomerLimit: 1` → each customer can use only once.
**Example**: `WELCOME100` → first order only → second use returns error

### 8. Total Redemption Limit
**How it works**: `maxRedemptions: 100` → after 100 uses across all customers, voucher is exhausted.

### 9. Expiry Date
**How it works**: `validTo: 2026-12-31` → voucher expires after this date.

---

## Recommended Additional Discount Strategies

### Tier 1: High-Value, Easy to Implement

#### 1. Buy One Get One (BOGO)
**How it works**: Buy 1 product, get 1 free (or at discount).
**When to use**: Clearance, slow-moving inventory, festival promotions.
**Customer benefit**: Effectively 50% off if they need 2 units.
**Admin management**: Create a "Deal" with type `bogo`, select product. System auto-adds free item to cart.
**Business rules**: Limit to specific products, max 1 free per order, stock check required.

#### 2. Quantity Discount (Tiered Pricing)
**How it works**: Buy more, save more. E.g., 1-9 units = regular price, 10-49 = 5% off, 50+ = 10% off.
**When to use**: B2B customers, chronic medication patients who buy in bulk.
**Customer benefit**: Lower per-unit cost for larger purchases.
**Admin management**: Product Edit → "Quantity Tiers" section. Define tiers: {minQty, discountPct}.
**Business rules**: Only for OTC products (not prescription), max quantity limit per order.

#### 3. First Order Discount
**How it works**: New customers get X% off their first order automatically.
**When to use**: Customer acquisition, new user onboarding.
**Customer benefit**: Immediate savings on first purchase — builds trust.
**Admin management**: Settings → "First Order Discount: 10%" (auto-applied at checkout).
**Business rules**: Verified by checking if customer has any prior delivered orders. One-time only.

#### 4. Free Shipping Coupon
**How it works**: Voucher code that waives delivery charge (sets delivery to ₹0).
**When to use**: Promotions, cart abandonment recovery, minimum order incentive.
**Customer benefit**: No delivery fee — saves ₹20-50.
**Admin management**: New voucher type `free_shipping` (no flat amount, just delivery waiver).
**Business rules**: Can combine with minOrder, one-time per customer, area-restricted.

### Tier 2: Medium Complexity

#### 5. Bundle/Combo Discount
**How it works**: Buy a pre-defined bundle of products together → get X% off the bundle total.
**When to use**: Health bundles (Cold & Flu Kit, Diabetes Care Pack), cross-selling.
**Customer benefit**: Cheaper than buying items separately.
**Admin management**: Use existing HealthBundle model → add `discountPct` field → auto-apply at checkout.
**Business rules**: All items must be in stock, discount only applies when all items are purchased.

#### 6. Festival/Seasonal Campaigns
**How it works**: Time-limited discount campaigns tied to festivals (Diwali, Holi, Ramadan).
**When to use**: Festival seasons, health awareness months (World Diabetes Day).
**Customer benefit**: Seasonal savings.
**Admin management**: Use existing Campaign model → set start/end dates → auto-apply discount.
**Business rules**: Auto-expire after end date, display countdown timer, category-specific.

#### 7. Flash Sale
**How it works**: Deep discount (30-50% off) for a very short time (2-6 hours).
**When to use**: Clearance, social media promotion, app launch.
**Customer benefit**: Major savings if they act fast.
**Admin management**: Deal with type `flash_sale`, start time, end time, max units.
**Business rules**: Limited stock, countdown timer, one per customer, no voucher stacking.

#### 8. Loyalty Points Redemption
**How it works**: Customers earn 1 point per ₹10 spent. 100 points = ₹10 off.
**When to use**: Repeat customer retention, long-term engagement.
**Customer benefit**: Earn points on every purchase, redeem for discounts.
**Admin management**: Already implemented (LoyaltyTransaction model). Enhance with redemption at checkout.
**Business rules**: Points expire after 12 months, min 100 points to redeem.

### Tier 3: Advanced Features

#### 9. Buy X Get Y Free (Cross-Product)
**How it works**: Buy Product A, get Product B free.
**When to use**: Cross-selling, introducing new products, clearing old stock.
**Customer benefit**: Free product with purchase.
**Admin management**: Deal with type `buy_x_get_y`, sourceProductId, freeProductId.
**Business rules**: Free product must be in stock, one free item per order.

#### 10. Referral Discount
**How it works**: Existing customer refers a friend → both get ₹50 off.
**When to use**: Word-of-mouth marketing, customer acquisition.
**Customer benefit**: Both referrer and referee save money.
**Admin management**: New `Referral` model (referrerId, refereeEmail, code, status).
**Business rules**: Referee must be a new customer, both must complete an order, one referral per customer.

#### 11. Cashback / Wallet Credit
**How it works**: Instead of instant discount, customer gets cashback in wallet for next purchase.
**When to use**: Encourage repeat purchases, higher AOV.
**Customer benefit**: Savings on future orders.
**Admin management**: New `WalletTransaction` model. After order delivery, credit X% to wallet.
**Business rules**: Cashback usable after 7 days (return window), expires in 90 days.

#### 12. Membership Pricing
**How it works**: Premium members get exclusive pricing (extra 5% off all products).
**When to use**: Subscription revenue model, loyal customer base.
**Customer benefit**: Ongoing savings, free delivery, priority support.
**Admin management**: Customer model → `membershipTier` field. Pricing engine checks tier.
**Business rules**: Monthly/yearly fee, auto-renew, cancelable, tier-specific benefits.

---

## Implementation Priority

| Priority | Feature | Effort | Business Value |
|----------|---------|--------|---------------|
| P0 | Fix existing voucher per-customer limit | Done | High |
| P1 | First Order Discount | Small | High (acquisition) |
| P1 | Free Shipping Coupon | Small | High (conversion) |
| P1 | Quantity Discount (tiers) | Medium | Medium (B2B) |
| P2 | Bundle Discount (enhance HealthBundle) | Medium | Medium (AOV) |
| P2 | Flash Sale | Medium | High (urgency) |
| P2 | Festival Campaigns (enhance Campaign) | Medium | Medium (seasonal) |
| P3 | BOGO | Large | Medium |
| P3 | Loyalty Points Redemption | Medium | Medium (retention) |
| P3 | Buy X Get Y | Large | Medium |
| P4 | Referral Discount | Large | High (acquisition) |
| P4 | Cashback / Wallet | Large | Medium |
| P4 | Membership Pricing | Large | High (recurring revenue) |
