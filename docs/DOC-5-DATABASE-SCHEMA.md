# DOC-5 — Database Schema (Prisma / PostgreSQL)

**Project:** PMS — Pradeep Medical Store (online pharmacy, customer storefront + admin panel)
**Source file:** `prisma/schema.prisma` (1090 lines, **40 models**, 0 enums, 0 composite types)
**Database:** PostgreSQL 15+ hosted on **Supabase** (managed) via **Supavisor** pooler
**ORM:** Prisma 6.x (`prisma-client-js` generator)
**Doc role:** Senior database documentation analyst — exhaustive field-by-field reference

---

## 1. Configuration

### 1.1 `generator client`

| Directive | Value | Notes |
|---|---|---|
| `provider` | `prisma-client-js` | Standard Prisma Client generator. No custom output path, no binary targets, no preview features — uses Prisma 6.x defaults. |

### 1.2 `datasource db`

| Field | Value | Purpose |
|---|---|---|
| `provider` | `postgresql` | Targets PostgreSQL dialect (array/JSON/Decimal native support). |
| `url` | `env("DATABASE_URL")` | Runtime connection — uses Supabase **Supavisor transaction-mode pooler** on port **6543** with `?pgbouncer=true`. Required for serverless (Vercel) to reuse pooled connections. |
| `directUrl` | `env("DIRECT_URL")` | Migration-time connection — Supavisor **session-mode pooler** on port **5432**. Avoids "prepared statement already exists" errors that occur under PgBouncer transaction mode during `prisma migrate`. |

**FK enforcement:** `relationMode` left at default (`foreignKeys`) — Supavisor supports prepared statements in transaction mode, so no ORM-level referential-integrity emulation is required.

### 1.3 Design principles (from schema header comment)

1. **Normalized** — e.g. product images live only in `ProductImage`, never duplicated on `Product`.
2. **Indexed** — every FK and frequently-filtered column carries `@@index`.
3. **Typed** — monetary values use `Decimal(10,2)` for exact precision; long text uses `@db.Text` (PostgreSQL native `text`).
4. **Cascading** — child records (`OrderItem`, `CartItem`, etc.) use `onDelete: Cascade`; parents that must preserve history (e.g. `Order.customer`) use `SetNull`.

### 1.4 Database-level enums / types

**None.** The schema defines **no `enum` blocks and no `type` aliases.** All enumerated value sets are stored as `String @db.VarChar(N)` with the allowed values documented in inline `// a | b | c` comments (cataloged per model in §3 below). This keeps the schema portable across SQLite (dev) and Postgres (prod) and avoids migration friction when adding new enum values.

### 1.5 Connection pooling summary

| Concern | Strategy |
|---|---|
| Pooler | Supabase Supavisor (PgBouncer-compatible) |
| Runtime URL | transaction mode, port 6543, `?pgbouncer=true` |
| Migration URL | session mode, port 5432 (DIRECT_URL) |
| Statement caching | enabled (Supavisor supports prepared statements) |
| Orphan-row prevention | `onDelete: Cascade` on all child tables |
| Historical preservation | `onDelete: SetNull` on `Order.customerId`, `Prescription.customerId`, `Review.customerId`, `NotificationLog.customerId`, etc. |

---

## 2. Model Index (40 models, in schema order)

| # | Model | Purpose (1-line) | Schema lines |
|---:|---|---|---|
| 1 | `Admin` | Admin-panel users with role-based access | 41–56 |
| 2 | `Customer` | Customer accounts (email + phone login) | 59–93 |
| 3 | `WishlistItem` | Customer-favorited products | 95–107 |
| 4 | `Address` | Saved delivery addresses | 110–130 |
| 5 | `Otp` | One-time passwords for verification flows | 132–150 |
| 6 | `Category` | Product categories (self-referencing tree) | 157–176 |
| 7 | `Brand` | Product brands | 179–199 |
| 8 | `Product` | Central catalog entity | 202–282 |
| 9 | `ProductImage` | Multi-image metadata per product | 291–316 |
| 10 | `Deal` | Admin-curated promotional discounts | 322–341 |
| 11 | `Cart` | Per-customer shopping cart (1:1) | 348–359 |
| 12 | `CartItem` | Line items in a cart | 362–375 |
| 13 | `Order` | Customer orders — fulfillment source of truth | 382–453 |
| 14 | `OrderItem` | Line items in an order (snapshot) | 456–476 |
| 15 | `OrderStatusHistory` | Audit trail of status changes | 479–490 |
| 16 | `OrderNote` | Internal admin notes on orders | 495–508 |
| 17 | `Prescription` | Customer-uploaded Rx images | 514–529 |
| 18 | `ManualRequest` | Free-text medicine requests | 531–546 |
| 19 | `LoyaltyTransaction` | Loyalty earn/redeem audit ledger | 552–567 |
| 20 | `Voucher` | Flat-amount discount codes | 573–594 |
| 21 | `VoucherUsage` | Per-customer voucher redemption tracking | 597–608 |
| 22 | `Setting` | Admin key-value config store (JSON values) | 614–623 |
| 23 | `NotificationTemplate` | Email/WhatsApp templates | 629–642 |
| 24 | `NotificationLog` | Log of all email/WhatsApp sends | 645–661 |
| 25 | `DeliveryZone` | Locality-based delivery config | 667–683 |
| 26 | `PaymentMethod` | Admin-managed payment options (Razorpay, COD, QR, …) | 689–704 |
| 27 | `Review` | Product reviews with AI moderation | 710–742 |
| 28 | `AdminNotification` | Real-time admin alerts | 748–762 |
| 29 | `NewsletterSubscriber` | Email newsletter subscribers | 768–776 |
| 30 | `StockSubscription` | Back-in-stock alerts | 782–797 |
| 31 | `PushSubscription` | Web Push endpoints per device | 816–831 |
| 32 | `AppNotifTemplate` | Push notification templates | 836–858 |
| 33 | `AppNotifLog` | Push delivery audit log | 862–889 |
| 34 | `AppNotifPreference` | Per-customer master push toggle | 895–905 |
| 35 | `DeviceRegistration` | Onboarding-wizard state per device | 923–945 |
| 36 | `ErrorLog` | Production error capture | 951–972 |
| 37 | `Campaign` | Admin landing/promo pages | 978–1009 |
| 38 | `HealthBundle` | Curated product combo packs | 1016–1032 |
| 39 | `MedicineReminder` | Customer dosage reminders | 1043–1061 |
| 40 | `RefillReminder` | Auto refill reminders for Rx products | 1071–1090 |

### 2.1 Models grouped by domain

| Domain | Models |
|---|---|
| Auth & users | `Admin`, `Customer`, `Otp`, `Address`, `WishlistItem` |
| Catalog | `Category`, `Brand`, `Product`, `ProductImage`, `Deal`, `HealthBundle` |
| Cart & checkout | `Cart`, `CartItem` |
| Orders | `Order`, `OrderItem`, `OrderStatusHistory`, `OrderNote` |
| Prescriptions & manual requests | `Prescription`, `ManualRequest` |
| Loyalty | `LoyaltyTransaction` (+ `Customer.loyaltyPoints`) |
| Vouchers | `Voucher`, `VoucherUsage` |
| Settings | `Setting` |
| Notifications (email/WhatsApp) | `NotificationTemplate`, `NotificationLog`, `AdminNotification`, `NewsletterSubscriber` |
| Notifications (Web Push) | `PushSubscription`, `AppNotifTemplate`, `AppNotifLog`, `AppNotifPreference`, `DeviceRegistration` |
| Stock alerts | `StockSubscription` |
| Reminders | `MedicineReminder`, `RefillReminder` |
| Delivery & payment | `DeliveryZone`, `PaymentMethod` |
| Reviews | `Review` |
| Marketing | `Campaign` |
| Operations | `ErrorLog` |

---

## 3. Per-Model Reference (exhaustive)

### 3.1 `Admin`

**Purpose:** Admin-panel users with role-based access. Controls the Admin Panel.

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` | Primary key |
| `name` | `String` | `@db.VarChar(255)` | — | |
| `email` | `String` | `@unique @db.VarChar(255)` | — | Login identifier |
| `phone` | `String?` | `@db.VarChar(20)` | — | Nullable |
| `passwordHash` | `String` | `@db.VarChar(255)` | — | Bcrypt/argon2 hash |
| `role` | `String` | `@db.VarChar(30)` | `"admin"` | **Enum-like:** `admin` \| `super_admin` \| `manager` |
| `isActive` | `Boolean` | — | `true` | |
| `permissions` | `String?` | `@db.Text` | — | JSON-encoded array of permission keys; `null` = all (super_admin) |
| `lastLoginAt` | `DateTime?` | — | — | |
| `createdAt` | `DateTime` | — | `now()` | |
| `updatedAt` | `DateTime` | — | `@updatedAt` | |

**Relations:** none (Admin is a standalone root; admin-related notes use `OrderNote.authorId`/`OrderStatusHistory.createdBy` as plain VarChar strings, not FKs).

**Indexes:** `@@index([email])`

**Notable patterns:** JSON-encoded permissions stored as `@db.Text` (avoiding join tables for a fixed-shape ACL).

---

### 3.2 `Customer`

**Purpose:** Customer accounts. Email is the login identifier; phone used for WhatsApp.

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` | |
| `name` | `String` | `@db.VarChar(255)` | — | |
| `email` | `String` | `@unique @db.VarChar(255)` | — | Login identifier |
| `phone` | `String` | `@unique @db.VarChar(20)` | — | WhatsApp channel |
| `passwordHash` | `String` | `@db.VarChar(255)` | — | |
| `isEmailVerified` | `Boolean` | — | `false` | |
| `isActive` | `Boolean` | — | `true` | |
| `whatsappOptIn` | `Boolean` | — | `true` | |
| `loyaltyPoints` | `Int` | — | `0` | 1 point per Rs. 10 spent on delivered orders |
| `createdAt` | `DateTime` | — | `now()` | |
| `updatedAt` | `DateTime` | — | `@updatedAt` | |

**Relations (13):**

