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
  "products",
  "categories",
  "brands",
  "orders",
  "customers",
  "reviews",
  "reports",
  "delivery-zones",
  "offers",
  "vouchers",
  "loyalty",
  "notifications",
  "payment-methods",
  "settings",
  "templates",
  "newsletter",
  "deals",
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
  customers: "Customers",
  reviews: "Reviews",
  reports: "Reports",
  "delivery-zones": "Delivery Zones",
  offers: "Offers & Banners",
  vouchers: "Vouchers",
  loyalty: "Loyalty",
  notifications: "Notifications",
  "payment-methods": "Payment Methods",
  settings: "Settings",
  templates: "Templates",
  newsletter: "Newsletter",
  deals: "Today's Deals",
  admins: "Admins",
};

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
    body: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f4f6f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#059669 0%,#0d9488 100%);padding:24px 32px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.3px;"><span style="vertical-align:middle;margin-right:8px;font-size:26px;">&#128138;</span> Pradeep Medical Store</div>
            <div style="font-size:12px;color:#d1fae5;margin-top:6px;letter-spacing:1px;text-transform:uppercase;">Verify Your Email</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#111827;">Hello {{name}},</h1>
            <p style="margin:0 0 16px 0;font-size:15px;line-height:1.65;color:#374151;">Welcome to Pradeep Medical Store! Please use the OTP below to verify your email address and complete your registration.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
              <tr><td align="center" style="background-color:#ecfdf5;border:1px dashed #059669;border-radius:8px;padding:20px;">
                <div style="font-size:32px;font-weight:700;letter-spacing:8px;color:#059669;">{{otp}}</div>
                <div style="font-size:12px;color:#6b7280;margin-top:8px;text-transform:uppercase;letter-spacing:1px;">Your Verification Code</div>
              </td></tr>
            </table>
            <p style="margin:0;font-size:14px;color:#374151;line-height:1.65;">This OTP is valid for <strong>{{expiry}} minutes</strong>. If you did not request this, please ignore this email.</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f9fafb;padding:24px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0 0 8px 0;font-size:13px;color:#4b5563;line-height:1.5;"><strong>Pradeep Medical Store</strong><br />Main Market, Mathura, Uttar Pradesh 281001<br />Phone: +91 99999 99999 | Email: care@pradeepmedical.com</p>
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">&copy; Pradeep Medical Store. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  },
  {
    key: "login_otp",
    name: "Login OTP",
    channel: "email",
    subject: "Your PMS Login OTP - {{otp}}",
    variables: ["name", "otp", "expiry"],
    body: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f4f6f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#059669 0%,#0d9488 100%);padding:24px 32px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.3px;"><span style="vertical-align:middle;margin-right:8px;font-size:26px;">&#128274;</span> Pradeep Medical Store</div>
            <div style="font-size:12px;color:#d1fae5;margin-top:6px;letter-spacing:1px;text-transform:uppercase;">Login Verification</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#111827;">Hello {{name}},</h1>
            <p style="margin:0 0 16px 0;font-size:15px;line-height:1.65;color:#374151;">Use the OTP below to securely log in to your Pradeep Medical Store account.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
              <tr><td align="center" style="background-color:#ecfdf5;border:1px dashed #059669;border-radius:8px;padding:20px;">
                <div style="font-size:32px;font-weight:700;letter-spacing:8px;color:#059669;">{{otp}}</div>
                <div style="font-size:12px;color:#6b7280;margin-top:8px;text-transform:uppercase;letter-spacing:1px;">Your Login Code</div>
              </td></tr>
            </table>
            <p style="margin:0;font-size:14px;color:#374151;line-height:1.65;">This OTP is valid for <strong>{{expiry}} minutes</strong>. If you did not attempt to log in, please secure your account and contact us immediately.</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f9fafb;padding:24px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0 0 8px 0;font-size:13px;color:#4b5563;line-height:1.5;"><strong>Pradeep Medical Store</strong><br />Main Market, Mathura, Uttar Pradesh 281001<br />Phone: +91 99999 99999 | Email: care@pradeepmedical.com</p>
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">&copy; Pradeep Medical Store. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  },
  {
    key: "order_confirmed",
    name: "Order Confirmed",
    channel: "email",
    subject: "Order Confirmed - {{orderNumber}}",
    variables: ["name", "orderNumber", "amount", "paymentMethod"],
    body: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f4f6f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#059669 0%,#0d9488 100%);padding:24px 32px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.3px;"><span style="vertical-align:middle;margin-right:8px;font-size:26px;">&#128138;</span> Pradeep Medical Store</div>
            <div style="font-size:12px;color:#d1fae5;margin-top:6px;letter-spacing:1px;text-transform:uppercase;">Order Confirmed</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#111827;">Hello {{name}},</h1>
            <p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#374151;">Thank you for your order! We've received your order and it's now being processed. Here's a summary of your purchase:</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:24px;">
              <tr><td style="padding:16px 20px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#6b7280;">Order Number</td><td style="padding:16px 20px;border-bottom:1px solid #e5e7eb;font-size:14px;font-weight:600;color:#111827;text-align:right;">{{orderNumber}}</td></tr>
              <tr><td style="padding:16px 20px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#6b7280;">Order Total</td><td style="padding:16px 20px;border-bottom:1px solid #e5e7eb;font-size:14px;font-weight:600;color:#059669;text-align:right;">Rs. {{amount}}</td></tr>
              <tr><td style="padding:16px 20px;font-size:14px;color:#6b7280;">Payment Method</td><td style="padding:16px 20px;font-size:14px;font-weight:600;color:#111827;text-align:right;">{{paymentMethod}}</td></tr>
            </table>
            <p style="margin:0;font-size:14px;color:#374151;line-height:1.65;">We will notify you when your order is packed and out for delivery. If you have any questions, feel free to reach out to us.</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f9fafb;padding:24px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0 0 8px 0;font-size:13px;color:#4b5563;line-height:1.5;"><strong>Pradeep Medical Store</strong><br />Main Market, Mathura, Uttar Pradesh 281001<br />Phone: +91 99999 99999 | Email: care@pradeepmedical.com</p>
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">&copy; Pradeep Medical Store. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  },
  {
    key: "order_packed",
    name: "Order Packed",
    channel: "email",
    subject: "Your Order is Packed - {{orderNumber}}",
    variables: ["name", "orderNumber"],
    body: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f4f6f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#059669 0%,#0d9488 100%);padding:24px 32px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.3px;"><span style="vertical-align:middle;margin-right:8px;font-size:26px;">&#128230;</span> Pradeep Medical Store</div>
            <div style="font-size:12px;color:#d1fae5;margin-top:6px;letter-spacing:1px;text-transform:uppercase;">Order Packed</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#111827;">Hello {{name}},</h1>
            <p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#374151;">Good news! Your order has been carefully packed by our pharmacy team and is ready for dispatch.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ecfdf5;border-left:4px solid #059669;border-radius:6px;margin-bottom:24px;">
              <tr><td style="padding:16px 20px;font-size:14px;color:#065f46;">
                <strong>Order Number:</strong> {{orderNumber}}<br />
                <strong>Status:</strong> Packed &mdash; Dispatching Soon
              </td></tr>
            </table>
            <p style="margin:0;font-size:14px;color:#374151;line-height:1.65;">We'll notify you as soon as your order is out for delivery. Thank you for choosing Pradeep Medical Store.</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f9fafb;padding:24px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0 0 8px 0;font-size:13px;color:#4b5563;line-height:1.5;"><strong>Pradeep Medical Store</strong><br />Main Market, Mathura, Uttar Pradesh 281001<br />Phone: +91 99999 99999 | Email: care@pradeepmedical.com</p>
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">&copy; Pradeep Medical Store. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  },
  {
    key: "order_out_for_delivery",
    name: "Out for Delivery",
    channel: "email",
    subject: "Out for Delivery - {{orderNumber}}",
    variables: ["name", "orderNumber"],
    body: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f4f6f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#059669 0%,#0d9488 100%);padding:24px 32px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.3px;"><span style="vertical-align:middle;margin-right:8px;font-size:26px;">&#128666;</span> Pradeep Medical Store</div>
            <div style="font-size:12px;color:#d1fae5;margin-top:6px;letter-spacing:1px;text-transform:uppercase;">Out for Delivery</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#111827;">Hello {{name}},</h1>
            <p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#374151;">Your order is on its way! Our delivery executive is heading to your address and will reach you shortly.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ecfdf5;border-left:4px solid #059669;border-radius:6px;margin-bottom:24px;">
              <tr><td style="padding:16px 20px;font-size:14px;color:#065f46;">
                <strong>Order Number:</strong> {{orderNumber}}<br />
                <strong>Status:</strong> Out for Delivery
              </td></tr>
            </table>
            <p style="margin:0;font-size:14px;color:#374151;line-height:1.65;">Please keep your phone handy &mdash; our delivery executive may call you to confirm your location. Thank you for choosing Pradeep Medical Store.</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f9fafb;padding:24px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0 0 8px 0;font-size:13px;color:#4b5563;line-height:1.5;"><strong>Pradeep Medical Store</strong><br />Main Market, Mathura, Uttar Pradesh 281001<br />Phone: +91 99999 99999 | Email: care@pradeepmedical.com</p>
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">&copy; Pradeep Medical Store. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  },
  {
    key: "order_delivered",
    name: "Order Delivered",
    channel: "email",
    subject: "Order Delivered - {{orderNumber}}",
    variables: ["name", "orderNumber"],
    body: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f4f6f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#059669 0%,#0d9488 100%);padding:24px 32px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.3px;"><span style="vertical-align:middle;margin-right:8px;font-size:26px;">&#9989;</span> Pradeep Medical Store</div>
            <div style="font-size:12px;color:#d1fae5;margin-top:6px;letter-spacing:1px;text-transform:uppercase;">Order Delivered</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#111827;">Hello {{name}},</h1>
            <p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#374151;">Great news! Your order has been successfully delivered. Thank you for shopping with Pradeep Medical Store &mdash; we hope to serve you again soon.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ecfdf5;border-left:4px solid #059669;border-radius:6px;margin-bottom:24px;">
              <tr><td style="padding:16px 20px;font-size:14px;color:#065f46;">
                <strong>Order Number:</strong> {{orderNumber}}<br />
                <strong>Status:</strong> Delivered
              </td></tr>
            </table>
            <p style="margin:0 0 24px 0;font-size:14px;color:#374151;line-height:1.65;">We'd love to hear your feedback! Your review helps other customers and helps us improve our service.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center">
                <a href="https://pradeepmedical.com" target="_blank" rel="noopener noreferrer" style="display:inline-block;background-color:#059669;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;">Share Your Feedback</a>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f9fafb;padding:24px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0 0 8px 0;font-size:13px;color:#4b5563;line-height:1.5;"><strong>Pradeep Medical Store</strong><br />Main Market, Mathura, Uttar Pradesh 281001<br />Phone: +91 99999 99999 | Email: care@pradeepmedical.com</p>
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">&copy; Pradeep Medical Store. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  },
  {
    key: "order_cancelled",
    name: "Order Cancelled",
    channel: "email",
    subject: "Order Cancelled - {{orderNumber}}",
    variables: ["name", "orderNumber", "reason"],
    body: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f4f6f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#059669 0%,#0d9488 100%);padding:24px 32px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.3px;"><span style="vertical-align:middle;margin-right:8px;font-size:26px;">&#9940;</span> Pradeep Medical Store</div>
            <div style="font-size:12px;color:#d1fae5;margin-top:6px;letter-spacing:1px;text-transform:uppercase;">Order Cancelled</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#111827;">Hello {{name}},</h1>
            <p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#374151;">Your order has been cancelled as per your request or due to unforeseen circumstances. We're sorry for any inconvenience caused.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fef2f2;border-left:4px solid #dc2626;border-radius:6px;margin-bottom:24px;">
              <tr><td style="padding:16px 20px;font-size:14px;color:#991b1b;">
                <strong>Order Number:</strong> {{orderNumber}}<br />
                <strong>Status:</strong> Cancelled<br />
                <strong>Reason:</strong> {{reason}}
              </td></tr>
            </table>
            <p style="margin:0;font-size:14px;color:#374151;line-height:1.65;">If you have any questions about this cancellation or wish to place a new order, please don't hesitate to contact us. We're here to help.</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f9fafb;padding:24px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0 0 8px 0;font-size:13px;color:#4b5563;line-height:1.5;"><strong>Pradeep Medical Store</strong><br />Main Market, Mathura, Uttar Pradesh 281001<br />Phone: +91 99999 99999 | Email: care@pradeepmedical.com</p>
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">&copy; Pradeep Medical Store. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  },
  {
    key: "prescription_submitted",
    name: "Prescription Submitted",
    channel: "email",
    subject: "Prescription Received - Pradeep Medical Store",
    variables: ["name"],
    body: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f4f6f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#059669 0%,#0d9488 100%);padding:24px 32px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.3px;"><span style="vertical-align:middle;margin-right:8px;font-size:26px;">&#128221;</span> Pradeep Medical Store</div>
            <div style="font-size:12px;color:#d1fae5;margin-top:6px;letter-spacing:1px;text-transform:uppercase;">Prescription Received</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#111827;">Hello {{name}},</h1>
            <p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#374151;">Thank you for uploading your prescription with Pradeep Medical Store. Our licensed pharmacists will review it shortly and verify the medicines against your doctor's instructions.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ecfdf5;border-left:4px solid #059669;border-radius:6px;margin-bottom:24px;">
              <tr><td style="padding:16px 20px;font-size:14px;color:#065f46;">
                <strong>What happens next?</strong><br />
                1. Our pharmacist reviews your prescription<br />
                2. We add the verified medicines to your cart<br />
                3. You'll receive a notification once approved
              </td></tr>
            </table>
            <p style="margin:0;font-size:14px;color:#374151;line-height:1.65;">This process typically takes 30-60 minutes during business hours. If you have any urgent queries, please call us at +91 99999 99999.</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f9fafb;padding:24px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0 0 8px 0;font-size:13px;color:#4b5563;line-height:1.5;"><strong>Pradeep Medical Store</strong><br />Main Market, Mathura, Uttar Pradesh 281001<br />Phone: +91 99999 99999 | Email: care@pradeepmedical.com</p>
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">&copy; Pradeep Medical Store. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  },
  {
    key: "prescription_under_review",
    name: "Prescription Under Review",
    channel: "email",
    subject: "Prescription Under Review - Pradeep Medical Store",
    variables: ["name"],
    body: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f4f6f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#059669 0%,#0d9488 100%);padding:24px 32px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.3px;"><span style="vertical-align:middle;margin-right:8px;font-size:26px;">&#128269;</span> Pradeep Medical Store</div>
            <div style="font-size:12px;color:#d1fae5;margin-top:6px;letter-spacing:1px;text-transform:uppercase;">Prescription Under Review</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#111827;">Hello {{name}},</h1>
            <p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#374151;">Good news! Our licensed pharmacist is now reviewing your prescription. We're verifying the medicines against your doctor's instructions and will update you shortly.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fef3c7;border-left:4px solid #d97706;border-radius:6px;margin-bottom:24px;">
              <tr><td style="padding:16px 20px;font-size:14px;color:#92400e;">
                <strong>Status:</strong> Under Review<br />
                <strong>What happens next:</strong> We'll either approve the prescription or reach out if we need more information.
              </td></tr>
            </table>
            <p style="margin:0;font-size:14px;color:#374151;line-height:1.65;">This process typically takes 30-60 minutes during business hours. For any urgent queries, please call us at +91 99999 99999.</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f9fafb;padding:24px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0 0 8px 0;font-size:13px;color:#4b5563;line-height:1.5;"><strong>Pradeep Medical Store</strong><br />Main Market, Mathura, Uttar Pradesh 281001<br />Phone: +91 99999 99999 | Email: care@pradeepmedical.com</p>
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">&copy; Pradeep Medical Store. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  },
  {
    key: "prescription_approved",
    name: "Prescription Approved",
    channel: "email",
    subject: "Prescription Approved - Pradeep Medical Store",
    variables: ["name"],
    body: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f4f6f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#059669 0%,#0d9488 100%);padding:24px 32px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.3px;"><span style="vertical-align:middle;margin-right:8px;font-size:26px;">&#9989;</span> Pradeep Medical Store</div>
            <div style="font-size:12px;color:#d1fae5;margin-top:6px;letter-spacing:1px;text-transform:uppercase;">Prescription Approved</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#111827;">Hello {{name}},</h1>
            <p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#374151;">Great news! Your prescription has been reviewed and approved by our licensed pharmacist. The verified medicines have been added to your cart and are ready for checkout.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ecfdf5;border-left:4px solid #059669;border-radius:6px;margin-bottom:24px;">
              <tr><td style="padding:16px 20px;font-size:14px;color:#065f46;">
                <strong>Status:</strong> Approved &amp; Ready for Checkout<br />
                <strong>Next Step:</strong> Complete your purchase to get your medicines delivered.
              </td></tr>
            </table>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center">
                <a href="https://pradeepmedical.com" target="_blank" rel="noopener noreferrer" style="display:inline-block;background-color:#059669;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;">Complete Your Order</a>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f9fafb;padding:24px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0 0 8px 0;font-size:13px;color:#4b5563;line-height:1.5;"><strong>Pradeep Medical Store</strong><br />Main Market, Mathura, Uttar Pradesh 281001<br />Phone: +91 99999 99999 | Email: care@pradeepmedical.com</p>
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">&copy; Pradeep Medical Store. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  },
  {
    key: "prescription_completed",
    name: "Prescription Order Created",
    channel: "email",
    subject: "Your Prescription Order is Ready - Pradeep Medical Store",
    variables: ["name"],
    body: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f4f6f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#059669 0%,#0d9488 100%);padding:24px 32px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.3px;"><span style="vertical-align:middle;margin-right:8px;font-size:26px;">&#128722;</span> Pradeep Medical Store</div>
            <div style="font-size:12px;color:#d1fae5;margin-top:6px;letter-spacing:1px;text-transform:uppercase;">Order Created</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#111827;">Hello {{name}},</h1>
            <p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#374151;">Your prescription has been converted into a complete order. Our team has prepared your medicines and the order is now being processed for delivery.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ecfdf5;border-left:4px solid #059669;border-radius:6px;margin-bottom:24px;">
              <tr><td style="padding:16px 20px;font-size:14px;color:#065f46;">
                <strong>Status:</strong> Order Created<br />
                <strong>Next Step:</strong> You'll receive order status updates as we pack and dispatch your medicines.
              </td></tr>
            </table>
            <p style="margin:0;font-size:14px;color:#374151;line-height:1.65;">Thank you for choosing Pradeep Medical Store. If you have any questions, please call us at +91 99999 99999.</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f9fafb;padding:24px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0 0 8px 0;font-size:13px;color:#4b5563;line-height:1.5;"><strong>Pradeep Medical Store</strong><br />Main Market, Mathura, Uttar Pradesh 281001<br />Phone: +91 99999 99999 | Email: care@pradeepmedical.com</p>
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">&copy; Pradeep Medical Store. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  },
  {
    key: "prescription_rejected",
    name: "Prescription Rejected",
    channel: "email",
    subject: "Prescription Update - Pradeep Medical Store",
    variables: ["name", "reason"],
    body: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f4f6f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#059669 0%,#0d9488 100%);padding:24px 32px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.3px;"><span style="vertical-align:middle;margin-right:8px;font-size:26px;">&#9888;</span> Pradeep Medical Store</div>
            <div style="font-size:12px;color:#d1fae5;margin-top:6px;letter-spacing:1px;text-transform:uppercase;">Prescription Update</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#111827;">Hello {{name}},</h1>
            <p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#374151;">We've reviewed your prescription, but unfortunately we're unable to process it at this time. Please see the reason below:</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fef2f2;border-left:4px solid #dc2626;border-radius:6px;margin-bottom:24px;">
              <tr><td style="padding:16px 20px;font-size:14px;color:#991b1b;">
                <strong>Status:</strong> Rejected<br />
                <strong>Reason:</strong> {{reason}}
              </td></tr>
            </table>
            <p style="margin:0;font-size:14px;color:#374151;line-height:1.65;">Please upload a clearer copy of your prescription or contact our pharmacy team for assistance. We're happy to help you get the medicines you need.</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f9fafb;padding:24px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0 0 8px 0;font-size:13px;color:#4b5563;line-height:1.5;"><strong>Pradeep Medical Store</strong><br />Main Market, Mathura, Uttar Pradesh 281001<br />Phone: +91 99999 99999 | Email: care@pradeepmedical.com</p>
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">&copy; Pradeep Medical Store. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  },
  {
    key: "manual_request_under_review",
    name: "Manual Medicine Request Under Review",
    channel: "email",
    subject: "Medicine Request Under Review - Pradeep Medical Store",
    variables: ["name"],
    body: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f4f6f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#059669 0%,#0d9488 100%);padding:24px 32px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.3px;"><span style="vertical-align:middle;margin-right:8px;font-size:26px;">&#128269;</span> Pradeep Medical Store</div>
            <div style="font-size:12px;color:#d1fae5;margin-top:6px;letter-spacing:1px;text-transform:uppercase;">Request Under Review</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#111827;">Hello {{name}},</h1>
            <p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#374151;">Our pharmacy team is now reviewing the medicines you requested. We're checking availability and prices, and will update you shortly.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fef3c7;border-left:4px solid #d97706;border-radius:6px;margin-bottom:24px;">
              <tr><td style="padding:16px 20px;font-size:14px;color:#92400e;">
                <strong>Status:</strong> Under Review<br />
                <strong>What happens next:</strong> We'll either approve the request with prices, or reach out if any items are unavailable.
              </td></tr>
            </table>
            <p style="margin:0;font-size:14px;color:#374151;line-height:1.65;">This process typically takes 30-60 minutes during business hours. For any urgent queries, please call us at +91 99999 99999.</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f9fafb;padding:24px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0 0 8px 0;font-size:13px;color:#4b5563;line-height:1.5;"><strong>Pradeep Medical Store</strong><br />Main Market, Mathura, Uttar Pradesh 281001<br />Phone: +91 99999 99999 | Email: care@pradeepmedical.com</p>
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">&copy; Pradeep Medical Store. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  },
  {
    key: "manual_request_submitted",
    name: "Manual Medicine Request Submitted",
    channel: "email",
    subject: "Medicine Request Received - Pradeep Medical Store",
    variables: ["name", "medicineList"],
    body: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f4f6f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#059669 0%,#0d9488 100%);padding:24px 32px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.3px;"><span style="vertical-align:middle;margin-right:8px;font-size:26px;">&#128221;</span> Pradeep Medical Store</div>
            <div style="font-size:12px;color:#d1fae5;margin-top:6px;letter-spacing:1px;text-transform:uppercase;">Medicine Request Received</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#111827;">Hello {{name}},</h1>
            <p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#374151;">Thank you for your medicine request. Our pharmacy team is reviewing the items you requested and will add the available medicines to your cart shortly.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:24px;">
              <tr><td style="padding:16px 20px;font-size:14px;color:#6b7280;border-bottom:1px solid #e5e7eb;font-weight:600;">Requested Medicines</td></tr>
              <tr><td style="padding:16px 20px;font-size:14px;color:#111827;line-height:1.65;">{{medicineList}}</td></tr>
            </table>
            <p style="margin:0;font-size:14px;color:#374151;line-height:1.65;">We'll notify you as soon as your request is processed. For any urgent queries, please call us at +91 99999 99999.</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f9fafb;padding:24px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0 0 8px 0;font-size:13px;color:#4b5563;line-height:1.5;"><strong>Pradeep Medical Store</strong><br />Main Market, Mathura, Uttar Pradesh 281001<br />Phone: +91 99999 99999 | Email: care@pradeepmedical.com</p>
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">&copy; Pradeep Medical Store. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  },
  {
    key: "manual_request_approved",
    name: "Manual Medicine Request Approved",
    channel: "email",
    subject: "Medicine Request Approved - Pradeep Medical Store",
    variables: ["name"],
    body: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f4f6f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#059669 0%,#0d9488 100%);padding:24px 32px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.3px;"><span style="vertical-align:middle;margin-right:8px;font-size:26px;">&#9989;</span> Pradeep Medical Store</div>
            <div style="font-size:12px;color:#d1fae5;margin-top:6px;letter-spacing:1px;text-transform:uppercase;">Medicine Request Approved</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#111827;">Hello {{name}},</h1>
            <p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#374151;">Great news! Your medicine request has been approved by our pharmacy team. The verified medicines have been added to your cart and are ready for checkout.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ecfdf5;border-left:4px solid #059669;border-radius:6px;margin-bottom:24px;">
              <tr><td style="padding:16px 20px;font-size:14px;color:#065f46;">
                <strong>Status:</strong> Approved &amp; Ready for Checkout<br />
                <strong>Next Step:</strong> Complete your purchase to get your medicines delivered.
              </td></tr>
            </table>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center">
                <a href="https://pradeepmedical.com" target="_blank" rel="noopener noreferrer" style="display:inline-block;background-color:#059669;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;">Complete Your Order</a>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f9fafb;padding:24px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0 0 8px 0;font-size:13px;color:#4b5563;line-height:1.5;"><strong>Pradeep Medical Store</strong><br />Main Market, Mathura, Uttar Pradesh 281001<br />Phone: +91 99999 99999 | Email: care@pradeepmedical.com</p>
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">&copy; Pradeep Medical Store. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  },
  {
    key: "manual_request_completed",
    name: "Manual Request Order Created",
    channel: "email",
    subject: "Your Medicine Request Order is Ready - Pradeep Medical Store",
    variables: ["name"],
    body: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f4f6f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#059669 0%,#0d9488 100%);padding:24px 32px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.3px;"><span style="vertical-align:middle;margin-right:8px;font-size:26px;">&#128722;</span> Pradeep Medical Store</div>
            <div style="font-size:12px;color:#d1fae5;margin-top:6px;letter-spacing:1px;text-transform:uppercase;">Order Created</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#111827;">Hello {{name}},</h1>
            <p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#374151;">Your medicine request has been converted into a complete order. Our team has prepared your medicines and the order is now being processed for delivery.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ecfdf5;border-left:4px solid #059669;border-radius:6px;margin-bottom:24px;">
              <tr><td style="padding:16px 20px;font-size:14px;color:#065f46;">
                <strong>Status:</strong> Order Created<br />
                <strong>Next Step:</strong> You'll receive order status updates as we pack and dispatch your medicines.
              </td></tr>
            </table>
            <p style="margin:0;font-size:14px;color:#374151;line-height:1.65;">Thank you for choosing Pradeep Medical Store. If you have any questions, please call us at +91 99999 99999.</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f9fafb;padding:24px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0 0 8px 0;font-size:13px;color:#4b5563;line-height:1.5;"><strong>Pradeep Medical Store</strong><br />Main Market, Mathura, Uttar Pradesh 281001<br />Phone: +91 99999 99999 | Email: care@pradeepmedical.com</p>
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">&copy; Pradeep Medical Store. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  },
  {
    key: "manual_request_rejected",
    name: "Manual Medicine Request Rejected",
    channel: "email",
    subject: "Medicine Request Update - Pradeep Medical Store",
    variables: ["name", "reason"],
    body: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f4f6f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#059669 0%,#0d9488 100%);padding:24px 32px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.3px;"><span style="vertical-align:middle;margin-right:8px;font-size:26px;">&#9888;</span> Pradeep Medical Store</div>
            <div style="font-size:12px;color:#d1fae5;margin-top:6px;letter-spacing:1px;text-transform:uppercase;">Medicine Request Update</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#111827;">Hello {{name}},</h1>
            <p style="margin:0 0 24px 0;font-size:15px;line-height:1.65;color:#374151;">We've reviewed your medicine request, but unfortunately we're unable to process it at this time. Please see the reason below:</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fef2f2;border-left:4px solid #dc2626;border-radius:6px;margin-bottom:24px;">
              <tr><td style="padding:16px 20px;font-size:14px;color:#991b1b;">
                <strong>Status:</strong> Rejected<br />
                <strong>Reason:</strong> {{reason}}
              </td></tr>
            </table>
            <p style="margin:0;font-size:14px;color:#374151;line-height:1.65;">For prescription medicines, please upload a valid prescription. Our pharmacy team is happy to assist you &mdash; call us at +91 99999 99999 for help.</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f9fafb;padding:24px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0 0 8px 0;font-size:13px;color:#4b5563;line-height:1.5;"><strong>Pradeep Medical Store</strong><br />Main Market, Mathura, Uttar Pradesh 281001<br />Phone: +91 99999 99999 | Email: care@pradeepmedical.com</p>
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">&copy; Pradeep Medical Store. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
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
    body: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #059669;">{{title}}</h2>
  <p>{{message}}</p>
  {{details}}
</div>`,
    variables: ["title", "message", "details"],
  },
  {
    key: "admin_new_order",
    name: "Admin Alert — New Order",
    channel: "email",
    subject: "[PMS] New Order — {{orderNumber}}",
    body: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #059669;">🛒 New Order Received</h2>
  <p><strong>Order:</strong> {{orderNumber}}</p>
  <p><strong>Customer:</strong> {{customerName}}</p>
  <p><strong>Total:</strong> Rs. {{amount}}</p>
  <p><strong>Payment Method:</strong> {{paymentMethod}}</p>
  {{details}}
</div>`,
    variables: ["orderNumber", "customerName", "amount", "paymentMethod", "details"],
  },
  {
    key: "admin_new_prescription",
    name: "Admin Alert — New Prescription",
    channel: "email",
    subject: "[PMS] New Prescription Upload — {{customerName}}",
    body: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #8b5cf6;">📋 New Prescription Uploaded</h2>
  <p><strong>Customer:</strong> {{customerName}}</p>
  <p><strong>Ref ID:</strong> {{refId}}</p>
  {{details}}
</div>`,
    variables: ["customerName", "refId", "details"],
  },
  {
    key: "admin_new_manual_request",
    name: "Admin Alert — New Manual Request",
    channel: "email",
    subject: "[PMS] New Manual Medicine Request — {{customerName}}",
    body: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #f59e0b;">📝 New Manual Medicine Request</h2>
  <p><strong>Customer:</strong> {{customerName}}</p>
  <p><strong>Ref ID:</strong> {{refId}}</p>
  {{details}}
</div>`,
    variables: ["customerName", "refId", "details"],
  },
  {
    key: "admin_order_status_update",
    name: "Admin Alert — Order Status Update",
    channel: "email",
    subject: "[PMS] Order {{orderNumber}} — Status changed to {{newStatus}}",
    body: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #0284c7;">📦 Order Status Updated</h2>
  <p><strong>Order:</strong> {{orderNumber}}</p>
  <p><strong>Previous Status:</strong> {{oldStatus}}</p>
  <p><strong>New Status:</strong> {{newStatus}}</p>
  {{details}}
</div>`,
    variables: ["orderNumber", "oldStatus", "newStatus", "details"],
  },
  {
    key: "admin_payment_update",
    name: "Admin Alert — Payment Update",
    channel: "email",
    subject: "[PMS] Order {{orderNumber}} — Payment {{paymentStatus}}",
    body: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #7c3aed;">💳 Payment Update</h2>
  <p><strong>Order:</strong> {{orderNumber}}</p>
  <p><strong>Payment Status:</strong> {{paymentStatus}}</p>
  <p><strong>Payment Method:</strong> {{paymentMethod}}</p>
  {{details}}
</div>`,
    variables: ["orderNumber", "paymentStatus", "paymentMethod", "details"],
  },
];

export const OTP_LENGTH = 6;
export const TOKEN_EXPIRY_HOURS = 24 * 7; // 7 days
export const CART_COOKIE = "pms_session";
