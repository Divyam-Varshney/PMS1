# Prescription Custom Pack Size — System Design Blueprint

## Overview

This feature allows the pharmacy to sell prescription medicines in custom pack sizes
that differ from the manufacturer's standard pack. For example, a medicine normally
sold in a strip of 15 tablets can be offered in a custom pack of 25 tablets.

**Available only for**: Prescription-required medicines (Rx products)
**Not available for**: OTC products, devices, or non-prescription items

---

## 1. Database Schema Changes

### New Model: `CustomPackSize`

```prisma
model CustomPackSize {
  id              String   @id @default(cuid())
  productId       String                          // Links to Product
  quantity        Int                              // Number of units (e.g., 25 tablets)
  label           String   @db.VarChar(100)       // Display label (e.g., "25 Tablets", "Custom Pack")
  pricePerUnit    Decimal  @db.Decimal(10, 2)     // Selling price per unit
  mrpPerUnit      Decimal  @db.Decimal(10, 2)     // MRP per unit
  isActive        Boolean  @default(true)
  requiresPrescription Boolean @default(true)     // Always true for this feature
  displayOrder    Int      @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@index([productId])
  @@index([isActive])
  @@unique([productId, quantity])                  // One custom pack per quantity
}
```

### Product Model Addition

Add a flag to Product to indicate custom packs are available:
```prisma
// In Product model:
hasCustomPacks Boolean @default(false)             // Shows "Custom Pack Available" badge
```

---

## 2. How Custom Pack Sizes Are Created

### Admin Workflow

1. Admin opens Product Edit for a prescription-required product
2. New "Custom Pack Sizes" section appears (only visible when `prescriptionRequired = true`)
3. Admin clicks "Add Custom Pack"
4. Admin enters:
   - **Quantity**: Number of units (e.g., 25)
   - **Label**: Display name (e.g., "25 Tablets" or "Custom Strip of 25")
   - **Price per Unit**: Selling price per individual unit
   - **MRP per Unit**: MRP per individual unit
5. System calculates:
   - Total selling price = quantity × pricePerUnit
   - Total MRP = quantity × mrpPerUnit
   - Discount % = ((MRP - Selling) / MRP) × 100
6. Admin saves the custom pack
7. Multiple custom packs can be created per product (e.g., 10, 15, 25, 30 tablets)

### Validation Rules

- Quantity must be ≥ 1
- Price per unit must be > 0
- MRP per unit must be ≥ Price per unit (no negative margin)
- Duplicate quantities not allowed (unique constraint: productId + quantity)
- Only prescription-required products can have custom packs

---

## 3. How Pricing Is Calculated

### Formula

```
Total Selling Price = quantity × pricePerUnit
Total MRP = quantity × mrpPerUnit
Discount Amount = Total MRP - Total Selling Price
Discount % = (Discount Amount / Total MRP) × 100
```

### Example

Product: Metformin 500mg (standard pack: 15 tablets, MRP ₹45)

Custom Pack: 25 tablets
- Price per unit: ₹2.50
- MRP per unit: ₹3.00
- Total Selling Price: 25 × ₹2.50 = ₹62.50
- Total MRP: 25 × ₹3.00 = ₹75.00
- Discount: ₹12.50 (16.7% off)

### Cart Integration

When a customer selects a custom pack:
- The cart item stores: `productId`, `customPackId`, `quantity` (always 1 — the pack itself is the unit)
- The `lineTotal` = custom pack's total selling price (not product.sellingPrice × qty)
- Voucher/discount calculations use the custom pack's total, not the standard product price

### CartItem Model Addition

```prisma
// In CartItem model:
customPackId String?  // Links to CustomPackSize if a custom pack is selected
```

---

## 4. How Inventory Is Managed

### Two Approaches (Recommended: Approach A)

#### Approach A: Shared Stock (Recommended)

- Custom packs draw from the same stock pool as standard packs
- When a custom pack of 25 is sold, `product.stock` decreases by 25 (not 1)
- Stock validation: `if (product.stock < customPack.quantity) → "Not enough stock"`
- Low stock threshold is checked at the product level

**Advantages**: Simple, no separate inventory for each pack size
**Disadvantages**: Cannot track how many custom packs vs standard packs were sold

#### Approach B: Separate Stock (Future Enhancement)

- Each custom pack has its own `stock` field
- `CustomPackSize.stock` = number of custom packs available
- Standard product stock is separate
- Requires the pharmacy to physically separate custom-pack inventory

---

## 5. How Prescriptions Are Validated

### Validation Flow

1. **Product-level check**: If `product.prescriptionRequired = true`, the customer MUST upload a prescription
2. **Custom pack check**: Custom packs inherit the prescription requirement from the product
3. **Quantity validation**: The pharmacist reviews the prescription and verifies:
   - The prescribed quantity matches (or is close to) the ordered custom pack quantity
   - If the prescription says "15 tablets" but the customer ordered 25, the pharmacist can:
     - ✅ Approve if the doctor wrote "as directed" or the quantity is within reasonable limits
     - ❌ Reject if the quantity clearly exceeds the prescription
4. **Prescription upload**: Already handled by the existing prescription upload system
5. **Admin review**: The admin sees the ordered quantity + uploaded prescription in the order detail

### Business Rules