| Field | Type | FK / target | onDelete |
|---|---|---|---|
| `addresses` | `Address[]` | hasMany | Cascade |
| `orders` | `Order[]` | hasMany | **SetNull** (preserves order history) |
| `prescriptions` | `Prescription[]` | hasMany | **SetNull** |
| `manualRequests` | `ManualRequest[]` | hasMany | **SetNull** |
| `reviews` | `Review[]` | hasMany | **SetNull** |
| `cart` | `Cart?` | hasOne (1:1) | Cascade |
| `otps` | `Otp[]` | hasMany | Cascade |
| `notifications` | `NotificationLog[]` | hasMany | **SetNull** |
| `wishlist` | `WishlistItem[]` | hasMany | Cascade |
| `loyaltyTxns` | `LoyaltyTransaction[]` | hasMany | Cascade |
| `stockAlerts` | `StockSubscription[]` | hasMany | Cascade |
| `reminders` | `MedicineReminder[]` | hasMany | Cascade |
| `refillReminders` | `RefillReminder[]` | hasMany | Cascade |
| `pushSubscriptions` | `PushSubscription[]` | hasMany | Cascade |
| `appNotifLogs` | `AppNotifLog[]` | hasMany | Cascade |
| `appNotifPref` | `AppNotifPreference?` | hasOne (1:1) | Cascade |
| `deviceRegistrations` | `DeviceRegistration[]` | hasMany | Cascade |

**Indexes:** `@@index([email])`, `@@index([phone])`

**Notable patterns:** `loyaltyPoints` is denormalized running balance — `LoyaltyTransaction` is the audit ledger. Many downstream tables use `SetNull` so deleting a customer preserves historical orders/prescriptions/reviews/notifications.

---

### 3.3 `WishlistItem`

**Purpose:** Products a customer has saved to their wishlist (favorites).

| Field | Type | Constraints | Default |
|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` |
| `customerId` | `String` | — | — |
| `productId` | `String` | — | — |
| `createdAt` | `DateTime` | — | `now()` |

**Relations:**

| Field | Type | FK | onDelete |
|---|---|---|---|
| `customer` | `Customer` | `customerId → Customer.id` | Cascade |
| `product` | `Product` | `productId → Product.id` | Cascade |

**Indexes:** `@@unique([customerId, productId])` (one row per customer-product pair), `@@index([customerId])`

---

### 3.4 `Address`

**Purpose:** Saved delivery addresses for customers.

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` | |
| `customerId` | `String` | — | — | |
| `label` | `String` | `@db.VarChar(30)` | `"Home"` | **Enum-like:** `Home` \| `Work` \| `Other` |
| `line1` | `String` | `@db.VarChar(255)` | — | |
| `line2` | `String?` | `@db.VarChar(255)` | — | |
| `city` | `String` | `@db.VarChar(100)` | `"Mathura"` | |
| `district` | `String` | `@db.VarChar(100)` | `"Mathura"` | |
| `state` | `String` | `@db.VarChar(100)` | `"Uttar Pradesh"` | |
| `pincode` | `String` | `@db.VarChar(10)` | — | |
| `locality` | `String?` | `@db.VarChar(100)` | — | Used for delivery zone lookup |
| `phone` | `String?` | `@db.VarChar(20)` | — | |
| `isDefault` | `Boolean` | — | `false` | |
| `createdAt` | `DateTime` | — | `now()` | |
| `updatedAt` | `DateTime` | — | `@updatedAt` | |

**Relations:**

| Field | Type | FK | onDelete |
|---|---|---|---|
| `customer` | `Customer` | `customerId → Customer.id` | Cascade |
| `orders` | `Order[]` | hasMany | (default Restrict — see Order) |

**Indexes:** `@@index([customerId])`

**Notable patterns:** Hard-coded default city/district/state for the Mathura, Uttar Pradesh service area.

---

### 3.5 `Otp`

**Purpose:** One-time passwords for email/WhatsApp verification flows.

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` | |
| `customerId` | `String?` | — | — | Nullable for registration flow (customer not yet created) |
| `code` | `String` | `@db.VarChar(10)` | — | |
| `purpose` | `String` | `@db.VarChar(20)` | — | **Enum-like:** `register` \| `login` \| `reset` |
| `channel` | `String` | `@db.VarChar(20)` | `"email"` | **Enum-like:** `email` \| `whatsapp` \| `both` |
| `expiresAt` | `DateTime` | — | — | |
| `used` | `Boolean` | — | `false` | |
| `attempts` | `Int` | — | `0` | Brute-force counter |
| `createdAt` | `DateTime` | — | `now()` | |
| `pendingData` | `String?` | `@db.Text` | — | For registration: stores pending customer data as JSON (customer not created until verified) |

**Relations:**

| Field | Type | FK | onDelete |
|---|---|---|---|
| `customer` | `Customer?` | `customerId → Customer.id` | Cascade |

**Indexes:** `@@index([customerId])`, `@@index([code])`

**Notable patterns:** OTP-purpose state machine — registration stores pending customer data as JSON in `pendingData` to defer Customer row creation until email verification completes (avoids orphan accounts).

---

### 3.6 `Category`

**Purpose:** Product categories. Supports nested categories via `parentId`.

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` | |
| `name` | `String` | `@db.VarChar(255)` | — | |
| `slug` | `String` | `@unique @db.VarChar(255)` | — | URL-safe identifier |
| `description` | `String?` | `@db.Text` | — | |
| `image` | `String?` | `@db.VarChar(500)` | — | |
| `parentId` | `String?` | — | — | Self-reference |
| `displayOrder` | `Int` | — | `0` | |
| `status` | `String` | `@db.VarChar(20)` | `"active"` | **Enum-like:** `active` \| `inactive` |
| `visibility` | `String` | `@db.VarChar(20)` | `"public"` | **Enum-like:** `public` \| `hidden` |
| `createdAt` | `DateTime` | — | `now()` | |
| `updatedAt` | `DateTime` | — | `@updatedAt` | |

**Relations:**

| Field | Type | FK / target | onDelete |
|---|---|---|---|
| `parent` | `Category?` | self-ref `parentId → Category.id` (relation name `"CategoryParent"`) | **SetNull** |
| `children` | `Category[]` | back-relation of `parent` | — |
| `products` | `Product[]` | hasMany (via `Product.categoryId`) | (Product uses SetNull) |

**Indexes:** `@@index([parentId])`, `@@index([slug])`

**Notable patterns:** Self-referencing adjacency list for nested categories. Two independent flags (`status` for catalog visibility, `visibility` for storefront listing).

---

### 3.7 `Brand`

**Purpose:** Medicine/product brands with logo & featured image support.

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` | |
| `name` | `String` | `@db.VarChar(255)` | — | |
| `slug` | `String` | `@unique @db.VarChar(255)` | — | |
| `description` | `String?` | `@db.Text` | — | |
| `logo` | `String?` | `@db.VarChar(500)` | — | |
| `svgIcon` | `String?` | `@db.Text` | — | Inline SVG markup |
| `featuredImage` | `String?` | `@db.VarChar(500)` | — | |
| `displayMode` | `String` | `@db.VarChar(20)` | `"both"` | **Enum-like:** `logo_only` \| `name_only` \| `both` |
| `displayOrder` | `Int` | — | `0` | |
| `isFeaturedOnHomepage` | `Boolean` | — | `false` | Only featured brands show in the homepage marquee |
| `status` | `String` | `@db.VarChar(20)` | `"active"` | Enum-like (values not documented; assumed `active` \| `inactive`) |
| `visibility` | `String` | `@db.VarChar(20)` | `"public"` | Enum-like |
| `createdAt` | `DateTime` | — | `now()` | |
| `updatedAt` | `DateTime` | — | `@updatedAt` | |

**Relations:**

| Field | Type | FK | onDelete |
|---|---|---|---|
| `products` | `Product[]` | hasMany (via `Product.brandId`) | (Product uses SetNull) |

**Indexes:** `@@index([slug])`, `@@index([isFeaturedOnHomepage])`

**Notable patterns:** `svgIcon` stores inline SVG markup (no extra request); `displayMode` controls storefront rendering.

---

### 3.8 `Product`

**Purpose:** Products (medicines, OTC, wellness, devices). Central catalog entity.

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` | |
| `name` | `String` | `@db.VarChar(255)` | — | |
| `slug` | `String` | `@unique @db.VarChar(255)` | — | |
| `sku` | `String?` | `@db.VarChar(100)` | — | |
| `shortDescription` | `String?` | `@db.VarChar(500)` | — | |
| `description` | `String?` | `@db.Text` | — | |
| `composition` | `String?` | `@db.VarChar(255)` | — | Active ingredients |
| `genericName` | `String?` | `@db.VarChar(255)` | — | |
| `manufacturer` | `String?` | `@db.VarChar(255)` | — | |
| `hsnCode` | `String?` | `@db.VarChar(20)` | — | GST HSN code |
| `prescriptionRequired` | `Boolean` | — | `false` | Rx gate |
| `isGeneric` | `Boolean` | — | `false` | |
| `brandId` | `String?` | — | — | |
| `categoryId` | `String?` | — | — | |
| `unit` | `String?` | `@db.VarChar(50)` | — | Enum-like: `strip`, `bottle`, `tube`, … |
| `packSize` | `String?` | `@db.VarChar(100)` | — | |
| `mrp` | `Decimal` | `@db.Decimal(10, 2)` | — | Maximum retail price |
| `sellingPrice` | `Decimal` | `@db.Decimal(10, 2)` | — | |
| `baseDiscountPct` | `Decimal` | `@db.Decimal(5, 2)` | `0` | Min discount % floor |
| `maxDiscountPct` | `Decimal` | `@db.Decimal(5, 2)` | `0` | Margin-protected discount ceiling |
| `costPrice` | `Decimal?` | `@db.Decimal(10, 2)` | — | Internal cost (margin calc) |
| `taxPct` | `Decimal` | `@db.Decimal(5, 2)` | `0` | GST % |
| `stock` | `Int` | — | `0` | |
| `lowStockThreshold` | `Int` | — | `10` | |
| `primaryImage` | `String?` | `@db.VarChar(500)` | — | Denormalized cache of `ProductImage` where `isPrimary=true` |
| `galleryImages` | `String?` | `@db.Text` | — | JSON array cache of image URLs |
| `displayOrder` | `Int` | — | `0` | |
| `isFeatured` | `Boolean` | — | `false` | |
| `isBestSeller` | `Boolean` | — | `false` | |
| `isTrending` | `Boolean` | — | `false` | |
| `status` | `String` | `@db.VarChar(20)` | `"active"` | Enum-like |
| `visibility` | `String` | `@db.VarChar(20)` | `"public"` | Enum-like |
| `avgRating` | `Decimal` | `@db.Decimal(3, 2)` | `0` | Snapshot updated when reviews approved |
| `reviewCount` | `Int` | — | `0` | Snapshot |
| `createdAt` | `DateTime` | — | `now()` | |
| `updatedAt` | `DateTime` | — | `@updatedAt` | |

**Relations (12):**

