// ============================================================================
// File: src/components/customer/api.ts
// Purpose: React Query keys + shared TypeScript types for the customer SPA.
//          The actual fetch client (ApiError / api / run) lives in
//          src/lib/fetch-client.ts and is re-exported here for convenience so
//          existing `import { api, run } from "./api"` calls keep working.
// Role: Re-used by every customer view/component — never call fetch() directly.
// ============================================================================

// Re-export the shared fetch client (single source of truth, shared with the
// admin SPA). Customer views use both `api(url)` (callable GET) and the
// `api.get/post/...` method form.
export { ApiError, api, run } from "@/lib/fetch-client";

// ---------------------------------------------------------------------------
// React Query keys — namespaced so cache invalidation is predictable.
// ---------------------------------------------------------------------------
export const qk = {
  me: ["customer", "me"] as const,
  cart: ["customer", "cart"] as const,
  publicSettings: ["customer", "public-settings"] as const,
  products: (params: Record<string, unknown>) => ["customer", "products", params] as const,
  product: (slug: string) => ["customer", "product", slug] as const,
  categories: ["customer", "categories"] as const,
  brands: ["customer", "brands"] as const,
  featured: ["customer", "featured"] as const,
  deals: ["customer", "deals"] as const,
  orders: ["customer", "orders"] as const,
  // Unified history (orders + prescriptions + manual requests) — used by
  // the redesigned OrdersView. Auto-refreshes on a 30s interval there.
  history: ["customer", "history"] as const,
  addresses: ["customer", "addresses"] as const,
  wishlist: ["customer", "wishlist"] as const,
  reviews: (productId: string) => ["customer", "reviews", productId] as const,
  trackOrder: (id: string) => ["customer", "track", id] as const,
  loyalty: ["customer", "loyalty"] as const,
  vouchers: ["admin", "vouchers"] as const,
  stockAlerts: ["customer", "stock-alerts"] as const,
  recommendations: (subtotal: number, freeAbove: number | null) =>
    ["customer", "recommendations", subtotal, freeAbove] as const,
  // Curated medical bundles (home carousel + /bundles view).
  bundles: ["customer", "bundles"] as const,
  // Per-product recommendations: related + frequentlyBought + alternatives.
  productRecommendations: (productId: string) =>
    ["customer", "product-recommendations", productId] as const,
  // Home page premium product feed (6 sections in one call).
  homeFeed: ["customer", "home-feed"] as const,
  // Customer-created medicine reminders (MedicineReminder model).
  reminders: ["customer", "reminders"] as const,
  // Prescription refill reminders (RefillReminder model) — auto-created
  // when an Rx order is delivered, or manually created by the customer.
  refillReminders: ["customer", "refill-reminders"] as const,
};

// ---------------------------------------------------------------------------
// Shared TypeScript types for API responses (kept loose to match Prisma).
// ---------------------------------------------------------------------------
export interface CustomerMe {
  id: string;
  name: string;
  email: string;
  phone: string;
  isEmailVerified: boolean;
  /** Legacy opt-in flag retained on the Customer model. No longer used for
   *  dispatch (WhatsApp sending was removed) — kept here so the typed customer
   *  object matches the /api/customer/me response shape. */
  whatsappOptIn?: boolean;
  isActive?: boolean;
  createdAt?: string;
  addresses: Address[];
  _count?: { orders: number; prescriptions: number };
}

export interface Address {
  id: string;
  label: string;
  line1: string;
  line2?: string | null;
  city: string;
  district: string;
  state: string;
  pincode: string;
  locality?: string | null;
  phone?: string | null;
  isDefault: boolean;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  displayMode?: string; // "logo_only" | "name_only" | "both"
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  image?: string | null;
  description?: string | null;
  displayOrder: number;
  /** Number of active products in this category. Optional because some legacy
   *  callers (e.g. admin lists) don't include it. */
  productCount?: number;
}

