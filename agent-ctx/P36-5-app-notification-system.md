# P36-5 — App Notification System (Web Push)

**Agent**: app-notification-system
**Date**: 2026-08-02
**Status**: ✅ Complete

## Summary

Built a complete Web Push notification system for the PMS pharmacy from scratch. Includes 4 Prisma models, a service worker, push delivery service, 18 default templates, transactional + broadcast sending, AI-assisted campaign content generation, customer preference UI, and a full admin center.

## Files created

### Prisma
- `prisma/schema.prisma` — added `PushSubscription`, `AppNotifTemplate`, `AppNotifLog`, `AppNotifPreference` models (before `ErrorLog`); added back-relations to `Customer`

### Service worker
- `public/sw.js` — push event + notificationclick + install/activate handlers

### Client components
- `src/components/shared/sw-register.tsx` — registers SW on idle
- `src/components/customer/notification-preferences.tsx` — customer account preferences card with enable/disable flow
- `src/components/admin/views/AppNotificationCenterView.tsx` — admin center with Create Campaign + History tabs

### Library
- `src/lib/push-service.ts` — VAPID config + `sendPushToCustomer` with auto-pruning
- `src/lib/app-notif-templates.ts` — 18 default templates
- `src/lib/app-notifs.ts` — `sendAutoNotification`, `broadcastCampaign`, `ensureTemplatesSeeded`, `getOrCreatePreference`, `getAnalytics`

### API routes (11)
Customer:
- `src/app/api/push/vapid-public/route.ts`
- `src/app/api/push/subscribe/route.ts`
- `src/app/api/push/unsubscribe/route.ts`
- `src/app/api/app-notifs/preferences/route.ts`
- `src/app/api/app-notifs/history/route.ts`

Admin:
- `src/app/api/admin/app-notifs/templates/route.ts`
- `src/app/api/admin/app-notifs/history/route.ts`
- `src/app/api/admin/app-notifs/analytics/route.ts`
- `src/app/api/admin/app-notifs/template-toggle/route.ts`
- `src/app/api/admin/app-notifs/broadcast/route.ts`
- `src/app/api/admin/app-notifs/generate/route.ts`

## Files modified
- `src/app/layout.tsx` — added `<SWRegister />`
- `src/components/customer/account-view.tsx` — added `<NotificationPreferences />` card
- `src/components/admin/admin-store.ts` — added `"app-notification-center"` to AdminView union
- `src/app/admin/page.tsx` — dynamic import + case for AppNotificationCenterView
- `src/components/admin/AdminLayout.tsx` — added Bell nav item (Marketing group, below Newsletter, newsletter permission), title map entry, Bell icon import
- `src/app/api/checkout/route.ts` — `sendAutoNotification("order_placed", ...)` after email
- `src/app/api/admin/orders/[id]/status/route.ts` — `sendAutoNotification` for status changes
- `src/app/api/admin/orders/[id]/prescription-verify/route.ts` — `sendAutoNotification` for approve/reject
- `src/app/api/admin/orders/[id]/payment/route.ts` — `sendAutoNotification` for payment status changes

## Verification
- ✅ Lint: 0 errors, 0 warnings
- ✅ db:push --accept-data-loss succeeded
- ✅ All 18 templates seeded (verified via API)
- ✅ Broadcast correctly skips customers without subscriptions
- ✅ AI generate returns valid JSON draft
- ✅ Template toggle works
- ✅ All endpoints return correct auth codes (401 unauth, 200 auth)
- ✅ Homepage, admin, and /sw.js all return 200
- ✅ No errors in dev server log

## Notes for future agents
- All push notifications use VAPID (env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`)
- Dead endpoints (404/410) are auto-pruned — no manual cleanup needed
- Customer preferences default to enabled=true (created lazily on first interaction)
- Broadcasts process in chunks of 20 customers to avoid overwhelming the DB / push service
- Push failures are wrapped in `.catch()` in every integration point — they never break the order/payment flow