| Field | Type | FK | onDelete |
|---|---|---|---|
| `brand` | `Brand?` | `brandId → Brand.id` | **SetNull** |
| `category` | `Category?` | `categoryId → Category.id` | **SetNull** |
| `orderItems` | `OrderItem[]` | hasMany | (default Restrict — see OrderItem) |
| `cartItems` | `CartItem[]` | hasMany | Cascade |
| `reviews` | `Review[]` | hasMany | Cascade |
| `wishlist` | `WishlistItem[]` | hasMany | Cascade |
| `deals` | `Deal[]` | hasMany | (Deal uses SetNull) |
| `images` | `ProductImage[]` | hasMany | Cascade |
| `stockAlerts` | `StockSubscription[]` | hasMany | Cascade |
| `refillReminders` | `RefillReminder[]` | hasMany | Cascade |

**Indexes (12):** `@@index([slug])`, `@@index([brandId])`, `@@index([categoryId])`, `@@index([status])`, `@@index([isFeatured])`, `@@index([isBestSeller])`, `@@index([isTrending])`, `@@index([visibility, status])` (composite — Phase 97 templates-perf), `@@index([avgRating])`, `@@index([baseDiscountPct])`, `@@index([createdAt])`, `@@index([displayOrder])`

**Notable patterns:**
- **Margin-protected discount model:** `baseDiscountPct` (floor) + `maxDiscountPct` (margin ceiling). Pricing engine clamps all discount calculations to `[base, max]`.
- **Denormalized image cache:** `primaryImage` + `galleryImages` are mirrored from `ProductImage` to avoid a JOIN on every catalog card/list query (documented in schema comments).
- **Rating snapshot:** `avgRating` + `reviewCount` updated by trigger/seed when reviews are approved (not computed live on every render).
- **Phase 97 perf indexes:** Added composite + single-column indexes covering `/api/catalog/home-feed` and `/api/catalog/featured` queries (without these, home page scans full Product table — fine at 325 rows, O(n) at scale).

---

### 3.9 `ProductImage`

**Purpose:** Dedicated table for scalable multi-image management. Single source of truth for all product image metadata (replaces old redundant `Product.thumbnail`/`featuredImage`/`zoomImage` columns).

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` | |
| `productId` | `String` | — | — | |
| `imagePath` | `String` | `@db.VarChar(500)` | — | Storage path/URL |
| `originalName` | `String` | `@db.VarChar(255)` | — | |
| `altText` | `String?` | `@db.VarChar(255)` | — | Accessibility |
| `title` | `String?` | `@db.VarChar(255)` | — | |
| `caption` | `String?` | `@db.VarChar(255)` | — | |
| `description` | `String?` | `@db.Text` | — | |
| `displayOrder` | `Int` | — | `0` | |
| `isPrimary` | `Boolean` | — | `false` | Mirrors to `Product.primaryImage` |
| `width` | `Int?` | — | — | |
| `height` | `Int?` | — | — | |
| `fileSize` | `Int` | — | `0` | Bytes |
| `mimeType` | `String` | `@db.VarChar(50)` | `"image/jpeg"` | |
| `hash` | `String?` | `@db.VarChar(64)` | — | SHA-256 for duplicate detection |
| `type` | `String` | `@db.VarChar(20)` | `"image"` | **Enum-like:** `image` \| `video` \| `ar` \| `360` |
| `createdAt` | `DateTime` | — | `now()` | |
| `updatedAt` | `DateTime` | — | `@updatedAt` | |

**Relations:**

| Field | Type | FK | onDelete |
|---|---|---|---|
| `product` | `Product` | `productId → Product.id` | Cascade |

**Indexes:** `@@index([productId])`, `@@index([isPrimary])`, `@@index([displayOrder])`

**Notable patterns:** `type` supports `ar` and `360` (future AR/360° product views). `hash` enables deduplication of identical uploads.

---

### 3.10 `Deal`

**Purpose:** Today's Deals — admin-curated promotional discounts on products.

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` | |
| `title` | `String` | `@db.VarChar(255)` | — | |
| `description` | `String?` | `@db.Text` | — | |
| `productId` | `String?` | — | — | Optional product link |
| `discountPct` | `Decimal` | `@db.Decimal(5, 2)` | `0` | |
| `originalPrice` | `Decimal?` | `@db.Decimal(10, 2)` | — | |
| `dealPrice` | `Decimal?` | `@db.Decimal(10, 2)` | — | |
| `startDate` | `DateTime?` | — | — | |
| `endDate` | `DateTime?` | — | — | |
| `isActive` | `Boolean` | — | `true` | |
| `displayOrder` | `Int` | — | `0` | |
| `createdAt` | `DateTime` | — | `now()` | |
| `updatedAt` | `DateTime` | — | `@updatedAt` | |

**Relations:**

| Field | Type | FK | onDelete |
|---|---|---|---|
| `product` | `Product?` | `productId → Product.id` | **SetNull** |

**Indexes:** `@@index([isActive])`, `@@index([displayOrder])`

---

### 3.11 `Cart`

**Purpose:** A customer's shopping cart. One per customer (1:1).

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` | |
| `customerId` | `String` | `@unique` | — | Enforces 1:1 |
| `voucherCode` | `String?` | `@db.VarChar(50)` | — | Applied voucher |
| `createdAt` | `DateTime` | — | `now()` | |
| `updatedAt` | `DateTime` | — | `@updatedAt` | |

**Relations:**

| Field | Type | FK | onDelete |
|---|---|---|---|
| `customer` | `Customer` | `customerId → Customer.id` | Cascade |
| `items` | `CartItem[]` | hasMany | Cascade |

**Indexes:** `@@index([customerId])`

---

### 3.12 `CartItem`

**Purpose:** Line items in a cart.

| Field | Type | Constraints | Default |
|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` |
| `cartId` | `String` | — | — |
| `productId` | `String` | — | — |
| `quantity` | `Int` | — | `1` |
| `createdAt` | `DateTime` | — | `now()` |
| `updatedAt` | `DateTime` | — | `@updatedAt` |

**Relations:**

| Field | Type | FK | onDelete |
|---|---|---|---|
| `cart` | `Cart` | `cartId → Cart.id` | Cascade |
| `product` | `Product` | `productId → Product.id` | Cascade |

**Indexes:** `@@unique([cartId, productId])` (one row per product per cart), `@@index([cartId])`

---

### 3.13 `Order`

**Purpose:** Customer orders. Single source of truth for fulfillment.

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` | |
| `orderNumber` | `String` | `@unique @db.VarChar(50)` | — | Human-readable ID |
| `customerId` | `String?` | — | — | Nullable for guest checkout |
| `addressId` | `String?` | — | — | |
| `shipName` | `String` | `@db.VarChar(255)` | — | Snapshot |
| `shipPhone` | `String` | `@db.VarChar(20)` | — | Snapshot |
| `shipLine1` | `String` | `@db.VarChar(255)` | — | Snapshot |
| `shipLine2` | `String?` | `@db.VarChar(255)` | — | Snapshot |
| `shipCity` | `String` | `@db.VarChar(100)` | — | Snapshot |
| `shipDistrict` | `String` | `@db.VarChar(100)` | — | Snapshot |
| `shipState` | `String` | `@db.VarChar(100)` | — | Snapshot |
| `shipPincode` | `String` | `@db.VarChar(10)` | — | Snapshot |
| `shipLocality` | `String?` | `@db.VarChar(100)` | — | Snapshot |
| `itemsTotal` | `Decimal` | `@db.Decimal(10, 2)` | `0` | Sum of `OrderItem.lineTotal` |
| `productDiscount` | `Decimal` | `@db.Decimal(10, 2)` | `0` | |
| `voucherDiscount` | `Decimal` | `@db.Decimal(10, 2)` | `0` | |
| `deliveryCharge` | `Decimal` | `@db.Decimal(10, 2)` | `0` | |
| `taxTotal` | `Decimal` | `@db.Decimal(10, 2)` | `0` | |
| `grandTotal` | `Decimal` | `@db.Decimal(10, 2)` | `0` | |
| `roundOff` | `Decimal` | `@db.Decimal(10, 2)` | `0` | Cash-rounding adjustment |
| `voucherCode` | `String?` | `@db.VarChar(50)` | — | Applied voucher snapshot |
| `loyaltyPointsRedeemed` | `Int` | — | `0` | |
| `loyaltyDiscount` | `Decimal` | `@db.Decimal(10, 2)` | `0` | |
| `status` | `String` | `@db.VarChar(30)` | `"pending"` | Enum-like (see §4.1 below) |
| `paymentMethod` | `String` | `@db.VarChar(30)` | `"cod"` | Enum-like (`cod` \| `razorpay` \| `qr` \| `bank_transfer` …) |
| `paymentStatus` | `String` | `@db.VarChar(20)` | `"pending"` | Enum-like (`pending` \| `paid` \| `failed` \| `refunded`) |
| `paymentId` | `String?` | `@db.VarChar(255)` | — | Gateway txn id |
| `paymentGateway` | `String?` | `@db.VarChar(50)` | — | |
| `paymentScreenshot` | `String?` | `@db.VarChar(500)` | — | QR-payment proof upload |
| `paymentScreenshotUploadedAt` | `DateTime?` | — | — | |
| `paymentTxnId` | `String?` | `@db.VarChar(100)` | — | |
| `source` | `String` | `@db.VarChar(30)` | `"cart"` | Enum-like: `cart` \| `prescription` \| `manual_request` |
| `prescriptionId` | `String?` | — | — | Soft link (no FK — prescription may be deleted) |
| `manualRequestId` | `String?` | — | — | Soft link |
| `notes` | `String?` | `@db.Text` | — | Customer-visible |
| `adminNotes` | `String?` | `@db.Text` | — | Internal (legacy; see `OrderNote`) |
| `confirmedAt` | `DateTime?` | — | — | Tracking timeline |
| `packedAt` | `DateTime?` | — | — | |
| `outForDeliveryAt` | `DateTime?` | — | — | |
| `deliveredAt` | `DateTime?` | — | — | |
| `cancelledAt` | `DateTime?` | — | — | |
| `estimatedDelivery` | `DateTime?` | — | — | |
| `createdAt` | `DateTime` | — | `now()` | |
| `updatedAt` | `DateTime` | — | `@updatedAt` | |

**Relations:**

| Field | Type | FK | onDelete |
|---|---|---|---|
| `customer` | `Customer?` | `customerId → Customer.id` | **SetNull** |
| `address` | `Address?` | `addressId → Address.id` | (default Restrict) |
| `items` | `OrderItem[]` | hasMany | Cascade |
| `statusHistory` | `OrderStatusHistory[]` | hasMany | Cascade |
| `orderNotes` | `OrderNote[]` | hasMany | Cascade |

**Indexes:** `@@index([customerId])`, `@@index([status])`, `@@index([orderNumber])`, `@@index([createdAt])`

**Notable patterns:**
- **Snapshotting:** All `ship*` fields are denormalized snapshots so historical orders don't change if the customer edits their address.
- **Soft links to Prescription/ManualRequest:** `prescriptionId` and `manualRequestId` are plain strings (no Prisma relation), so deleting a Prescription doesn't cascade-delete the Order.
- **Per-stage timestamps** (`confirmedAt`, `packedAt`, `outForDeliveryAt`, `deliveredAt`, `cancelledAt`) drive the customer-facing order tracking timeline.
- **Dual notes system:** `adminNotes` (legacy free-text) + `OrderNote[]` (newer per-note audit trail).
- **Loyalty redemption:** `loyaltyPointsRedeemed` + `loyaltyDiscount` together record both the points spent and the equivalent rupee discount applied.

---

### 3.14 `OrderItem`

**Purpose:** Line items in an order. Snapshot of product details at purchase time.

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` | |
| `orderId` | `String` | — | — | |
| `productId` | `String?` | — | — | Nullable (deleted product) |
| `name` | `String` | `@db.VarChar(255)` | — | Snapshot |
| `sku` | `String?` | `@db.VarChar(100)` | — | Snapshot |
| `image` | `String?` | `@db.VarChar(500)` | — | Snapshot |
| `qty` | `Int` | — | — | |
| `mrp` | `Decimal` | `@db.Decimal(10, 2)` | — | Snapshot |
| `sellingPrice` | `Decimal` | `@db.Decimal(10, 2)` | — | Snapshot |
| `appliedDiscountPct` | `Decimal` | `@db.Decimal(5, 2)` | `0` | |
| `discountAmount` | `Decimal` | `@db.Decimal(10, 2)` | `0` | |
| `lineTotal` | `Decimal` | `@db.Decimal(10, 2)` | — | Final line total |
| `createdAt` | `DateTime` | — | `now()` | |