export interface ProductImage {
  id: string;
  imagePath: string;
  altText?: string | null;
  title?: string | null;
  caption?: string | null;
  isPrimary: boolean;
  displayOrder: number;
  width?: number | null;
  height?: number | null;
  fileSize?: number;
  mimeType?: string;
  originalName?: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  sku?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  composition?: string | null;
  genericName?: string | null;
  manufacturer?: string | null;
  prescriptionRequired: boolean;
  isGeneric: boolean;
  brandId?: string | null;
  categoryId?: string | null;
  unit?: string | null;
  packSize?: string | null;
  mrp: number;
  sellingPrice: number;
  baseDiscountPct: number;
  maxDiscountPct: number;
  costPrice?: number | null;
  stock: number;
  primaryImage?: string | null;
  galleryImages?: string | null;
  isFeatured: boolean;
  isBestSeller: boolean;
  isTrending: boolean;
  avgRating: number;
  reviewCount: number;
  brand?: Pick<Brand, "id" | "name" | "slug" | "logo" | "displayMode"> | null;
  category?: Pick<Category, "id" | "name" | "slug"> | null;
  images?: ProductImage[];
}

export interface ProductListResponse {
  items: Product[];
  total: number;
  page: number;
  limit: number;
}

export interface FeaturedResponse {
  featured: Product[];
  bestSellers: Product[];
  trending: Product[];
}

/** A curated medical bundle returned by /api/catalog/bundles. */
export interface MedicalBundleResponse {
  id: string;
  name: string;
  description: string;
  icon: string;
  accentColor: string;
  accentBg: string;
  accentBorder: string;
  keywords: string[];
  maxItems: number;
  products: Product[];
  totalSavings: number;
  combinedMrp: number;
  combinedPrice: number;
  inStockCount: number;
}

export interface BundlesResponse {
  bundles: MedicalBundleResponse[];
}

/** Per-product recommendations returned by /api/catalog/recommendations/[productId]. */
export interface ProductRecommendationsResponse {
  related: Product[];
  frequentlyBought: Product[];
  alternatives: Product[];
}

/** Premium product feed returned by /api/catalog/home-feed.
 *  Powers the 6 extra showcase sections on the home page (New Arrivals,
 *  Doctor's Choice, Pharmacist Recommended, Limited-Time Deals, Seasonal
 *  Collection, Top Rated). `season` lets the Seasonal section pick a
 *  matching title, gradient, and icon client-side. */
export interface HomeFeedResponse {
  newArrivals: Product[];
  doctorsChoice: Product[];
  pharmacistRecommended: Product[];
  limitedTimeDeals: Product[];
  seasonalCollection: Product[];
  topRated: Product[];
  season: "winter" | "summer" | "monsoon" | "festive";
}

export interface CartItemPricing {
  productId: string;
  name: string;
  sku?: string | null;
  image?: string | null;
  qty: number;
  mrp: number;
  sellingPrice: number;
  baseDiscountPct: number;
  maxDiscountPct: number;
  appliedDiscountPct: number;
  unitPrice: number;
  discountAmount: number;
  lineMrpTotal: number;
  lineTotal: number;
  voucherDiscountShare: number;
  finalLineTotal: number;
  categoryId?: string | null;
  brandId?: string | null;
  isGeneric?: boolean;
  upgraded?: boolean;
}

export interface Cart {
  id: string;
  voucherCode?: string | null;
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    product: Pick<
      Product,
      | "id"
      | "name"
      | "slug"
      | "mrp"
      | "sellingPrice"
      | "baseDiscountPct"
      | "maxDiscountPct"
      | "primaryImage"
      | "stock"
      | "prescriptionRequired"
      | "unit"
      | "packSize"
    > & {
      // Brand is a relation (not a scalar on Product), included by the
      // cart _lib's PRODUCT_SELECT. Declared here so cart-view can render
      // the brand name next to each line item.
      brand?: { name: string } | null;
    };
  }>;
  pricing: {
    lines: CartItemPricing[];
    itemsTotal: number;
    productDiscount: number;
    subtotalAfterDiscount: number;
    voucherDiscount: number;
    voucherCode?: string;
    voucherValid: boolean;
    voucherError?: string;
    totalAfterVoucher: number;
    upgradeThreshold: number;
    upgraded: boolean;
  };
  delivery: {
    charge: number;
    free: boolean;
    zone?: string;
    zoneName?: string;
    estimatedHours?: number;
    serviceable?: boolean;
    message?: string;
    /** Free-delivery threshold for the matched zone (from /api/delivery/calculate). */
    freeAbove?: number | null;
  };
  grandTotal: number;
}

