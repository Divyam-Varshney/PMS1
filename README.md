# PMS — Pradeep Medical Store

> Online Pharmacy Platform for Mathura, Uttar Pradesh.
> Next.js 16 · React 19 · TypeScript · Prisma + PostgreSQL (Neon) · Tailwind CSS 4 · shadcn/ui (New York).

---

## Overview

PMS is a full-stack online pharmacy storefront + admin panel. Customers can
browse a catalog of medicines, upload prescriptions, place orders with
delivery-zone-aware shipping, pay via Razorpay / COD, and track their orders.
Admins get a complete management console for products, brands, categories,
orders, customers, deals, vouchers, delivery zones, payment methods,
prescription verification, AI-powered health assistant, App Notifications,
AI Email Marketing, and a BI Dashboard with AI insights.

## Tech Stack

| Layer            | Choice                                                      |
| ---------------- | ----------------------------------------------------------- |
| Framework        | Next.js 16 (App Router) — Turbopack dev bundler             |
| Language         | TypeScript 5 (strict)                                       |
| Database         | PostgreSQL on Neon (pooler)                                |
| ORM              | Prisma 6.x                                                  |
| Styling          | Tailwind CSS 4 + shadcn/ui (New York) + Lucide icons        |
| State            | Zustand (client) + TanStack Query (server)                 |
| Animation        | Framer Motion                                               |
| Auth             | Custom OTP-based flow, scrypt + HMAC-SHA256 session tokens  |
| Payments         | Razorpay + Cash on Delivery                                |
| AI               | Z.AI SDK (GLM) — hardcoded fallback for production          |
| Push             | Web Push API + VAPID + Service Worker (PWA)                 |
| Storage          | Cloudflare R2 (S3-compatible)                               |
| Emails           | Nodemailer + premium dark-themed HTML templates             |

## Project Structure

```
prisma/
├── schema.prisma          # 39 models, PostgreSQL
└── seed.ts                # Demo data (admin, products, vouchers...)
public/                    # Static assets (icons, manifest, sw.js, robots.txt)
scripts/                   # with-env.mjs, gen-vapid.mjs, auto-commit.sh
src/
├── app/
│   ├── api/               # 171 API routes
│   ├── admin/             # Admin panel (dynamic imports all 28 views)
│   ├── p/[slug]/          # SEO product page (SSG)
│   ├── products/[slug]/   # Product redirect page
│   ├── layout.tsx        # Root layout (SWRegister, SonnerToaster)
│   ├── page.tsx          # Customer SPA router (hash-based routing)
│   └── globals.css       # Tailwind 4 + premium polish
├── components/
│   ├── admin/            # 28 views + AdminLayout + admin-store
│   ├── customer/         # 41 components (home, shop, product, cart, etc.)
│   ├── shared/           # 8 shared (product-card, reviews, sw-register)
│   └── ui/               # 28 shadcn/ui components
└── lib/                  # 30 modules (auth, db, AI, push, notifications, etc.)
```

## Key Features

### Customer Portal
- Homepage with hero, categories, brands, featured products, deals, bundles
- Shop page with infinite scroll, advanced filters, sort
- Product detail with gallery, reviews, recommendations
- Cart with voucher application, loyalty redemption
- Checkout with Razorpay / COD, delivery zone matching
- OTP-based authentication (email + phone)
- Prescription upload + manual medicine request
- Wishlist, order tracking, address management
- PMS AI Health Assistant widget
- PWA with push notifications (App Notifications)

### Admin Panel
- **BI Dashboard** — 15-section analytics with AI insights, profit tracking, sales forecast
- **Products** — Full CRUD, bulk import/export, AI content generation, gallery manager
- **Orders** — Enterprise order management with timeline, smart status workflow, payment management, bulk actions
- **Customers** — Full CRM with loyalty, order history, addresses
- **Templates** — 3 channels: Customer Email (23), Admin Email (6), App Notifications (21)
- **Apps Notification's Center** — AI campaign generator, product selection, broadcast to all customers
- **AI Email Marketing** — Multi-product campaigns, HTML email generation, broadcast + test send
- **Reviews** — AI moderation, AI reply generation, image uploads, analytics
- **Settings** — Store info with master logo, SMTP, storage (R2), AI config, SEO, theme, hero
- **Brands & Categories** — Brand visibility (logo required for public), image management
- **Delivery Zones** — Zone-based charges, minimum order rules
- **Payment Methods** — Razorpay, COD, UPI/QR with test connectivity
- **Vouchers, Deals, Offers, Campaigns** — Full promotional toolkit
- **Reports** — Sales + product analytics with CSV export
- **Admin Management** — 25 granular permissions, role-based access
- **Security** — Admin login alert email, error logging, backup management