- Custom packs are ONLY available for prescription-required products
- The customer must upload a valid prescription before checkout (existing flow)
- The pharmacist manually verifies the prescription quantity vs ordered quantity
- If the prescription doesn't match, the pharmacist can modify the order or contact the customer

---

## 6. How the Customer Selects the Pack Size

### Product Detail Page (PDP)

When a product has custom packs:

1. Standard pack is shown as the default option
2. A "Pack Size" selector appears below the quantity selector:
   ```
   ┌─────────────────────────────────────────┐
   │  Select Pack Size                        │
   │                                          │
   │  ○ Standard Pack — 15 Tablets — ₹38.25  │
   │  ○ Custom Pack — 25 Tablets — ₹62.50    │
   │  ○ Custom Pack — 30 Tablets — ₹75.00    │
   │                                          │
   │  ⚠ Prescription Required                 │
   │  Upload prescription at checkout         │
   └─────────────────────────────────────────┘
   ```

3. Customer selects a pack size (radio button or dropdown)
4. Price updates dynamically based on selection
5. "Add to Cart" uses the selected pack's pricing
6. Prescription required badge is always visible

### Cart View

- Cart item shows the selected pack label (e.g., "Metformin 500mg — 25 Tablets (Custom Pack)")
- Price reflects the custom pack total
- Prescription upload prompt is shown

### Checkout

- Standard checkout flow applies
- Prescription upload is mandatory (existing flow)
- Order summary shows the custom pack label and price

---

## 7. How the Order Is Processed

### Order Creation

1. Customer adds custom pack to cart
2. Cart stores: `productId`, `customPackId`, `quantity: 1`
3. At checkout, the order is created with:
   - `OrderItem.productId` = product ID
   - `OrderItem.customPackId` = custom pack ID (new field)
   - `OrderItem.quantity` = 1 (the pack itself is the unit)
   - `OrderItem.lineTotal` = custom pack's total selling price
4. Prescription is uploaded (existing flow)

### OrderItem Model Addition

```prisma
// In OrderItem model:
customPackId String?  // Links to CustomPackSize if ordered as a custom pack
```

### Admin Order Review

1. Admin opens the order in Admin → Orders → Order Detail
2. Order items show: product name + pack label (e.g., "Metformin 500mg — 25 Tablets (Custom Pack)")
3. Admin reviews the prescription:
   - Verify the prescribed quantity
   - Compare with the ordered custom pack quantity
   - Approve or modify the order
4. If approved, order proceeds to fulfillment
5. Stock is reduced by the pack quantity (not 1)

### Fulfillment

- Pharmacist dispenses the exact quantity from the custom pack
- Standard fulfillment workflow applies

---

## 8. Additional Business Rules

### Pricing Rules

1. **No negative margin**: Custom pack selling price must be ≤ MRP
2. **Volume discount**: Larger packs can have a lower per-unit price (incentive for bulk)
3. **Minimum quantity**: Custom packs must have quantity ≥ 2 (otherwise use standard pack)
4. **Maximum quantity**: Capped at 100 units per pack (safety limit)

### Display Rules

1. Custom packs only visible on PDP if `product.hasCustomPacks = true` AND `product.prescriptionRequired = true`
2. If no custom packs are active, the selector is hidden (standard pack only)
3. Custom pack badge: "Custom Pack Available" on product cards (optional)

### Inventory Rules

1. Stock check: `if (product.stock < customPack.quantity) → show "Out of Stock" for that pack`
2. When a custom pack is ordered, `product.stock -= customPack.quantity`
3. Low stock alert triggers if stock drops below threshold after deduction

### Validation Rules

1. Only admin can create/edit/delete custom packs
2. Custom packs can be deactivated (isActive = false) without deleting
3. Existing orders with custom packs are not affected if the pack is later deactivated
4. Custom pack quantities cannot exceed 100 units

---

## 9. API Endpoints (Future Implementation)

### Admin API

```
GET    /api/admin/products/[id]/custom-packs          — List custom packs for a product
POST   /api/admin/products/[id]/custom-packs          — Create a custom pack
PUT    /api/admin/products/[id]/custom-packs/[packId]  — Update a custom pack
DELETE /api/admin/products/[id]/custom-packs/[packId]  — Delete a custom pack
```

### Customer API

```
GET /api/catalog/products/[slug]  — Returns product + active custom packs (if any)
POST /api/cart/add               — Accepts optional `customPackId` parameter
```

### Cart Response

Cart items include:
```json
{
  "id": "...",
  "productId": "...",
  "customPackId": "...",       // null for standard packs
  "customPackLabel": "25 Tablets",
  "quantity": 1,
  "product": { ... },
  "lineTotal": 62.50
}
```

---

## 10. Implementation Priority

| Phase | Task | Effort |
|-------|------|--------|
| 1 | Add `CustomPackSize` model + migration | Small |
| 2 | Add `customPackId` to CartItem + OrderItem | Small |
| 3 | Admin UI: Custom pack management in Product Edit | Medium |
| 4 | Customer PDP: Pack size selector | Medium |
| 5 | Cart integration: Custom pack pricing | Medium |
| 6 | Checkout + order creation | Small (existing flow handles it) |
| 7 | Admin order review: Show custom pack label | Small |
| 8 | Stock management: Deduct by pack quantity | Small |

**Estimated total effort**: 2-3 development sessions
