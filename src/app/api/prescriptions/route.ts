// ============================================================================
// File: src/app/api/prescriptions/route.ts
// Purpose: Accept multipart/form-data prescription uploads (one or more images)
//          + notes. Uses the cloud storage service (private bucket) so uploads
//          persist on Vercel's read-only filesystem. Creates a Prescription
//          record with images stored as a JSON array of storage URLs.
// Role: Powers PrescriptionView.
// ============================================================================

import { db } from "@/lib/db";
import { ok, unauthorized, err } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth";
import { createAdminNotification } from "@/lib/admin-notifications";
import { sendNotification } from "@/lib/notifications";
import { storage, StorageError } from "@/lib/storage";

// ----------------------------------------------------------------------------
// GET /api/prescriptions
// Returns the current customer's prescription history, newest first, with the
// `images` JSON column parsed into a real array (so the customer-side history
// view can render thumbnails without re-parsing). Used by PrescriptionView's
// history section.
// ----------------------------------------------------------------------------
export async function GET() {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login to view prescriptions");

  const rows = await db.prescription.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
  });

  const items = rows.map((p) => {
    let images: string[] = [];
    try {
      images = JSON.parse(p.images) as string[];
      if (!Array.isArray(images)) images = [];
    } catch {
      images = [];
    }
    return {
      id: p.id,
      status: p.status,
      notes: p.notes,
      adminNotes: p.adminNotes,
      convertedOrderId: p.convertedOrderId,
      createdAt: p.createdAt.toISOString(),
      images,
      imageCount: images.length,
    };
  });

  return ok({ items, total: items.length });
}

export async function POST(req: Request) {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login to upload a prescription");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return err("Invalid form data. Please upload image files.");
  }

  const notes = (form.get("notes") as string | null)?.trim() || null;
  const files = form.getAll("files");
  if (files.length === 0) return err("Please select at least one prescription image");

  const savedPaths: string[] = [];
  try {
    for (const file of files) {
      if (!(file instanceof File)) continue;
      // storage.upload validates MIME + size and throws StorageError on invalid.
      const { url } = await storage.upload("prescriptions", file, {
        ownerId: customer.id,
      });
      savedPaths.push(url);
    }
  } catch (e) {
    // If some files uploaded before the error, clean them up to avoid orphans.
    for (const p of savedPaths) {
      await storage.delete("prescriptions", p).catch(() => {});
    }
    if (e instanceof StorageError) return err(e.message, e.status);
    return err("Failed to upload prescription images", 500);
  }

  if (savedPaths.length === 0) return err("No valid images uploaded");

  const prescription = await db.prescription.create({
    data: {
      customerId: customer.id,
      images: JSON.stringify(savedPaths),
      notes,
      status: "pending",
    },
  });

  // Admin notification
  await createAdminNotification({
    type: "new_prescription",
    title: "New Prescription Uploaded",
    message: `${customer.name} uploaded a prescription (${savedPaths.length} image${savedPaths.length > 1 ? "s" : ""})`,
    refId: prescription.id,
    refType: "prescription",
    customerName: customer.name,
    emailDetails: [
      `Customer: ${customer.name} (${customer.email}, ${customer.phone})`,
      `Images: ${savedPaths.length}`,
      notes ? `Notes: ${notes}` : "",
    ].filter(Boolean).join("\n"),
  });

  // Customer "submitted" confirmation email — uses the prescription_submitted
  // template from DEFAULT_TEMPLATES. Failures are swallowed (notification log
  // still records the attempt) so they never block the upload response.
  try {
    await sendNotification({
      to: customer.email,
      templateKey: "prescription_submitted",
      vars: { name: customer.name },
      customerId: customer.id,
      channel: "email",
    });
  } catch (e) {
    console.error("[rx] submitted email send failed:", e);
  }

  return ok(prescription);
}