export interface OrderListItem {
  id: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  grandTotal: number;
  deliveryCharge?: number;
  createdAt: string;
  // Tracking timeline timestamps
  confirmedAt?: string | null;
  packedAt?: string | null;
  outForDeliveryAt?: string | null;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  // Delivery + ETA
  estimatedDelivery?: string | null;
  shipLocality?: string | null;
  // Pricing breakdown (for richer order cards)
  voucherCode?: string | null;
  voucherDiscount?: number;
  loyaltyDiscount?: number;
  // Product-level discount (MRP − selling) aggregated across line items.
  // Returned by the customer /api/orders endpoint; used for "Total Savings".
  productDiscount?: number;
  // Source links
  prescriptionId?: string | null;
  _count?: { items: number };
  items?: Array<{
    id: string;
    name: string;
    qty: number;
    image?: string | null;
    lineTotal: number;
  }>;
}

export interface OrderTrack {
  id: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  source?: string;
  grandTotal: number;
  itemsTotal: number;
  productDiscount: number;
  voucherDiscount: number;
  deliveryCharge: number;
  voucherCode?: string | null;
  loyaltyPointsRedeemed: number;
  loyaltyDiscount: number;
  createdAt: string;
  // Stage timestamps (for the tracking timeline)
  confirmedAt?: string | null;
  packedAt?: string | null;
  outForDeliveryAt?: string | null;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  estimatedDelivery?: string | null;
  notes?: string | null;
  prescriptionId?: string | null;
  shipName: string;
  shipPhone: string;
  shipLine1: string;
  shipLine2?: string | null;
  shipCity: string;
  shipState: string;
  shipPincode: string;
  shipLocality?: string | null;
  // QR payment screenshot (only populated for paymentMethod="qr" orders).
  // The customer uploads a UPI transfer screenshot so the admin can verify
  // and mark the order as paid.
  paymentScreenshot?: string | null;
  paymentScreenshotUploadedAt?: string | null;
  paymentTxnId?: string | null;
  items: Array<{
    id: string;
    name: string;
    qty: number;
    mrp: number;
    appliedDiscountPct: number;
    lineTotal: number;
    image?: string | null;
  }>;
  statusHistory: Array<{
    id: string;
    status: string;
    note?: string | null;
    createdAt: string;
  }>;
}

/** A payment method option returned by the public settings API. */
export interface PaymentMethodOption {
  id: string;
  key: string;       // cod | qr | upi | razorpay | ...
  label: string;     // "Cash on Delivery", "QR Code", etc.
  description?: string | null;
  icon?: string | null;  // lucide icon name
  displayOrder: number;
}

/** A dynamic hero card (managed from Admin → Settings → Hero → Hero Cards). */
export interface HeroCard {
  id: string;
  enabled: boolean;
  icon: string;   // lucide icon name
  title: string;
  description: string;
  link: string;   // customer view name or URL
  displayOrder: number;
}

/** A trust feature item (managed from Admin → Settings → Hero → Trust Features). */
export interface HeroTrustFeature {
  id: string;
  enabled: boolean;
  icon: string;
  title: string;
  description: string;
  displayOrder: number;
}

/**
 * Admin-configurable hero section (home page). Stored as a single JSON blob
 * under the `hero.config` Setting key so the whole object updates atomically
 * and supports arrays (cards, trustFeatures). Every major sub-component has
 * an `enabled` toggle so it can be turned off without code changes.
 */