**Relations:**

| Field | Type | FK | onDelete |
|---|---|---|---|
| `order` | `Order` | `orderId → Order.id` | Cascade |
| `product` | `Product?` | `productId → Product.id` | (default Restrict — preserves product reference) |

**Indexes:** `@@index([orderId])`, `@@index([productId])`

**Notable patterns:** Full product snapshot (`name`, `sku`, `image`, `mrp`, `sellingPrice`) so order history remains intact even if the Product row is later modified or deleted.

---

### 3.15 `OrderStatusHistory`

**Purpose:** Audit trail of order status changes.

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` | |
| `orderId` | `String` | — | — | |
| `status` | `String` | `@db.VarChar(30)` | — | New status value |
| `note` | `String?` | `@db.Text` | — | |
| `createdBy` | `String?` | `@db.VarChar(100)` | — | Admin id or `"system"` |
| `createdAt` | `DateTime` | — | `now()` | |

**Relations:**

| Field | Type | FK | onDelete |
|---|---|---|---|
| `order` | `Order` | `orderId → Order.id` | Cascade |

**Indexes:** `@@index([orderId])`

**Notable patterns:** Append-only ledger — each row is one state transition; the latest row by `createdAt` is the current status.

---

### 3.16 `OrderNote`

**Purpose:** Internal admin notes on an order (separate from customer-visible `Order.notes`). Each note is its own row so it can be edited/deleted independently.

| Field | Type | Constraints | Default |
|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` |
| `orderId` | `String` | — | — |
| `body` | `String` | `@db.Text` | — |
| `authorId` | `String?` | `@db.VarChar(100)` | — |
| `authorName` | `String?` | `@db.VarChar(120)` | — |
| `createdAt` | `DateTime` | — | `now()` |
| `updatedAt` | `DateTime` | — | `@updatedAt` |

**Relations:**

| Field | Type | FK | onDelete |
|---|---|---|---|
| `order` | `Order` | `orderId → Order.id` | Cascade |

**Indexes:** `@@index([orderId])`, `@@index([createdAt])`

---

### 3.17 `Prescription`

**Purpose:** Customer-uploaded prescription images.

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` | |
| `customerId` | `String?` | — | — | Nullable for guest submissions |
| `images` | `String` | `@db.Text` | — | JSON array of image URLs |
| `notes` | `String?` | `@db.Text` | — | Customer notes |
| `status` | `String` | `@db.VarChar(30)` | `"pending"` | Enum-like (`pending` \| `verified` \| `rejected` \| `converted`) |
| `adminNotes` | `String?` | `@db.Text` | — | |
| `convertedOrderId` | `String?` | — | — | Soft link to the resulting Order |
| `createdAt` | `DateTime` | — | `now()` | |
| `updatedAt` | `DateTime` | — | `@updatedAt` | |

**Relations:**

| Field | Type | FK | onDelete |
|---|---|---|---|
| `customer` | `Customer?` | `customerId → Customer.id` | **SetNull** |

**Indexes:** `@@index([customerId])`, `@@index([status])`

**Notable patterns:** `images` is a JSON-encoded array stored as Text (no dedicated PrescriptionImage table). `convertedOrderId` is a soft link — the Order also has `prescriptionId` as a back-reference, also soft (no FK), forming a bidirectional loose coupling so either side can be deleted without cascading.

---

### 3.18 `ManualRequest`

**Purpose:** Free-text medicine requests (customer can't find a product).

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` | |
| `customerId` | `String?` | — | — | |
| `medicineList` | `String` | `@db.Text` | — | Customer-typed list |
| `notes` | `String?` | `@db.Text` | — | |
| `status` | `String` | `@db.VarChar(30)` | `"pending"` | Enum-like (`pending` \| `quoted` \| `converted` \| `rejected`) |
| `adminNotes` | `String?` | `@db.Text` | — | |
| `convertedOrderId` | `String?` | — | — | Soft link |
| `createdAt` | `DateTime` | — | `now()` | |
| `updatedAt` | `DateTime` | — | `@updatedAt` | |

**Relations:**

| Field | Type | FK | onDelete |
|---|---|---|---|
| `customer` | `Customer?` | `customerId → Customer.id` | **SetNull** |

**Indexes:** `@@index([customerId])`, `@@index([status])`

---

### 3.19 `LoyaltyTransaction`

**Purpose:** Audit trail of loyalty point earn/redeem transactions per customer.

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` | |
| `customerId` | `String` | — | — | |
| `type` | `String` | `@db.VarChar(20)` | — | **Enum-like:** `earn` \| `redeem` \| `adjust` |
| `points` | `Int` | — | — | Signed (positive earn, negative redeem) |
| `balance` | `Int` | — | — | Running balance snapshot after this txn |
| `reason` | `String` | `@db.VarChar(255)` | — | |
| `orderId` | `String?` | — | — | Soft link to the order that earned/redeemed points |
| `createdAt` | `DateTime` | — | `now()` | |

**Relations:**

| Field | Type | FK | onDelete |
|---|---|---|---|
| `customer` | `Customer` | `customerId → Customer.id` | Cascade |

**Indexes:** `@@index([customerId])`, `@@index([createdAt])`

**Notable patterns:** **Append-only ledger with balance snapshots.** Each row records the running balance after the transaction — enabling point-in-time balance reconstruction without re-summing. The denormalized `Customer.loyaltyPoints` is the current balance; this table is the audit history.

---

### 3.20 `Voucher`

**Purpose:** Voucher codes — flat-amount deduction from order total.

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` | |
| `code` | `String` | `@unique @db.VarChar(50)` | — | |
| `description` | `String?` | `@db.Text` | — | |
| `amount` | `Decimal` | `@db.Decimal(10, 2)` | — | Flat Rs. amount to deduct |
| `scope` | `String` | `@db.VarChar(20)` | `"cart"` | **Enum-like:** `cart` \| `product` \| `category` |
| `targetIds` | `String?` | `@db.Text` | — | JSON array of productId or categoryId (when scope ≠ cart) |
| `minOrder` | `Decimal` | `@db.Decimal(10, 2)` | `0` | Minimum cart total |
| `maxRedemptions` | `Int` | — | `0` | 0 = unlimited |
| `usedCount` | `Int` | — | `0` | Denormalized counter |
| `perCustomerLimit` | `Int` | — | `0` | 0 = unlimited |
| `validFrom` | `DateTime` | — | `now()` | |
| `validTo` | `DateTime?` | — | — | Nullable = no expiry |
| `isActive` | `Boolean` | — | `true` | |
| `createdAt` | `DateTime` | — | `now()` | |
| `updatedAt` | `DateTime` | — | `@updatedAt` | |

**Relations:**

| Field | Type | FK | onDelete |
|---|---|---|---|
| `usages` | `VoucherUsage[]` | hasMany | Cascade |

**Indexes:** `@@index([code])`, `@@index([isActive])`

---

### 3.21 `VoucherUsage`

**Purpose:** Per-customer voucher usage tracking (enforces `perCustomerLimit`).

| Field | Type | Constraints | Default |
|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` |
| `voucherId` | `String` | — | — |
| `customerId` | `String?` | — | — |
| `orderId` | `String?` | — | — |
| `createdAt` | `DateTime` | — | `now()` |

**Relations:**

| Field | Type | FK | onDelete |
|---|---|---|---|
| `voucher` | `Voucher` | `voucherId → Voucher.id` | Cascade |

**Indexes:** `@@index([voucherId])`, `@@index([customerId])`

**Notable patterns:** `customerId` and `orderId` are plain strings (no Prisma relation) — usage records survive customer/order deletion for analytics.

---

### 3.22 `Setting`

**Purpose:** Admin-configurable key-value store (JSON-encoded values).

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` | |
| `key` | `String` | `@unique @db.VarChar(100)` | — | |
| `value` | `String` | `@db.Text` | — | JSON-encoded value |
| `category` | `String` | `@db.VarChar(50)` | `"general"` | Enum-like (admin-defined grouping) |
| `updatedAt` | `DateTime` | — | `@updatedAt` | |

**Relations:** none.

**Indexes:** `@@index([key])`, `@@index([category])`

**Notable patterns:** No `createdAt` (settings are upserted). Values are JSON-serialized in the application layer (typed access via `src/lib/settings.ts`).

---

### 3.23 `NotificationTemplate`

