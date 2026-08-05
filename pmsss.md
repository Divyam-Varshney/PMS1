# PMS Pharmacy — Complete Project Setup & Deployment Guide

> **Pradeep Medical Store (PMS)** — A production-grade online pharmacy e-commerce platform.
> This guide covers everything from cloning the repository to deploying on Vercel.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Local Development Setup](#2-local-development-setup)
3. [Environment Variables](#3-environment-variables)
4. [Database Configuration](#4-database-configuration)
5. [Storage Configuration](#5-storage-configuration)
6. [AI (Z.AI SDK) Production Setup](#6-ai-zai-sdk-production-setup)
7. [Vercel Deployment Guide](#7-vercel-deployment-guide)
8. [Service Configuration](#8-service-configuration)
9. [Troubleshooting Guide](#9-troubleshooting-guide)
10. [Production Checklist](#10-production-checklist)

---

## 1. Project Overview

### Project Name

**PMS Pharmacy (Pradeep Medical Store)** — An online pharmacy platform serving Mathura, Uttar Pradesh, India.

### Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Framework** | Next.js 16 (App Router, Turbopack) | 16.1.1 |
| **UI Library** | React 19 | 19.0.0 |
| **Language** | TypeScript 5 | 5.x |
| **Database** | PostgreSQL (Neon serverless) | 15+ |
| **ORM** | Prisma 6 | 6.11.1 |
| **Styling** | Tailwind CSS 4 + shadcn/ui (New York) | 4.x |
| **State** | Zustand (client) + TanStack React Query (server) | 5.x / 5.x |
| **AI** | Z.AI SDK (z-ai-web-dev-sdk) | 0.0.18 |
| **Push Notifications** | Web Push API + VAPID + Service Worker | web-push 3.6.7 |
| **Email** | Nodemailer (SMTP) | 9.0.3 |
| **Payments** | Razorpay | 2.9.6 |
| **PDF** | jsPDF + jsPDF-AutoTable | 4.2.1 |
| **Charts** | Recharts | 2.15.4 |
| **Storage** | S3-compatible (AWS S3, Cloudflare R2, Supabase, Azure) | Multiple SDKs |

### Folder Structure

```
PMS-Pharmacy/
├── prisma/
│   ├── schema.prisma          # 40 database models
│   └── seed.ts                # Database seed script
├── public/
│   ├── sw.js                  # Service Worker (push notifications)
│   ├── manifest.json          # PWA manifest
│   ├── icon.png               # App icon (192/512px)
│   ├── logo.png               # Store logo
│   └── ...
├── scripts/
│   ├── with-env.mjs           # Env-loading launcher (all scripts route through this)
│   ├── gen-vapid.mjs          # Generate VAPID key pair
│   ├── keepalive.mjs          # Dev server supervisor
│   ├── auto-commit.sh         # Git auto-commit daemon
│   └── seed-production-catalog.cjs  # 300+ product seed
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root layout (font, providers, SW register)
│   │   ├── page.tsx           # Customer SPA router (single route, hash-based)
│   │   ├── globals.css        # Tailwind + custom CSS (749 lines)
│   │   ├── admin/
│   │   │   └── page.tsx       # Admin SPA router (session-gated)
│   │   └── api/               # 178 API routes (App Router conventions)
│   ├── components/
│   │   ├── admin/             # 16 shared admin components
│   │   │   └── views/         # 28 admin view components
│   │   ├── customer/          # 50 customer components
│   │   ├── shared/            # 8 shared components (product-card, etc.)
│   │   └── ui/                # 28 shadcn/ui components
│   ├── hooks/                 # Custom React hooks
│   └── lib/                   # 33 library modules
│       ├── ai-service.ts      # Z.AI SDK integration
│       ├── auth.ts            # Authentication (scrypt + HMAC tokens)
│       ├── app-notifs.ts      # Push notification service
│       ├── push-service.ts    # Web Push delivery (VAPID)
│       ├── pricing-engine.ts  # Order total calculation
│       ├── settings.ts        # Settings engine (key-value store)
│       ├── constants.ts       # All constants + email templates (21 templates)
│       ├── db.ts              # Prisma client singleton
│       └── storage/           # Storage provider abstraction (4 providers)
├── docs/                      # Documentation files
├── .env.example               # Environment variable template
├── .env                       # Your local environment (NEVER commit this)
├── next.config.ts             # Next.js configuration
├── package.json               # Dependencies + scripts
├── prisma/schema.prisma       # Database schema (40 models, 1090 lines)
└── worklog.md                 # Project worklog (9000+ lines)
```

### System Architecture

The project uses a **single-route SPA (Single Page Application)** pattern:

- **Customer site** (`/`): One Next.js route renders the entire customer app. URL hash determines the active view (`#v=shop`, `#v=product&productId=xxx`). Zustand store manages navigation.
- **Admin panel** (`/admin`): One Next.js route with session gate. 32 views lazy-loaded via `next/dynamic`.
- **API**: 178 routes under `src/app/api/` using Next.js App Router conventions. Standardized `{ ok, data }` or `{ ok: false, error }` response envelope.

### Main Modules

| Module | Description |
|--------|-------------|
| Customer Portal | Shopping, cart, checkout, orders, prescriptions, wishlist, reviews |
| Admin Panel | Dashboard, products, orders, customers, prescriptions, marketing, settings |
| AI Integration | Health assistant, product generator, marketing generator, dashboard insights |
| Notification System | Web Push (VAPID), 21 templates, device registration, broadcast campaigns |
| Email System | 21 email templates, SMTP via Nodemailer, admin alerts |
| Payment System | Razorpay, COD, QR code, UPI — modular payment methods |
| Storage System | S3-compatible cloud storage for product images, prescriptions, branding |

### Prerequisites

- **Node.js** 20+ (or Bun runtime)
- **PostgreSQL** 15+ (Neon, Supabase, or self-hosted)
- **Bun** (recommended package manager — `npm install -g bun`)
- **Git**

---

## 2. Local Development Setup

### Step 1: Clone the Repository

```bash
git clone https://github.com/Divyam-Varshney/PMS1.git
cd PMS1
```

### Step 2: Install Dependencies

```bash
bun install
```

This installs 610 packages and automatically runs `prisma generate` (via `postinstall` script).

### Step 3: Configure Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env` with your actual credentials (see [Section 3](#3-environment-variables) for details):

```bash
nano .env
```

Minimum required values to start:

```
DATABASE_URL="postgresql://user:password@host:6543/dbname?pgbouncer=true&connection_limit=10&pool_timeout=30"
DIRECT_URL="postgresql://user:password@host:5432/dbname"
AUTH_SECRET="any-random-32-byte-hex-string"
VAPID_PUBLIC_KEY="generated-vapid-public-key"
VAPID_PRIVATE_KEY="generated-vapid-private-key"
VAPID_SUBJECT="mailto:admin@yourdomain.com"
```

Generate VAPID keys:

```bash
bun run scripts/gen-vapid.mjs
```

Generate AUTH_SECRET:

```bash
openssl rand -hex 32
```

### Step 4: Database Setup

Push the schema to your database (creates all 40 tables):

```bash
bun run db:push
```

This runs `prisma db push` which synchronizes the Prisma schema with your PostgreSQL database.

### Step 5: Seed Data (Optional)

Seed the database with initial data (admin user, settings, brands, categories, products, vouchers, delivery zones, payment methods):

```bash
bun run db:seed
```

This creates:
- **Admin user**: `admin@pradeepmedical.com` / `admin123` (role: `super_admin`)
- **Settings**: All default settings from `src/lib/constants.ts`
- **Notification templates**: 21 email + 21 push templates
- **Brands**: 13 pharmacy brands (Cipla, Sun Pharma, etc.)
- **Categories**: 8 categories (Prescription Medicines, OTC, Wellness, etc.)
- **Products**: 16 demo products
- **Vouchers**: WELCOME50 + SAVE100
- **Delivery zones**: Mathura City + Vrindavan
- **Payment methods**: COD, QR, Razorpay, UPI

### Step 6: Start the Development Server

```bash
bun run dev
```

The server starts on `http://localhost:3000`.

### Step 7: Verify the Project

1. Open `http://localhost:3000` — customer portal should load
2. Open `http://localhost:3000/admin` — admin login should appear
3. Login with `admin@pradeepmedical.com` / `admin123`
4. Check the dashboard loads with analytics cards

---

## 3. Environment Variables

### Required Variables

| Variable | Purpose | Used By | Dev Required | Prod Required |
|----------|---------|---------|-------------|---------------|
| `DATABASE_URL` | PostgreSQL connection (pooler) with `?pgbouncer=true&connection_limit=10&pool_timeout=30` | Prisma, all API routes | Yes | Yes |
| `DIRECT_URL` | Direct PostgreSQL connection (for migrations, no pooler) | Prisma migrations | Yes | Yes |
| `AUTH_SECRET` | HMAC-SHA256 token signing secret | `src/lib/auth.ts` | Yes | Yes |
| `VAPID_PUBLIC_KEY` | Web Push public key (base64url) | `src/lib/push-service.ts`, customer components | Yes | Yes |
| `VAPID_PRIVATE_KEY` | Web Push private key (base64url) | `src/lib/push-service.ts` | Yes | Yes |
| `VAPID_SUBJECT` | Push sender identity (`mailto:admin@domain.com`) | `src/lib/push-service.ts` | Yes | Yes |

### Optional Variables

| Variable | Purpose | Used By | Default |
|----------|---------|---------|---------|
| `COOKIE_SECURE` | `true` for HTTPS, `false` for localhost | `src/lib/auth.ts` | `false` |
| `ADMIN_URL` | Admin panel URL (used in notification emails) | `src/lib/admin-notifications.ts` | — |
| `Z_AI_BASE_URL` | Z.AI API endpoint | `src/lib/ai-service.ts` | Hardcoded fallback |
| `Z_AI_API_KEY` | Z.AI API key identifier | `src/lib/ai-service.ts` | Hardcoded fallback |
| `Z_AI_TOKEN` | Z.AI JWT auth token | `src/lib/ai-service.ts` | Hardcoded fallback |
| `Z_AI_CHAT_ID` | Z.AI chat session ID | `src/lib/ai-service.ts` | Hardcoded fallback |
| `Z_AI_USER_ID` | Z.AI user ID | `src/lib/ai-service.ts` | Hardcoded fallback |
| `NODE_ENV` | `development` or `production` | Next.js runtime | `development` |

### Connection String Format

```
# Pooler connection (for app runtime)
DATABASE_URL="postgresql://USER:PASSWORD@HOST-pooler.region.aws.neon.tech/DBNAME?pgbouncer=true&connection_limit=10&pool_timeout=30"

# Direct connection (for migrations)
DIRECT_URL="postgresql://USER:PASSWORD@HOST.region.aws.neon.tech/DBNAME"
```

---

## 4. Database Configuration

### Database Provider

**PostgreSQL 15+** hosted on **Neon** (serverless PostgreSQL).

### How the Application Connects

1. **Prisma Client** (`src/lib/db.ts`): Singleton instance using `DATABASE_URL` (pooler connection)
2. **Prisma Migrations**: Uses `DIRECT_URL` (direct connection, no pooler)
3. **Connection Pooling**: Supavisor transaction-mode pooler with `connection_limit=10`

### Schema Synchronization

To push schema changes to the database:

```bash
bun run db:push
```

This command:
- Reads `prisma/schema.prisma` (40 models, 1090 lines)
- Compares with the current database state
- Applies changes (creates tables, adds columns, creates indexes)
- Does NOT destroy data (use `--accept-data-loss` for destructive changes)

### Database Models (40)

| Category | Models |
|----------|--------|
| E-commerce | Customer, Address, Product, ProductImage, Brand, Category, Cart, CartItem, Order, OrderItem, OrderStatusHistory, Voucher, VoucherUsage, DeliveryZone, PaymentMethod |
| Prescriptions | Prescription, ManualRequest |
| Auth | Otp, Admin |
| Notifications | NotificationLog, NotificationTemplate, AdminNotification, PushSubscription, AppNotifTemplate, AppNotifLog, AppNotifPreference, DeviceRegistration |
| Engagement | WishlistItem, Review, StockSubscription, MedicineReminder, RefillReminder, LoyaltyTransaction |
| Marketing | Offer, Deal, Campaign, NewsletterSubscriber |
| System | Setting, ErrorLog, HealthBundle |

### Backup Recommendations

1. **Neon automated backups**: Neon provides automatic point-in-time recovery
2. **Manual backup**: Use `pg_dump` or Neon's backup feature
3. **Storage backup**: Cloud storage providers (R2, S3) have built-in durability

### Restore Process

```bash
# Restore from a pg_dump backup
psql "postgresql://user:pass@host/db" < backup.sql

# Or use Neon's point-in-time recovery in the dashboard
```

---

## 5. Storage Configuration

### Storage Provider

The project supports **10 storage providers** via a unified abstraction (`src/lib/storage/`):

| Provider | Key | SDK |
|----------|-----|-----|
| Amazon S3 | `amazon-s3` | @aws-sdk/client-s3 |
| Cloudflare R2 | `cloudflare-r2` | @aws-sdk/client-s3 (S3-compatible) |
| Backblaze B2 | `backblaze-b2` | @aws-sdk/client-s3 |
| DigitalOcean Spaces | `digitalocean` | @aws-sdk/client-s3 |
| MinIO | `minio` | @aws-sdk/client-s3 |
| Google Cloud Storage | `gcs` | @aws-sdk/client-s3 |
| Custom S3-compatible | `custom-s3` | @aws-sdk/client-s3 |
| Supabase Storage | `supabase` | @supabase/supabase-js |
| Azure Blob Storage | `azure-blob` | @azure/storage-blob |
| Local filesystem | `local` | fs/promises (dev fallback) |

### Configuration

Storage is configured via **Admin Panel → Settings → Storage** tab. The configuration is stored in the `Setting` table under key `storage.config`.

### Development (Local)

- Default: Local filesystem (`public/uploads/<category>/`)
- No configuration needed — files are served by Next.js directly
- Categories: `products`, `brands`, `categories`, `qr-codes`, `store`, `prescriptions`, `payments`, `reviews`

### Production (Cloud)

1. Create a bucket on your chosen provider (Cloudflare R2 recommended — zero egress fees)
2. Go to Admin → Settings → Storage
3. Select your provider
4. Enter credentials (endpoint, region, bucket, access key, secret key)
5. Set public base URL (e.g., `https://pub-xxxxx.r2.dev`)
6. Click "Test Connection"
7. Click "Save"

### File Categories

| Category | Privacy | Used For |
|----------|---------|----------|
| products | Public | Product images |
| brands | Public | Brand logos |
| categories | Public | Category images |
| qr-codes | Public | Payment QR codes |
| store | Public | Store logo, favicon, OG image |
| prescriptions | Private | Customer prescription images |
| payments | Private | Payment screenshots |
| reviews | Public | Customer review photos |

Private files are served via authenticated proxy: `/api/file/[bucket]/[...key]`

---

## 6. AI (Z.AI SDK) Production Setup

### How the SDK is Initialized

The project uses the `z-ai-web-dev-sdk` package to power 8 AI features:
- AI Health Assistant (customer chatbot)
- AI Product Generator (admin)
- AI Marketing Generator (admin email marketing)
- AI Push Notification Generator
- AI Dashboard Insights (business analytics)
- AI Review Moderation + Reply
- AI Product Image Search

All AI calls go through `src/lib/ai-service.ts`.

### Configuration Priority (4 levels)

The SDK loads configuration in this order. The first source with valid config wins:

| Priority | Source | How to Configure |
|----------|--------|-----------------|
| **1** | Environment variables | Set `Z_AI_*` env vars on Vercel |
| **2** | `.z-ai-config` file | Place file at project root, home dir, or `/etc/` |
| **3** | Database settings | Admin Panel → Settings → AI tab |
| **4** | Hardcoded fallback | Already built into `ai-service.ts` (works zero-config) |

### The `token` Field (CRITICAL)

The `token` is a JWT (JSON Web Token) that authenticates requests to the Z.AI API. Without it, the API returns 401 Unauthorized.

- `apiKey: "Z.ai"` is just an identifier — NOT a real API key
- The `token` JWT is sent as the `X-Token` HTTP header
- The hardcoded fallback (Priority 4) already includes the token

### Production Fallback (Direct Fetch)

If the Z.AI SDK fails on Vercel (e.g., ESM import issues), the code automatically falls back to a **direct `fetch()` call** that constructs the HTTP request manually using the same config. This ensures AI works reliably in production regardless of SDK issues.

### Common Errors

| Error | Cause | Solution |
|-------|-------|---------|
| "AI insights temporarily unavailable" | Z.AI API call failed | Check token is configured |
| 401 Unauthorized | Missing/expired token | Ensure `token` JWT is in config |
| "Failed to construct ZAI instance" | SDK couldn't load config | Hardcoded fallback handles this |
| Timeout / no response | Z.AI API slow | 30s timeout built in |

### Verification

1. Open the customer site → click AI Health Assistant (bottom-right)
2. Send "I have a fever"
3. If you get a response with product suggestions, AI is working

---

## 7. Vercel Deployment Guide

### Step 1: Import the Repository

1. Go to https://vercel.com → New Project
2. Import your GitHub repository (`Divyam-Varshney/PMS1`)
3. Vercel auto-detects Next.js — keep default settings

### Step 2: Build Configuration

- **Framework Preset**: Next.js (auto-detected)
- **Build Command**: `next build` (Vercel handles this)
- **Output Directory**: `.next` (auto-detected)
- **Install Command**: `bun install` (or `npm install`)

### Step 3: Environment Variables

Go to **Settings → Environment Variables** and add each variable:

| Variable | Value | Required |
|----------|-------|----------|
| `DATABASE_URL` | `postgresql://...?pgbouncer=true&connection_limit=10&pool_timeout=30` | Yes |
| `DIRECT_URL` | `postgresql://...` (direct, no pooler) | Yes |
| `AUTH_SECRET` | Random 32-byte hex string | Yes |
| `COOKIE_SECURE` | `true` | Yes |
| `VAPID_PUBLIC_KEY` | Your VAPID public key | Yes |
| `VAPID_PRIVATE_KEY` | Your VAPID private key | Yes |
| `VAPID_SUBJECT` | `mailto:admin@yourdomain.com` | Yes |
| `ADMIN_URL` | `https://your-app.vercel.app/admin` | Yes |
| `Z_AI_BASE_URL` | `https://internal-api.z.ai/v1` | No (has fallback) |
| `Z_AI_API_KEY` | `Z.ai` | No (has fallback) |
| `Z_AI_TOKEN` | Your JWT token | No (has fallback) |
| `Z_AI_CHAT_ID` | Your chat ID | No (has fallback) |
| `Z_AI_USER_ID` | Your user ID | No (has fallback) |

### Step 4: Database Connection

1. Ensure your Neon/Supabase database allows connections from Vercel (0.0.0.0/0 for serverless)
2. The `DATABASE_URL` must include `?pgbouncer=true&connection_limit=10&pool_timeout=30` for connection pooling
3. Run `bun run db:push` locally to sync the schema before deploying

### Step 5: Storage Configuration

1. After deployment, login to admin panel
2. Go to Settings → Storage
3. Configure your cloud storage provider (R2 recommended)
4. Test the connection
5. Upload a test product image to verify

### Step 6: AI Configuration

AI works out-of-the-box with the hardcoded fallback. To verify:
1. Open the customer site
2. Click the AI Health Assistant widget
3. Send a test message

### Step 7: Domain Configuration (Optional)

1. Go to Settings → Domains in Vercel
2. Add your custom domain
3. Update DNS records as instructed
4. Update `ADMIN_URL` environment variable to match

### Step 8: Final Deployment Verification

1. Visit the deployed URL — customer portal should load
2. Visit `/admin` — admin login should appear
3. Login with `admin@pradeepmedical.com` / `admin123`
4. Check Dashboard loads with analytics
5. Check AI Health Assistant responds
6. Check product images load
7. Test checkout flow

---

## 8. Service Configuration

### Database (Neon PostgreSQL)

- **Purpose**: Stores all application data (40 models)
- **Modules**: All API routes, Prisma client
- **Configuration**: `DATABASE_URL` + `DIRECT_URL` env vars
- **Verification**: `curl https://your-app.vercel.app/api/health` returns 200

### Email (SMTP via Nodemailer)

- **Purpose**: Sends order confirmations, OTP emails, admin alerts
- **Modules**: `src/lib/notifications.ts`, all order/prescription routes
- **Configuration**: Admin → Settings → SMTP tab (host, port, username, password, secure)
- **Verification**: Admin → Settings → SMTP → "Test SMTP" button

### Web Push (VAPID)

- **Purpose**: Push notifications to customer devices
- **Modules**: `src/lib/push-service.ts`, `public/sw.js`, notification onboarding
- **Configuration**: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` env vars
- **Verification**: `curl https://your-app.vercel.app/api/push/vapid-public` returns public key

### AI (Z.AI SDK)

- **Purpose**: Health assistant, product generation, marketing, insights
- **Modules**: `src/lib/ai-service.ts`, health-assistant API, admin AI routes
- **Configuration**: Hardcoded fallback (zero-config) or `Z_AI_*` env vars
- **Verification**: AI Health Assistant responds to messages

### Storage (Cloud)

- **Purpose**: Product images, prescriptions, branding assets
- **Modules**: `src/lib/storage/`, all upload routes
- **Configuration**: Admin → Settings → Storage tab
- **Verification**: Upload a test image in admin product editor

### Payments (Razorpay)

- **Purpose**: Online payment processing
- **Modules**: `src/lib/razorpay.ts`, checkout routes
- **Configuration**: Admin → Settings → Payment Methods → Razorpay (Key ID + Secret)
- **Verification**: Admin → Payment Methods → "Test Connection"

---

## 9. Troubleshooting Guide

### Project Won't Start

| Cause | Solution |
|-------|----------|
| Missing `.env` file | Copy `.env.example` to `.env` and fill in values |
| Invalid `DATABASE_URL` | Check connection string format, ensure `?pgbouncer=true` |
| Port 3000 in use | Kill existing process: `lkill $(lsof -t -i:3000)` |
| Dependencies not installed | Run `bun install` |
| Prisma client not generated | Run `bun run db:generate` |

### Database Connection Failed

| Cause | Solution |
|-------|----------|
| Wrong connection string | Verify `DATABASE_URL` format: `postgresql://user:pass@host:6543/db?pgbouncer=true` |
| Pooler not enabled | Ensure `?pgbouncer=true` in `DATABASE_URL` |
| Connection limit too low | Use `connection_limit=10` (not 3) |
| IP not whitelisted | Neon/Supabase: allow `0.0.0.0/0` for serverless |
| Schema not pushed | Run `bun run db:push` |

### Images Not Loading

| Cause | Solution |
|-------|----------|
| Storage not configured | Admin → Settings → Storage → configure provider |
| Wrong bucket/endpoint | Verify storage credentials and bucket name |
| Product has no image | Upload images via admin product gallery |
| Old R2 bucket URL | Check `primaryImage` URLs match current bucket |
| CORS blocked | Ensure storage provider allows your domain |

### AI Integration Errors

| Cause | Solution |
|-------|----------|
| "Failed to parse URL" | SDK failed → code falls back to direct fetch automatically |
| 401 Unauthorized | Missing `token` JWT → hardcoded fallback includes it |
| "AI disabled" | Check Admin → Settings → AI → enabled = true |
| Timeout | Z.AI API slow → 30s timeout built in |
| Empty insights | API call failed → check Vercel function logs |

### Notification Errors

| Cause | Solution |
|-------|----------|
| "Could not enable notifications" | SW not active → refresh page, try again |
| Permission denied | Browser blocked notifications → check browser settings |
| "no active Service Worker" | SW registration failed → check `/sw.js` is accessible |
| Notifications not arriving | VAPID keys mismatch → verify env vars |
| Brave browser issues | Brave Shields block notifications → disable Shields for site |

### Build Failures

| Cause | Solution |
|-------|----------|
| TypeScript errors | `next.config.ts` has `ignoreBuildErrors: true` — should pass |
| Missing Prisma client | Run `bun run db:generate` before build |
| Memory limit | Vercel: increase function memory in settings |
| Large bundle | Check dynamic imports are used for heavy components |

### Deployment Failures

| Cause | Solution |
|-------|----------|
| Missing env vars | Set all required variables in Vercel settings |
| Database not accessible | Verify `DATABASE_URL` + `DIRECT_URL` are correct |
| Build timeout | Check for infinite loops in code |
| Prisma generate fails | Ensure `postinstall` script runs: `prisma generate` |

---

## 10. Production Checklist

Before deploying to production, verify each item:

### Environment Variables
- [ ] `DATABASE_URL` set with `?pgbouncer=true&connection_limit=10&pool_timeout=30`
- [ ] `DIRECT_URL` set (direct connection, no pooler)
- [ ] `AUTH_SECRET` set to a random 32-byte hex string
- [ ] `COOKIE_SECURE=true`
- [ ] `VAPID_PUBLIC_KEY` set
- [ ] `VAPID_PRIVATE_KEY` set
- [ ] `VAPID_SUBJECT` set
- [ ] `ADMIN_URL` set to production URL

### Database
- [ ] Schema pushed (`bun run db:push`)
- [ ] Seed data inserted (`bun run db:seed`)
- [ ] Admin user created
- [ ] Connection pooling enabled
- [ ] IP access set to `0.0.0.0/0` (for serverless)

### Storage
- [ ] Cloud storage provider configured (R2/S3/Supabase/Azure)
- [ ] Test connection passes
- [ ] Product images upload successfully
- [ ] Branding logo uploaded

### AI
- [ ] AI Health Assistant responds to messages
- [ ] Admin Dashboard shows AI insights
- [ ] AI Product Generator works
- [ ] No 401 errors in logs

### Notifications
- [ ] VAPID keys configured
- [ ] Service Worker registers (`/sw.js` accessible)
- [ ] Permission request works
- [ ] Test notification delivered
- [ ] Notification templates seeded

### Email
- [ ] SMTP configured (host, port, credentials)
- [ ] Test SMTP passes
- [ ] Order confirmation emails sent
- [ ] OTP emails delivered

### Payments
- [ ] Razorpay credentials configured (if using online payments)
- [ ] COD enabled
- [ ] QR code uploaded (if using QR payments)
- [ ] Test order checkout works

### Performance
- [ ] Homepage loads in < 3 seconds
- [ ] API response times < 1 second
- [ ] No horizontal scroll on mobile
- [ ] Images load correctly
- [ ] Lint passes (`bun run lint`)

### Security
- [ ] `.env` file NOT committed to git
- [ ] `COOKIE_SECURE=true`
- [ ] Admin credentials changed from default
- [ ] HTTPS enabled (Vercel handles this)

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `bun install` | Install dependencies |
| `bun run dev` | Start dev server (port 3000) |
| `bun run build` | Production build |
| `bun run start` | Start production server |
| `bun run lint` | Run ESLint |
| `bun run db:push` | Push schema to database |
| `bun run db:generate` | Generate Prisma client |
| `bun run db:seed` | Seed database with initial data |
| `bun run db:studio` | Open Prisma Studio (database GUI) |
| `bun run scripts/gen-vapid.mjs` | Generate VAPID key pair |

### Admin Credentials (after seed)

- **Email**: `admin@pradeepmedical.com`
- **Password**: `admin123`
- **URL**: `http://localhost:3000/admin` (dev) or `https://your-domain.vercel.app/admin` (prod)

### Key URLs

| URL | Purpose |
|-----|---------|
| `/` | Customer portal |
| `/admin` | Admin panel |
| `/api/health` | Health check |
| `/api/settings/public` | Public settings |
| `/api/push/vapid-public` | VAPID public key |
| `/sw.js` | Service Worker |
| `/manifest.json` | PWA manifest |

---

*This guide is based on the actual implementation of the PMS Pharmacy project as of August 2026. For the latest changes, refer to `worklog.md` in the repository root.*
