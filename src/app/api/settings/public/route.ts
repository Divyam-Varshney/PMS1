// ============================================================================
// File: src/app/api/settings/public/route.ts
// Purpose: Return only public-safe store settings for the customer site.
//          NEVER include SMTP/payment secrets.
// Role: Powers the customer header (store name, open status), footer, SEO meta,
//       delivery thresholds, payment-method toggles, theme, and offers.
// ============================================================================

import { getSetting } from "@/lib/settings";
import { okNoCache } from "@/lib/api";
import { db } from "@/lib/db";
import { PublicSettings } from "@/components/customer/api";

// Force dynamic rendering — settings change frequently via the admin panel
// and must never be served from a static cache.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  // Parse marketing offers (stored as JSON string in settings)
  let offers: any[] = [];
  try {
    const raw = await getSetting<string | null>("marketing.offers");
    offers = raw ? JSON.parse(raw as string) : [];
    offers = offers.filter((o: any) => o.isActive).sort((a: any, b: any) => a.displayOrder - b.displayOrder);
  } catch {
    offers = [];
  }

  // Fetch active payment methods from DB (modular payment system)
  const paymentMethods = await db.paymentMethod.findMany({
    where: { isActive: true },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, key: true, label: true, description: true, icon: true, displayOrder: true },
  });

  // Hero section config (admin-editable via Settings → Hero). Stored as a
  // single JSON blob under `hero.config` so the whole object — including the
  // cards and trustFeatures arrays — updates atomically.
  const hero = await getSetting<any>("hero.config");

  const settings: PublicSettings = {
    store: {
      name: await getSetting<string>("store.name"),
      tagline: await getSetting<string>("store.tagline"),
      email: await getSetting<string>("store.email"),
      phone: await getSetting<string>("store.phone"),
      address: await getSetting<string>("store.address"),
      openStatus: await getSetting<boolean>("store.openStatus"),
      openTime: await getSetting<string>("store.openTime"),
      closeTime: await getSetting<string>("store.closeTime"),
      closedMessage: await getSetting<string>("store.closedMessage"),
      logo: await getSetting<string>("store.logo"),
      licenseNumber: await getSetting<string>("store.licenseNumber"),
    },
    weeklySchedule: await getSetting<any>("store.weeklySchedule"),
    holidays: await getSetting<any>("store.holidays"),
    // Payment methods are now DB-managed (admin can add/enable/disable from Admin Panel)
    payment: {
      codEnabled: paymentMethods.some((p) => p.key === "cod"),
      onlineEnabled: paymentMethods.some((p) => p.key === "online" || p.key === "razorpay" || p.key === "cashfree"),
    },
    paymentMethods,
    hero,
    seo: {
      title: await getSetting<string>("seo.title"),
      description: await getSetting<string>("seo.description"),
      keywords: await getSetting<string>("seo.keywords"),
    },
    theme: {
      primaryColor: await getSetting<string>("theme.primaryColor"),
      accentColor: await getSetting<string>("theme.accentColor"),
    },
    offers,
  };
  return okNoCache(settings);
}
