// ============================================================================
// File: src/app/api/admin/categories/[id]/image/route.ts
// Purpose: Upload a category image. Uses the cloud storage service so uploads
//          persist on Vercel's read-only filesystem. Deletes the previous
//          image to avoid orphans.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, notFound } from "@/lib/api";
import { storage, StorageError } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;

  const category = await db.category.findUnique({ where: { id } });
  if (!category) return notFound();

  const form = await req.formData();
  const file = form.getAll("file").find((f): f is File => f instanceof File);
  if (!file) return err("No file uploaded", 400);

  try {
    // Delete the previous image to avoid orphaned files.
    if (category.image) {
      await storage.delete("categories", category.image).catch(() => {});
    }

    const { url } = await storage.upload("categories", file, { ownerId: id });
    const updated = await db.category.update({ where: { id }, data: { image: url } });
    return ok({ category: updated, image: url });
  } catch (e) {
    if (e instanceof StorageError) return err(e.message, e.status);
    return err("Failed to upload image", 500);
  }
}

// ---------------------------------------------------------------------------
// DELETE — Remove the category image from cloud storage + clear the DB ref.
// ---------------------------------------------------------------------------
export async function DELETE(_req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;
  const category = await db.category.findUnique({ where: { id } });
  if (!category) return notFound();
  if (!category.image) return ok({ deleted: false, message: "No image to delete" });

  await storage.delete("categories", category.image).catch(() => {});
  const updated = await db.category.update({
    where: { id },
    data: { image: null },
  });
  return ok({ deleted: true, category: updated });
}
