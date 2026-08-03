// ============================================================================
// File: src/lib/constants.ts
// Purpose: Centralized constants for the PMS platform (statuses, roles,
//          payment methods, channels, default settings).
// Role: Single source of truth for string literals used across the app so
//       that we never hardcode status values in business logic.
// ============================================================================

export const ORDER_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  PACKED: "packed",
  OUT_FOR_DELIVERY: "out_for_delivery",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
  RETURNED: "returned",
} as const;

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  packed: "Packed",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

export const ORDER_STATUS_FLOW: string[] = [
  "pending",
  "confirmed",
  "packed",
  "out_for_delivery",
  "delivered",
];

export const PAYMENT_METHOD = {
  COD: "cod",
  QR: "qr",
  UPI: "upi",
  ONLINE: "online",
} as const;

// NOTE: For server-side label resolution, use `getPaymentLabel()` from
// `@/lib/payment-methods` — it reads the admin-configured PaymentMethod table.
// This static map is only a client-side fallback for quick rendering.
export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cod: "Cash on Delivery",
  qr: "QR Code Payment",
  upi: "UPI Payment",
  online: "Online Payment",
  razorpay: "Razorpay",
  cashfree: "Cashfree",
};

export const PAYMENT_STATUS = {
  PENDING: "pending",
  PAID: "paid",
  FAILED: "failed",
  REFUNDED: "refunded",
} as const;

export const PRESCRIPTION_STATUS = {
  PENDING: "pending",
  UNDER_REVIEW: "under_review",
  VERIFIED: "verified",
  CONVERTED: "converted",
  REJECTED: "rejected",
} as const;

export const MANUAL_REQUEST_STATUS = {
  PENDING: "pending",
  UNDER_REVIEW: "under_review",
  VERIFIED: "verified",
  CONVERTED: "converted",
  REJECTED: "rejected",
} as const;

/// Human-readable labels for prescription & manual request statuses —
/// shared by the customer-side unified history cards and the admin
/// PrescriptionsView / ManualRequestsView.
export const RX_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  under_review: "Under Review",
  verified: "Approved",
  converted: "Converted",
  rejected: "Rejected",
};

export const ADMIN_ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  MANAGER: "manager",
} as const;

/// Granular admin permission keys. Each key gates a section of the admin panel
/// (sidebar nav + the underlying API endpoints). `super_admin` role implicitly
/// has ALL permissions regardless of the `permissions` field on the Admin row;
/// for non-super_admin admins the field is a JSON-encoded array of these keys.
/// Keep this list in sync with NAV_GROUPS in src/components/admin/AdminLayout.tsx
/// and the permission helper in src/lib/permissions.ts.
export const ADMIN_PERMISSIONS = [
  "dashboard",
  // Catalog
  "products",
  "categories",
  "brands",
  // Sales
  "orders",
  "prescriptions",
  "manual-requests",
  "customers",
  "reviews",
  // Marketing
  "offers",
  "deals",
  "campaigns",
  "ai-marketing",
  "vouchers",
  "newsletter",
  "app-notifications",
  "templates",
  // Operations
  "delivery-zones",
  "payment-methods",
  "reports",
  // System
  "backups",
  "database",
  "error-logs",
  "settings",
  "admins",
] as const;

export type AdminPermissionKey = (typeof ADMIN_PERMISSIONS)[number];

/// Human-readable labels for each permission key — used by the AdminsView
/// Permissions dialog so the user sees "Products" instead of "products".
export const ADMIN_PERMISSION_LABELS: Record<AdminPermissionKey, string> = {
  dashboard: "Dashboard",
  products: "Products",
  categories: "Categories",
  brands: "Brands",
  orders: "Orders",
  prescriptions: "Prescriptions",
  "manual-requests": "Manual Requests",
  customers: "Customers",
  reviews: "Reviews",
  offers: "Offers & Banners",
  deals: "Today's Deals",
  campaigns: "Campaigns",
  "ai-marketing": "AI Marketing",
  vouchers: "Vouchers",
  newsletter: "Newsletter",
  "app-notifications": "App Notifications",
  templates: "Templates",
  "delivery-zones": "Delivery Zones",
  "payment-methods": "Payment Methods",
  reports: "Reports",
  backups: "Backups",
  database: "Database",
  "error-logs": "Error Logs",
  settings: "Settings",
  admins: "Admins",
};

/// Logical module groupings used by the AdminsView permission editor to
/// render the toggle grid as labelled sections rather than a flat list.
/// Keys map 1-to-1 to ADMIN_PERMISSIONS entries (no orphans, no missing).
export const PERMISSION_GROUPS: {
  label: string;
  icon: string;
  permissions: AdminPermissionKey[];
}[] = [
  {
    label: "Overview",
    icon: "LayoutDashboard",
    permissions: ["dashboard"],
  },
  {
    label: "Catalog",
    icon: "Package",
    permissions: ["products", "categories", "brands"],
  },
  {
    label: "Sales",
    icon: "ShoppingCart",
    permissions: ["orders", "prescriptions", "manual-requests", "customers", "reviews"],
  },
  {
    label: "Marketing",
    icon: "Megaphone",
    permissions: [
      "offers",
      "deals",
      "campaigns",
      "ai-marketing",
      "vouchers",
      "newsletter",
      "app-notifications",
      "templates",
    ],
  },
  {
    label: "Operations",
    icon: "Truck",
    permissions: ["delivery-zones", "payment-methods", "reports"],
  },
  {
    label: "System",
    icon: "Settings",
    permissions: ["backups", "database", "error-logs", "settings", "admins"],
  },
];

export const NOTIFICATION_CHANNELS = {
  EMAIL: "email",
  WHATSAPP: "whatsapp",
} as const;

export const DISCOUNT_TYPES = {
  PRODUCT: "product",
  CATEGORY: "category",
  CART: "cart",
  GENERIC: "generic",
  PROMOTIONAL: "promotional",
} as const;

export const COUPON_TYPES = {
  PERCENTAGE: "percentage",
  FLAT: "flat",
} as const;

export const PRODUCT_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  DRAFT: "draft",
} as const;

