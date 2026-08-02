// ============================================================================
// File: src/app/api/admin/payment-methods/[id]/qr-image/route.ts
// Purpose: Upload a QR code image for a QR payment method. Uses the cloud
//          storage service so uploads persist on Vercel's read-only
//          filesystem. Stores the URL in PaymentMethod.config as
//          {"qrImage": "<url>"} (merged with existing config).
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

  const pm = await db.paymentMethod.findUnique({ where: { id } });
  if (!pm) return notFound("Payment method not found");
  // Defensive: only QR-type methods should accept an image upload.
  if (pm.key !== "qr") {
    return err("QR image upload is only supported for QR payment methods", 400);
  }

  const form = await req.formData();
  const file = form.getAll("file").find((f): f is File => f instanceof File);
  if (!file) return err("No file uploaded", 400);

  // Parse existing config so we can delete the old QR image (avoid orphans).
  let existing: Record<string, unknown> = {};
  try {
    existing = pm.config ? (JSON.parse(pm.config) as Record<string, unknown>) : {};
  } catch {
    existing = {};
  }

  try {
    // Delete the previous QR image if it exists.
    const oldQr = typeof existing.qrImage === "string" ? existing.qrImage : null;
    if (oldQr) {
      await storage.delete("qr-codes", oldQr).catch(() => {});
    }

    const { url } = await storage.upload("qr-codes", file, { ownerId: pm.id });
    const nextConfig = { ...existing, qrImage: url };

    const updated = await db.paymentMethod.update({
      where: { id },
      data: { config: JSON.stringify(nextConfig) },
    });
    return ok({ paymentMethod: updated, qrImage: url });
  } catch (e) {
    if (e instanceof StorageError) return err(e.message, e.status);
    return err("Failed to upload QR image", 500);
  }
}

// ---------------------------------------------------------------------------
// DELETE — Remove the QR image from cloud storage + clear the config ref.
// ---------------------------------------------------------------------------
export async function DELETE(_req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;
  const pm = await db.paymentMethod.findUnique({ where: { id } });
  if (!pm) return notFound("Payment method not found");

  let existing: Record<string, unknown> = {};
  try {
    existing = pm.config ? (JSON.parse(pm.config) as Record<string, unknown>) : {};
  } catch {
    existing = {};
  }

  const oldQr = typeof existing.qrImage === "string" ? existing.qrImage : null;
  if (!oldQr) return ok({ deleted: false, message: "No QR image to delete" });

  // Delete from cloud storage (best-effort).
  await storage.delete("qr-codes", oldQr).catch(() => {});

  // Remove qrImage from config (preserve other config fields).
  const { qrImage: _removed, ...nextConfig } = existing;
  const updated = await db.paymentMethod.update({
    where: { id },
    data: { config: JSON.stringify(nextConfig) },
  });
  return ok({ deleted: true, paymentMethod: updated });
}