export interface HeroConfig {
  // — General —
  enabled: boolean;
  layout: "split-left" | "split-right" | "centered" | "full-bg";
  stylePreset: "emerald" | "teal" | "midnight" | "sunrise" | "custom";
  height: "sm" | "md" | "lg" | "xl";
  contentAlign: "left" | "center";
  bgOverlay: number;        // 0-100 dark overlay over background image
  borderRadius: number;     // px
  sectionSpacing: "compact" | "normal" | "relaxed";
  animationsEnabled: boolean;

  // — Background —
  bgImageEnabled: boolean;
  bgImageDesktop: string;
  bgImageTablet: string;
  bgImageMobile: string;
  bgColor: string;
  gradientEnabled: boolean;
  gradientFrom: string;
  gradientVia: string;
  gradientTo: string;
  bgPattern: "none" | "dots" | "grid" | "waves";
  bgOpacity: number;        // 0-100 opacity of the bg color/gradient layer
  videoBgEnabled: boolean;  // future-ready
  videoBgUrl: string;

  // — Content —
  heading: string;
  headingHighlight: string;
  subheading: string;
  description: string;
  promoBadgeEnabled: boolean;
  promoBadgeText: string;
  offerBadgeEnabled: boolean;
  offerText: string;
  discountLabel: string;
  deliveryInfoEnabled: boolean;
  deliveryInfoText: string;
  noticeText: string;

  // — Buttons —
  ctaEnabled: boolean;
  primaryCtaText: string;
  primaryCtaUrl: string;       // customer view name or URL
  primaryCtaIcon: string;      // lucide icon name
  secondaryCtaText: string;
  secondaryCtaUrl: string;
  secondaryCtaIcon: string;
  buttonStyle: "solid" | "outline" | "gradient";

  // — Search —
  searchEnabled: boolean;
  searchPlaceholder: string;
  popularSearches: string;     // comma-separated

  // — Hero Cards (dynamic array) —
  cardsEnabled: boolean;
  cards: HeroCard[];

  // — Trust Features (dynamic array) —
  trustEnabled: boolean;
  trustFeatures: HeroTrustFeature[];

  // — Promotional Banner —
  promoBannerEnabled: boolean;
  promoBannerImage: string;
  promoBannerTitle: string;
  promoBannerDesc: string;
  promoBannerCtaText: string;
  promoBannerCtaUrl: string;
  promoBannerStart: string;    // ISO date
  promoBannerEnd: string;      // ISO date

  // — Announcement Bar —
  announcementEnabled: boolean;
  announcementText: string;
  announcementLink: string;
  announcementStart: string;   // ISO date
  announcementEnd: string;     // ISO date

  // — SEO —
  seoHeading: string;
  seoKeywords: string;
  seoDescription: string;
  imageAltText: string;
}

export interface PublicSettings {
  store: {
    name: string;
    tagline: string;
    email: string;
    phone: string;
    address: string;
    openStatus: boolean;
    openTime: string;
    closeTime: string;
    closedMessage: string;
    logo: string;
    licenseNumber: string;
  };
  weeklySchedule?: any;
  holidays?: any;
  delivery?: { freeAbove: number; defaultCharge: number; estimatedHours: number };
  payment: { codEnabled: boolean; onlineEnabled: boolean };
  paymentMethods?: PaymentMethodOption[];
  hero?: HeroConfig;
  seo: { title: string; description: string; keywords: string };
  theme?: { primaryColor: string; accentColor: string };
  offers?: Array<{
    id: string;
    title: string;
    subtitle?: string;
    ctaText?: string;
    ctaView?: string;
    bgColor: string;
    textColor: string;
    position: string;
    isActive: boolean;
    displayOrder: number;
    customHtml?: string;
  }>;
}

/** A voucher code (flat-amount deduction from order total). */
export interface Voucher {
  id: string;
  code: string;
  description?: string | null;
  amount: number;
  scope: "cart" | "product" | "category";
  targetIds?: string[] | null;
  minOrder: number;
  maxRedemptions: number;
  usedCount: number;
  perCustomerLimit: number;
  validFrom: string;
  validTo?: string | null;
  isActive: boolean;
}