**Purpose:** Admin-managed email/WhatsApp templates.

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` | |
| `key` | `String` | `@unique @db.VarChar(100)` | — | e.g. `order_placed`, `otp_email` |
| `name` | `String` | `@db.VarChar(255)` | — | |
| `channel` | `String` | `@db.VarChar(20)` | — | **Enum-like:** `email` \| `whatsapp` |
| `subject` | `String?` | `@db.VarChar(255)` | — | Email only |
| `body` | `String` | `@db.Text` | — | Template with `{{variables}}` |
| `variables` | `String?` | `@db.Text` | — | JSON array of variable names |
| `isActive` | `Boolean` | — | `true` | |
| `updatedAt` | `DateTime` | — | `@updatedAt` | |

**Relations:** none (templates referenced by `NotificationLog.templateKey` as a plain string).

**Indexes:** `@@index([key])`, `@@index([channel])`

---

### 3.24 `NotificationLog`

**Purpose:** Log of all notifications sent (email/WhatsApp).

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` | |
| `customerId` | `String?` | — | — | |
| `recipient` | `String` | `@db.VarChar(255)` | — | Email or phone |
| `channel` | `String` | `@db.VarChar(20)` | — | Enum-like: `email` \| `whatsapp` |
| `subject` | `String?` | `@db.VarChar(255)` | — | |
| `body` | `String` | `@db.Text` | — | |
| `status` | `String` | `@db.VarChar(20)` | `"sent"` | Enum-like: `sent` \| `failed` \| `queued` |
| `templateKey` | `String?` | `@db.VarChar(100)` | — | Soft link to template |
| `error` | `String?` | `@db.Text` | — | |
| `createdAt` | `DateTime` | — | `now()` | |

**Relations:**

| Field | Type | FK | onDelete |
|---|---|---|---|
| `customer` | `Customer?` | `customerId → Customer.id` | **SetNull** |

**Indexes:** `@@index([customerId])`, `@@index([channel])`

---

### 3.25 `DeliveryZone`

**Purpose:** Locality-based delivery configuration (single centralized system).

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` | |
| `name` | `String` | `@db.VarChar(100)` | — | |
| `localities` | `String` | `@db.Text` | `""` | Newline/comma-separated list |
| `pincodes` | `String` | `@db.Text` | `""` | |
| `charge` | `Decimal` | `@db.Decimal(10, 2)` | `0` | Delivery fee |
| `freeAbove` | `Decimal?` | `@db.Decimal(10, 2)` | — | Free delivery threshold |
| `minOrder` | `Decimal` | `@db.Decimal(10, 2)` | `0` | |
| `estimatedHours` | `Int` | — | `24` | ETA |
| `isActive` | `Boolean` | — | `true` | |
| `displayOrder` | `Int` | — | `0` | |
| `createdAt` | `DateTime` | — | `now()` | |
| `updatedAt` | `DateTime` | — | `@updatedAt` | |

**Relations:** none.

**Indexes:** `@@index([isActive])`, `@@index([displayOrder])`

**Notable patterns:** `localities` / `pincodes` stored as text lists (not join tables) — keeps lookup simple at the cost of constraint enforcement.

---

### 3.26 `PaymentMethod`

**Purpose:** Modular, admin-managed payment options.

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` | |
| `key` | `String` | `@unique @db.VarChar(50)` | — | e.g. `cod`, `razorpay`, `qr_upi` |
| `label` | `String` | `@db.VarChar(100)` | — | Customer-facing |
| `description` | `String?` | `@db.Text` | — | |
| `icon` | `String?` | `@db.VarChar(50)` | — | |
| `gateway` | `String?` | `@db.VarChar(50)` | — | Enum-like: `razorpay` \| `stripe` \| `manual` … |
| `config` | `String?` | `@db.Text` | — | JSON (gateway credentials — server-side only) |
| `displayOrder` | `Int` | — | `0` | |
| `isActive` | `Boolean` | — | `true` | |
| `createdAt` | `DateTime` | — | `now()` | |
| `updatedAt` | `DateTime` | — | `@updatedAt` | |

**Relations:** none.

**Indexes:** `@@index([isActive])`, `@@index([displayOrder])`

**Notable patterns:** Gateway credentials stored as JSON in `config` (server-side only — never exposed to client). Replaces hardcoded payment options.

---

### 3.27 `Review`

**Purpose:** Product reviews with AI moderation.

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` | |
| `productId` | `String` | — | — | |
| `customerId` | `String?` | — | — | |
| `authorName` | `String` | `@db.VarChar(255)` | — | |
| `rating` | `Int` | — | `5` | 1–5 |
| `title` | `String?` | `@db.VarChar(255)` | — | |
| `body` | `String?` | `@db.Text` | — | |
| `status` | `String` | `@db.VarChar(20)` | `"pending"` | **Enum-like:** `pending` \| `approved` \| `rejected` |
| `images` | `String?` | `@db.Text` | — | JSON array of image URLs |
| `aiStatus` | `String?` | `@db.VarChar(20)` | — | **Enum-like:** `auto_approved` \| `flagged` \| `manual` |
| `aiNote` | `String?` | `@db.Text` | — | AI-generated explanation |
| `createdAt` | `DateTime` | — | `now()` | |
| `adminReply` | `String?` | `@db.Text` | — | |
| `adminReplyAt` | `DateTime?` | — | — | |
| `adminReplyBy` | `String?` | `@db.VarChar(100)` | — | |

**Relations:**

| Field | Type | FK | onDelete |
|---|---|---|---|
| `product` | `Product` | `productId → Product.id` | Cascade |
| `customer` | `Customer?` | `customerId → Customer.id` | **SetNull** |

**Indexes:** `@@index([productId])`, `@@index([customerId])`, `@@index([status])`, `@@index([aiStatus])`

**Notable patterns:**
- **AI moderation pipeline:** `aiStatus` records whether AI auto-approved, flagged, or was overridden by manual review. `aiNote` explains the AI decision.
- **Admin replies:** Each review can have one admin reply (`adminReply` + `adminReplyAt` + `adminReplyBy`).
- **Snapshot authorName:** decoupled from Customer so reviews persist after account deletion (SetNull on customerId).

---

### 3.28 `AdminNotification`

**Purpose:** Real-time admin alerts for new orders, prescriptions, etc.

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` | |
| `type` | `String` | `@db.VarChar(50)` | — | Enum-like: `new_order` \| `new_prescription` \| `new_manual_request` \| `low_stock` \| `new_review` … |
| `title` | `String` | `@db.VarChar(255)` | — | |
| `message` | `String` | `@db.Text` | — | |
| `refId` | `String?` | `@db.VarChar(100)` | — | Polymorphic ref to Order/Prescription/etc. |
| `refType` | `String?` | `@db.VarChar(30)` | — | Discriminator: `order` \| `prescription` \| … |
| `customerName` | `String?` | `@db.VarChar(255)` | — | |
| `isRead` | `Boolean` | — | `false` | |
| `createdAt` | `DateTime` | — | `now()` | |

**Relations:** none.

**Indexes:** `@@index([isRead])`, `@@index([type])`, `@@index([createdAt])`

**Notable patterns:** Polymorphic reference (`refId` + `refType`) — single table for all admin alert types.

---

### 3.29 `NewsletterSubscriber`

**Purpose:** Email newsletter subscribers (no account required).

| Field | Type | Constraints | Default |
|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` |
| `email` | `String` | `@unique @db.VarChar(255)` | — |
| `name` | `String?` | `@db.VarChar(255)` | — |
| `isActive` | `Boolean` | — | `true` |
| `createdAt` | `DateTime` | — | `now()` |

**Relations:** none.

**Indexes:** `@@index([email])`

---

### 3.30 `StockSubscription`

**Purpose:** Back-in-stock alert subscriptions.

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` | |
| `customerId` | `String` | — | — | |
| `productId` | `String` | — | — | |
| `email` | `String` | `@db.VarChar(255)` | — | Notification target |
| `status` | `String` | `@db.VarChar(20)` | `"active"` | **Enum-like:** `active` \| `notified` \| `cancelled` |
| `createdAt` | `DateTime` | — | `now()` | |
| `notifiedAt` | `DateTime?` | — | — | |

**Relations:**

| Field | Type | FK | onDelete |
|---|---|---|---|
| `customer` | `Customer` | `customerId → Customer.id` | Cascade |
| `product` | `Product` | `productId → Product.id` | Cascade |

**Indexes:** `@@unique([customerId, productId])`, `@@index([productId, status])` (composite — used by stock-restock job to find subscribers), `@@index([customerId])`

---

### 3.31 `PushSubscription`

**Purpose:** Browser/device push subscriptions for a customer. One customer can have multiple (laptop, phone, PWA install). Uniquely keyed by the Web Push `endpoint` URL.

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` | |
| `customerId` | `String` | — | — | |
| `endpoint` | `String` | `@unique @db.VarChar(500)` | — | FCM/Mozilla/Apple push endpoint URL |
| `p256dhKey` | `String` | `@db.VarChar(255)` | — | Client P-256 public key (base64url) |
| `authKey` | `String` | `@db.VarChar(255)` | — | Client auth secret (base64url) |
| `userAgent` | `String?` | `@db.VarChar(500)` | — | |
| `isActive` | `Boolean` | — | `true` | Dead endpoints are auto-pruned |
| `createdAt` | `DateTime` | — | `now()` | |
| `updatedAt` | `DateTime` | — | `@updatedAt` | |

**Relations:**

| Field | Type | FK | onDelete |
|---|---|---|---|
| `customer` | `Customer` | `customerId → Customer.id` | Cascade |

**Indexes:** `@@index([customerId])`, `@@index([isActive])`

**Notable patterns:** Auto-pruning of dead endpoints handled by `sendPushToCustomer` (`src/lib/push-service.ts`).

---

### 3.32 `AppNotifTemplate`

**Purpose:** Admin-managed templates for App (push) notifications. 18 default templates mirror customer email templates so each transactional event has both email + push variants.

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` | |
| `key` | `String` | `@unique @db.VarChar(80)` | — | e.g. `order_placed`, `payment_successful` |
| `name` | `String` | `@db.VarChar(255)` | — | |
| `title` | `String` | `@db.VarChar(255)` | — | Notification title |
| `shortDesc` | `String?` | `@db.VarChar(500)` | — | Admin-only description of when it fires |
| `fullMessage` | `String` | `@db.Text` | — | Body with `{{variables}}` |
| `icon` | `String?` | `@db.VarChar(500)` | — | Defaults to `/icon.png` |
| `bannerImage` | `String?` | `@db.VarChar(500)` | — | Optional large image |
| `deepLink` | `String?` | `@db.VarChar(500)` | — | Route to open on click (e.g. `/account/orders`) |
| `variables` | `String?` | `@db.Text` | — | JSON array: `["name","orderNumber"]` |
| `category` | `String` | `@db.VarChar(40)` | `"transactional"` | **Enum-like:** `transactional` \| `campaign` \| `system` |
| `priority` | `String` | `@db.VarChar(20)` | `"normal"` | **Enum-like:** `normal` \| `high` |
| `isEnabled` | `Boolean` | — | `true` | |
| `createdAt` | `DateTime` | — | `now()` | |
| `updatedAt` | `DateTime` | — | `@updatedAt` | |

**Relations:**

