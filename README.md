# PMS — Pradeep Medical Store

> Online Pharmacy Platform for Mathura, Uttar Pradesh.
> Next.js 16 · React 19 · TypeScript · Prisma + PostgreSQL (Supabase) · Tailwind CSS 4 · shadcn/ui (New York).

---

## Overview

PMS is a full-stack online pharmacy storefront + admin panel. Customers can
browse a catalog of medicines, upload prescriptions, place orders with
delivery-zone-aware shipping, pay via Razorpay / COD, and track their orders.
Admins get a complete management console for products, brands, categories,
orders, customers, deals, vouchers, delivery zones, payment methods,
prescription verification, and an AI-powered health assistant widget.


## Tech Stack

| Layer            | Choice                                                      |
| ---------------- | ----------------------------------------------------------- |
| Framework        | Next.js 16 (App Router) — Turbopack dev bundler             |
| Language         | TypeScript 5 (strict)                                       |
| Database         | PostgreSQL on Supabase (Supavisor pooler)                  |
| ORM              | Prisma 6.x                                                  |
| Styling          | Tailwind CSS 4 + shadcn/ui (New York) + Lucide icons        |
| State            | Zustand (client) + TanStack Query (server)                 |
| Animation        | Framer Motion                                               |
| Auth             | Custom OTP-based flow, scrypt + HMAC-SHA256 session tokens  |
| Payments         | Razorpay + Cash on Delivery                                |
| Storage          | Provider-agnostic (9 cloud providers + local dev fallback) |
| PDF              | jsPDF + jsPDF-AutoTable (invoices)                          |
| Email            | Nodemailer (OTP / notifications)                            |
| AI               | z-ai-web-dev-sdk (LLM health assistant)                     |

## Project Structure

```
.
├── prisma/
│   ├── schema.prisma          # 29-model PostgreSQL schema
│   └── seed.ts                # Demo data (admin, products, vouchers...)
├── public/                    # Static assets + user uploads
├── scripts/
│   └── with-env.mjs           # Env launcher (forces .env to override system env)
├── src/
│   ├── app/
│   │   ├── api/               # 124 API routes
│   │   ├── admin/             # Admin panel route
│   │   ├── globals.css        # Tailwind + premium polish
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Customer storefront (SPA)
│   ├── components/
│   │   ├── admin/             # Admin panel views + storage settings
│   │   ├── customer/          # Storefront components
│   │   ├── shared/            # Shared components
│   │   └── ui/                # shadcn/ui primitives
│   ├── hooks/                 # React Query hooks
│   └── lib/
│       ├── storage/           # Provider-agnostic storage abstraction
│       │   ├── types.ts       # StorageProvider interface + 9 provider presets
│       │   ├── index.ts       # Facade — resolves active provider from DB
│       │   └── providers/     # local, s3, supabase, azure-blob
│       ├── db.ts              # Prisma client singleton
│       ├── auth.ts            # scrypt + HMAC session tokens
│       ├── api.ts             # ok()/err() response serializers
│       └── ...                # format, pricing, pdf, razorpay, etc.
├── .env                       # Environment variables (NOT committed)
├── .env.example               # Template — copy to .env and fill in
├── Caddyfile                  # Gateway config (port :81 → :3000)
├── bun.lock                   # Bun lockfile (canonical)
├── next.config.ts             # Next.js config (standalone, security headers)
├── package.json               # Scripts + dependencies
├── postcss.config.mjs         # Tailwind PostCSS plugin
├── tsconfig.json              # TypeScript config
└── eslint.config.mjs          # ESLint flat config
```

## Setup

### 1. Install dependencies