// ---------------------------------------------------------------------------
// Default hero configuration. Stored as one JSON blob under the `hero.config`
// Setting key. Mirrors the HeroConfig interface in src/components/customer/api.ts.
// Every major sub-component has an `enabled` toggle so admins can turn pieces
// on/off without code changes. Arrays (cards, trustFeatures) support future
// expansion directly from the Admin Panel.
// ---------------------------------------------------------------------------
export const DEFAULT_HERO_CONFIG = {
  // — General —
  enabled: true,
  layout: "split-left",          // split-left | split-right | centered | full-bg
  stylePreset: "emerald",        // emerald | teal | midnight | sunrise | custom
  height: "lg",                  // sm | md | lg | xl
  contentAlign: "left",          // left | center
  bgOverlay: 40,                 // 0-100 dark overlay over background image
  borderRadius: 24,              // px
  sectionSpacing: "normal",      // compact | normal | relaxed
  animationsEnabled: true,

  // — Background —
  bgImageEnabled: false,
  bgImageDesktop: "",
  bgImageTablet: "",
  bgImageMobile: "",
  bgColor: "#047857",
  gradientEnabled: true,
  gradientFrom: "#047857",       // emerald-700
  gradientVia: "#059669",        // emerald-600
  gradientTo: "#0f766e",         // teal-700
  bgPattern: "dots",             // none | dots | grid | waves
  bgOpacity: 100,                // 0-100 opacity of the color/gradient layer
  videoBgEnabled: false,         // future-ready
  videoBgUrl: "",

  // — Content —
  heading: "Your trusted pharmacy,",
  headingHighlight: "delivered to your door.",
  subheading: "",
  description:
    "Order genuine medicines online in Mathura. Fast delivery, easy returns, and licensed pharmacists you can trust.",
  promoBadgeEnabled: true,
  promoBadgeText: "New Customer Offer",
  offerBadgeEnabled: true,
  offerText: "Flat ₹100 off on your first order",
  discountLabel: "Use code WELCOME100",
  deliveryInfoEnabled: true,
  deliveryInfoText: "Free delivery on orders above ₹499 · Same-day in Mathura",
  noticeText: "Licensed pharmacy · Verified by qualified pharmacists",

  // — Buttons —
  ctaEnabled: true,
  primaryCtaText: "Shop Now",
  primaryCtaUrl: "shop",
  primaryCtaIcon: "ArrowRight",
  secondaryCtaText: "Upload Prescription",
  secondaryCtaUrl: "prescription",
  secondaryCtaIcon: "FileText",
  buttonStyle: "solid",          // solid | outline | gradient

  // — Search —
  searchEnabled: true,
  searchPlaceholder: "Search medicines, brands...",
  popularSearches: "Paracetamol, Vitamin C, Diabetes, Blood Pressure, Antibiotics, Cough & Cold",

  // — Hero Cards (dynamic array) —
  cardsEnabled: true,
  cards: [
    {
      id: "card-rx",
      enabled: true,
      icon: "FileText",
      title: "Upload Prescription",
      description: "We verify & deliver",
      link: "prescription",
      displayOrder: 1,
    },
    {
      id: "card-manual",
      enabled: true,
      icon: "ClipboardList",
      title: "Request Medicines",
      description: "Can't find it? Ask us",
      link: "manual-request",
      displayOrder: 2,
    },
    {
      id: "card-catalog",
      enabled: true,
      icon: "Pill",
      title: "Browse Catalog",
      description: "All medicines & wellness",
      link: "shop",
      displayOrder: 3,
    },
    {
      id: "card-track",
      enabled: true,
      icon: "RefreshCw",
      title: "Track My Order",
      description: "Real-time status",
      link: "orders",
      displayOrder: 4,
    },
  ],

  // — Trust Features (dynamic array) —
  trustEnabled: true,
  trustFeatures: [
    {
      id: "trust-genuine",
      enabled: true,
      icon: "ShieldCheck",
      title: "Genuine Medicines",
      description: "Licensed sourcing",
      displayOrder: 1,
    },
    {
      id: "trust-delivery",
      enabled: true,
      icon: "Truck",
      title: "Fast Delivery",
      description: "Same-day in Mathura",
      displayOrder: 2,
    },
    {
      id: "trust-pharmacy",
      enabled: true,
      icon: "BadgeCheck",
      title: "Verified Pharmacy",
      description: "Drug license",
      displayOrder: 3,
    },
    {
      id: "trust-secure",
      enabled: true,
      icon: "Lock",
      title: "Secure Payments",
      description: "SSL encrypted",
      displayOrder: 4,
    },
  ],

  // — Promotional Banner —
  promoBannerEnabled: false,
  promoBannerImage: "",
  promoBannerTitle: "",
  promoBannerDesc: "",
  promoBannerCtaText: "",
  promoBannerCtaUrl: "shop",
  promoBannerStart: "",
  promoBannerEnd: "",

  // — Announcement Bar —
  announcementEnabled: true,
  announcementText: "🚚 Free delivery on orders above ₹499 across Mathura · Same-day delivery available",
  announcementLink: "shop",
  announcementStart: "",
  announcementEnd: "",

  // — SEO —
  seoHeading: "Pradeep Medical Store — Online Pharmacy in Mathura",
  seoKeywords: "online pharmacy Mathura, medicine delivery, prescription upload, buy medicines online",
  seoDescription:
    "Order genuine medicines online in Mathura with fast delivery. Upload prescription, request medicines, track orders.",
  imageAltText: "Pradeep Medical Store online pharmacy hero banner",
};