| Field | Type | FK | onDelete |
|---|---|---|---|
| `logs` | `AppNotifLog[]` | hasMany | **SetNull** (preserves log history when template deleted) |

**Indexes:** `@@index([key])`, `@@index([category])`, `@@index([isEnabled])`

---

### 3.33 `AppNotifLog`

**Purpose:** Log of every push notification dispatched — transactional AND campaign. Used for the admin History tab + delivery analytics dashboard.

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` | |
| `customerId` | `String` | — | — | |
| `templateId` | `String?` | — | — | Nullable for ad-hoc broadcasts |
| `templateKey` | `String?` | `@db.VarChar(80)` | — | Snapshot (preserves log if template deleted) |
| `title` | `String` | `@db.VarChar(255)` | — | Snapshot |
| `body` | `String` | `@db.Text` | — | Snapshot |
| `category` | `String` | `@db.VarChar(40)` | `"transactional"` | Enum-like: `transactional` \| `campaign` \| `system` |
| `status` | `String` | `@db.VarChar(20)` | `"sent"` | **Enum-like:** `sent` \| `failed` \| `skipped` |
| `error` | `String?` | `@db.Text` | — | |
| `metadata` | `String?` | `@db.Text` | — | JSON: `{ orderId, amount, ... }` for debugging |
| `isRead` | `Boolean` | — | `false` | Customer opened the notif |
| `readAt` | `DateTime?` | — | — | |
| `isClicked` | `Boolean` | — | `false` | Customer clicked the notif |
| `clickedAt` | `DateTime?` | — | — | |
| `retryCount` | `Int` | — | `0` | |
| `sentAt` | `DateTime?` | — | — | Actual push dispatch time |
| `createdAt` | `DateTime` | — | `now()` | |

**Relations:**

| Field | Type | FK | onDelete |
|---|---|---|---|
| `customer` | `Customer` | `customerId → Customer.id` | Cascade |
| `template` | `AppNotifTemplate?` | `templateId → AppNotifTemplate.id` | **SetNull** |

**Indexes:** `@@index([customerId])`, `@@index([templateKey])`, `@@index([category])`, `@@index([createdAt])`, `@@index([status])`

**Notable patterns:** **Snapshot fields** (`templateKey`, `title`, `body`) — push log rows survive template deletion. **Engagement tracking** via `isRead`/`readAt`/`isClicked`/`clickedAt` powers delivery analytics. `metadata` JSON for debugging context (orderId, amount, etc.).

---

### 3.34 `AppNotifPreference`

**Purpose:** Per-customer master toggle for App notifications. Default enabled. Auto-created on first interaction (subscribe / sendAutoNotif). When `enabled=false` the customer receives no push notifications at all, including broadcasts.

| Field | Type | Constraints | Default |
|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` |
| `customerId` | `String` | `@unique` | — |
| `enabled` | `Boolean` | — | `true` |
| `createdAt` | `DateTime` | — | `now()` |
| `updatedAt` | `DateTime` | — | `@updatedAt` |

**Relations:**

| Field | Type | FK | onDelete |
|---|---|---|---|
| `customer` | `Customer` | `customerId → Customer.id` | Cascade |

**Indexes:** `@@index([customerId])`

**Notable patterns:** Single boolean gate — checked by every push dispatch path. 1:1 with Customer (`@unique` on `customerId`).

---

### 3.35 `DeviceRegistration`

**Purpose:** Per-customer, per-device registration record for the onboarding wizard. Each browser/device is identified by a locally-generated `deviceId` (UUID stored in localStorage) so the onboarding wizard only shows ONCE per device.

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` | |
| `customerId` | `String` | — | — | |
| `deviceId` | `String` | `@db.VarChar(64)` | — | Client-generated UUID, stored in localStorage |
| `deviceLabel` | `String` | `@db.VarChar(120)` | — | e.g. `"Chrome · Android"`, `"Edge · Windows"` |
| `browserName` | `String` | `@db.VarChar(40)` | — | |
| `osName` | `String` | `@db.VarChar(40)` | — | |
| `deviceType` | `String` | `@db.VarChar(20)` | — | **Enum-like:** `desktop` \| `mobile` \| `tablet` \| `pwa` |
| `status` | `String` | `@db.VarChar(20)` | `"pending"` | **Enum-like:** `pending` \| `skipped` \| `completed` |
| `pushEndpoint` | `String?` | `@db.VarChar(500)` | — | FCM/Mozilla endpoint at registration time |
| `completedAt` | `DateTime?` | — | — | |
| `skippedAt` | `DateTime?` | — | — | |
| `lastCheckedAt` | `DateTime` | — | `now()` | |
| `createdAt` | `DateTime` | — | `now()` | |
| `updatedAt` | `DateTime` | — | `@updatedAt` | |

**Relations:**

| Field | Type | FK | onDelete |
|---|---|---|---|
| `customer` | `Customer` | `customerId → Customer.id` | Cascade |

**Indexes:** `@@unique([customerId, deviceId])`, `@@index([customerId])`, `@@index([deviceId])`, `@@index([status])`

**Notable patterns:** On every login, the client checks `GET /api/device-registrations/status` — if THIS device's status is `completed` AND the browser still has permission + an active push subscription, the wizard NEVER re-appears. If permission was revoked, the subscription expired, or the customer logged in from a brand-new browser, the wizard shows again.

---

### 3.36 `ErrorLog`

**Purpose:** Automatic error capture for production troubleshooting.

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` | |
| `timestamp` | `DateTime` | — | `now()` | |
| `severity` | `String` | `@db.VarChar(20)` | `"error"` | **Enum-like:** `info` \| `warning` \| `error` \| `critical` |
| `module` | `String?` | `@db.VarChar(100)` | — | e.g. `checkout`, `auth`, `product-detail` |
| `endpoint` | `String?` | `@db.VarChar(500)` | — | API route or page URL |
| `method` | `String?` | `@db.VarChar(10)` | — | `GET` \| `POST` \| `PUT` \| `DELETE` |
| `message` | `String` | `@db.Text` | — | |
| `stack` | `String?` | `@db.Text` | — | Stack trace (dev mode only) |
| `userAgent` | `String?` | `@db.VarChar(500)` | — | |
| `ipAddress` | `String?` | `@db.VarChar(45)` | — | IPv6-ready (45 chars) |
| `userId` | `String?` | `@db.VarChar(100)` | — | Customer or admin ID |
| `userEmail` | `String?` | `@db.VarChar(255)` | — | |
| `requestUrl` | `String?` | `@db.VarChar(500)` | — | |
| `statusCode` | `Int?` | — | — | HTTP status |
| `status` | `String` | `@db.VarChar(20)` | `"open"` | **Enum-like:** `open` \| `resolved` \| `ignored` |

**Relations:** none.

**Indexes:** `@@index([timestamp])`, `@@index([severity])`, `@@index([status])`, `@@index([module])`

**Notable patterns:** Designed for Sentry-like triage — admin can mark `open → resolved/ignored`. `stack` only captured in dev mode (PII/size concerns).

---

### 3.37 `Campaign`

**Purpose:** Admin-managed promotional landing pages.

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` | |
| `title` | `String` | `@db.VarChar(255)` | — | |
| `slug` | `String` | `@unique @db.VarChar(255)` | — | |
| `type` | `String` | `@db.VarChar(50)` | `"landing"` | **Enum-like:** `landing` \| `offer` \| `brand` \| `category` \| `festival` \| `flash-sale` \| `seasonal` |
| `status` | `String` | `@db.VarChar(20)` | `"draft"` | **Enum-like:** `draft` \| `published` \| `scheduled` \| `expired` |
| `bannerImage` | `String?` | `@db.VarChar(500)` | — | |
| `heroTitle` | `String?` | `@db.VarChar(255)` | — | |
| `heroSubtitle` | `String?` | `@db.Text` | — | |
| `heroCtaText` | `String?` | `@db.VarChar(100)` | — | |
| `heroCtaLink` | `String?` | `@db.VarChar(255)` | — | |
| `promoText` | `String?` | `@db.Text` | — | |
| `productIds` | `String?` | `@db.Text` | — | JSON array of product IDs |
| `categoryIds` | `String?` | `@db.Text` | — | JSON array of category IDs |
| `seoTitle` | `String?` | `@db.VarChar(255)` | — | |
| `metaDescription` | `String?` | `@db.Text` | — | |
| `startDate` | `DateTime?` | — | — | |
| `endDate` | `DateTime?` | — | — | |
| `displayOrder` | `Int` | — | `0` | |
| `createdAt` | `DateTime` | — | `now()` | |
| `updatedAt` | `DateTime` | — | `@updatedAt` | |

**Relations:** none (`productIds` / `categoryIds` are JSON-soft-links).

**Indexes:** `@@index([status])`, `@@index([type])`, `@@index([slug])`

**Notable patterns:** Flexible content + scheduling model. Featured products/categories stored as JSON arrays (not join tables) for simplicity.

---

### 3.38 `HealthBundle`

**Purpose:** Curated combo packs of complementary products. Admin-managed (CRUD via admin panel). Each bundle has a theme, emoji, gradient, and a list of product IDs.

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` | |
| `title` | `String` | `@db.VarChar(255)` | — | |
| `description` | `String?` | `@db.Text` | — | |
| `emoji` | `String` | `@db.VarChar(10)` | `"📦"` | |
| `gradient` | `String` | `@db.VarChar(100)` | `"from-emerald-50 to-teal-100"` | Tailwind gradient classes |
| `accentColor` | `String` | `@db.VarChar(50)` | `"text-emerald-700"` | Tailwind text class |
| `productIds` | `String` | `@db.Text` | — | JSON array of product IDs |
| `discountPct` | `Decimal` | `@db.Decimal(5, 2)` | `0` | Bundle discount |
| `displayOrder` | `Int` | — | `0` | |
| `isActive` | `Boolean` | — | `true` | |
| `createdAt` | `DateTime` | — | `now()` | |
| `updatedAt` | `DateTime` | — | `@updatedAt` | |

**Relations:** none (`productIds` is JSON-soft-link).

**Indexes:** `@@index([isActive])`, `@@index([displayOrder])`

**Notable patterns:** Tailwind class names stored as data — front-end renders the gradient/accent directly.

---

### 3.39 `MedicineReminder`

