# PMS Pharmacy — Environment Configuration Guide

This document lists every environment variable required by the PMS Pharmacy project.

---

## Required Environment Variables

### Database

| Variable | Purpose | Required in Dev | Required in Production |
|----------|---------|-----------------|----------------------|
| `DATABASE_URL` | PostgreSQL connection string with pooler | Yes | Yes |
| `DIRECT_URL` | Direct PostgreSQL connection (for migrations) | Yes | Yes |

**Format:**
```
DATABASE_URL="postgresql://user:pass@host-pooler:6543/db?pgbouncer=true&connection_limit=10&pool_timeout=30"
DIRECT_URL="postgresql://user:pass@host:5432/db"
```

### Authentication

| Variable | Purpose | Required in Dev | Required in Production |
|----------|---------|-----------------|----------------------|
| `AUTH_SECRET` | HMAC-SHA256 token signing secret | Yes | Yes |
| `COOKIE_SECURE` | Set to `true` for HTTPS, `false` for localhost | No (defaults to `false`) | Yes (`true`) |

**Generate:** `openssl rand -hex 32`

### Web Push (VAPID)

| Variable | Purpose | Required in Dev | Required in Production |
|----------|---------|-----------------|----------------------|
| `VAPID_PUBLIC_KEY` | Web Push public key (base64url) | Yes | Yes |
| `VAPID_PRIVATE_KEY` | Web Push private key (base64url) | Yes | Yes |
| `VAPID_SUBJECT` | `mailto:admin@yourdomain.com` | Yes | Yes |

**Generate:** `bun run scripts/gen-vapid.mjs`

### Site URL

| Variable | Purpose | Required in Dev | Required in Production |
|----------|---------|-----------------|----------------------|
| `ADMIN_URL` | Admin panel URL (used in notification emails) | No | Yes |

### AI (Z.AI SDK) — Optional (has hardcoded fallback)

| Variable | Purpose | Required in Dev | Required in Production |
|----------|---------|-----------------|----------------------|
| `Z_AI_BASE_URL` | Z.AI API endpoint | No | No (has fallback) |
| `Z_AI_API_KEY` | Z.AI API key identifier | No | No (has fallback) |
| `Z_AI_TOKEN` | Z.AI JWT auth token | No | No (has fallback) |
| `Z_AI_CHAT_ID` | Z.AI chat session ID | No | No (has fallback) |
| `Z_AI_USER_ID` | Z.AI user ID | No | No (has fallback) |

**Note:** All Z.AI variables have a hardcoded fallback in `src/lib/ai-service.ts` that works without any configuration. Setting these env vars on Vercel is recommended for explicit configuration but not required.

### Runtime

| Variable | Purpose | Required in Dev | Required in Production |
|----------|---------|-----------------|----------------------|
| `NODE_ENV` | `development` or `production` | Set by Next.js | Set by Vercel |

---

## Vercel Deployment Checklist

1. Set `DATABASE_URL` with `?pgbouncer=true&connection_limit=10&pool_timeout=30`
2. Set `DIRECT_URL` (without pooler params)
3. Set `AUTH_SECRET` to a random 32-byte hex string
4. Set `COOKIE_SECURE=true`
5. Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
6. Set `ADMIN_URL` to your production URL
7. (Optional) Set `Z_AI_*` variables for explicit AI config
8. Deploy

---

## Files That Load Environment Variables

| File | Variables Used |
|------|---------------|
| `src/lib/db.ts` | `DATABASE_URL` (via Prisma) |
| `src/lib/auth.ts` | `AUTH_SECRET`, `COOKIE_SECURE` |
| `src/lib/push-service.ts` | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |
| `src/lib/ai-service.ts` | `Z_AI_BASE_URL`, `Z_AI_API_KEY`, `Z_AI_TOKEN`, `Z_AI_CHAT_ID`, `Z_AI_USER_ID` |
| `src/lib/constants.ts` | `ADMIN_URL` (via settings) |
| `prisma/schema.prisma` | `DATABASE_URL`, `DIRECT_URL` (via Prisma) |