/// Default settings seeded into the Setting table. Admin can override all.
export const DEFAULT_SETTINGS: Record<string, { value: any; category: string }> = {
  // Store
  "store.name": { value: "Pradeep Medical Store", category: "store" },
  "store.tagline": { value: "Your Trusted Pharmacy in Mathura", category: "store" },
  "store.email": { value: "care@pradeepmedical.com", category: "store" },
  "store.phone": { value: "+91 99999 99999", category: "store" },
  "store.address": {
    value: "Main Market, Mathura, Uttar Pradesh 281001",
    category: "store",
  },
  "store.gstNumber": { value: "09XXXXXXXXXX1ZX", category: "store" },
  "store.logo": { value: "", category: "store" },
  "store.openStatus": { value: true, category: "store" },
  "store.openTime": { value: "08:00", category: "store" },
  "store.closeTime": { value: "22:00", category: "store" },
  // Weekly schedule: each day can have different hours or be closed.
  // Format: { mon: {open:"09:00",close:"20:00",closed:false}, ... }
  "store.weeklySchedule": { value: {
    mon: { open: "09:00", close: "20:00", closed: false },
    tue: { open: "09:00", close: "20:00", closed: false },
    wed: { open: "09:00", close: "20:00", closed: false },
    thu: { open: "09:00", close: "20:00", closed: false },
    fri: { open: "09:00", close: "20:00", closed: false },
    sat: { open: "09:00", close: "20:00", closed: false },
    sun: { open: "09:00", close: "11:00", closed: false },
  }, category: "store" },
  // Holidays: array of {date: "2026-08-15", name: "Independence Day"}
  "store.holidays": { value: [], category: "store" },
  "store.closedMessage": {
    value: "We are currently closed. You can still browse, but checkout is disabled. We will process your order when we reopen.",
    category: "store",
  },
  "store.licenseNumber": { value: "UP-ML-XXXXXX", category: "store" },

  // Hero section (home page) — stored as a single JSON blob under `hero.config`
  // so the entire object updates atomically and supports arrays (cards,
  // trustFeatures). See DEFAULT_HERO_CONFIG below for the full shape.
  "hero.config": { value: DEFAULT_HERO_CONFIG, category: "hero" },

  // Discount — margin-protected model
  // When the cart subtotal (after product discounts, before voucher/delivery)
  // reaches this threshold, products with baseDiscountPct < maxDiscountPct get
  // automatically upgraded to their maxDiscountPct (reserve margin released).
  // 0 = feature disabled (products always stay at baseDiscountPct).
  "discount.cartThresholdForUpgrade": { value: 0, category: "discount" },

  // SMTP
  "smtp.enabled": { value: false, category: "smtp" },
  "smtp.host": { value: "smtp.gmail.com", category: "smtp" },
  "smtp.port": { value: 587, category: "smtp" },
  "smtp.username": { value: "", category: "smtp" },
  "smtp.password": { value: "", category: "smtp" },
  "smtp.senderName": { value: "Pradeep Medical Store", category: "smtp" },
  "smtp.senderEmail": { value: "care@pradeepmedical.com", category: "smtp" },

  // Payment
  "payment.onlineEnabled": { value: false, category: "payment" },
  "payment.codEnabled": { value: true, category: "payment" },
  "payment.razorpayKeyId": { value: "", category: "payment" },
  "payment.razorpayKeySecret": { value: "", category: "payment" },
  "payment.razorpayEnabled": { value: false, category: "payment" },
  "payment.cashfreeAppId": { value: "", category: "payment" },
  "payment.cashfreeSecretKey": { value: "", category: "payment" },
  "payment.cashfreeEnabled": { value: false, category: "payment" },

  // Subscribe & Save has been removed from the platform (subscription model
  // deleted from Prisma schema). These settings keys are no longer used.

  // Invoice
  "invoice.prefix": { value: "PMS", category: "invoice" },
  "invoice.showGst": { value: true, category: "invoice" },
  "invoice.footerNote": {
    value: "Thank you for choosing Pradeep Medical Store. Medicines once sold cannot be returned as per Drug Rules.",
    category: "invoice",
  },

  // SEO
  "seo.title": {
    value: "Pradeep Medical Store - Online Pharmacy in Mathura",
    category: "seo",
  },
  "seo.description": {
    value: "Order medicines online in Mathura with fast delivery. Upload prescription or request medicines manually.",
    category: "seo",
  },
  "seo.keywords": {
    value: "pharmacy, medicine, mathura, online pharmacy, prescription",
    category: "seo",
  },

  // Theme — full customization palette
  "theme.primaryColor": { value: "#059669", category: "theme" },
  "theme.accentColor": { value: "#0d9488", category: "theme" },
  "theme.backgroundColor": { value: "#ffffff", category: "theme" },
  "theme.cardColor": { value: "#ffffff", category: "theme" },
  "theme.textColor": { value: "#1a2e25", category: "theme" },
  "theme.mutedColor": { value: "#f0fdf4", category: "theme" },
  "theme.borderColor": { value: "#d1fae5", category: "theme" },
  "theme.sidebarColor": { value: "#f7fdf9", category: "theme" },
  "theme.fontFamily": { value: "Geist, sans-serif", category: "theme" },
  "theme.borderRadius": { value: "0.75rem", category: "theme" },

  // Admin notification settings — single Global Admin Email for ALL admin alerts.
  // Configurable from Admin → Settings → Notifications.
  "admin.notificationEmail": { value: "", category: "notification" },
  "admin.emailAlertsEnabled": { value: true, category: "notification" },
  "admin.alertOnNewOrder": { value: true, category: "notification" },
  "admin.alertOnNewPrescription": { value: true, category: "notification" },
  "admin.alertOnNewManualRequest": { value: true, category: "notification" },
  "admin.alertOnOrderStatusUpdate": { value: false, category: "notification" },
  "admin.alertOnPaymentUpdate": { value: true, category: "notification" },
  "admin.alertOnSystemAlert": { value: true, category: "notification" },

  // Auth
  "auth.otpExpiryMinutes": { value: 10, category: "general" },
  "auth.requireOtpOnRegister": { value: true, category: "general" },
  "auth.requireOtpOnLogin": { value: true, category: "general" },
};

