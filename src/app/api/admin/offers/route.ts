// ============================================================================
// File: src/app/api/admin/offers/route.ts
// Purpose: CRUD for promotional offers/banners. Stored in the Setting table
//          as JSON under key "marketing.offers". Public endpoint exposes
//          active offers to the customer website.
// ============================================================================

import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, parseBody } from "@/lib/api";
import { getSetting, setSetting } from "@/lib/settings";

interface Offer {
  id: string;
  title: string;
  subtitle?: string;
  ctaText?: string;
  ctaView?: string;
  bgColor: string;
  textColor: string;
  position: "top-banner" | "hero" | "mid-banner" | "custom";
  isActive: boolean;
  displayOrder: number;
  customHtml?: string;
  // Extended fields (added in Phase 3 redesign — safely optional)
  gradientTo?: string;
  useGradient?: boolean;
  startDate?: string;
  endDate?: string;
  [key: string]: any; // Allow any extra fields to pass through without breaking
}

async function getOffers(): Promise<Offer[]> {
  const raw = await getSetting<string | null>("marketing.offers");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw as string);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveOffers(offers: Offer[]) {
  await setSetting("marketing.offers", JSON.stringify(offers), "marketing");
}

export async function GET() {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const offers = await getOffers();
  return ok(offers);
}

export async function POST(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const body = await parseBody<Offer>(req);
  if (!body?.id || !body.title) return err("Offer id and title are required", 400);

  const offers = await getOffers();
  const idx = offers.findIndex((o) => o.id === body.id);
  if (idx >= 0) {
    offers[idx] = body;
  } else {
    offers.push(body);
  }
  offers.sort((a, b) => a.displayOrder - b.displayOrder);
  await saveOffers(offers);
  return ok(body);
}

export async function DELETE(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return err("Offer id is required", 400);

  const offers = await getOffers();
  const filtered = offers.filter((o) => o.id !== id);
  await saveOffers(filtered);
  return ok({ deleted: true });
}
