// ============================================================================
// File: src/app/api/settings/public/route.ts
// Purpose: Return only public-safe store settings for the customer site.
//          NEVER include SMTP/payment secrets.
// Role: Powers the customer header (store name, open status), footer, SEO meta,
//       delivery thresholds, payment-method toggles, theme, and offers.
//
//  Optimized (Phase 40.1): Single getAllSettings() call + single paymentMethods
//  query instead of 12 sequential getSetting() calls. The in-process cache
//  means getAllSettings() only hits the DB once per 30s anyway, but this is
//  cleaner and avoids 12 microtask hops.
// ============================================================================

import { getAllSettings } from "@/lib/settings";
import { okNoCache } from "@/lib/api";
import { db } from "@/lib/db";
import { PublicSettings } from "@/components/customer/api";

// Force dynamic rendering — settings change frequently via the admin panel
// and must never be served from a static cache.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  // Single getAllSettings() call — cached in-process for 30s (production)
  // or 5s (dev). This replaces 12 sequential getSetting() calls.
  const s = await getAllSettings();

  // Fetch active payment methods from DB (modular payment system) — single query.
  const paymentMethods = await db.paymentMethod.findMany({
    where: { isActive: true },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, key: true, label: true, description: true, icon: true, displayOrder: true },
  });

  // Parse marketing offers (stored as JSON string in settings)
  let offers: any[] = [];
  try {
    const raw = s["marketing.offers"];
    offers = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : [];
    offers = offers.filter((o: any) => o.isActive).sort((a: any, b: any) => a.displayOrder - b.displayOrder);
  } catch {
    offers = [];
  }

  const settings: PublicSettings = {
    store: {
      name: s["store.name"],
      tagline: s["store.tagline"],
      email: s["store.email"],
      phone: s["store.phone"],
      address: s["store.address"],
      openStatus: s["store.openStatus"],
      openTime: s["store.openTime"],
      closeTime: s["store.closeTime"],
      closedMessage: s["store.closedMessage"],
      logo: s["store.logo"],
      licenseNumber: s["store.licenseNumber"],
    },
    weeklySchedule: s["store.weeklySchedule"],
    holidays: s["store.holidays"],
    payment: {
      codEnabled: paymentMethods.some((p) => p.key === "cod"),
      onlineEnabled: paymentMethods.some((p) => p.key === "online" || p.key === "razorpay" || p.key === "cashfree"),
    },
    paymentMethods,
    hero: s["hero.config"],
    seo: {
      title: s["seo.title"],
      description: s["seo.description"],
      keywords: s["seo.keywords"],
    },
    theme: {
      primaryColor: s["theme.primaryColor"],
      accentColor: s["theme.accentColor"],
    },
    offers,
  };
  return okNoCache(settings);
}
