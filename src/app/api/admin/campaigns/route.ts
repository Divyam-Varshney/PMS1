// ============================================================================
// File: src/app/api/admin/campaigns/route.ts
// Purpose: CRUD for campaigns/landing pages. Admin-only.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, parseBody } from "@/lib/api";
import { slugify } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || undefined;
  const type = url.searchParams.get("type") || undefined;
  const search = url.searchParams.get("search") || undefined;

  const where: any = {};
  if (status) where.status = status;
  if (type) where.type = type;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    db.campaign.findMany({
      where,
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    }),
    db.campaign.count({ where }),
  ]);

  return ok({ items, total });
}

export async function POST(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const body = await parseBody<{
    title: string;
    slug?: string;
    type?: string;
    status?: string;
    bannerImage?: string;
    heroTitle?: string;
    heroSubtitle?: string;
    heroCtaText?: string;
    heroCtaLink?: string;
    promoText?: string;
    productIds?: string;
    categoryIds?: string;
    seoTitle?: string;
    metaDescription?: string;
    startDate?: string;
    endDate?: string;
    displayOrder?: number;
  }>(req);

  if (!body?.title) return err("Title is required", 400);

  const slug = body.slug ? slugify(body.slug) : slugify(body.title);

  // Check slug uniqueness
  const existing = await db.campaign.findUnique({ where: { slug } });
  if (existing) return err("A campaign with this slug already exists", 400);

  const campaign = await db.campaign.create({
    data: {
      title: body.title,
      slug,
      type: body.type || "landing",
      status: body.status || "draft",
      bannerImage: body.bannerImage || null,
      heroTitle: body.heroTitle || null,
      heroSubtitle: body.heroSubtitle || null,
      heroCtaText: body.heroCtaText || null,
      heroCtaLink: body.heroCtaLink || null,
      promoText: body.promoText || null,
      productIds: body.productIds || null,
      categoryIds: body.categoryIds || null,
      seoTitle: body.seoTitle || null,
      metaDescription: body.metaDescription || null,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      displayOrder: body.displayOrder ?? 0,
    },
  });

  return ok(campaign, 201);
}