/** A "Today's Deal" entry returned by the public /api/deals endpoint. */
export interface DealItem {
  id: string;
  title: string;
  description?: string | null;
  productId?: string | null;
  discountPct: number;
  originalPrice?: number | null;
  dealPrice?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  isActive: boolean;
  displayOrder: number;
  product?: Pick<
    Product,
    | "id"
    | "name"
    | "slug"
    | "mrp"
    | "sellingPrice"
    | "primaryImage"
    | "prescriptionRequired"
  > & {
    brand?: { name: string } | null;
    images?: Array<{ imagePath: string; isPrimary?: boolean; altText?: string | null }>;
  } | null;
}

/** A customer-submitted review (approved only, returned to the public site). */
export interface Review {
  id: string;
  authorName: string;
  rating: number;
  title: string | null;
  body: string | null;
  /** Customer-uploaded image URLs (max 6 per review). Empty when no images. */
  images?: string[];
  createdAt: string;
  verifiedBuyer: boolean;
  // Admin reply — present when a pharmacy admin has responded to this review.
  adminReply?: string | null;
  adminReplyAt?: string | null;
}

/** A product saved to the customer's wishlist, with full product detail. */
export interface WishlistProduct extends Product {
  wishedAt: string;
}

/** A single loyalty transaction (earn / redeem / adjust) audit row. */
export interface LoyaltyTransaction {
  id: string;
  customerId: string;
  type: "earn" | "redeem" | "adjust";
  points: number; // positive for earn, negative for redeem/adjust
  balance: number;
  reason: string;
  orderId?: string | null;
  createdAt: string;
}

/** Response shape from GET /api/customer/loyalty. */
export interface LoyaltyInfo {
  balance: number;
  balanceValue: number; // Rs. value of the balance (1 pt = Rs. 1)
  transactions: LoyaltyTransaction[];
}

/** Response shape from POST /api/customer/loyalty/redeem (preview). */
export interface LoyaltyRedeemPreview {
  valid: boolean;
  points: number;
  discount: number;
  remainingBalance: number;
}

// ---------------------------------------------------------------------------
// Unified customer history — returned by GET /api/customer/history. Merges
// orders, prescriptions, and manual requests into a single timeline so the
// customer's "My Activity" view can show everything in one place. Each item
// is normalized to a common shape with a discriminated `type` field.
// ---------------------------------------------------------------------------
export type UnifiedHistoryItem =
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
        items: Array<{
          id: string;
          name: string;
          qty: number;
          image?: string | null;
          lineTotal: number;
        }>;
        source?: string | null;
        prescriptionId?: string | null;
        manualRequestId?: string | null;
      };
    }
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

/** Response envelope from GET /api/customer/history. */
export interface UnifiedHistoryResponse {
  items: UnifiedHistoryItem[];
  total: number;
}

// ---------------------------------------------------------------------------
// Medicine Reminders — customer-created reminders to take medicines on
// schedule. Returned by GET /api/customer/reminders.
// ---------------------------------------------------------------------------

export interface MedicineReminder {
  id: string;
  customerId: string;
  productName: string;
  dosage?: string | null;
  frequency: "daily" | "twice-daily" | "weekly" | "custom";
  /** JSON-encoded array of "HH:MM" strings: ["08:00", "20:00"].
   *  Parsed into `timesList` by the consumer when needed. */
  times: string;
  startDate: string;
  endDate?: string | null;
  isActive: boolean;
  lastReminder?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Prescription Refill Reminders — auto-created when an Rx order is delivered.
// Returned by GET /api/customer/refill-reminders.
// ---------------------------------------------------------------------------

export interface RefillReminder {
  id: string;
  customerId: string;
  productId: string;
  orderId?: string | null;
  lastOrdered: string;
  nextRefillDate: string;
  daysSupply: number;
  isActive: boolean;
  notifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  product?: Pick<
    Product,
    | "id"
    | "name"
    | "slug"
    | "primaryImage"
    | "sellingPrice"
    | "mrp"
    | "stock"
    | "prescriptionRequired"
  > & {
    brand?: { id: string; name: string } | null;
  } | null;
}
