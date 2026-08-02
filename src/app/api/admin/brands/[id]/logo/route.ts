// ============================================================================
// File: src/app/api/admin/brands/[id]/logo/route.ts
// Purpose: Upload a brand logo. Uses the cloud storage service (Supabase
//          Storage in production, local filesystem in dev) so uploads persist
//          on Vercel's read-only filesystem.
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
  const brand = await db.brand.findUnique({ where: { id } });
  if (!brand) return notFound();

  const form = await req.formData();
  const file = form.getAll("file").find((f): f is File => f instanceof File);
  if (!file) return err("No file uploaded", 400);

  try {
    // Delete the previous logo to avoid orphaned files.
    if (brand.logo) {
      await storage.delete("brands", brand.logo).catch(() => {});
    }

    const { url } = await storage.upload("brands", file, { ownerId: id });
    const updated = await db.brand.update({ where: { id }, data: { logo: url } });
    return ok({ brand: updated, logo: url });
  } catch (e) {
    if (e instanceof StorageError) return err(e.message, e.status);
    return err("Failed to upload logo", 500);
  }
}

// ---------------------------------------------------------------------------
// DELETE — Remove the brand logo from cloud storage + clear the DB reference.
// Used when the admin clicks "Remove logo" (without uploading a replacement).
// ---------------------------------------------------------------------------
export async function DELETE(_req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;
  const brand = await db.brand.findUnique({ where: { id } });
  if (!brand) return notFound();
  if (!brand.logo) return ok({ deleted: false, message: "No logo to delete" });

  // Delete from cloud storage (best-effort).
  await storage.delete("brands", brand.logo).catch(() => {});

  // Clear the DB reference.
  const updated = await db.brand.update({
    where: { id },
    data: { logo: null },
  });
  return ok({ deleted: true, brand: updated });
}