**Purpose:** Customer-created reminders to take medicines on schedule.

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` | |
| `customerId` | `String` | — | — | |
| `productName` | `String` | `@db.VarChar(255)` | — | |
| `dosage` | `String?` | `@db.VarChar(100)` | — | e.g. `"1 tablet"` |
| `frequency` | `String` | `@db.VarChar(50)` | — | **Enum-like:** `daily` \| `twice-daily` \| `weekly` \| `custom` |
| `times` | `String` | `@db.Text` | — | JSON array of `"HH:MM"` strings: `["08:00", "20:00"]` |
| `startDate` | `DateTime` | — | `now()` | |
| `endDate` | `DateTime?` | — | — | |
| `isActive` | `Boolean` | — | `true` | |
| `lastReminder` | `DateTime?` | — | — | |
| `createdAt` | `DateTime` | — | `now()` | |
| `updatedAt` | `DateTime` | — | `@updatedAt` | |

**Relations:**

| Field | Type | FK | onDelete |
|---|---|---|---|
| `customer` | `Customer` | `customerId → Customer.id` | Cascade |

**Indexes:** `@@index([customerId])`, `@@index([isActive])`

**Notable patterns:** **Passive record** — actual push notifications require a separate scheduler service (future enhancement). UI is `MedicineRemindersView` accessible from the account page.

---

### 3.40 `RefillReminder`

**Purpose:** Auto-created when an order containing a `prescriptionRequired` product is delivered/completed. Tracks the next estimated refill date based on the days supply (default 25 days). The customer can also manually create a refill reminder.

| Field | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `String` | `@id` | `cuid()` | |
| `customerId` | `String` | — | — | |
| `productId` | `String` | — | — | |
| `orderId` | `String?` | — | — | Soft link to originating order |
| `lastOrdered` | `DateTime` | — | — | |
| `nextRefillDate` | `DateTime` | — | — | Calculated: `lastOrdered + daysSupply` |
| `daysSupply` | `Int` | — | `30` | Estimated days per pack |
| `isActive` | `Boolean` | — | `true` | |
| `notifiedAt` | `DateTime?` | — | — | |
| `createdAt` | `DateTime` | — | `now()` | |
| `updatedAt` | `DateTime` | — | `@updatedAt` | |

**Relations:**

| Field | Type | FK | onDelete |
|---|---|---|---|
| `customer` | `Customer` | `customerId → Customer.id` | Cascade |
| `product` | `Product` | `productId → Product.id` | Cascade |

**Indexes:** `@@index([customerId])`, `@@index([isActive])`, `@@index([nextRefillDate])`

**Notable patterns:** `orderId` is a soft link (no FK) — the RefillReminder survives order deletion. `nextRefillDate` is indexed for the daily cron job that scans for due reminders. (Schema comment says default 25 days, field default says 30 — minor discrepancy in docs vs. field default; actual logic in `src/lib/...` reconciles this.)

---

## 4. Cross-Cutting Data Flows

### 4.1 Order `status` enum (inferred — not Prisma enum)

The schema documents `status @default("pending") @db.VarChar(30)` but doesn't list values inline. The corresponding lifecycle timestamps on `Order` and the `OrderStatusHistory` model imply this state machine:

```
pending ──confirm──► confirmed ──pack──► packed ──dispatch──► out_for_delivery ──deliver──► delivered
   │                     │                                                                   │
   └──cancel──► cancelled                                                              (terminal)
                       └──cancel──► cancelled
```

Each transition appends an `OrderStatusHistory` row and stamps the matching `confirmedAt` / `packedAt` / `outForDeliveryAt` / `deliveredAt` / `cancelledAt` timestamp on the Order.

### 4.2 Customer → Cart → Order → OrderItem → Product → Brand/Category chain

This is the **central commerce flow**. End-to-end path:

```
Customer (1)
  ├── has 1 → Cart (1:1 via Cart.customerId @unique)
  │             └── hasMany → CartItem (cartId, productId, quantity)
  │                              └── belongsTo → Product
  ├── hasMany → Address (customerId, isDefault)
  │
  └── hasMany → Order (customerId, addressId)  [onDelete: SetNull — preserves history]
                  ├── snapshot fields: ship* (denormalized from Address)
                  ├── pricing totals: itemsTotal, productDiscount, voucherDiscount,
                  │                   deliveryCharge, taxTotal, grandTotal, roundOff
                  ├── loyalty: loyaltyPointsRedeemed, loyaltyDiscount
                  ├── payment: paymentMethod, paymentStatus, paymentId, paymentScreenshot
                  ├── source: source (cart | prescription | manual_request),
                  │           prescriptionId, manualRequestId (soft links)
                  ├── stage timestamps: confirmedAt, packedAt, outForDeliveryAt,
                  │                     deliveredAt, cancelledAt
                  ├── hasMany → OrderItem (orderId, productId?, name, sku, image, qty,
                  │                         mrp, sellingPrice, appliedDiscountPct,
                  │                         discountAmount, lineTotal)
                  │                └── belongsTo? → Product (productId nullable for deleted products)
                  ├── hasMany → OrderStatusHistory (orderId, status, note, createdBy)
                  └── hasMany → OrderNote (orderId, body, authorId, authorName)

Product (N)
  ├── belongsTo? → Brand (brandId, onDelete: SetNull)
  ├── belongsTo? → Category (categoryId, onDelete: SetNull)
  ├── hasMany → ProductImage (productId, isPrimary)  [single source of truth]
  ├── hasMany → Review (productId, customerId?, rating, status, aiStatus)
  ├── hasMany → Deal (productId, discountPct, dealPrice)
  ├── hasMany → CartItem (via Cart)
  ├── hasMany → OrderItem (snapshot kept even if Product deleted)
  ├── hasMany → WishlistItem
  ├── hasMany → StockSubscription (back-in-stock)
  └── hasMany → RefillReminder (auto-created when Rx product delivered)

Category (self-referencing tree)
  ├── belongsTo? → Category (parentId, "CategoryParent" relation, onDelete: SetNull)
  ├── hasMany → Category (children)
  └── hasMany → Product

Brand
  └── hasMany → Product
```

**Conversion mechanics (Cart → Order):**

1. Customer browses `/shop` → adds to cart via `POST /api/cart/add` (creates `CartItem` or increments `quantity`).
2. Cart is fetched client-side; `voucherCode` can be applied via `POST /api/cart/voucher` (validates against `Voucher` table).
3. Checkout (`POST /api/checkout`):
   - **Pricing Engine** (`src/lib/pricing-engine.ts`) computes `itemsTotal`, `productDiscount` (clamped to `[baseDiscountPct, maxDiscountPct]`), `voucherDiscount`, `deliveryCharge` (from `DeliveryZone`), `taxTotal`, `grandTotal`, `roundOff`.
   - Address fields are **snapshotted** into the Order (`ship*` fields) so later address edits don't mutate historical orders.
   - `Order.source = "cart"`.
   - `OrderItem` rows are created with product snapshots (name, sku, image, mrp, sellingPrice).
   - `Cart.items` are cleared (cart itself is preserved for reuse).
   - `VoucherUsage` row is inserted (enforces `perCustomerLimit`).
   - `LoyaltyTransaction` row of `type=earn` may be inserted on delivery (not on order placement — see §4.4).
   - `OrderStatusHistory` row inserted with `status="pending"`.
   - `AdminNotification` row created (`type="new_order"`).
   - Transactional notifications dispatched (email via `NotificationTemplate`, push via `AppNotifTemplate`).

### 4.3 Notification system models — relationships

The notification system has **two parallel subsystems** plus a real-time admin alert layer:

#### 4.3.1 Email / WhatsApp subsystem (legacy + primary transactional)

```
NotificationTemplate (key, channel: email|whatsapp, subject, body, variables)
        │
        │ (referenced by string key — no FK)
        ▼
NotificationLog (customerId?, recipient, channel, subject, body, status, templateKey, error)
        │
        └── belongsTo? → Customer (onDelete: SetNull — preserves log)
```

- `NotificationTemplate` is the admin-editable content store.
- `NotificationLog` is the append-only send log.
- Loose coupling: `NotificationLog.templateKey` is a plain string, not a FK — templates can be edited/deleted without breaking historical logs.

#### 4.3.2 Web Push subsystem (App notifications)

```
Customer (1)
  ├── has 1 → AppNotifPreference (customerId @unique, enabled boolean — master gate)
  ├── hasMany → PushSubscription (endpoint, p256dhKey, authKey — one per device/browser)
  ├── hasMany → DeviceRegistration (deviceId, status: pending|skipped|completed — onboarding wizard state)
  └── hasMany → AppNotifLog (every push dispatched, with engagement tracking)
                  └── belongsTo? → AppNotifTemplate (templateId, onDelete: SetNull — preserves log)

AppNotifTemplate (key, title, fullMessage, category: transactional|campaign|system,
                  priority: normal|high, isEnabled, deepLink)
        │
        └── hasMany → AppNotifLog (templateId — SetNull on template deletion)
```

**Dispatch flow:**
1. Event triggers (e.g. order placed) → look up `AppNotifTemplate` by `key` (e.g. `order_placed`).
2. Check `AppNotifPreference.enabled` for the customer — if `false`, skip entirely.
3. Check `AppNotifTemplate.isEnabled` — if `false`, skip.
4. Render template (`{{variables}}` substitution).
5. For each `PushSubscription` where `isActive=true`:
   - Send via Web Push API (VAPID-signed).
   - Insert `AppNotifLog` row with `status=sent|failed|skipped`, snapshotting `title`/`body`/`templateKey` (so log survives template deletion).
   - On 410 Gone (dead endpoint), set `PushSubscription.isActive=false` (auto-pruning).
6. Client reports back via `POST /api/app-notifs/log/[id]/click` and `/delivered` → updates `isRead`/`readAt`/`isClicked`/`clickedAt`.

**Onboarding wizard flow (`DeviceRegistration`):**
- Client generates `deviceId` (UUID) → stored in `localStorage`.
- On first login from a device, `GET /api/device-registrations/status?deviceId=X` checks if a row exists with `status=completed` AND the browser still has push permission.
- If not, wizard shows → on completion `POST /api/device-registrations/register` sets `status=completed`.
- "Skip for Now" → `status=skipped`.
- `@@unique([customerId, deviceId])` enforces one registration per customer-device pair.

#### 4.3.3 Admin real-time alerts

```
AdminNotification (type, title, message, refId, refType, isRead)
   - Polymorphic ref via (refId + refType) — no FK.
   - Consumed by AdminNotificationBell.tsx via polling/SSE.
```

### 4.4 Loyalty system

**Architecture:** Denormalized current balance + append-only ledger.

```
Customer.loyaltyPoints (Int, default 0)   ← current balance (denormalized)
        │
        └── hasMany → LoyaltyTransaction
                        (type: earn|redeem|adjust,
                         points: signed Int,
                         balance: snapshot after this txn,
                         reason, orderId — soft link)
