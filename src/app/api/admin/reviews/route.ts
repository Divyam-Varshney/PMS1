// ============================================================================
// File: src/app/api/admin/reviews/route.ts
// Purpose: List reviews with status filter + summary analytics.
//          GET ?status=pending|approved|rejected  &page=1 &pageSize=20
//          Returns { items, total, page, pageSize, totalPages, analytics }
//          where `analytics` has: avgRating, totalReviews, pendingCount,
//          approvedCount, rejectedCount, withImagesCount, flaggedCount.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, unauthorized, param, paramInt } from "@/lib/api";

export async function GET(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const status = param(req, "status");
  const page = Math.max(1, paramInt(req, "page", 1));
  const pageSize = Math.min(100, paramInt(req, "pageSize", 20));

  const where: any = {};
  if (status) where.status = status;

  const [total, items] = await Promise.all([
    db.review.count({ where }),
    db.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        product: { select: { id: true, name: true, slug: true } },
        customer: { select: { id: true, name: true } },
      },
    }),
  ]);

  // Hydrate admin reply author names in one batched query (avoids N+1).
  const adminIds = Array.from(
    new Set(
      items
        .map((r) => r.adminReplyBy)
        .filter((x): x is string => typeof x === "string" && x.length > 0)
    )
  );
  const admins = adminIds.length
    ? await db.admin.findMany({
        where: { id: { in: adminIds } },
        select: { id: true, name: true },
      })
    : [];
  const adminMap = new Map(admins.map((a) => [a.id, a.name]));
  const itemsWithAdminName = items.map((r) => {
    // Parse the JSON `images` column into a real array for the UI.
    let imageUrls: string[] = [];
    if (r.images) {
      try {
        const parsed = JSON.parse(r.images);
        if (Array.isArray(parsed)) {
          imageUrls = parsed.filter((s) => typeof s === "string" && s.trim());
        }
      } catch {
        imageUrls = [];
      }
    }
    return {
      ...r,
      images: imageUrls,
      adminReplyByName: r.adminReplyBy ? adminMap.get(r.adminReplyBy) ?? null : null,
    };
  });

  // ---- Summary analytics (across ALL reviews, ignoring the status filter) ----
  const allRows = await db.review.findMany({
    select: { rating: true, status: true, images: true, aiStatus: true },
  });
  const approvedRows = allRows.filter((r) => r.status === "approved");
  const avgRating =
    approvedRows.length > 0
      ? Math.round(
          (approvedRows.reduce((s, r) => s + r.rating, 0) / approvedRows.length) * 10
        ) / 10
      : 0;
  const withImagesCount = allRows.filter((r) => {
    if (!r.images) return false;
    try {
      const parsed = JSON.parse(r.images);
      return Array.isArray(parsed) && parsed.length > 0;
    } catch {
      return false;
    }
  }).length;
  const analytics = {
    avgRating,
    totalReviews: allRows.length,
    pendingCount: allRows.filter((r) => r.status === "pending").length,
    approvedCount: approvedRows.length,
    rejectedCount: allRows.filter((r) => r.status === "rejected").length,
    withImagesCount,
    flaggedCount: allRows.filter((r) => r.aiStatus === "flagged").length,
    autoApprovedCount: allRows.filter((r) => r.aiStatus === "auto_approved").length,
  };

  return ok({
    items: itemsWithAdminName,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    analytics,
  });
}