/// Notification template defaults. Seeded into NotificationTemplate table.
///
/// All template bodies are generated through `darkEmailTemplate()` so they
/// share a consistent premium DARK theme:
///   • Slate-900 page background (#0f172a) + slate-800 card (#1e293b)
///   • Emerald→teal gradient header (#059669 → #0d9488) with store name
///   • Inline CSS only (Gmail/Outlook strip <style> blocks)
///   • Table-based 600px layout — the most reliable pattern for cross-client
///     rendering across Gmail / Outlook / Apple Mail / Yahoo
///   • System font stack so no external font loads are required
///   • Dark-mode meta tags (color-scheme + supported-color-schemes + theme-color)
///     so email clients that respect OS dark-mode preferences render correctly
///   • Footer with store contact info on a darker slate band
/// All {{variables}} are replaced at send time by renderTemplate().
function darkEmailTemplate(opts: { eyebrow: string; content: string }): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <meta name="theme-color" content="#0f172a" />
  <title>${opts.eyebrow}</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#1e293b;border:1px solid #334155;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.35);">
        <tr>
          <td style="background:linear-gradient(135deg,#059669 0%,#0d9488 100%);padding:28px 32px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.3px;"><span style="vertical-align:middle;margin-right:8px;font-size:26px;">&#128138;</span> Pradeep Medical Store</div>
            <div style="font-size:12px;color:#d1fae5;margin-top:6px;letter-spacing:1.5px;text-transform:uppercase;">${opts.eyebrow}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            ${opts.content}
          </td>
        </tr>
        <tr>
          <td style="background-color:#0f172a;padding:24px 32px;border-top:1px solid #334155;">
            <p style="margin:0 0 8px 0;font-size:13px;color:#cbd5e1;line-height:1.5;"><strong style="color:#10b981;">Pradeep Medical Store</strong><br />Main Market, Mathura, Uttar Pradesh 281001<br />Phone: +91 99999 99999 &middot; Email: care@pradeepmedical.com</p>
            <p style="margin:0;font-size:12px;color:#64748b;line-height:1.5;">&copy; Pradeep Medical Store. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export const DEFAULT_TEMPLATES: Array<{
  key: string;
  name: string;
  channel: string;
  subject: string;
  body: string;
  variables: string[];
}> = [
  // ---- Customer Email Templates ----
  // Professional, responsive HTML emails with inline CSS (Gmail/Outlook strip
  // <style> blocks). 600px max-width table layout — the most reliable pattern
  // for cross-client rendering. Brand colors: emerald-600 #059669 + teal-600
  // #0d9488. All {{variables}} are replaced at send time by renderTemplate().
  {
    key: "registration_otp",
    name: "Registration OTP",
    channel: "email",
    subject: "Your PMS Registration OTP - {{otp}}",
    variables: ["name", "otp", "expiry"],
    body: darkEmailTemplate({
      eyebrow: "Verify Your Email",
      content: `<h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#f1f5f9;">Hello {{name}},</h1>
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.65;color:#cbd5e1;">Welcome to Pradeep Medical Store! Please use the OTP below to verify your email address and complete your registration.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr><td align="center" style="background-color:#0f172a;border:1px dashed #10b981;border-radius:12px;padding:20px;">
    <div style="font-size:32px;font-weight:700;letter-spacing:8px;color:#10b981;">{{otp}}</div>
    <div style="font-size:12px;color:#94a3b8;margin-top:8px;text-transform:uppercase;letter-spacing:1px;">Your Verification Code</div>
  </td></tr>
</table>
<p style="margin:0;font-size:14px;color:#cbd5e1;line-height:1.65;">This OTP is valid for <strong style="color:#10b981;">{{expiry}} minutes</strong>. If you did not request this, please ignore this email.</p>`,
    }),
  },
  {
    key: "login_otp",
    name: "Login OTP",
    channel: "email",
    subject: "Your PMS Login OTP - {{otp}}",
    variables: ["name", "otp", "expiry"],
    body: darkEmailTemplate({
      eyebrow: "Login Verification",
      content: `<h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#f1f5f9;">Hello {{name}},</h1>
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.65;color:#cbd5e1;">Use the OTP below to securely log in to your Pradeep Medical Store account.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr><td align="center" style="background-color:#0f172a;border:1px dashed #10b981;border-radius:12px;padding:20px;">
    <div style="font-size:32px;font-weight:700;letter-spacing:8px;color:#10b981;">{{otp}}</div>
    <div style="font-size:12px;color:#94a3b8;margin-top:8px;text-transform:uppercase;letter-spacing:1px;">Your Login Code</div>
  </td></tr>
</table>
<p style="margin:0;font-size:14px;color:#cbd5e1;line-height:1.65;">This OTP is valid for <strong style="color:#10b981;">{{expiry}} minutes</strong>. If you did not attempt to log in, please secure your account and contact us immediately.</p>`,
    }),
  },
  {
    key: "order_confirmed",
    name: "Order Confirmed",
    channel: "email",
    subject: "Order Confirmed - {{orderNumber}}",
    variables: ["name", "orderNumber", "amount", "paymentMethod"],
    body: darkEmailTemplate({
      eyebrow: "Order Confirmed",
      content: `<h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#f1f5f9;">Hello {{name}},</h1>
<p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#cbd5e1;">Thank you for your order! We've received your order and it's now being processed. Here's a summary of your purchase:</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;margin-bottom:24px;">
  <tr><td style="padding:14px 20px;border-bottom:1px solid #334155;font-size:14px;color:#94a3b8;">Order Number</td><td style="padding:14px 20px;border-bottom:1px solid #334155;font-size:14px;font-weight:600;color:#f1f5f9;text-align:right;">{{orderNumber}}</td></tr>
  <tr><td style="padding:14px 20px;border-bottom:1px solid #334155;font-size:14px;color:#94a3b8;">Order Total</td><td style="padding:14px 20px;border-bottom:1px solid #334155;font-size:14px;font-weight:700;color:#10b981;text-align:right;">Rs. {{amount}}</td></tr>
  <tr><td style="padding:14px 20px;font-size:14px;color:#94a3b8;">Payment Method</td><td style="padding:14px 20px;font-size:14px;font-weight:600;color:#f1f5f9;text-align:right;">{{paymentMethod}}</td></tr>
</table>
<p style="margin:0;font-size:14px;color:#cbd5e1;line-height:1.65;">We will notify you when your order is packed and out for delivery. If you have any questions, feel free to reach out to us.</p>`,
    }),
  },
  {
    key: "order_packed",
    name: "Order Packed",
    channel: "email",
    subject: "Your Order is Packed - {{orderNumber}}",
    variables: ["name", "orderNumber"],
    body: darkEmailTemplate({
      eyebrow: "Order Packed",
      content: `<h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#f1f5f9;">Hello {{name}},</h1>
<p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#cbd5e1;">Good news! Your order has been carefully packed by our pharmacy team and is ready for dispatch.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;border-left:4px solid #10b981;border-radius:8px;margin-bottom:24px;">
  <tr><td style="padding:16px 20px;font-size:14px;color:#d1fae5;">
    <strong>Order Number:</strong> {{orderNumber}}<br />
    <strong>Status:</strong> Packed &mdash; Dispatching Soon
  </td></tr>
</table>
<p style="margin:0;font-size:14px;color:#cbd5e1;line-height:1.65;">We'll notify you as soon as your order is out for delivery. Thank you for choosing Pradeep Medical Store.</p>`,
    }),
  },
  {
    key: "order_out_for_delivery",
    name: "Out for Delivery",
    channel: "email",
    subject: "Out for Delivery - {{orderNumber}}",
    variables: ["name", "orderNumber"],
    body: darkEmailTemplate({
      eyebrow: "Out for Delivery",
      content: `<h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#f1f5f9;">Hello {{name}},</h1>
<p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#cbd5e1;">Your order is on its way! Our delivery executive is heading to your address and will reach you shortly.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;border-left:4px solid #10b981;border-radius:8px;margin-bottom:24px;">
  <tr><td style="padding:16px 20px;font-size:14px;color:#d1fae5;">
    <strong>Order Number:</strong> {{orderNumber}}<br />
    <strong>Status:</strong> Out for Delivery
  </td></tr>
</table>
<p style="margin:0;font-size:14px;color:#cbd5e1;line-height:1.65;">Please keep your phone handy &mdash; our delivery executive may call you to confirm your location. Thank you for choosing Pradeep Medical Store.</p>`,
    }),
  },
  {
    key: "order_delivered",
    name: "Order Delivered",
    channel: "email",
    subject: "Order Delivered - {{orderNumber}}",
    variables: ["name", "orderNumber"],
    body: darkEmailTemplate({
      eyebrow: "Order Delivered",
      content: `<h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#f1f5f9;">Hello {{name}},</h1>
<p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#cbd5e1;">Great news! Your order has been successfully delivered. Thank you for shopping with Pradeep Medical Store &mdash; we hope to serve you again soon.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;border-left:4px solid #10b981;border-radius:8px;margin-bottom:24px;">
  <tr><td style="padding:16px 20px;font-size:14px;color:#d1fae5;">
    <strong>Order Number:</strong> {{orderNumber}}<br />
    <strong>Status:</strong> Delivered
  </td></tr>
</table>
<p style="margin:0 0 24px 0;font-size:14px;color:#cbd5e1;line-height:1.65;">We'd love to hear your feedback! Your review helps other customers and helps us improve our service.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr><td align="center">
    <a href="https://pradeepmedical.com" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:linear-gradient(135deg,#059669 0%,#0d9488 100%);color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;">Share Your Feedback</a>
  </td></tr>
</table>`,
    }),
  },
  {
    key: "order_cancelled",
    name: "Order Cancelled",
    channel: "email",
    subject: "Order Cancelled - {{orderNumber}}",
    variables: ["name", "orderNumber", "reason"],
    body: darkEmailTemplate({
      eyebrow: "Order Cancelled",
      content: `<h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#f1f5f9;">Hello {{name}},</h1>
<p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#cbd5e1;">Your order has been cancelled as per your request or due to unforeseen circumstances. We're sorry for any inconvenience caused.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#3f1d1d;border-left:4px solid #ef4444;border-radius:8px;margin-bottom:24px;">
  <tr><td style="padding:16px 20px;font-size:14px;color:#fecaca;">
    <strong>Order Number:</strong> {{orderNumber}}<br />
    <strong>Status:</strong> Cancelled<br />
    <strong>Reason:</strong> {{reason}}
  </td></tr>
</table>
<p style="margin:0;font-size:14px;color:#cbd5e1;line-height:1.65;">If you have any questions about this cancellation or wish to place a new order, please don't hesitate to contact us. We're here to help.</p>`,
    }),
  },
  {
    key: "prescription_submitted",
    name: "Prescription Submitted",
    channel: "email",
    subject: "Prescription Received - Pradeep Medical Store",
    variables: ["name"],
    body: darkEmailTemplate({
      eyebrow: "Prescription Received",
      content: `<h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#f1f5f9;">Hello {{name}},</h1>
<p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#cbd5e1;">Thank you for uploading your prescription with Pradeep Medical Store. Our licensed pharmacists will review it shortly and verify the medicines against your doctor's instructions.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;border-left:4px solid #10b981;border-radius:8px;margin-bottom:24px;">
  <tr><td style="padding:16px 20px;font-size:14px;color:#d1fae5;">
    <strong>What happens next?</strong><br />
    1. Our pharmacist reviews your prescription<br />
    2. We add the verified medicines to your cart<br />
    3. You'll receive a notification once approved
  </td></tr>
</table>
<p style="margin:0;font-size:14px;color:#cbd5e1;line-height:1.65;">This process typically takes 30-60 minutes during business hours. If you have any urgent queries, please call us at +91 99999 99999.</p>`,
    }),
  },
  {
    key: "prescription_under_review",
    name: "Prescription Under Review",
    channel: "email",
    subject: "Prescription Under Review - Pradeep Medical Store",
    variables: ["name"],
    body: darkEmailTemplate({
      eyebrow: "Prescription Under Review",
      content: `<h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#f1f5f9;">Hello {{name}},</h1>
<p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#cbd5e1;">Good news! Our licensed pharmacist is now reviewing your prescription. We're verifying the medicines against your doctor's instructions and will update you shortly.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#3a2f12;border-left:4px solid #f59e0b;border-radius:8px;margin-bottom:24px;">
  <tr><td style="padding:16px 20px;font-size:14px;color:#fde68a;">
    <strong>Status:</strong> Under Review<br />
    <strong>What happens next:</strong> We'll either approve the prescription or reach out if we need more information.
  </td></tr>
</table>
<p style="margin:0;font-size:14px;color:#cbd5e1;line-height:1.65;">This process typically takes 30-60 minutes during business hours. For any urgent queries, please call us at +91 99999 99999.</p>`,
    }),
  },
  {
    key: "prescription_approved",
    name: "Prescription Approved",
    channel: "email",
    subject: "Prescription Approved - Pradeep Medical Store",
    variables: ["name"],
    body: darkEmailTemplate({
      eyebrow: "Prescription Approved",
      content: `<h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#f1f5f9;">Hello {{name}},</h1>
<p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#cbd5e1;">Great news! Your prescription has been reviewed and approved by our licensed pharmacist. The verified medicines have been added to your cart and are ready for checkout.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;border-left:4px solid #10b981;border-radius:8px;margin-bottom:24px;">
  <tr><td style="padding:16px 20px;font-size:14px;color:#d1fae5;">
    <strong>Status:</strong> Approved &amp; Ready for Checkout<br />
    <strong>Next Step:</strong> Complete your purchase to get your medicines delivered.
  </td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr><td align="center">
    <a href="https://pradeepmedical.com" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:linear-gradient(135deg,#059669 0%,#0d9488 100%);color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;">Complete Your Order</a>
  </td></tr>
</table>`,
    }),
  },
  {
    key: "prescription_completed",
    name: "Prescription Order Created",
    channel: "email",
    subject: "Your Prescription Order is Ready - Pradeep Medical Store",
    variables: ["name"],
    body: darkEmailTemplate({
      eyebrow: "Order Created",
      content: `<h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#f1f5f9;">Hello {{name}},</h1>
<p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#cbd5e1;">Your prescription has been converted into a complete order. Our team has prepared your medicines and the order is now being processed for delivery.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;border-left:4px solid #10b981;border-radius:8px;margin-bottom:24px;">
  <tr><td style="padding:16px 20px;font-size:14px;color:#d1fae5;">
    <strong>Status:</strong> Order Created<br />
    <strong>Next Step:</strong> You'll receive order status updates as we pack and dispatch your medicines.
  </td></tr>
</table>
<p style="margin:0;font-size:14px;color:#cbd5e1;line-height:1.65;">Thank you for choosing Pradeep Medical Store. If you have any questions, please call us at +91 99999 99999.</p>`,
    }),
  },
  {
    key: "prescription_rejected",
    name: "Prescription Rejected",
    channel: "email",
    subject: "Prescription Update - Pradeep Medical Store",
    variables: ["name", "reason"],
    body: darkEmailTemplate({
      eyebrow: "Prescription Update",
      content: `<h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#f1f5f9;">Hello {{name}},</h1>
<p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#cbd5e1;">We've reviewed your prescription, but unfortunately we're unable to process it at this time. Please see the reason below:</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#3f1d1d;border-left:4px solid #ef4444;border-radius:8px;margin-bottom:24px;">
  <tr><td style="padding:16px 20px;font-size:14px;color:#fecaca;">
    <strong>Status:</strong> Rejected<br />
    <strong>Reason:</strong> {{reason}}
  </td></tr>
</table>
<p style="margin:0;font-size:14px;color:#cbd5e1;line-height:1.65;">Please upload a clearer copy of your prescription or contact our pharmacy team for assistance. We're happy to help you get the medicines you need.</p>`,
    }),
  },
  {
    key: "manual_request_under_review",
    name: "Manual Medicine Request Under Review",
    channel: "email",
    subject: "Medicine Request Under Review - Pradeep Medical Store",
    variables: ["name"],
    body: darkEmailTemplate({
      eyebrow: "Request Under Review",
      content: `<h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#f1f5f9;">Hello {{name}},</h1>
<p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#cbd5e1;">Our pharmacy team is now reviewing the medicines you requested. We're checking availability and prices, and will update you shortly.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#3a2f12;border-left:4px solid #f59e0b;border-radius:8px;margin-bottom:24px;">
  <tr><td style="padding:16px 20px;font-size:14px;color:#fde68a;">
    <strong>Status:</strong> Under Review<br />
    <strong>What happens next:</strong> We'll either approve the request with prices, or reach out if any items are unavailable.
  </td></tr>
</table>
<p style="margin:0;font-size:14px;color:#cbd5e1;line-height:1.65;">This process typically takes 30-60 minutes during business hours. For any urgent queries, please call us at +91 99999 99999.</p>`,
    }),
  },
  {
    key: "manual_request_submitted",
    name: "Manual Medicine Request Submitted",
    channel: "email",
    subject: "Medicine Request Received - Pradeep Medical Store",
    variables: ["name", "medicineList"],
    body: darkEmailTemplate({
      eyebrow: "Medicine Request Received",
      content: `<h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#f1f5f9;">Hello {{name}},</h1>
<p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#cbd5e1;">Thank you for your medicine request. Our pharmacy team is reviewing the items you requested and will add the available medicines to your cart shortly.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;border:1px solid #334155;border-radius:8px;margin-bottom:24px;">
  <tr><td style="padding:16px 20px;font-size:14px;color:#94a3b8;border-bottom:1px solid #334155;font-weight:600;">Requested Medicines</td></tr>
  <tr><td style="padding:16px 20px;font-size:14px;color:#f1f5f9;line-height:1.65;">{{medicineList}}</td></tr>
</table>
<p style="margin:0;font-size:14px;color:#cbd5e1;line-height:1.65;">We'll notify you as soon as your request is processed. For any urgent queries, please call us at +91 99999 99999.</p>`,
    }),
  },
  {
    key: "manual_request_approved",
    name: "Manual Medicine Request Approved",
    channel: "email",
    subject: "Medicine Request Approved - Pradeep Medical Store",
    variables: ["name"],
    body: darkEmailTemplate({
      eyebrow: "Medicine Request Approved",
      content: `<h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#f1f5f9;">Hello {{name}},</h1>
<p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#cbd5e1;">Great news! Your medicine request has been approved by our pharmacy team. The verified medicines have been added to your cart and are ready for checkout.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;border-left:4px solid #10b981;border-radius:8px;margin-bottom:24px;">
  <tr><td style="padding:16px 20px;font-size:14px;color:#d1fae5;">
    <strong>Status:</strong> Approved &amp; Ready for Checkout<br />
    <strong>Next Step:</strong> Complete your purchase to get your medicines delivered.
  </td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr><td align="center">
    <a href="https://pradeepmedical.com" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:linear-gradient(135deg,#059669 0%,#0d9488 100%);color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;">Complete Your Order</a>
  </td></tr>
</table>`,
    }),
  },
  {
    key: "manual_request_completed",
    name: "Manual Request Order Created",
    channel: "email",
    subject: "Your Medicine Request Order is Ready - Pradeep Medical Store",
    variables: ["name"],
    body: darkEmailTemplate({
      eyebrow: "Order Created",
      content: `<h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#f1f5f9;">Hello {{name}},</h1>
<p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#cbd5e1;">Your medicine request has been converted into a complete order. Our team has prepared your medicines and the order is now being processed for delivery.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;border-left:4px solid #10b981;border-radius:8px;margin-bottom:24px;">
  <tr><td style="padding:16px 20px;font-size:14px;color:#d1fae5;">
    <strong>Status:</strong> Order Created<br />
    <strong>Next Step:</strong> You'll receive order status updates as we pack and dispatch your medicines.
  </td></tr>
</table>
<p style="margin:0;font-size:14px;color:#cbd5e1;line-height:1.65;">Thank you for choosing Pradeep Medical Store. If you have any questions, please call us at +91 99999 99999.</p>`,
    }),
  },
  {
    key: "manual_request_rejected",
    name: "Manual Medicine Request Rejected",
    channel: "email",
    subject: "Medicine Request Update - Pradeep Medical Store",
    variables: ["name", "reason"],
    body: darkEmailTemplate({
      eyebrow: "Medicine Request Update",
      content: `<h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#f1f5f9;">Hello {{name}},</h1>
<p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#cbd5e1;">We've reviewed your medicine request, but unfortunately we're unable to process it at this time. Please see the reason below:</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#3f1d1d;border-left:4px solid #ef4444;border-radius:8px;margin-bottom:24px;">
  <tr><td style="padding:16px 20px;font-size:14px;color:#fecaca;">
    <strong>Status:</strong> Rejected<br />
    <strong>Reason:</strong> {{reason}}
  </td></tr>
</table>
<p style="margin:0;font-size:14px;color:#cbd5e1;line-height:1.65;">For prescription medicines, please upload a valid prescription. Our pharmacy team is happy to assist you &mdash; call us at +91 99999 99999 for help.</p>`,
    }),
  },

  // ---- Admin Email Templates ----
  // These power the centralized admin notification system in
  // `src/lib/admin-notifications.ts`. Each one is editable from Admin →
  // Notification Templates → "Admin Email Templates" tab. The variables here
  // are documentation-only (the live admin-notifications module currently
  // sends pre-rendered HTML directly via SMTP), but they help the admin know
  // which placeholders could be used if they swap to template-based sending.
  {
    key: "admin_alert",
    name: "Admin Alert (General)",
    channel: "email",
    subject: "[PMS Alert] {{title}}",
    body: darkEmailTemplate({
      eyebrow: "Admin Alert",
      content: `<h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#f1f5f9;">{{title}}</h1>
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.65;color:#cbd5e1;">{{message}}</p>
<div style="font-size:14px;color:#94a3b8;line-height:1.65;">{{details}}</div>`,
    }),
    variables: ["title", "message", "details"],
  },
  {
    key: "admin_new_order",
    name: "Admin Alert — New Order",
    channel: "email",
    subject: "[PMS] New Order — {{orderNumber}}",
    body: darkEmailTemplate({
      eyebrow: "New Order Received",
      content: `<h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#f1f5f9;">&#128722; New Order Received</h1>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;margin-bottom:16px;">
  <tr><td style="padding:14px 20px;border-bottom:1px solid #334155;font-size:14px;color:#94a3b8;">Order</td><td style="padding:14px 20px;border-bottom:1px solid #334155;font-size:14px;font-weight:600;color:#f1f5f9;text-align:right;">{{orderNumber}}</td></tr>
  <tr><td style="padding:14px 20px;border-bottom:1px solid #334155;font-size:14px;color:#94a3b8;">Customer</td><td style="padding:14px 20px;border-bottom:1px solid #334155;font-size:14px;font-weight:600;color:#f1f5f9;text-align:right;">{{customerName}}</td></tr>
  <tr><td style="padding:14px 20px;border-bottom:1px solid #334155;font-size:14px;color:#94a3b8;">Total</td><td style="padding:14px 20px;border-bottom:1px solid #334155;font-size:14px;font-weight:700;color:#10b981;text-align:right;">Rs. {{amount}}</td></tr>
  <tr><td style="padding:14px 20px;font-size:14px;color:#94a3b8;">Payment Method</td><td style="padding:14px 20px;font-size:14px;font-weight:600;color:#f1f5f9;text-align:right;">{{paymentMethod}}</td></tr>
</table>
<div style="font-size:14px;color:#94a3b8;line-height:1.65;">{{details}}</div>`,
    }),
    variables: ["orderNumber", "customerName", "amount", "paymentMethod", "details"],
  },
  {
    key: "admin_new_prescription",
    name: "Admin Alert — New Prescription",
    channel: "email",
    subject: "[PMS] New Prescription Upload — {{customerName}}",
    body: darkEmailTemplate({
      eyebrow: "New Prescription Uploaded",
      content: `<h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#f1f5f9;">&#128203; New Prescription Uploaded</h1>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;margin-bottom:16px;">
  <tr><td style="padding:14px 20px;border-bottom:1px solid #334155;font-size:14px;color:#94a3b8;">Customer</td><td style="padding:14px 20px;border-bottom:1px solid #334155;font-size:14px;font-weight:600;color:#f1f5f9;text-align:right;">{{customerName}}</td></tr>
  <tr><td style="padding:14px 20px;font-size:14px;color:#94a3b8;">Ref ID</td><td style="padding:14px 20px;font-size:14px;font-weight:600;color:#f1f5f9;text-align:right;">{{refId}}</td></tr>
</table>
<div style="font-size:14px;color:#94a3b8;line-height:1.65;">{{details}}</div>`,
    }),
    variables: ["customerName", "refId", "details"],
  },
  {
    key: "admin_new_manual_request",
    name: "Admin Alert — New Manual Request",
    channel: "email",
    subject: "[PMS] New Manual Medicine Request — {{customerName}}",
    body: darkEmailTemplate({
      eyebrow: "New Manual Medicine Request",
      content: `<h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#f1f5f9;">&#128221; New Manual Medicine Request</h1>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;margin-bottom:16px;">
  <tr><td style="padding:14px 20px;border-bottom:1px solid #334155;font-size:14px;color:#94a3b8;">Customer</td><td style="padding:14px 20px;border-bottom:1px solid #334155;font-size:14px;font-weight:600;color:#f1f5f9;text-align:right;">{{customerName}}</td></tr>
  <tr><td style="padding:14px 20px;font-size:14px;color:#94a3b8;">Ref ID</td><td style="padding:14px 20px;font-size:14px;font-weight:600;color:#f1f5f9;text-align:right;">{{refId}}</td></tr>
</table>
<div style="font-size:14px;color:#94a3b8;line-height:1.65;">{{details}}</div>`,
    }),
    variables: ["customerName", "refId", "details"],
  },
  {
    key: "admin_order_status_update",
    name: "Admin Alert — Order Status Update",
    channel: "email",
    subject: "[PMS] Order {{orderNumber}} — Status changed to {{newStatus}}",
    body: darkEmailTemplate({
      eyebrow: "Order Status Updated",
      content: `<h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#f1f5f9;">&#128230; Order Status Updated</h1>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;margin-bottom:16px;">
  <tr><td style="padding:14px 20px;border-bottom:1px solid #334155;font-size:14px;color:#94a3b8;">Order</td><td style="padding:14px 20px;border-bottom:1px solid #334155;font-size:14px;font-weight:600;color:#f1f5f9;text-align:right;">{{orderNumber}}</td></tr>
  <tr><td style="padding:14px 20px;border-bottom:1px solid #334155;font-size:14px;color:#94a3b8;">Previous Status</td><td style="padding:14px 20px;border-bottom:1px solid #334155;font-size:14px;font-weight:600;color:#cbd5e1;text-align:right;">{{oldStatus}}</td></tr>
  <tr><td style="padding:14px 20px;font-size:14px;color:#94a3b8;">New Status</td><td style="padding:14px 20px;font-size:14px;font-weight:700;color:#10b981;text-align:right;">{{newStatus}}</td></tr>
</table>
<div style="font-size:14px;color:#94a3b8;line-height:1.65;">{{details}}</div>`,
    }),
    variables: ["orderNumber", "oldStatus", "newStatus", "details"],
  },
  {
    key: "admin_payment_update",
    name: "Admin Alert — Payment Update",
    channel: "email",
    subject: "[PMS] Order {{orderNumber}} — Payment {{paymentStatus}}",
    body: darkEmailTemplate({
      eyebrow: "Payment Update",
      content: `<h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#f1f5f9;">&#128179; Payment Update</h1>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;margin-bottom:16px;">
  <tr><td style="padding:14px 20px;border-bottom:1px solid #334155;font-size:14px;color:#94a3b8;">Order</td><td style="padding:14px 20px;border-bottom:1px solid #334155;font-size:14px;font-weight:600;color:#f1f5f9;text-align:right;">{{orderNumber}}</td></tr>
  <tr><td style="padding:14px 20px;border-bottom:1px solid #334155;font-size:14px;color:#94a3b8;">Payment Status</td><td style="padding:14px 20px;border-bottom:1px solid #334155;font-size:14px;font-weight:700;color:#10b981;text-align:right;">{{paymentStatus}}</td></tr>
  <tr><td style="padding:14px 20px;font-size:14px;color:#94a3b8;">Payment Method</td><td style="padding:14px 20px;font-size:14px;font-weight:600;color:#f1f5f9;text-align:right;">{{paymentMethod}}</td></tr>
</table>
<div style="font-size:14px;color:#94a3b8;line-height:1.65;">{{details}}</div>`,
    }),
    variables: ["orderNumber", "paymentStatus", "paymentMethod", "details"],
  },

  // ---- Payment Email Templates ----
  // Customer-facing payment lifecycle emails — triggered by the payment route
  // (src/app/api/admin/orders/[id]/payment/route.ts) as the order's payment
  // status changes. All use the same dark theme via darkEmailTemplate().
  {
    key: "payment_successful",
    name: "Payment Successful",
    channel: "email",
    subject: "\u2705 Payment Received \u2014 Order {{orderNumber}}",
    variables: ["name", "orderNumber", "orderAmount"],
    body: darkEmailTemplate({
      eyebrow: "Payment Received",
      content: `<h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#f1f5f9;">Hello {{name}},</h1>
<p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#cbd5e1;">We've successfully received your payment. Thank you for shopping with Pradeep Medical Store — your order is now being processed.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;border-left:4px solid #10b981;border-radius:8px;margin-bottom:24px;">
  <tr><td style="padding:16px 20px;font-size:14px;color:#d1fae5;">
    <strong>Order Number:</strong> {{orderNumber}}<br />
    <strong>Amount Paid:</strong> Rs. {{orderAmount}}<br />
    <strong>Status:</strong> Payment Received
  </td></tr>
</table>
<p style="margin:0;font-size:14px;color:#cbd5e1;line-height:1.65;">We'll notify you as soon as your order is packed and dispatched. If you have any questions, feel free to reach out to us.</p>`,
    }),
  },
  {
    key: "payment_failed",
    name: "Payment Failed",
    channel: "email",
    subject: "\u274C Payment Failed \u2014 Order {{orderNumber}}",
    variables: ["name", "orderNumber", "orderAmount"],
    body: darkEmailTemplate({
      eyebrow: "Payment Failed",
      content: `<h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#f1f5f9;">Hello {{name}},</h1>
<p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#cbd5e1;">We were unable to process your payment. No amount has been charged to your account. Please try again or use a different payment method.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#3f1d1d;border-left:4px solid #ef4444;border-radius:8px;margin-bottom:24px;">
  <tr><td style="padding:16px 20px;font-size:14px;color:#fecaca;">
    <strong>Order Number:</strong> {{orderNumber}}<br />
    <strong>Amount:</strong> Rs. {{orderAmount}}<br />
    <strong>Status:</strong> Payment Failed
  </td></tr>
</table>
<p style="margin:0;font-size:14px;color:#cbd5e1;line-height:1.65;">If you believe this is an error or need help completing your payment, please call us at +91 99999 99999 — we're here to help.</p>`,
    }),
  },
  {
    key: "refund_initiated",
    name: "Refund Initiated",
    channel: "email",
    subject: "\uD83D\uDCB8 Refund Initiated \u2014 Order {{orderNumber}}",
    variables: ["name", "orderNumber", "orderAmount"],
    body: darkEmailTemplate({
      eyebrow: "Refund Initiated",
      content: `<h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#f1f5f9;">Hello {{name}},</h1>
<p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#cbd5e1;">We've initiated a refund for your order. The amount will be credited back to your original payment method within 5-7 business days, depending on your bank.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#3a2f12;border-left:4px solid #f59e0b;border-radius:8px;margin-bottom:24px;">
  <tr><td style="padding:16px 20px;font-size:14px;color:#fde68a;">
    <strong>Order Number:</strong> {{orderNumber}}<br />
    <strong>Refund Amount:</strong> Rs. {{orderAmount}}<br />
    <strong>Status:</strong> Refund Initiated
  </td></tr>
</table>
<p style="margin:0;font-size:14px;color:#cbd5e1;line-height:1.65;">If you have any questions about the refund, please contact our support team at care@pradeepmedical.com.</p>`,
    }),
  },
  {
    key: "refund_completed",
    name: "Refund Completed",
    channel: "email",
    subject: "\u2705 Refund Completed \u2014 Order {{orderNumber}}",
    variables: ["name", "orderNumber", "orderAmount"],
    body: darkEmailTemplate({
      eyebrow: "Refund Completed",
      content: `<h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#f1f5f9;">Hello {{name}},</h1>
<p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#cbd5e1;">Good news! Your refund has been successfully processed. The amount has been credited back to your original payment method.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;border-left:4px solid #10b981;border-radius:8px;margin-bottom:24px;">
  <tr><td style="padding:16px 20px;font-size:14px;color:#d1fae5;">
    <strong>Order Number:</strong> {{orderNumber}}<br />
    <strong>Refund Amount:</strong> Rs. {{orderAmount}}<br />
    <strong>Status:</strong> Refund Completed
  </td></tr>
</table>
<p style="margin:0;font-size:14px;color:#cbd5e1;line-height:1.65;">If you don't see the refund reflected in your account within 3 business days, please contact your bank or reach out to us at care@pradeepmedical.com.</p>`,
    }),
  },
];

export const OTP_LENGTH = 6;
export const TOKEN_EXPIRY_HOURS = 24 * 7; // 7 days
export const CART_COOKIE = "pms_session";