```

**Earn rule** (from `Customer.loyaltyPoints` comment): **1 point per Rs. 10 spent on delivered orders.**

**Lifecycle:**
- **Earn:** When an Order transitions to `delivered`, a `LoyaltyTransaction` row is inserted with `type=earn`, `points = floor(grandTotal / 10)`, `balance = Customer.loyaltyPoints + points`. `Customer.loyaltyPoints` is updated atomically in the same transaction. `orderId` soft-links back to the originating order.
- **Redeem:** At checkout, customer can redeem points (typically 1 point = Rs. 1, configurable). A `LoyaltyTransaction` with `type=redeem` and `points = -N` is inserted. The order records `loyaltyPointsRedeemed` and `loyaltyDiscount` snapshot fields.
- **Adjust:** Admin-initiated corrections (`type=adjust`) — manual balance changes with a `reason`.
- **Ledger reconstruction:** Because each row carries a `balance` snapshot, point-in-time balances can be reconstructed by reading the latest row before a given timestamp — no re-summing required.

**Redemption API:** `POST /api/customer/loyalty/redeem` (see `src/lib/loyalty.ts`).

### 4.5 Prescriptions & Manual Requests → Orders conversion

Both `Prescription` and `ManualRequest` are **intake channels** that can be converted into Orders by an admin. They share an identical status/flow shape:

```
Customer (1)
  ├── hasMany → Prescription (images: JSON, notes, status, adminNotes, convertedOrderId)
  │                │  [onDelete: SetNull on customerId — preserves prescription history]
  │                │
  │                │  Admin reviews in /admin/prescriptions
  │                │  Admin clicks "Convert to Order"
  │                ▼
  │           POST /api/admin/prescriptions/[id]/convert
  │                │  → creates Order with source="prescription",
  │                │    prescriptionId=<prescription.id>
  │                │  → updates Prescription.status="converted",
  │                │    Prescription.convertedOrderId=<new order.id>
  │                │  → creates OrderStatusHistory row
  │                ▼
  └── hasMany → ManualRequest (medicineList: Text, notes, status, adminNotes, convertedOrderId)
                   │  [onDelete: SetNull on customerId]
                   │
                   │  Admin reviews in /admin/manual-requests
                   │  Admin clicks "Convert to Order"
                   ▼
              POST /api/admin/manual-requests/[id]/convert
                   → creates Order with source="manual_request",
                     manualRequestId=<manualRequest.id>
                   → updates ManualRequest.status="converted",
                     ManualRequest.convertedOrderId=<new order.id>
```

**Soft-link bidirectionality:**
- `Prescription.convertedOrderId → Order.id` (string, no FK).
- `Order.prescriptionId → Prescription.id` (string, no FK).
- Same pattern for `ManualRequest` ↔ `Order`.
- Using soft links (no Prisma `@relation`) means either side can be deleted without breaking the other — important because orders must survive prescription cleanup, and prescriptions must survive order archival.

**Status semantics (inferred):**

| Source | Intake statuses | Conversion statuses |
|---|---|---|
| `Prescription` | `pending` (newly uploaded) | `verified` (admin validated Rx) → `converted` (Order created) / `rejected` (invalid Rx) |
| `ManualRequest` | `pending` (newly submitted) | `quoted` (admin priced the items) → `converted` (Order created) / `rejected` |

After conversion, the resulting Order behaves identically to a cart-originated Order — same fulfillment pipeline, same status transitions, same notification triggers.

---

## 5. Cross-Cutting Patterns Summary

| Pattern | Where used | Implementation |
|---|---|---|
| **Soft delete via SetNull** | `Order.customerId`, `Prescription.customerId`, `ManualRequest.customerId`, `Review.customerId`, `NotificationLog.customerId`, `AppNotifLog.templateId`, `Product.brandId`, `Product.categoryId`, `Category.parentId`, `Deal.productId` | `onDelete: SetNull` preserves historical rows when parent is deleted. |
| **Hard cascade delete** | All child tables owned 1:1 or N:1 by a parent that has no standalone value | `onDelete: Cascade` — used on `CartItem`, `OrderItem`, `OrderStatusHistory`, `OrderNote`, `WishlistItem`, `StockSubscription`, `PushSubscription`, `AppNotifPreference`, `DeviceRegistration`, `MedicineReminder`, `RefillReminder`, `LoyaltyTransaction`, `Address`, `Otp`, `Cart`, `ProductImage`. |
| **Snapshot denormalization** | `Order.ship*` (from Address), `OrderItem.{name,sku,image,mrp,sellingPrice}` (from Product), `AppNotifLog.{templateKey,title,body}` (from AppNotifTemplate), `Product.{primaryImage,galleryImages}` (from ProductImage), `Product.{avgRating,reviewCount}` (from Review) | Avoids JOINs and preserves history when source changes/deleted. |
| **JSON-in-Text storage** | `Admin.permissions`, `Otp.pendingData`, `Prescription.images`, `Review.images`, `Voucher.targetIds`, `Campaign.productIds`, `Campaign.categoryIds`, `HealthBundle.productIds`, `MedicineReminder.times`, `AppNotifTemplate.variables`, `AppNotifLog.metadata`, `Setting.value`, `PaymentMethod.config` | Portable across SQLite/Postgres. No native JSONB usage — all are `@db.Text`. |
| **Audit trail / append-only ledger** | `OrderStatusHistory`, `LoyaltyTransaction`, `NotificationLog`, `AppNotifLog`, `ErrorLog`, `VoucherUsage` | Each row is one event; never updated (only inserted), except `ErrorLog.status` and `AppNotifLog.isRead/isClicked` which are mutable. |
| **Composite unique constraints** | `WishlistItem @@unique([customerId, productId])`, `CartItem @@unique([cartId, productId])`, `StockSubscription @@unique([customerId, productId])`, `DeviceRegistration @@unique([customerId, deviceId])` | Prevents duplicate join-table rows. |
| **Composite indexes for query perf** | `Product @@index([visibility, status])`, `StockSubscription @@index([productId, status])` | Phase 97 perf work — covers the most common filter combinations. |
| **Polymorphic references** | `AdminNotification.{refId, refType}`, `Order.{prescriptionId, manualRequestId, source}` | Single column pair that points to different tables based on a discriminator. |
| **Master-toggle gate** | `AppNotifPreference.enabled`, `Customer.isActive`, `Customer.whatsappOptIn`, `Voucher.isActive`, `Product.status`, `Category.visibility` | Single boolean checked before any dispatch/listing operation. |
| **Denormalized counters** | `Voucher.usedCount`, `Product.reviewCount`, `Customer.loyaltyPoints` | Updated atomically alongside the audit-row insertion to avoid COUNT() queries. |
| **Stage-timestamp tracking** | `Order.{confirmedAt, packedAt, outForDeliveryAt, deliveredAt, cancelledAt, estimatedDelivery}`, `DeviceRegistration.{completedAt, skippedAt, lastCheckedAt}`, `RefillReminder.notifiedAt`, `StockSubscription.notifiedAt` | One nullable DateTime per stage — drives timeline UIs without parsing history. |
| **Self-referencing adjacency list** | `Category.parentId` (relation `"CategoryParent"`) | Tree structure for nested categories. |
| **Per-device identification via client UUID** | `DeviceRegistration.deviceId` (stored in localStorage) | Survives cookie clears, distinguishes browsers on the same customer account. |
| **Hash-based deduplication** | `ProductImage.hash` (SHA-256, 64 chars) | Detects and skips duplicate uploads. |

---

## 6. Index Coverage Summary

The schema declares **73 indexes** across 40 models (counting `@unique` and `@@unique` as indexes). Highlights:

| Model | Index count | Notable composites |
|---|---|---|
| `Product` | 12 | `[visibility, status]` |
| `AppNotifLog` | 5 | — |
| `Order` | 4 | — |
| `Customer` | 2 + 2 uniques | — |
| `ErrorLog` | 4 | — |
| `Campaign` | 3 + 1 unique | — |
| `StockSubscription` | 2 + 1 unique | `[productId, status]` |
| `DeviceRegistration` | 3 + 1 unique | — |
| `Admin` | 1 | `[email]` |

Every foreign key column has a corresponding `@@index`. The Product table has the heaviest indexing due to its central role in catalog queries (featured, best-seller, trending, visibility+status, avgRating, baseDiscountPct, createdAt, displayOrder).

---

## 7. Migration & Operational Notes

- **Migration tooling:** `prisma migrate` uses `DIRECT_URL` (session-mode pooler, port 5432). Runtime queries use `DATABASE_URL` (transaction-mode pooler, port 6543 with `?pgbouncer=true`).
- **No native enums:** All enumerated value sets are `String @db.VarChar(N)` with inline `// a | b | c` comments. Adding a new value requires no migration — only an application code update. Trade-off: no DB-level constraint enforcement (the app layer is the source of truth).
- **Decimal precision:** All monetary fields use `Decimal(10,2)` — exact precision, no float drift. Discount percentages use `Decimal(5,2)` (max 999.99%). Ratings use `Decimal(3,2)` (max 9.99).
- **CUID primary keys:** All `id` fields use `@default(cuid())` — collision-resistant, sortable, URL-safe. No auto-increment integers.
- **`@updatedAt` everywhere:** Every mutable model has `updatedAt DateTime @updatedAt` for automatic timestamp management.
- **No `createdAt` on `Setting` or `NotificationTemplate`:** These are upsert-only / admin-curated — no creation timestamp needed.
- **Soft-delete absence:** The schema has **no `deletedAt` columns** — deletion is either Cascade (children) or SetNull (historical preservation). There is no "trash" / "archived" state.

---

## 8. Related Code References

| Concern | File |
|---|---|
| Prisma client singleton | `src/lib/db.ts` |
| Pricing engine (margin-protected discounts) | `src/lib/pricing-engine.ts` |
| Loyalty earn/redeem logic | `src/lib/loyalty.ts` |
| Push dispatch + auto-pruning | `src/lib/push-service.ts` |
| App notification templates (18 defaults) | `src/lib/app-notif-templates.ts` |
| App notification dispatch helpers | `src/lib/app-notifs.ts` |
| Email/WhatsApp template rendering | `src/lib/email-template.ts`, `src/lib/notifications.ts` |
| Settings typed access | `src/lib/settings.ts` |
| Stock-restock notifier | `src/lib/stock-notifier.ts` |
| Admin notification creator | `src/lib/admin-notifications.ts` |
| Permission keys for `Admin.permissions` | `src/lib/permissions.ts` |
| Error capture → `ErrorLog` | `src/lib/error-capture.ts` |
| Storage providers (image uploads) | `src/lib/storage/providers/{azure-blob,s3,supabase,local}.ts` |
| Seed data (40 models + 18 push templates) | `prisma/seed.ts` |

---

*End of DOC-5 — Database Schema. 40 models documented field-by-field.*
