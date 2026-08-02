# Neon PostgreSQL Migration Guide

## Quick Start

When you have your Neon database credentials, update `.env`:

```env
DATABASE_URL="postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require&pgbouncer=true"
DIRECT_URL="postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require"
```

Then run:
```bash
bun run db:push    # Creates all tables on Neon
bun run db:seed    # Seeds admin + settings + categories + delivery zones + payment methods
```

## Neon Free Plan Evaluation

### Your Estimated Workload
- 2,000 customers/year
- 10,000-12,000 transactions/year (~27-33/day)
- 321 products, 110 brands, 8 categories

### Free Plan Limits
| Resource | Free Plan | Your Usage | Verdict |
|----------|-----------|------------|---------|
| Storage | 0.5 GB | ~50-100 MB | Sufficient |
| Compute hours | 100/month | ~90-150/month | EXCEEDS LIMIT |
| Auto-suspend | After 5 min idle | Cold starts 1-3s | Problematic |

### Recommendation: Launch Plan ($19/month)

The free plan's auto-suspend feature causes 1-3 second cold starts on every request after 5 min of inactivity. With ~100+ daily visitors, the database would be constantly waking up. Additionally, the estimated 90-150 compute hours/month exceeds the 100 free hour limit.

**The Launch plan ($19/month) provides:**
- 300 compute hours/month (covers your workload)
- 10 GB storage (10x your needs)
- No auto-suspend (always-on, zero cold starts)
- Sub-100ms query latency

**Free plan is OK for initial testing only (first 1-2 weeks). Upgrade before going live with real customers.**