### Core System
- **39 Prisma models** with 96 indexes
- **171 API routes** with auth protection on all admin routes
- **Real mobile push notifications** via Web Push API + VAPID + service worker
- **AI integration** with 4-priority config loader (env → file → DB → hardcoded fallback)
- **Premium dark-themed email templates** (27 templates)
- **Cloudflare R2** storage for product images, prescriptions, branding
- **Admin login security** — email notification with IP, browser, device, OS
- **Smart status workflow** — prevents invalid order transitions
- **Payment management** — 7 payment statuses with auto email + push triggers

## Getting Started

### Prerequisites
- Node.js 18+ / Bun
- PostgreSQL database (Neon, Supabase, or local)
- Cloudflare R2 account (for image storage) — optional, local storage works for dev

### Installation

```bash
# Clone the repository
git clone https://github.com/Divyam-Varshney/PMS1.git
cd PMS1

# Install dependencies
bun install

# Copy environment file and configure
cp .env.example .env
# Edit .env with your database URL, auth secret, and VAPID keys

# Generate VAPID keys for push notifications
bun run scripts/gen-vapid.mjs

# Push database schema
bun run db:push

# Start development server
bun run dev
```

### Environment Variables

See `.env.example` for all required variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL pooler URL (with `?pgbouncer=true`) |
| `DIRECT_URL` | Yes | PostgreSQL direct URL (for migrations) |
| `AUTH_SECRET` | Yes | HMAC token signing secret (`openssl rand -hex 32`) |
| `VAPID_PUBLIC_KEY` | Yes | Web Push public key (generate with `gen-vapid.mjs`) |
| `VAPID_PRIVATE_KEY` | Yes | Web Push private key |
| `VAPID_SUBJECT` | No | Default: `mailto:admin@pradeepmedicalstore.in` |
| `Z_AI_*` | No | AI config (optional — hardcoded fallback works) |
| `COOKIE_SECURE` | No | Default: `false` (set `true` for HTTPS production) |

### Admin Access

Default admin credentials (from seed):
- Email: `admin@pradeepmedical.com`
- Password: `admin123`

## Production Deployment (Vercel)

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables (DATABASE_URL, DIRECT_URL, AUTH_SECRET, VAPID_*)
4. Deploy — AI works automatically (hardcoded Z.AI fallback)
5. Configure SMTP in Admin → Settings → SMTP
6. Configure R2 storage in Admin → Settings → Storage
7. Upload logo in Admin → Settings → Store Information

## Security

- All 101 admin API routes have `getAdminFromRequest()` auth check
- OTP rate limiting (5 attempts max)
- httpOnly + secure + sameSite=lax cookies
- sanitizeHtml() on all `dangerouslySetInnerHTML`
- Prisma parameterized queries (no SQL injection)
- Security headers: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- Admin login alert email (IP, browser, device, OS)
- File upload validation (MIME + size)

## Performance

- Dashboard cached (60s analytics, 5min AI insights)
- 31 admin + 24 customer dynamic imports (code splitting)
- 47/80 homepage images lazy loaded
- 96 Prisma indexes
- WebP image optimization
- API response times: 0.2-0.7s (customer), 0.2-2.5s (admin)

## Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start dev server (port 3000) |
| `bun run build` | Production build |
| `bun run start` | Start production server |
| `bun run lint` | ESLint check |
| `bun run db:push` | Push Prisma schema to database |
| `bun run db:seed` | Seed demo data |
| `bun run db:studio` | Prisma Studio |
| `bun run scripts/gen-vapid.mjs` | Generate VAPID keys |

## License

Proprietary — Pradeep Medical Store, Mathura
