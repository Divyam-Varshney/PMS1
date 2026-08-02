// ============================================================================
// File: src/app/api/admin/products/bulk/route.ts
// Purpose: Bulk actions on products — soft-delete (trash), bulk status change,
//          and permanent delete (for trashed products only).
//
//          Soft-delete moves products to "trashed" status (recoverable).
//          Hard delete is only allowed for products already in "trashed" status.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, parseBody } from "@/lib/api";
import { storage } from "@/lib/storage";

interface BulkBody {
  ids: string[];
  action?: "trash" | "activate" | "deactivate" | "permanent-delete";
}

export async function POST(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const body = await parseBody<BulkBody>(req);
  if (!body?.ids || !Array.isArray(body.ids) || body.ids.length === 0)
    return err("ids array is required", 400);

  const action = body.action || "trash";
  let trashed = 0;
  let activated = 0;
  let deactivated = 0;
  let permanentlyDeleted = 0;
  const errors: string[] = [];

  for (const id of body.ids) {
    try {
      if (action === "trash") {
        // Soft-delete: move to trashed status (recoverable)
        await db.product.update({
          where: { id },
          data: { status: "trashed", visibility: "hidden" },
        });
        trashed++;
      } else if (action === "activate") {
        await db.product.update({
          where: { id },
          data: { status: "active", visibility: "public" },
        });
        activated++;
      } else if (action === "deactivate") {
        await db.product.update({
          where: { id },
          data: { status: "inactive", visibility: "hidden" },
        });
        deactivated++;
      } else if (action === "permanent-delete") {
        // Only allow permanent delete for trashed products
        const product = await db.product.findUnique({
          where: { id },
          select: { status: true },
        });
        if (!product) {
          errors.push(`${id}: product not found`);
          continue;
        }
        if (product.status !== "trashed") {
          errors.push(`${id}: must be trashed before permanent delete`);
          continue;
        }
        // Check if product is referenced by orders — if so, can't delete
        const referenced = await db.orderItem.findFirst({ where: { productId: id } });
        if (referenced) {
          errors.push(`${id}: has orders, cannot permanently delete`);
          continue;
        }
        // Clean up related records
        const images = await db.productImage.findMany({
          where: { productId: id },
          select: { imagePath: true },
        });
        for (const img of images) {
          await storage.delete("products", img.imagePath).catch(() => {});
        }
        await db.productImage.deleteMany({ where: { productId: id } });
        await db.cartItem.deleteMany({ where: { productId: id } });
        await db.wishlistItem.deleteMany({ where: { productId: id } });
        await db.stockSubscription.deleteMany({ where: { productId: id } }).catch(() => {});
        await db.review.deleteMany({ where: { productId: id } }).catch(() => {});
        await db.deal.deleteMany({ where: { productId: id } }).catch(() => {});
        await db.product.delete({ where: { id } });
        permanentlyDeleted++;
      }
    } catch (e: any) {
      errors.push(`${id}: ${e?.message ?? "error"}`);
    }
  }

  return ok({
    trashed,
    activated,
    deactivated,
    permanentlyDeleted,
    errors,
    total: body.ids.length,
  });
}
