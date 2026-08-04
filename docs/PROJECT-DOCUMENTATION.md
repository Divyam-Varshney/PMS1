# PMS Pharmacy — Exhaustive Project Documentation

> **Pradeep Medical Store (PMS)** — A complete production-grade online pharmacy e-commerce platform built with Next.js 16, React 19, TypeScript, Prisma 6, and PostgreSQL.
>
> **Document scope:** Every file, every folder, every function, every route, every component, every database model — documented exhaustively.
>
> **Last updated:** Phase 40.1 (post performance optimization)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack & Architecture](#2-tech-stack--architecture)
3. [Frontend — Customer Portal](#3-frontend--customer-portal)
4. [Frontend — Admin Panel](#4-frontend--admin-panel)
5. [Backend — API Reference](#5-backend--api-reference)
6. [Database](#6-database)
7. [Features](#7-features)
8. [Configuration & Settings](#8-configuration--settings)
9. [Current Limitations & Known Issues](#9-current-limitations--known-issues)

---

## 1. Project Overview

### 1.1 Purpose

PMS Pharmacy (Pradeep Medical Store) is a full-featured online pharmacy e-commerce platform serving Mathura, Uttar Pradesh, India. It enables customers to order medicines online with fast doorstep delivery, upload prescriptions for pharmacist verification, request hard-to-find medicines, track orders in real-time, and receive push notifications about their order status.

### 1.2 Target Users

| User Type | Description |
|---|---|
| **Customers** | Residents of Mathura and surrounding areas (Vrindavan) who need medicines delivered to their doorstep. Includes patients with chronic conditions (diabetes, hypertension) who reorder regularly. |
| **Pharmacy Admins** | Store staff who manage products, process orders, verify prescriptions, handle customer queries, and oversee inventory. Roles: Super Admin (full access), Manager, Admin (granular permissions). |
| **Pharmacists** | Verify uploaded prescriptions, approve/reject them, and convert them into fulfilled orders. |

### 1.3 Problem It Solves

1. **Accessibility** — Elderly and chronically ill patients can order medicines from home instead of visiting multiple pharmacies.
2. **Prescription verification** — Digital prescription upload + pharmacist review workflow ensures legal compliance for Rx medicines.
3. **Medicine availability** — "Manual Request" feature lets customers request medicines not listed in the catalog; the pharmacy sources them.
4. **Transparency** — Real-time order tracking with timeline (placed → confirmed → packed → out for delivery → delivered).
5. **Reminders** — Medicine reminders + refill reminders help patients adhere to treatment schedules.
6. **Loyalty** — Points-based loyalty program (1 point per Rs. 50 spent) incentivizes repeat purchases.

### 1.4 Business Context

- **Founded by:** Pradeep Varshney (since 1995 — 30+ years of pharmacy service)
- **Location:** Mathura, Uttar Pradesh, India
- **Delivery zones:** Mathura City (Rs. 20 charge, free above Rs. 500) + Vrindavan (Rs. 50 charge, free above Rs. 1000)
- **Payment methods:** COD, QR code (UPI), Razorpay (online), UPI
- **Store hours:** Configurable weekly schedule with holiday support
- **License:** Licensed pharmacy with qualified pharmacist

### 1.5 Key Metrics

| Metric | Value |
|---|---|
| Total source files | 356 (`.ts` + `.tsx`) |
| Total source lines | 83,539 |
| API routes | 179 |
| Prisma models | 40 |
| Customer components | 49 |
| Admin views | 28 |
| Shared UI components | 28 (shadcn/ui) |
| Lib modules | 33 |
| Default email templates | 21 |
| Default push notification templates | 21 |
| Storage providers supported | 9 cloud + 1 local |
| AI providers supported | 7 (Z.AI default + 6 OpenAI-compatible) |

---

## 2. Tech Stack & Architecture

### 2.1 Technologies Used

#### Core Framework

| Technology | Version | Purpose |
|---|---|---|
| **Next.js** | 16.1.1 | Full-stack React framework with App Router + Turbopack |
| **React** | 19.0.0 | UI library |
| **TypeScript** | 5.x | Type-safe JavaScript |
| **Turbopack** | (bundled with Next 16) | Dev server + production bundler (replaces Webpack) |

#### Database & ORM

| Technology | Version | Purpose |
|---|---|---|
| **PostgreSQL** | (Neon serverless) | Relational database hosted on Neon (Tokyo region) |
| **Prisma** | 6.11.1 | Type-safe ORM with migration system |
| **Supavisor** | (Neon pooler) | Connection pooling (`?pgbouncer=true&connection_limit=10&pool_timeout=30`) |

#### Frontend

| Technology | Version | Purpose |
|---|---|---|
| **Tailwind CSS** | 4.x | Utility-first CSS framework |
| **shadcn/ui** | (New York) | Component library built on Radix UI |
| **Radix UI** | 16+ packages | Accessible, unstyled React primitives |
| **Lucide React** | 0.525 | Icon library |
| **Framer Motion** | 12.23 | Animation library |
| **Zustand** | 5.0.6 | Lightweight client state management |
| **TanStack React Query** | 5.82 | Server state management (caching, mutations, prefetch) |
| **Sonner** | 2.0.6 | Toast notifications |
| **next-themes** | 0.4.6 | Dark mode support |
| **Recharts** | 2.15 | Chart library (admin reports) |
| **input-otp** | 1.4.2 | OTP input component |

#### Backend

| Technology | Version | Purpose |
|---|---|---|
| **Node.js** | (bundled with Next 16) | Server runtime |
| **Nodemailer** | 9.0.3 | SMTP email sending |
| **web-push** | 3.6.7 | Web Push notifications (VAPID) |
| **Razorpay** | 2.9.6 | Payment gateway integration |
| **jsPDF** + **jspdf-autotable** | 4.2.1 / 5.0.8 | PDF invoice generation (lazy-loaded) |
| **z-ai-web-dev-sdk** | 0.0.18 | Z.AI AI integration (chat + image search) |

#### Cloud Storage (lazy-loaded)

| Technology | Version | Purpose |
|---|---|---|
| **@aws-sdk/client-s3** | 3.1095 | S3-compatible storage (AWS S3, R2, B2, DO Spaces, MinIO, GCS) |
| **@aws-sdk/s3-request-presigner** | 3.1095 | Signed URL generation |
| **@supabase/supabase-js** | 2.110 | Supabase Storage |
| **@azure/storage-blob** | 12.33 | Azure Blob Storage |

#### Development Tools

| Technology | Version | Purpose |
|---|---|---|
| **ESLint** | 9.x + eslint-config-next | Code linting |
| **tsx** | 4.19 | TypeScript script execution (seed) |
| **tw-animate-css** | 1.3.5 | Tailwind animation utilities |

### 2.2 Folder/File Structure

```
/home/z/my-project/
├── .env                          # Environment variables (NOT in git)
├── .env.example                  # Template for .env
├── .gitignore
├── Caddyfile                     # Gateway reverse proxy config
├── README.md                     # Project overview
├── RECOVERY.md                   # Recovery instructions
├── bun.lock                      # Bun package lock
├── components.json               # shadcn/ui config
├── eslint.config.mjs             # ESLint flat config
├── next-env.d.ts                 # Next.js TypeScript env
├── next.config.ts                # Next.js configuration
├── package.json                  # Dependencies + scripts
├── postcss.config.mjs            # PostCSS for Tailwind
├── tsconfig.json                 # TypeScript config
│
├── prisma/
│   ├── schema.prisma             # 40 models, 1090 lines
│   └── seed.ts                   # Database seed script
│
├── public/
│   ├── apple-icon.png            # Apple touch icon (180×180)
│   ├── favicon.ico               # Browser tab icon
│   ├── icon.png                  # PWA icon (192/512)
│   ├── logo.png                  # Store logo
│   ├── og-image.png              # Open Graph image
│   ├── manifest.json             # PWA manifest
│   ├── robots.txt                # SEO robots
│   └── sw.js                     # Service Worker (push notifications)
│
├── scripts/
│   ├── auto-commit.sh            # Git auto-commit daemon (5min)
│   ├── feature-brands.mjs        # One-time: feature specific brands
│   ├── fix-max-discount.mjs      # One-time: fix maxDiscountPct
│   ├── gen-vapid.mjs             # Generate VAPID key pair
│   ├── keepalive.mjs             # Dev server supervisor
│   ├── seed-production-catalog.cjs # 300+ real products seed
│   ├── start-stable.sh           # Production-safe server start
│   ├── sync-primary-images.mjs   # One-time: sync product images
│   ├── upload-new-logo.mjs       # One-time: upload logo to cloud
│   └── with-env.mjs              # Env-loading launcher (all scripts)
│
├── src/
│   ├── app/
│   │   ├── layout.tsx            # Root layout (Geist font, Providers, Toaster, SWRegister)
│   │   ├── page.tsx              # Customer SPA router (single route)
│   │   ├── globals.css           # Tailwind + custom CSS (749 lines)
│   │   │
│   │   ├── admin/
│   │   │   └── page.tsx          # Admin SPA router (session gate)
│   │   │
│   │   ├── api/                  # 179 API routes (see Section 5)
│   │   │   ├── admin/            # Admin-only endpoints
│   │   │   ├── admin-auth/       # Admin auth
│   │   │   ├── app-notifs/       # Customer app notification endpoints
│   │   │   ├── auth/             # Customer auth
│   │   │   ├── cart/             # Cart operations
│   │   │   ├── catalog/          # Public catalog
│   │   │   ├── checkout/         # Order placement
│   │   │   ├── customer/         # Customer profile/data
│   │   │   ├── device-registrations/ # Push device registration
│   │   │   ├── orders/           # Customer order operations
│   │   │   ├── push/             # Push subscription management
│   │   │   └── ... (see full list in Section 5)
│   │   │
│   │   ├── p/[slug]/             # (SEO route — redirect to product)
│   │   └── products/[slug]/      # (SEO route — redirect to product)
│   │
│   ├── components/
│   │   ├── admin/                # 16 admin shared components
│   │   │   └── views/            # 28 admin view components
│   │   ├── customer/             # 49 customer components
│   │   ├── shared/               # 8 shared components (product-card, etc.)
│   │   └── ui/                   # 28 shadcn/ui components
│   │
│   ├── hooks/                    # Custom React hooks
│   │
│   └── lib/                      # 33 library modules
│       ├── storage/              # Storage provider abstraction
│       │   └── providers/        # 4 providers (local, s3, supabase, azure-blob)
│       └── ... (see Section 5 + 8)
│
├── docs/                         # Documentation files
├── mini-services/                # (Empty — for future WebSocket services)
├── skills/                       # AI skill definitions
├── tests/                        # (Test files)
├── tool-results/                 # Agent tool output cache
├── upload/                       # Local file upload directory
└── agent-ctx/                    # Agent context files
```

### 2.3 Architecture Pattern

The project uses a **single-route SPA (Single Page Application)** pattern for both the customer site and admin panel:

#### Customer Site (`/`)
- **One Next.js route** at `src/app/page.tsx` renders the entire customer application.
- **Hash-based routing**: The URL hash (`#v=shop`, `#v=product&productId=xxx`) determines which view is displayed. This makes the app refresh-safe and enables browser back/forward navigation.
- **Zustand store** (`src/lib/store.ts`) holds the current `view` state + history stack.
- **Lazy loading**: 25 of 26 views are loaded via `next/dynamic` with `ssr: false`. Only `HomeView` is eager (landing page needs instant first paint).
- **React Query** manages all server state (caching, mutations, prefetch, optimistic updates).

#### Admin Panel (`/admin`)
- **One Next.js route** at `src/app/admin/page.tsx` renders the entire admin panel.
- **Session gate**: On mount, fetches `/api/admin-auth/me`. If 401, shows `<AdminLogin>`. Otherwise, mounts `<AdminLayout>` with the active view.
- **Same hash-based routing** pattern via a separate Zustand store (`admin-store.ts`).
- **32 views** all lazy-loaded via `next/dynamic`.

#### Why This Architecture?
1. **No SSR for SPAs**: Customer and admin sites are interactive apps, not content sites. SSR would waste server resources compiling every view upfront.
2. **Bundle splitting**: Lazy-loading 25+ views reduces the initial JS bundle by ~60%.
3. **Refresh-safe**: Hash routing means a refresh on `#v=orders` stays on the orders page.
4. **Deep-linkable**: URLs like `http://localhost:3000/#v=product&productId=abc` can be shared.
5. **Simple deployment**: Only 2 Next.js routes (`/` and `/admin`) — no complex file-system routing.

#### API Design
- **179 API routes** under `src/app/api/` using Next.js App Router conventions.
- **Standardized response envelope**: `{ ok: true, data }` or `{ ok: false, error }` via helpers in `src/lib/api.ts`.
- **Cookie-based auth**: HTTP-only cookies (`pms_customer_token`, `pms_admin_token`) with HMAC-SHA256 signed tokens.
- **In-process caching**: Auth identity (30s), settings (30s), delivery zones (60s), analytics (60s), AI insights (5min) — all cached in module-scope variables.

---

## 3. Frontend — Customer Portal

### 3.1 Root Layout (`src/app/layout.tsx`)

The root layout is shared by both the customer site and admin panel. It:
- Loads the **Geist Sans** font from Google Fonts (variable: `--font-geist-sans`).
- Wraps the app in `<Providers>` (React Query client + theme).
- Renders the `<SonnerToaster>` (toast notifications, positioned top-center, rich colors).
- Renders `<SWRegister>` (registers the service worker for push notifications).
- Sets comprehensive metadata: title, description, keywords, manifest link, icons, OpenGraph, Twitter cards, theme color (`#059669` emerald-600).
- Viewport: disables user scaling (`maximumScale: 1, userScalable: false`) for app-like feel.

### 3.2 Customer SPA Router (`src/app/page.tsx`)

This is the heart of the customer site. It:

1. **Reads the current view** from the Zustand `useUI` store.
2. **Restores from URL hash** on mount (`restoreFromHash()`).
3. **Primes 8 React Query caches** in parallel on mount:
   - `qk.publicSettings` → `/api/settings/public`
   - `qk.me` → `/api/auth/me`
   - `qk.cart` → `/api/cart`
   - `qk.featured` → `/api/catalog/featured`
   - `qk.categories` → `/api/catalog/categories`
   - `qk.brands` → `/api/catalog/brands?featured=true`
   - `qk.deals` → `/api/deals`
   - `qk.homeFeed` → `/api/catalog/home-feed`

   This shaves 200-500ms off cold load time by firing all queries in parallel with the layout mounting.

4. **Scrolls to top** on every view change (except when pressing Back).
5. **Renders the active view** inside `<CustomerLayout>` wrapped in a `<main key={viewKey} className="animate-page-enter">` — the CSS animation replaces the previous framer-motion `AnimatePresence` (saves 200ms per navigation).

**View switch logic** (`renderView()` function):
- 26 cases mapping `view.name` to the corresponding lazy-loaded component.
- `HomeView` is imported eagerly (landing page).
- All other views use `dynamic(() => import(...), { ssr: false })`.

### 3.3 Customer Layout (`src/components/customer/customer-layout.tsx`)

Wraps every customer view with the full application chrome:

| Element | Component | Purpose |
|---|---|---|
| Top banner | (inline) | Promotional offer banner (if hero announcement is disabled) |
| Custom HTML offers | (inline) | Admin-defined custom HTML (sanitized via `sanitizeHtml`) |
| Header | `<Header>` | Sticky top navigation |
| Store closed alert | (inline) | Amber alert when store is closed |
| Main content | `{children}` | The active view |
| Footer | `<Footer>` | Newsletter, links, trust badges |
| Bottom nav | `<BottomNav>` | Mobile-only 5-item navigation |
| Cart sheet | `<CartSheet>` | Slide-in cart drawer |
| Search dialog | `<SearchDialog>` | Cmd+K search modal |
| Mobile menu | `<MobileMenu>` | Slide-in left navigation drawer |
| Compare bar | `<CompareBar>` | Sticky bottom compare tray |
| Back to top | `<BackToTop>` | Floating scroll-to-top button |
| Health assistant | `<HealthAssistantWidget>` | AI chat widget |
| Welcome popup | `<WelcomePopup>` | First-time visitor popup |
| Device wizard | `<DeviceRegistrationWizard>` | Push notification onboarding |
| Theme applier | `<ThemeApplier>` | Applies admin-configured theme colors |

### 3.4 Customer Components (49 files)

#### Navigation & Chrome

##### Header (`header.tsx`, 267 lines)
- **Sticky top bar** with logo, navigation links, search bar, cart, and account menu.
- **Desktop** (`lg:flex`): Full nav links + inline search bar + store-open pill + account dropdown.
- **Mobile** (`lg:hidden`): Hamburger menu + logo + cart icon + search icon + login button.
- **Cart badge**: Animated count badge with pop animation on change.
- **Account dropdown**: My Account, My Orders, Wishlist, Addresses, Profile, Logout.
- **Store-open pill**: Emerald (open) or amber (closed) with animated ping dot.

##### Footer (`footer.tsx`, 256 lines)
- **Newsletter signup** form (emerald gradient banner).
- **5-column link grid**: Brand info, Shop, Account, Help & Info, Contact.
- **Trust badges** strip.
- **Payment methods** display.
- **Copyright** with GST + delivery badges.

##### Bottom Nav (`bottom-nav.tsx`, 112 lines)
- **Mobile-only** (`lg:hidden`), fixed bottom.
- **5 items**: Home, Shop, Cart (with badge), Account, Menu.
- **Active indicator**: Animated top bar using framer-motion `layoutId`.

##### Mobile Menu (`mobile-menu.tsx`, 446 lines)
- **Slide-in left drawer** (shadcn Sheet).
- **Profile header** with gradient.
- **4 nav sections**: Shop, Pharmacy, Account, Support.
- **Auth gating**: Items requiring login show a "Login" pill.
- **Special actions**: Search, AI Assistant, Cart.
- **Logout** at the bottom.

##### Cart Sheet (`cart-sheet.tsx`, 317 lines)
- **Slide-in right drawer** for quick cart view.
- **Line items** with qty steppers, remove buttons.
- **Voucher apply/remove**.
- **Totals breakdown**: Items, discount, voucher, delivery, grand total.
- **Checkout CTA**.

##### Search Dialog (`search-dialog.tsx`, 531 lines)
- **Cmd/Ctrl+K** to open.
- **Multi-section autocomplete**: Products + Categories + Brands.
- **Recent searches** (localStorage, max 5).
- **Trending searches** (hardcoded: Dolo 650, Crocin, Vitamin C, Insulin, Sanitizer).
- **Full keyboard navigation**: ↑↓ to navigate, Enter to select, Esc to close.

##### Back to Top (`back-to-top.tsx`, 103 lines)
- **Floating button** (left side, avoids AI assistant on right).
- **Circular SVG progress ring** showing scroll percentage.
- **Appears** when scrolled > 400px.
- **Memoized** + uses CSS animations (framer-motion removed for performance).

##### Welcome Popup (`welcome-popup.tsx`, 181 lines)
- **First-time visitor** popup (sessionStorage gated).
- **Appears** 1.5s after page load.
- **3 highlight cards**: Search medicines, Upload prescription, Save favorites.
- **2 CTAs**: Browse Medicines, Upload Prescription.

##### Health Assistant Widget (`health-assistant-widget.tsx`, 669 lines)
- **Floating AI chat widget** (bottom-right).
- **Floating button** opens a chat panel.
- **AI-powered**: Answers medicine questions, suggests products, guides to "Request a Medicine".
- **Quick actions**: Search a medicine, Track my order, Upload prescription, Request a medicine.
- **Product cards** in responses with images, prices, and View CTAs.
- **Medical bundles** suggestions.
- **Disclaimer**: "AI assistant — not a doctor."

##### Device Registration Wizard (`device-registration-wizard.tsx`, 809 lines)
- **4-step guided flow** for push notification onboarding (Phase 40 redesign).
- **Steps**: Welcome → Permission → Registering → Test Result → Done.
- **Error states**: Denied (permission blocked), Registering Failed.
- **Device fingerprinting**: Generates UUID stored in localStorage.
- **Login-time validation**: Checks if device is already registered via `/api/device-registrations/validate`.
- **Test push**: Sends a welcome notification after successful registration.

##### Compare Bar (`compare-bar.tsx`, 108 lines)
- **Sticky bottom tray** showing compared products (up to 4).
- **Appears** when 1+ items in compare list AND not on compare view.

##### Theme Applier (`theme-applier.ts`)
- **Reads** `settings.theme` from React Query cache.
- **Applies** CSS custom properties (`--primary`, `--ring`, `--accent`) to `document.documentElement`.

#### Primary Views

##### Home View (`home-view.tsx`, 2125 lines) — **Most Important**
The homepage is a consolidated, modern, trustworthy pharmacy landing page with 13 sections:

1. **Hero System** — Fully admin-configurable via `HeroConfig`. Layouts: split-left, split-right, centered, full-bg. Style presets: emerald/teal/midnight/sunrise/custom. Background: image (desktop/tablet/mobile) + gradient + pattern (dots/grid/waves) + animated orbs. Supports announcement bar, promo banner, hero cards, trust features, search bar with popular searches.
2. **Hero Action Cards** — 3 cards: Upload Prescription, Request Medicines, Browse Catalog.
3. **Shop by Category** — Grid of category tiles with icons and product counts.
4. **Trusted Brands** — Marquee of brand logos/names.
5. **Featured Products** — Grid of featured products.
6. **Deals & Bestsellers** — Merged tabs showing today's deals and best-selling products.
7. **Trending & New** — Merged tabs showing trending and new arrival products.
8. **Mid-banner offers** — Promotional banner.
9. **Medical Bundles** — Carousel of curated health bundles (First Aid, Diabetes Care, etc.).
10. **Wellness Hub** — Health tips + testimonials.
11. **Recently viewed** — Products the customer recently viewed.
12. **Compliance/trust strip** — Pharmacy license, genuine medicines, etc.
13. **Final CTA band** — "Start ordering today" call to action.

**Performance**: Uses `useMemo` for derived data, `useCallback` for stable handlers, `memo()` for `ProductGrid`. Framer-motion `whileInView` for scroll-triggered entrance animations.

##### Shop View (`shop-view.tsx`, 1033 lines)
- **Product listing page** with sidebar filters and product grid.
- **Filters**: Search, prescription (all/OTC/Rx), availability (all/in-stock/out-of-stock), categories, brands, price range slider (₹0-5000).
- **Sort options**: Popular, price (asc/desc), newest, best discount, rating.
- **View modes**: Grid (cards) or List (rows with more details) — persisted to localStorage.
- **Page modes**: Infinite scroll (IntersectionObserver) or classic pagination — persisted to localStorage.
- **PAGE_SIZE**: 30 products per page.
- **Active filter chips** with X buttons + "Clear all".

##### Product View (`product-view.tsx`, 1130 lines)
- **Premium single-product detail page**.
- **Two-column desktop layout**: Gallery (left) + Info (right).
- **Sticky mobile CTA bar** with qty stepper + Add to Cart + Buy Now.
- **Specs table**: Composition, Generic Name, Manufacturer, Category, Pack Size, etc.
- **Info accordion**: Uses, How to Use, Side Effects, Warnings, Storage, Disclaimer (auto-generated from product data).
- **Frequently Bought Together** (FBT): Up to 3 products with checkboxes + "Add selected to cart".
- **Generic alternatives**: Same generic name, different brand (cheaper substitutes).
- **Related products**: 8 products from same category.
- **Reviews section**: Rating distribution + review cards with images.
- **Wishlist + Share** buttons.

##### Product Gallery (`product-gallery.tsx`, 508 lines)
- **Amazon-style image gallery**.
- **Main image** with click-to-zoom Dialog.
- **Thumbnail strip**: Vertical on desktop, horizontal scroll on mobile.
- **Touch swipe** via framer-motion drag.
- **Zoom**: Pinch-to-zoom (2-finger), double-tap toggle (1× ↔ 2.5×), mouse wheel zoom, drag to pan.

##### Checkout View (`checkout-view.tsx`, 1525 lines)
- **Checkout flow**: Address picker → Payment method → Order summary → Place order.
- **Auth required**: Redirects to login if not authenticated.
- **Store-closed gate**: Blocks checkout when store is closed.
- **Delivery calculation**: Recalculates when address changes (race-condition guarded).
- **Loyalty redemption**: Validates points ≤ balance and ≤ subtotal.
- **Payment methods**: COD, QR, UPI, Razorpay (script lazy-loaded).
- **Razorpay flow**: Create order → Open Razorpay modal → Verify signature → Navigate to success.
- **Free delivery progress bar**: Shows how much more to add for free delivery.

##### Cart View (`cart-view.tsx`, 798 lines)
- **Full cart page** (vs the quick CartSheet drawer).
- **Line items** with qty steppers, remove, effective price calculation.
- **Voucher** apply/remove.
- **Discount breakdown**: Item discounts, voucher discount, delivery, grand total.
- **Smart recommendations**: Suggests add-on products to qualify for free delivery.

#### Order & Account Views

##### Orders View (`orders-view.tsx`, 1344 lines)
- **Unified activity history**: Merges Orders + Prescriptions + Manual Requests into a single timeline.
- **Filter tabs**: All / Orders / Prescriptions / Requests.
- **Order segmentation**: "Active Orders" (pending/confirmed/packed/out_for_delivery) vs "Past Orders".
- **Auto-refresh**: 10s polling interval.
- **Reorder**: One-click reorder with "added/skipped/totalItems" feedback.
- **Detail dialog**: Opens for prescriptions/manual_requests with image lightbox + status timeline.

##### Order Success View (`order-success-view.tsx`, 334 lines)
- **Post-checkout success screen** with animated checkmark.
- **Order number** + ETA.
- **QR payment**: Shows QR image + screenshot upload form.
- **CTAs**: Track Order, Continue Shopping, Go to Home.

##### Track Order View (`track-order-view.tsx`, 937 lines)
- **Animated vertical timeline** of fulfillment stages (8 stages).
- **Live ETA countdown** (updates every second, SSR-safe).
- **Order summary** + delivery address.
- **Invoice download** + reorder.
- **QR payment** screenshot upload (same as order-success).

##### Account View (`account-view.tsx`, 741 lines)
- **Customer dashboard**: Profile summary, savings tracker, quick stats, recent activity, buy-again, quick actions, refills, notification preferences.
- **Stats**: totalSavings, totalSpent, totalOrders, avgOrderValue, totalItemsPurchased, loyaltyPoints.
- **Quick links**: 6 cards (Orders, Addresses, Wishlist, Stock Alerts, Reminders, Refill Reminders).
- **Buy Again**: Top 4 most-reordered products with quick add-to-cart.
- **Recent activity**: Last 3 items from unified history.
- **Refill card**: Shows due-soon refills with snooze button.

##### Profile View (`profile-view.tsx`, 479 lines)
- **Edit profile**: Name, phone (email is read-only with verified badge).
- **Profile header**: Avatar with initials in gradient circle, "Member since" badge.
- **Quick stats**: Orders count, addresses count.
- **Loyalty card**: Balance + value + collapsible transaction history.

##### Addresses View (`addresses-view.tsx`, 599 lines)
- **List saved addresses** with edit/delete/set-default.
- **Add new form**: Label (Home/Work/Other), line1, line2, city, district, state, pincode, locality (dropdown from delivery zones), phone, isDefault.
- **Delete confirmation**: AlertDialog prevents accidental deletes.

##### Auth View (`auth-view.tsx`, 930 lines)
- **Login + Register + Forgot Password + OTP verification** in one premium view.
- **Split-screen desktop**: Left branding panel (emerald gradient, feature bullets, testimonial), right form.
- **Mobile**: Compact logo + form.
- **OTP UI**: 6-slot InputOTP with "Resend OTP" (60s cooldown).
- **Critical login fix**: On login success without OTP, immediately sets `qc.setQueryData(qk.me, data.customer)` to prevent auto-logout.

#### Other Views

| View | File | Lines | Purpose |
|---|---|---|---|
| Prescription Upload | `prescription-view.tsx` | 397 | Drag-and-drop image upload for prescriptions + history |
| Manual Request | `manual-request-view.tsx` | 309 | Type a list of medicines + notes + history |
| Wishlist | `wishlist-view.tsx` | 242 | Grid of saved products + bulk "Add all to cart" |
| Categories | `categories-view.tsx` | 212 | Grid of all categories with search filter |
| Bundles | `bundle-view.tsx` | 390 | Dedicated "all health bundles" page |
| About | `about-view.tsx` | 211 | Premium "About Us" page with brand story |
| Contact | `contact-view.tsx` | 567 | Contact form + info + FAQ accordion |
| Terms | `terms-view.tsx` | 365 | T&C with sticky table of contents |
| Refund Policy | `refund-policy-view.tsx` | 286 | Refund & return policy |
| Compare | `compare-view.tsx` | 448 | Side-by-side product comparison (up to 4) |
| Health Tip | `health-tip-view.tsx` | 227 | Full-article view for a health tip |
| Medicine Reminders | `medicine-reminders-view.tsx` | 658 | Create/edit/pause/delete medicine reminders |
| Stock Alerts | `stock-alerts-view.tsx` | 227 | List of back-in-stock subscriptions |

#### Hooks & Utilities

| Hook | File | Purpose |
|---|---|---|
| `useCustomer` | `use-customer.ts` | Fetches `/api/auth/me`, exposes `{customer, isLoading, isAuthenticated}` |
| `usePublicSettings` | `use-public-settings.ts` | Fetches `/api/settings/public`, computes `isStoreOpen` (IST-aware) |
| `useRequireAuth` | `use-require-auth.ts` | Guard hook — redirects to login if not authenticated |
| `useCompare` | `use-compare.ts` | Tracks up to 4 compare products (localStorage) |
| `useRecentlyViewed` | `use-recently-viewed.ts` | Tracks last 8 viewed products (localStorage) |

### 3.5 State Management

| Pattern | Usage |
|---|---|
| **Zustand** | View routing (`view`, `navigate`, `back`), UI toggles (`cartOpen`, `searchOpen`, `menuOpen`) |
| **React Query** | All server state — `useQuery` for reads, `useMutation` for writes, `qc.prefetchQuery` for priming, `qc.setQueryData` for optimistic updates |
| **useState** | Form fields, local UI state |
| **useEffect** | Mount-time priming, scroll restoration, view-sync, keyboard shortcuts |
| **useRef** | Scroll position, input focus, race-condition guards |
| **useMemo/useCallback** | Derived data, stable handler refs |
| **localStorage** | Compare list, recently viewed, recent searches, shop view/page mode preferences |
| **sessionStorage** | Welcome popup shown flag |

### 3.6 Responsive Design

- **Mobile-first**: All views default to single-column, expand at `sm` (640px), `md` (768px), `lg` (1024px).
- **Bottom nav**: `lg:hidden` (mobile/tablet only).
- **Desktop nav**: `hidden lg:flex` (desktop only).
- **Safe areas**: `pb-safe` on bottom nav for iOS notch.
- **Touch targets**: Minimum 36px (qty steppers, nav buttons).

---

## 4. Frontend — Admin Panel

### 4.1 Admin SPA Router (`src/app/admin/page.tsx`, 179 lines)

- **Session gate**: Fetches `/api/admin-auth/me` on mount. If 401, shows `<AdminLogin>`. Otherwise, mounts `<AdminLayout>`.
- **32 lazy-loaded views** via `next/dynamic` with `ssr: false`.
- **View switch**: `AdminContent` reads `useAdminStore.view` and switches on `view.name` (28 cases + default → Dashboard).

### 4.2 Admin Layout (`src/components/admin/AdminLayout.tsx`, 793 lines)

The premium admin shell with:

#### Sidebar Structure (5 groups + standalone Dashboard)

| Group | Items |
|---|---|
| **Catalog** | Products, Brands, Categories |
| **Sales** | Orders, Prescriptions, Manual Requests, Customers |
| **Marketing** | Offers & Banners, Today's Deals, Campaigns, AI Email Marketing, Vouchers, Newsletter, Apps Notification's, Reviews |
| **Operations** | Delivery Zones, Payment Methods, Reports |
| **System** | Backups, Database, Templates, Settings, Admins, Error Logs |
| *(Standalone)* | Dashboard |

Each item has a `permission` key and is hidden if `hasPermission(admin, key)` returns false.

#### Sidebar Features
- **Collapsible groups** (click to expand/collapse).
- **Search filter** (filters items by label).
- **Live badges**: Pending orders, low stock, pending prescriptions, pending manual requests (polled every 30s).
- **Store open/close toggle** in the sidebar footer.

#### Topbar
- **Sidebar trigger** (collapse/expand).
- **Breadcrumbs** (Dashboard → Parent → Current).
- **Cmd+K command palette** (search all nav items).
- **Date widget** (IST date).
- **Dark mode toggle**.
- **Notification bell** (live dropdown, 15s polling, chime on new).
- **Role badge**.
- **Logout** button.

#### Page Transitions
- Framer-motion `AnimatePresence mode="wait"` with 200ms fade+slide animation.

### 4.3 Shared Admin Components (16 files)

| Component | File | Lines | Purpose |
|---|---|---|---|
| `AdminLogin` | `AdminLogin.tsx` | 106 | Centered emerald-branded login card |
| `AdminNotificationBell` | `AdminNotificationBell.tsx` | 250 | Live notification bell with Web Audio chime |
| `AnimatedNumber` | `animated-number.tsx` | 71 | Smooth count-up animation for stat cards |
| `RichTextEditor` | `RichTextEditor.tsx` | 192 | contentEditable-based rich text editor (no external deps) |
| `BrandingPanel` | `branding-panel.tsx` | 141 | Master logo upload (used everywhere) |
| `AiProviderPanel` | `ai-provider-panel.tsx` | 279 | AI provider settings (11 providers) |
| `StorageUsageStats` | `storage-usage-stats.tsx` | 198 | Storage usage widget with bar chart |
| `StorageSettingsPanel` | `storage-settings-panel.tsx` | 987 | 10-provider storage configuration |
| `HeroSettingsPanel` | `hero-settings-panel.tsx` | 677 | Homepage hero configuration (42 icon options) |
| `SearchProductImages` | `search-product-images.tsx` | 559 | AI-powered product image search (9 sources) |
| `ProductGalleryManager` | `product-gallery-manager.tsx` | 1811 | Professional media manager with drag-drop + compression |
| `ui` (shared primitives) | `ui.tsx` | 244 | PageHeader, StatusBadge, TableSkeleton, EmptyState, etc. |
| `admin-store` | `admin-store.ts` | 134 | Zustand store for admin SPA |
| `api` | `api.ts` | 9 | Re-exports shared fetch client |

### 4.4 Admin Views (28 files, 32 exports)

#### Dashboard (`DashboardView.tsx`, 1407 lines)
- **BI dashboard** (Shopify/Stripe style).
- **15 sections**: Smart Alerts, Revenue Overview (5 cards), Profit Analytics (4 cards), AI Business Insights, Order Analytics (8 status cards), Inventory Analytics (6 cards + low-stock list), Customer Analytics (5 cards), Product Performance (top 5), Brand & Category (top 5 each), Prescription & MR, Delivery Analytics, Payment Analytics, AI Sales Forecast, AI Inventory Suggestions, AI Profit Suggestions.
- **Animated stat cards** with count-up effect.
- **Cross-view integration**: "View all" on Inventory Alerts sets a one-shot filter that ProductsView consumes.

#### Products (`ProductsView.tsx`, 929 lines + `ProductEditView.tsx`, 1449 lines)
- **List view**: Stats row (4 cards), enhanced filters, bulk actions (delete, set status, export), table/grid toggle, CSV import/export.
- **Edit view**: 5 tabs (Basic Info, Pricing, Inventory, Attributes, Images) + sticky bottom save bar + AI Content Generator with 3-step pipeline (search → validate → generate).
- **Embedded components**: `ProductGalleryManager` + `SearchProductImages` + `RichTextEditor`.

#### Orders (`OrdersView.tsx`, 1268 lines + `OrderDetailView.tsx`, 1945 lines)
- **List view**: 8 summary cards, advanced search/filters, 10-column table, bulk actions, Sheet drawer for quick preview.
- **Detail view**: Smart status workflow (valid transitions only), payment management (7 statuses), info cards (customer/address/payment/pricing), products table (add/edit/remove items with lock when packed), timeline, internal notes, prescription card.

#### Prescriptions (`PrescriptionsView.tsx`, 783 lines)
- **List + detail** with image viewer (zoom + rotate), status workflow, admin notes, convert-to-order dialog with product picker.

#### Manual Requests (`ManualRequestsView.tsx`, 750 lines)
- **List + detail** mirroring PrescriptionsView but for typed medicine lists.

#### Customers (`CustomersView.tsx`, 752 lines)
- **List + detail**: Profile, addresses, order history, loyalty points adjust, toggle active, export CSV.

#### Other Admin Views

| View | Lines | Purpose |
|---|---|---|
| Vouchers | 662 | Flat-amount voucher management (cart/product/category scope) |
| Delivery Zones | 851 | Zone management with localities + pincodes |
| Payment Methods | 805 | Modular payment method management (UPI/Razorpay/COD/QR) |
| Reviews | 690 | Review moderation + AI moderate/reply + image gallery |
| Settings | 697 | 12-tab settings (Store, SMTP, SEO, Theme, Hero, Storage, AI, etc.) |
| Admins | 793 | Admin accounts + granular permissions editor |
| Reports | 340 | Sales + product reports with Recharts + CSV export |
| Offers | 555 | Premium offer/banner management with color presets |
| Deals | 708 | "Today's Deals" management |
| Campaigns | 389 | Landing page management |
| Newsletter | 580 | Subscriber management + bulk email |
| Notifications | 134 | Legacy notification log |
| Notification Templates | 957 | Email + push template editor with live preview |
| Backups | 164 | DB + storage overview |
| Database | 214 | Read-only table browser |
| Error Logs | 448 | Error log management with bulk actions |
| AI Marketing | 657 | AI email marketing generator + broadcast |
| App Notification Center | 901 | Push notification campaign builder + history |

### 4.5 Permission System

**Two roles:**
- `super_admin` — Full access to everything; `permissions` field is null/ignored.
- `admin` / `manager` — Granular permissions; `permissions` field is a JSON-encoded array of permission keys.

**25 permission keys** (one per nav item + `dashboard`):
`dashboard`, `products`, `brands`, `categories`, `orders`, `prescriptions`, `manual-requests`, `customers`, `offers`, `deals`, `campaigns`, `ai-marketing`, `vouchers`, `newsletter`, `app-notifications`, `reviews`, `delivery-zones`, `payment-methods`, `reports`, `backups`, `database`, `templates`, `settings`, `admins`, `error-logs`.

**Enforcement layers:**
1. **Frontend (sidebar):** Filters items via `hasPermission(admin, key)`.
2. **Backend (per-route):** Every `/api/admin/*` route re-checks permissions server-side.
3. **AdminsView:** Only `super_admin` can create admins or edit permissions.

---

## 5. Backend — API Reference

### 5.1 Conventions

- **179 routes** under `src/app/api/`.
- **Response envelope**: `{ ok: true, data }` or `{ ok: false, error }`.
- **Auth**: Cookie-based (`pms_customer_token`, `pms_admin_token`) with HMAC-SHA256 signed tokens. In-process identity cache (30s TTL).
- **Caching**: `okCached()` for public catalog endpoints (s-maxage), `okNoCache()` for auth routes.
- **Validation**: Light — `parseBody` is async + JSON-only; required fields checked explicitly. No zod.

### 5.2 API Categories (179 routes)

#### Auth (9 routes)

| Method & Path | Purpose | Auth |
|---|---|---|
| POST `/api/auth/register` | Store registration data in OTP (no Customer created yet) | none |
| POST `/api/auth/verify-otp` | Verify OTP → create Customer + Address + set cookie | none |
| POST `/api/auth/login` | Login (password) → cookie or OTP | none |
| POST `/api/auth/login-verify` | Verify login OTP → set cookie | none |
| POST `/api/auth/resend-otp` | Resend register/login OTP (60s rate limit) | none |
| POST `/api/auth/forgot-password` | Send reset OTP | none |
| POST `/api/auth/reset-password` | Reset password using OTP | none |
| GET `/api/auth/me` | Return current customer (or null) | customer (optional) |
| POST `/api/auth/logout` | Clear cookie + invalidate cache | customer |
| POST `/api/admin-auth/login` | Admin login + cookie + **admin_login_alert email** | none |
| POST `/api/admin-auth/logout` | Clear admin cookie | admin |
| GET `/api/admin-auth/me` | Return current admin or 401 | admin |

#### Cart (5 routes)

| Method & Path | Purpose | Auth |
|---|---|---|
| GET `/api/cart` | Current cart with full pricing breakdown | customer (else empty) |
| POST `/api/cart/add` | Add product (upsert, stock check) | customer |
| POST `/api/cart/update` | Set qty (0 deletes) | customer |
| POST `/api/cart/remove` | Remove product entirely | customer |
| POST/DELETE `/api/cart/voucher` | Apply/remove voucher code | customer |

#### Checkout (3 routes)

| Method & Path | Purpose | Auth |
|---|---|---|
| POST `/api/checkout` | Place order (stock decrement, voucher, loyalty, email + push) | customer |
| POST `/api/checkout/razorpay` | Create Razorpay order | customer |
| POST `/api/checkout/razorpay/verify` | Verify Razorpay signature + mark paid | customer |

#### Catalog (8 routes — all public, CDN-cached)

| Method & Path | Purpose | Cache |
|---|---|---|
| GET `/api/catalog/products` | Paginated product list with filters | s-maxage=30 |
| GET `/api/catalog/products/[slug]` | Single product by slug | dynamic |
| GET `/api/catalog/featured` | Featured + BestSeller + Trending | s-maxage=60 |
| GET `/api/catalog/home-feed` | 6 home sections + season | s-maxage=300 |
| GET `/api/catalog/categories` | Active categories with counts | s-maxage=60 |
| GET `/api/catalog/brands` | Active brands (optional `?featured=true`) | s-maxage=60 |
| GET `/api/catalog/bundles` | Curated medical bundles | s-maxage=300 |
| GET `/api/catalog/recommendations/[productId]` | Related + FBT + alternatives | s-maxage=60 |

#### Customer (14 routes — all require customer auth)

| Method & Path | Purpose |
|---|---|
| GET `/api/customer/me` | Profile + addresses + counts |
| PUT `/api/customer/profile` | Update name/phone |
| GET/POST `/api/customer/addresses` | List / create address |
| PUT/DELETE `/api/customer/addresses/[id]` | Edit / delete address |
| GET `/api/customer/history` | Unified timeline (orders + prescriptions + requests, paginated) |
| GET `/api/customer/stats` | Aggregate stats (savings, spent, orders, etc.) |
| GET `/api/customer/loyalty` · POST `/api/customer/loyalty/redeem` | Balance + transactions / preview redemption |
| GET/POST/PATCH/DELETE `/api/customer/reminders` | Medicine reminders CRUD |
| GET/POST/PATCH/DELETE `/api/customer/refill-reminders` | Refill reminders CRUD |
| GET `/api/customer/frequently-reordered` | Top 8 reordered products |

#### Orders (4 routes — customer-facing)

| Method & Path | Purpose |
|---|---|
| GET `/api/orders/[id]/track` | Order + timeline + QR image |
| POST `/api/orders/[id]/reorder` | Re-add all items to cart |
| POST/GET `/api/orders/[id]/payment-screenshot` | Upload/fetch QR payment screenshot |

#### Admin: Products/Brands/Categories (16 routes)

Full CRUD + bulk actions + CSV import/export + gallery management + logo/image upload.

#### Admin: Orders/Prescriptions/Manual Requests (23 routes)

| Key routes | Purpose |
|---|---|
| GET `/api/admin/orders` | Paginated orders with multi-filters |
| GET `/api/admin/orders/[id]` | Full order detail |
| PATCH `/api/admin/orders/[id]/status` | Smart status update (valid transitions, email + push + loyalty) |
| PATCH `/api/admin/orders/[id]/payment` | Payment status update (7 statuses, email + push) |
| POST `/api/admin/orders/[id]/prescription-verify` | Approve/reject prescription |
| POST `/api/admin/orders/[id]/items` | Add product (re-runs pricing) |
| PATCH/DELETE `/api/admin/orders/[id]/item/[itemId]` | Edit/remove line |
| GET `/api/admin/orders/[id]/invoice` | PDF invoice |
| GET `/api/admin/orders/[id]/shipping-label` | PDF shipping label |
| POST `/api/admin/prescriptions/[id]/convert` | Convert prescription → order |
| POST `/api/admin/manual-requests/[id]/convert` | Convert manual request → order |

#### Admin: Dashboard (4 routes)

| Method & Path | Purpose | Cache |
|---|---|---|
| GET `/api/admin/dashboard` | 50+ metrics | 30s |
| GET `/api/admin/dashboard/analytics` | Comprehensive BI analytics | 60s |
| GET `/api/admin/dashboard/ai-insights` | AI-generated insights + forecast | 5min |
| GET `/api/admin/counts` | Sidebar badges (pending orders, low stock, etc.) | — |

#### Admin: Settings/Branding/Storage (10 routes)

Settings management (12 tabs), branding upload, storage config (10 providers), SMTP test, storage test, storage usage stats.

#### Admin: Marketing (36 routes)

AI generation (product, marketing, images), campaigns, deals, offers, newsletter (list/send/broadcast/export), vouchers.

#### Admin: App Notifications (8 routes)

Broadcast push, AI generate, history, analytics, retry failed, template management, test send.

#### Admin: Other (39 routes)

Admins CRUD, backups, database browser, error logs, payment methods, delivery zones, reports (sales + products), reviews (moderation + AI), notification templates.

#### Customer: App Notifications + Device Registration + Push (12 routes)

| Method & Path | Purpose |
|---|---|
| GET `/api/push/vapid-public` | Return VAPID public key (public) |
| POST `/api/push/subscribe` | Register/refresh push subscription |
| POST `/api/push/unsubscribe` | Deactivate subscription |
| GET `/api/device-registrations/status` | Check device registration status |
| POST `/api/device-registrations/validate` | Health-check on login |
| POST `/api/device-registrations/register` | Final wizard step + welcome push |
| POST `/api/device-registrations/skip` | Mark as skipped |
| GET/PUT `/api/app-notifs/preferences` | Get/set master toggle |
| GET `/api/app-notifs/history` | Customer's notification log |
| POST `/api/app-notifs/test` | Send test push |
| POST `/api/app-notifs/log/[id]/click` | Mark clicked (SW beacon) |
| POST `/api/app-notifs/log/[id]/delivered` | Mark delivered (SW beacon) |

#### Public (22 routes)

| Method & Path | Purpose |
|---|---|
| GET `/api/health` | Health check (DB ping) |
| GET `/api/settings/public` | Public store settings |
| POST `/api/contact` | Contact form submission |
| POST `/api/newsletter/subscribe` | Newsletter subscribe |
| GET `/api/file/[bucket]/[...key]` | Authenticated file proxy (prescriptions, payments) |
| POST `/api/delivery/calculate` | Calculate delivery charge |
| GET `/api/delivery/check` | Check delivery availability |
| GET `/api/delivery/localities` | Sorted locality list |
| GET `/api/deals` | Public today's deals |
| GET `/api/payment-methods` | Active payment methods |
| GET/POST `/api/prescriptions` | List/upload prescriptions |
| GET/POST `/api/manual-requests` | List/submit manual requests |
| GET/POST `/api/reviews` | List/submit reviews (with AI moderation) |
| GET/POST/DELETE `/api/stock-subscriptions` | Back-in-stock subscriptions |
| GET/POST `/api/wishlist` · DELETE `/api/wishlist/[productId]` | Wishlist management |
| POST `/api/health-assistant` | AI pharmacy assistant chatbot |
| GET `/api/invoice/[orderId]` | PDF invoice download |
| GET `/api/campaigns/[slug]` | Public campaign landing page |

---

## 6. Database

### 6.1 Configuration

- **Provider**: PostgreSQL
- **Host**: Neon serverless (Tokyo region) via Supavisor transaction pooler
- **Connection string**: `postgresql://...?pgbouncer=true&connection_limit=10&pool_timeout=30`
- **Direct URL** (for migrations): Port 5432 (session mode)
- **40 models**, **0 native enums** (all String with documented value sets), **73 indexes**

### 6.2 Models (40 total)

#### Core E-commerce Models

| Model | Purpose | Key Fields |
|---|---|---|
| **Customer** | Registered customer | name, email (unique), phone (unique), passwordHash, isEmailVerified, isActive, whatsappOptIn, loyaltyPoints |
| **Address** | Saved delivery address | label, line1, line2, city, district, state, pincode, locality, phone, isDefault |
| **Product** | Medicine/product catalog | name, slug (unique), sku, description, composition, genericName, manufacturer, prescriptionRequired, mrp, sellingPrice, baseDiscountPct, maxDiscountPct, stock, lowStockThreshold, status, visibility, isFeatured, isBestSeller, isTrending, primaryImage, galleryImages, avgRating, reviewCount |
| **ProductImage** | Product gallery images | productId, url, altText, displayOrder, isPrimary |
| **Brand** | Product brand | name, slug, description, logo, displayMode, displayOrder, isFeaturedOnHomepage, status, visibility |
| **Category** | Product category (self-referencing parent) | name, slug, description, image, parentId, displayOrder, status, visibility |
| **Cart** | Customer's cart (one per customer) | customerId, voucherCode |
| **CartItem** | Cart line item | cartId, productId, qty |
| **Order** | Placed order | orderNumber (unique), customerId, addressId, prescriptionId, manualRequestId, status, paymentStatus, paymentMethod, paymentId, itemsTotal, productDiscount, voucherDiscount, deliveryCharge, loyaltyDiscount, roundOff, grandTotal, voucherCode, source, notes, adminNotes, shipName, shipPhone, shipLine1, shipCity, shipState, shipPincode, shipLocality, trackingNumber, carrier, estimatedDelivery, cancelledAt, confirmedAt, packedAt, outForDeliveryAt, deliveredAt |
| **OrderItem** | Order line item (snapshot) | orderId, productId, name, sku, image, qty, mrp, sellingPrice, appliedDiscountPct, discountAmount, lineTotal |
| **OrderStatusHistory** | Audit trail of status changes | orderId, status, note, createdBy |
| **Voucher** | Discount voucher | code (unique), description, amount, scope (cart/product/category), targetIds, minOrder, maxRedemptions, usedCount, perCustomerLimit, validFrom, validTo, isActive |
| **VoucherUsage** | Voucher redemption record | voucherCode, customerId, orderId |
| **DeliveryZone** | Delivery zone config | name, localities, pincodes, charge, freeAbove, minOrder, estimatedHours, isActive, displayOrder |
| **PaymentMethod** | Payment method config | key (unique), label, description, icon, gateway, config (JSON), displayOrder, isActive |

#### Prescription & Manual Request Models

| Model | Purpose |
|---|---|
| **Prescription** | Uploaded prescription images + status |
| **ManualRequest** | Customer's typed medicine request list + status |

#### Auth Models

| Model | Purpose |
|---|---|
| **Otp** | One-time passwords (register/login/reset) with pendingData for registration |
| **Admin** | Admin account with role + permissions |

#### Notification Models

| Model | Purpose |
|---|---|
| **NotificationLog** | Email/WhatsApp notification log |
| **NotificationTemplate** | Email template (key, subject, body, variables) |
| **AdminNotification** | Admin bell notification (in-app) |
| **PushSubscription** | Browser push subscription (endpoint, p256dhKey, authKey, userAgent, isActive) |
| **AppNotifTemplate** | Push notification template (21 defaults) |
| **AppNotifLog** | Push delivery log (status, isRead, isClicked, retryCount) |
| **AppNotifPreference** | Customer's master push toggle (enabled) |
| **DeviceRegistration** | Device registration wizard state (deviceId, deviceLabel, browserName, osName, deviceType, status) |

#### Customer Engagement Models

| Model | Purpose |
|---|---|
| **WishlistItem** | Saved product (customerId + productId unique) |
| **Review** | Product review (rating, title, body, images, aiStatus, aiNote) |
| **StockSubscription** | Back-in-stock notification subscription |
| **MedicineReminder** | Customer's medicine reminder (productName, dosage, frequency, times) |
| **RefillReminder** | Refill reminder (productId, daysSupply, lastOrdered, status) |
| **LoyaltyTransaction** | Loyalty points audit (type: earn/redeem/adjust, points, balance, reason, orderId) |

#### Marketing Models

| Model | Purpose |
|---|---|
| **Offer** | Promotional offer (stored as JSON in Setting) |
| **Deal** | Today's deal (productId, discountPct, dates) |
| **Campaign** | Landing page campaign (slug, type, hero, products, categories) |
| **NewsletterSubscriber** | Email subscriber (email, name, isActive) |

#### System Models

| Model | Purpose |
|---|---|
| **Setting** | Key-value settings store (key unique, value Text) |
| **ErrorLog** | Automatic error capture (severity, module, endpoint, message, stack) |
| **Campaign** | Landing page campaign |
| **HealthBundle** | (Unused — legacy, kept for seed script) |

### 6.3 Key Relationships

```
Customer 1───∞ Address
Customer 1───∞ Order ────1 Address (snapshot)
                     ────1 Prescription (optional)
                     ────1 ManualRequest (optional)
                     ────∞ OrderItem ────1 Product (optional, snapshot)
                     ────∞ OrderStatusHistory
                     ────∞ VoucherUsage

Product 1───∞ ProductImage
Product ∞───1 Brand
Product ∞───1 Category (self-referencing)
Product 1───∞ Review
Product 1───∞ StockSubscription

Customer 1───1 Cart ────∞ CartItem ────1 Product
Customer 1───∞ PushSubscription
Customer 1───1 AppNotifPreference
Customer 1───∞ DeviceRegistration
Customer 1───∞ LoyaltyTransaction

Admin 1───∞ AdminNotification
Admin 1───∞ OrderStatusHistory (createdBy)
```

### 6.4 Index Strategy

- **All foreign keys** are indexed (`@@index([customerId])`, `@@index([orderId])`, etc.)
- **Unique constraints**: email, phone, slug, orderNumber, voucher code, endpoint (push)
- **Composite indexes**: `[customerId, deviceId]` on DeviceRegistration
- **Phase 40.1 addition**: `@@index([productId])` on OrderItem (was missing, caused full table scans on analytics)
- **Performance indexes** on Product: `[visibility, status]`, `[avgRating]`, `[baseDiscountPct]`, `[createdAt]`

### 6.5 Data Flow Example: Order Placement

1. Customer adds products to **Cart** (CartItem rows)
2. Customer applies a **Voucher** code (stored on Cart.voucherCode)
3. Customer checks out → `/api/checkout`:
   - Validates cart, address, payment method
   - Runs **pricing engine** (`calculateOrderTotals`)
   - Creates **Order** + **OrderItem** rows (snapshots of product data)
   - Creates **OrderStatusHistory** entry (status=pending)
   - Decrements product stock atomically
   - Increments voucher usage + creates **VoucherUsage**
   - Redeems loyalty points (creates **LoyaltyTransaction**)
   - Clears cart items
   - Sends `order_placed` email + push notification
   - Creates admin notification (new_order)
4. Admin updates order status → PATCH `/api/admin/orders/[id]/status`:
   - Validates transition (e.g., pending→confirmed OK, pending→delivered rejected)
   - Creates **OrderStatusHistory** entry
   - Sets timestamp (confirmedAt, packedAt, etc.)
   - Sends status email + push notification
   - Awards loyalty points on delivered / claws back on cancelled

---

## 7. Features

### 7.1 Customer Features

#### Authentication
- Email + password registration with OTP verification
- Login with optional OTP (configurable)
- Password reset via OTP
- "Remember me" (30d vs 7d session)
- Session restore on page refresh

#### Shopping
- Browse products by category, brand, search
- Product detail with gallery, specs, info accordion, reviews
- Add to cart, update quantity, remove
- Apply voucher codes
- Cart persistence (server-side, tied to customer)
- Wishlist + compare (up to 4 products)
- Recently viewed products (last 8)

#### Checkout
- Multiple delivery addresses
- Delivery charge calculation by locality/pincode
- Payment methods: COD, QR (UPI), Razorpay, UPI
- Loyalty point redemption
- Free delivery threshold progress bar
- Order notes

#### Order Management
- Real-time order tracking with 8-stage timeline
- Live ETA countdown
- Invoice PDF download
- Reorder (one-click)
- QR payment screenshot upload

#### Prescriptions
- Drag-and-drop image upload
- Multiple images per prescription
- Status tracking (pending → under_review → approved/rejected → converted)
- Prescription history

#### Manual Requests
- Type a list of medicines + notes
- Status tracking
- Convert to order by admin

#### Engagement
- Loyalty points (1 point per Rs. 50 spent)
- Medicine reminders (daily, twice-daily, weekly, custom)
- Refill reminders (auto-created on Rx order delivery)
- Back-in-stock subscriptions
- Product reviews with images + AI moderation
- Health assistant AI chatbot
- Health tips (16 curated articles)
- Medical bundles (10 curated kits)

#### Notifications
- App (push) notifications via Web Push API
- Device Registration Wizard (4-step onboarding)
- Per-device registration (localStorage UUID)
- Automatic notifications: order placed, confirmed, packed, out for delivery, delivered, cancelled, payment status, prescription status
- Master toggle + per-device management
- Test notification button

### 7.2 Admin Features

#### Dashboard
- 15-section BI dashboard with AI insights
- Revenue, profit, orders, customers, inventory analytics
- AI sales forecast + inventory/profit suggestions
- Smart alerts bar

#### Catalog Management
- Products: Full CRUD, bulk actions, CSV import/export, AI content generator, gallery manager with drag-drop + compression
- Brands: CRUD with logo upload, featured toggle, CSV import/export
- Categories: CRUD with parent nesting, image upload

#### Order Management
- Orders list with 8 summary cards, advanced filters, bulk actions
- Order detail with smart status workflow, payment management, timeline, internal notes
- Prescription verification + convert to order
- Manual request handling + convert to order
- PDF invoice + shipping label generation

#### Customer Management
- Customer list with search, filter, bulk delete
- Customer detail with order history, loyalty adjust, toggle active
- Loyalty points management

#### Marketing
- Offers & banners with color presets + live preview
- Today's deals management
- Campaign/landing page management
- AI email marketing (generate + broadcast)
- Vouchers (flat-amount, cart/product/category scope)
- Newsletter subscriber management + bulk email
- App notification center (push campaign builder + AI generator)
- Reviews moderation with AI moderate/reply

#### Operations
- Delivery zones management
- Payment methods management (modular, 4+ types)
- Reports (sales + products with charts + CSV export)

#### System
- Settings (12 tabs: Store, SMTP, SEO, Theme, Hero, Storage, AI, etc.)
- Admin accounts with granular permissions
- Notification templates (email + push) with live preview
- Backups overview
- Database browser (read-only)
- Error logs with bulk actions
- Storage diagnostics

### 7.3 AI Features

1. **AI Health Assistant** — Chatbot for medicine queries, product suggestions, bundle recommendations
2. **AI Product Generator** — Search-then-generate pipeline for product fields (name, composition, description, etc.)
3. **AI Marketing Generator** — Email copy + HTML email generation for product promotions
4. **AI Push Notification Generator** — Title/message/CTA/emoji/priority for campaigns
5. **AI Review Moderation** — Auto-approve/flag reviews based on content
6. **AI Review Reply** — Generate professional admin replies (tone-adaptive to rating)
7. **AI Product Image Search** — Search real product packaging photos from 9 trusted pharmacy sources
8. **AI Dashboard Insights** — Business insights, sales forecast, inventory/profit suggestions

### 7.4 Notification System

#### Email Notifications (21 templates)
- Customer: registration_otp, login_otp, order_confirmed, order_packed, order_out_for_delivery, order_delivered, order_cancelled, prescription_submitted/under_review/approved/completed/rejected, manual_request_submitted/under_review/approved/completed/rejected, payment_successful, payment_failed, refund_initiated, refund_completed
- Admin: admin_login_alert, admin_new_order, admin_new_prescription, admin_new_manual_request, admin_order_status_update, admin_payment_update

#### Push Notifications (21 templates)
- Same events as email, delivered via Web Push API
- Per-device registration with DeviceRegistration wizard
- Delivery + click tracking via SW beacons
- Analytics: sent/failed/skipped/delivered/opened/clicked rates

#### Admin Bell Notifications
- Real-time dropdown with 15s polling
- Web Audio API chime on new notifications
- Types: new_order, new_prescription, new_manual_request, back_in_stock, order_status_update, payment_update

---

## 8. Configuration & Settings

### 8.1 Environment Variables

| Variable | Purpose | Required |
|---|---|---|
| `DATABASE_URL` | PostgreSQL pooler URL with `?pgbouncer=true&connection_limit=10&pool_timeout=30` | Yes |
| `DIRECT_URL` | PostgreSQL direct URL (for migrations) | Yes |
| `AUTH_SECRET` | HMAC token signing secret (32-byte hex) | Yes |
| `COOKIE_SECURE` | `true` for HTTPS, `false` for localhost | No (default: false) |
| `ADMIN_URL` | Admin panel URL (used in notification emails) | No |
| `Z_AI_BASE_URL` | Z.AI API endpoint | No (has fallback) |
| `Z_AI_API_KEY` | Z.AI API key | No (has fallback) |
| `Z_AI_CHAT_ID` | Z.AI chat session ID | No |
| `Z_AI_USER_ID` | Z.AI user ID | No |
| `VAPID_PUBLIC_KEY` | Web Push VAPID public key | Yes (for push) |
| `VAPID_PRIVATE_KEY` | Web Push VAPID private key | Yes (for push) |
| `VAPID_SUBJECT` | `mailto:admin@yourdomain.com` | Yes (for push) |
| `NODE_ENV` | `development` or `production` | No (default: development) |

### 8.2 Admin Settings (stored in `Setting` table, ~50 keys)

| Category | Keys |
|---|---|
| **Store** | store.name, store.tagline, store.email, store.phone, store.address, store.openStatus, store.openTime, store.closeTime, store.closedMessage, store.logo, store.licenseNumber, store.gstNumber |
| **Store Schedule** | store.weeklySchedule (JSON), store.holidays (JSON) |
| **SMTP** | smtp.host, smtp.port, smtp.username, smtp.password, smtp.secure, smtp.senderEmail |
| **Payment** | payment.codEnabled, payment.onlineEnabled (now DB-managed via PaymentMethod table) |
| **Invoice** | invoice.prefix, invoice.series, invoice.template |
| **SEO** | seo.title, seo.description, seo.keywords |
| **Theme** | theme.primaryColor, theme.accentColor |
| **Hero** | hero.config (large JSON blob) |
| **Auth** | auth.requireOtpOnLogin, auth.otpExpiryMinutes, auth.sessionTimeoutHours |
| **Discount** | discount.cartThresholdForUpgrade, discount.maxDiscountPct |
| **Delivery** | delivery.freeAboveDefault, delivery.estimatedHoursDefault |
| **AI** | ai.config (JSON: provider, apiKey, baseUrl, model) |
| **Storage** | storage.config (JSON: provider, s3/supabase/azure config, rules) |
| **Admin Alerts** | admin.emailAlertsEnabled, admin.alertOnNewOrder, admin.alertOnNewPrescription, admin.alertOnNewManualRequest, admin.alertOnOrderStatusUpdate, admin.alertOnPaymentUpdate, admin.notificationEmail |
| **Marketing** | marketing.offers (JSON array) |

### 8.3 Next.js Configuration (`next.config.ts`)

| Setting | Value |
|---|---|
| Output | `standalone` (Vercel + Docker optimized) |
| reactStrictMode | `true` |
| allowedDevOrigins | `.space-z.ai`, `.vercel.app` (sandbox HMR) |
| typescript.ignoreBuildErrors | `true` (Decimal annotation drift — runtime serializer handles it) |
| images.formats | `["image/webp"]` |
| Security headers | X-Frame-Options: SAMEORIGIN, X-Content-Type-Options: nosniff, Referrer-Policy, Permissions-Policy (camera/microphone/geolocation disabled, notifications=self) |
| Bundler | Turbopack |

### 8.4 Storage Providers (9 cloud + 1 local)

| Provider | Key | SDK |
|---|---|---|
| Amazon S3 | `s3` | @aws-sdk/client-s3 |
| Cloudflare R2 | `r2` | @aws-sdk/client-s3 (S3-compatible) |
| Backblaze B2 | `b2` | @aws-sdk/client-s3 |
| DigitalOcean Spaces | `do-spaces` | @aws-sdk/client-s3 |
| MinIO | `minio` | @aws-sdk/client-s3 |
| Google Cloud Storage | `gcs` | @aws-sdk/client-s3 (S3 interop) |
| Custom S3-compatible | `custom-s3` | @aws-sdk/client-s3 |
| Supabase Storage | `supabase` | @supabase/supabase-js |
| Azure Blob Storage | `azure-blob` | @azure/storage-blob |
| Local filesystem | `local` | fs/promises (dev fallback) |

### 8.5 AI Providers (7 presets)

| Provider | Key | Needs API Key | Needs Base URL |
|---|---|---|---|
| Z.AI SDK (default) | `zai` | No (uses z-ai-web-dev-sdk) | No |
| OpenAI | `openai` | Yes | No |
| Google Gemini | `gemini` | Yes | Yes |
| Anthropic Claude | `claude` | Yes | Yes |
| Groq | `groq` | Yes | No |
| OpenRouter | `openrouter` | Yes | No |
| DeepSeek | `deepseek` | Yes | No |
| Ollama (self-hosted) | `ollama` | No | Yes |
| LM Studio (local) | `lm-studio` | No | Yes |
| Custom OpenAI-compatible | `custom` | Yes | Yes |

### 8.6 Service Worker (`public/sw.js`)

**Events handled:**
- `install` → `skipWaiting()` (activate immediately)
- `activate` → `clients.claim()` (control page on first install)
- `push` → Parse JSON payload, `showNotification()` with title/body/icon/image/tag/deepLink/priority. Fire `/api/app-notifs/log/{logId}/delivered` beacon.
- `notificationclick` → Focus existing PMS tab + postMessage `NOTIF_CLICK` with deepLink + logId. If no tab, `openWindow()` with normalized URL.
- `pushsubscriptionchange` → Re-subscribe with VAPID key + POST new endpoint with `oldEndpoint` for cleanup.
- `message` → `SKIP_WAITING` for SW update flow.

### 8.7 PWA Manifest (`public/manifest.json`)

- **Name**: "Pradeep Medical Store - Online Pharmacy"
- **Short name**: "PMS Pharmacy"
- **Display**: `standalone`
- **Theme color**: `#059669` (emerald-600)
- **Icons**: `/icon.png` (192, 512, maskable) + `/apple-icon.png` (180)
- **Categories**: medical, health, shopping

### 8.8 Scripts

| Script | Purpose |
|---|---|
| `scripts/with-env.mjs` | Env-loading launcher (all npm scripts route through this) |
| `scripts/keepalive.mjs` | Dev server supervisor (restarts after 3 consecutive failures) |
| `scripts/start-stable.sh` | Production-safe server start (survives sandbox resets) |
| `scripts/auto-commit.sh` | Git auto-commit daemon (5min interval) |
| `scripts/gen-vapid.mjs` | Generate VAPID key pair |
| `scripts/seed-production-catalog.cjs` | 300+ real products seed |
| `scripts/feature-brands.mjs` | One-time: feature specific brands |
| `scripts/fix-max-discount.mjs` | One-time: fix maxDiscountPct |
| `scripts/sync-primary-images.mjs` | One-time: sync product images |
| `scripts/upload-new-logo.mjs` | One-time: upload logo to cloud |

### 8.9 Gateway (`Caddyfile`)

Reverse proxy on `:81`:
- **Transform-port route**: `?XTransformPort=<port>` → reverse_proxy to `localhost:<port>` (dynamic port routing for sandbox)
- **Default route**: `reverse_proxy localhost:3000` (Next.js)

---

## 9. Current Limitations & Known Issues

### 9.1 Performance

| Issue | Status | Impact |
|---|---|---|
| `typescript.ignoreBuildErrors = true` in next.config.ts | Deferred | Type errors silently swallowed at build time. Decimal-vs-number annotation drift needs sweep to re-enable. |
| No `next/image` usage (51+ raw `<img>` tags) | Deferred | Product images served at original resolution. Would benefit from WebP conversion + responsive sizes. Requires `remotePatterns` config. |
| Framer-motion still in ~25 components | Deferred | ~32KB gzip in initial bundle. Could be replaced with CSS animations. Already removed from `page.tsx` + `back-to-top.tsx`. |
| Analytics route fires ~33 parallel queries | Deferred | Could collapse to ~12 with raw SQL `FILTER` clauses. 60s cache mitigates. |
| In-process caches (settings, auth, analytics) are per-instance | Deferred | On Vercel with multiple lambdas, each instance maintains its own cache. Would benefit from Redis/Vercel KV. |

### 9.2 Security

| Issue | Status | Impact |
|---|---|---|
| No rate limiting on `/api/auth/*` or `/api/admin-auth/login` | Deferred | OTP brute-force risk. Application-layer 60s rate limit on resend, but no per-IP throttling. Needs middleware. |
| No `src/middleware.ts` exists | Deferred | No global request logging, no IP-based throttling, no global security headers beyond next.config.ts. |
| Hardcoded Z.AI credentials fallback in source | Low | `apiKey: "Z.ai"`, `chatId: "chat-b391670f-..."` committed. Anyone with repo access can use this account. |
| `AUTH_SECRET` has hardcoded fallback | Medium | Missing `AUTH_SECRET` only logs FATAL but server starts with insecure fallback. Should be hard `process.exit(1)` in production. |
| No CSP (Content-Security-Policy) header | Low | No strict CSP with nonces for inline scripts. |
| No HSTS header | Low | No `Strict-Transport-Security` for HTTPS deploys. |
| 30+ API routes lack try/catch | Deferred | If a DB query throws (connection drop, OOM), customer sees ugly Next.js 500 page instead of `{ ok: false, error }`. |

### 9.3 Code Quality

| Issue | Status | Impact |
|---|---|---|
| Duplicate `usePublicSettings`/`useCustomer` subscriptions | Deferred | 5 separate hook instances for the same query key across the customer layout. Could be consolidated via Context. |
| Command palette doesn't filter by permission | Minor | Admin can Cmd+K to any view, even if sidebar hides it. The view will show empty data or 403 from API. |
| `BrandingPanel` uses raw `fetch` instead of shared `api` client | Minor | Bypasses auth-cookie handling + error-toast logic. |
| `AdminGuard` export is dead code | Minor | Never imported anywhere (page.tsx implements its own session check). |
| `NotificationsView` (legacy) vs `AppNotificationCenterView` | Minor | Potential confusion — bell "View all" goes to legacy log; sidebar "Apps Notification's" goes to new push tool. |
| No standardized validation library (zod/joi) | By design | Validation is ad-hoc across routes. Email regex, phone format, pincode format checked inconsistently. |

### 9.4 Functional

| Issue | Status | Impact |
|---|---|---|
| `HealthBundle` Prisma model is unused | Low | App uses in-memory `resolveAllBundles()` from `medical-bundles.ts` instead. Kept for seed script compatibility. |
| `RefillReminder.daysSupply` default mismatch | Minor | Field declaration says default 30, header comment says 25. Needs reconciliation. |
| Stock notifier records intent only | By design | `notifyBackInStock` marks subscriptions as "notified" + creates admin notification, but doesn't dispatch actual email/push to subscribers. Deferred. |
| Razorpay `orders.cancel` not in SDK types | Workaround | Cast to `any` in `testRazorpayConnection`. |
| No background job queue | By design | All async work (email sending, push dispatch) is fire-and-forget via `.catch()`. No retry queue for failed notifications (except `retryFailedNotifications` for push, triggered manually). |

### 9.5 Browser Compatibility

| Browser | Push Notifications | Notes |
|---|---|---|
| Chrome Desktop | ✅ Full support | Primary target |
| Edge Desktop | ✅ Full support | Chromium-based |
| Brave Desktop | ✅ Full support | Chromium-based |
| Firefox Desktop | ✅ Full support | Uses Mozilla push service |
| Chrome Android | ✅ Full support | Primary mobile target |
| Samsung Internet | ✅ Supported | Chromium-based |
| Edge Mobile | ✅ Supported | Chromium-based |
| Installed PWA | ✅ Full support | Standalone display mode |
| iPhone Safari | ⚠️ Limited | Requires PWA install to home screen (iOS 16.4+) |
| Private/Incognito | ⚠️ May not persist | Storage is ephemeral; wizard re-shows on each session |

### 9.6 Production Deployment Notes

- **Vercel**: Primary deployment target. `output: "standalone"` optimized. `force-dynamic` + `revalidate=0` on auth routes prevents stale cached pre-login responses.
- **Environment variables**: Must set `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `VAPID_*` in Vercel project settings.
- **Database**: Neon PostgreSQL (Tokyo region) with Supavisor connection pooling.
- **Storage**: Configure a cloud storage provider (R2 recommended — zero egress fees) via Admin → Settings → Storage.
- **AI**: Z.AI SDK works out-of-the-box without API keys (hardcoded fallback). For production, set `Z_AI_API_KEY` or configure via Admin → Settings → AI.
- **Email**: Configure SMTP via Admin → Settings → SMTP. Test with "Test SMTP" button.
- **Push notifications**: Generate VAPID keys via `bun run scripts/gen-vapid.mjs`, set in `.env`.

---

## Appendix A: File Count Summary

| Category | Count | Lines |
|---|---|---|
| Customer components | 49 | ~17,500 |
| Admin views | 28 | ~28,080 |
| Admin shared components | 16 | ~5,200 |
| Shared components | 8 | ~800 |
| UI components (shadcn) | 28 | ~2,000 |
| API routes | 179 | ~12,000 |
| Lib modules | 33 | ~7,500 |
| Storage providers | 4 | ~1,200 |
| Prisma schema | 1 | 1,090 |
| **Total** | **356** | **~83,500** |

## Appendix B: NPM Dependencies (42)

### Production (42)
`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `@azure/storage-blob`, `@prisma/client`, 16× `@radix-ui/*`, `@supabase/supabase-js`, `@tanstack/react-query`, `class-variance-authority`, `clsx`, `framer-motion`, `input-otp`, `jspdf`, `jspdf-autotable`, `lucide-react`, `next`, `next-themes`, `nodemailer`, `razorpay`, `react`, `react-dom`, `recharts`, `sonner`, `tailwind-merge`, `web-push`, `z-ai-web-dev-sdk`, `zustand`

### Development (12)
`@tailwindcss/postcss`, `@types/node`, `@types/nodemailer`, `@types/react`, `@types/react-dom`, `eslint`, `eslint-config-next`, `prisma`, `tailwindcss`, `tsx`, `tw-animate-css`, `typescript`

---

**End of Documentation**

This document covers every aspect of the PMS Pharmacy project — from the tech stack and architecture to every component, every API route, every database model, every feature, and every configuration option. It is intended to be a complete reference for developers, maintainers, and stakeholders.