```bash
bun install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in real values:

```bash
cp .env.example .env
```

Required variables:
- `DATABASE_URL` — PostgreSQL pooler URL (port 6543, `?pgbouncer=true`)
- `DIRECT_URL` — PostgreSQL direct URL (port 5432, for migrations)
- `AUTH_SECRET` — long random hex string for signing session tokens
- `COOKIE_SECURE` — `"false"` for dev, `"true"` for HTTPS production

### 3. Initialize database

```bash
bun run db:push     # Sync Prisma schema to PostgreSQL
bun run db:seed     # Seed demo data (admin, products, vouchers...)
```

### 4. Run the dev server

```bash
bun run dev
```

This starts Next.js in dev mode with **Turbopack** on port 3000.
The first page load compiles on-demand (~10s); subsequent loads are fast.

### 5. Open the app

- **Customer storefront**: http://localhost:3000/
- **Admin panel**: http://localhost:3000/admin
  - Default admin: `admin@pradeepmedical.com` / `admin123`

## Cloud Storage Configuration

File uploads (product images, brand logos, prescriptions, payment screenshots)
use a **provider-agnostic storage system** configurable from the Admin Panel
→ Settings → Storage. No environment variables needed — everything is stored
in the database.

**Supported providers (9 + 1 dev fallback):**
- Cloudflare R2 (recommended — zero egress fees)
- Amazon S3
- Backblaze B2
- DigitalOcean Spaces
- MinIO (self-hosted)
- Google Cloud Storage
- Supabase Storage
- Azure Blob Storage
- Custom S3-compatible
- Local filesystem (dev only)

**To configure:** Admin → Settings → Storage → select provider → enter
credentials → Test Connection → Save. Switching providers later requires
only updating the config — no code changes.

Private files (prescriptions, payment screenshots) are served through an
authenticated proxy (`/api/file/...`) with time-limited signed URLs.

## Environment Variable Loading

The sandbox injects a default `DATABASE_URL=file:.../custom.db` (SQLite) into
the process environment. Next.js and Prisma both treat system env vars as
authoritative, so the SQLite URL was overriding the real PostgreSQL URL in
`.env`.

To fix this permanently, all npm scripts that need DB access run through
`scripts/with-env.mjs`, a tiny launcher that parses `.env` and **forces** those
values to override any same-named system env vars before exec'ing the command.

```json
"dev": "node scripts/with-env.mjs next dev --turbo -p 3000"
"db:push": "node scripts/with-env.mjs prisma db push"
```

## Available Scripts

| Script             | Description                                          |
| ------------------ | ---------------------------------------------------- |
| `bun run dev`      | Start Next.js dev server (Turbopack, port 3000)     |
| `bun run build`    | Production build (Turbopack, standalone output)      |
| `bun run start`    | Start production server (port 3000)                  |
| `bun run lint`     | Run ESLint                                           |
| `bun run db:push`  | Sync Prisma schema to PostgreSQL                     |
| `bun run db:generate` | Regenerate Prisma Client                          |
| `bun run db:seed`  | Seed demo data                                       |
| `bun run db:studio`| Open Prisma Studio GUI                               |

## Architecture Notes

### Database Connection Pooling

- `DATABASE_URL` uses Supabase Supavisor's transaction-mode pooler (port 6543)
  with `?pgbouncer=true&connection_limit=3` for serverless-friendly reuse.
- `DIRECT_URL` uses the session-mode pooler (port 5432) for migrations.
- `src/lib/db.ts` uses a `globalForPrisma` singleton to avoid exhausting
  connections during Next.js hot reloads.

### Authentication

- Customers register with email + OTP verification (Nodemailer).
- Admins log in with email + password (scrypt hashing).
- Session tokens are HMAC-SHA256 signed, stored in httpOnly cookies.
- 20 granular permission keys for admin roles (`super_admin`, `admin`, `manager`).

### API Design

- 124 API routes under `src/app/api/`.
- All responses go through `src/lib/api.ts`'s `ok()` / `err()` serializers,
  which convert Prisma `Decimal` values to numbers and `Date` values to ISO
  strings for JSON safety.
- Cart and checkout hot paths use `Promise.all` for parallel queries.

### Storage Architecture

- All uploads go through a single `storage` facade (`src/lib/storage/`).
- The active provider is resolved at runtime from the DB config (Setting key
  `storage.config`) — changing providers requires no code changes.
- Each provider implements the `StorageProvider` interface (`upload`, `delete`,
  `getPublicUrl`, `getSignedUrl`, `testConnection`).
- Automatic retry with exponential backoff on transient failures.
- Orphan cleanup: old files deleted when replaced or when their DB record is deleted.
- Private files use signed URLs (5-min expiry) via the authenticated proxy.

### Customer Storefront

The customer site is a single-page app at `/` driven by Zustand view-state
and Framer Motion transitions. Views include: home, shop, product detail,
cart, checkout, orders, order detail, wishlist, addresses, profile,
prescriptions, login, register, OTP verification, forgot password, about,
contact, and a floating AI health assistant widget.

### Admin Panel

The admin panel at `/admin` is a full management console with: dashboard
(revenue/profit charts, inventory alerts, storage health indicator, top
products/categories), products, brands, categories, orders, customers, deals,
vouchers, delivery zones, payment methods, prescriptions, manual requests,
newsletter subscribers, settings (incl. storage configuration), and admin
user management.

## Production Deployment

### Vercel (recommended)

1. Push the repo to GitHub and import it into Vercel.
2. Set environment variables in Vercel:
   - `DATABASE_URL` — Supabase pooler URL (port 6543)
   - `DIRECT_URL` — Supabase direct URL (port 5432)
   - `AUTH_SECRET` — strong random hex string
   - `COOKIE_SECURE` — `"true"`
3. Deploy — Vercel auto-detects Next.js and uses the `standalone` output.
4. After deploy, log into the Admin Panel → Settings → Storage and configure
   a cloud storage provider (recommended: **Cloudflare R2** for zero egress
   fees). This is required because Vercel has a read-only filesystem.

### Self-hosting (Docker / VPS)

1. Set `COOKIE_SECURE="true"` and a strong `AUTH_SECRET` in `.env`.
2. Run `bun run build` then `bun run start`.
3. Use a process manager (systemd, Docker, PM2) to keep it alive.
4. Configure a reverse proxy (Caddy/Nginx) with HTTPS.
#