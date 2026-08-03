// ============================================================================
// File: src/app/api/catalog/products/[slug]/route.ts
// Purpose: Fetch a single product by slug for the ProductView.
// Role: Returns full product details + brand + category + approved reviews.
//
// CRITICAL: `export const dynamic = "force-dynamic"` is REQUIRED on Vercel.
// Without it, Vercel caches API responses at the edge. When the build is
// deployed before products exist, the 404 responses get cached permanently.
// Adding this directive ensures the route is always executed server-side.
// ============================================================================

import { db } from "@/lib/db";
import { ok, notFound } from "@/lib/api";

// Force dynamic rendering — never cache this route on Vercel/CDN.
// Product detail pages must always hit the database for fresh data.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const product = await db.product.findFirst({
    where: {
      OR: [
        { slug },
        { id: slug }, // fallback: allow lookup by product ID too
      ],
      status: "active",
      visibility: "public",
    },
    include: {
      brand: { select: { id: true, name: true, slug: true, logo: true, displayMode: true } },
      category: { select: { id: true, name: true, slug: true } },
      images: {
        orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }, { createdAt: "asc" }],
      },
      reviews: {
        where: { status: "approved" },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
  if (!product) return notFound("Product not found");
  return ok(product);
}
