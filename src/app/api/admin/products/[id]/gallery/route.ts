// ============================================================================
// File: src/app/api/admin/products/[id]/gallery/route.ts
// Purpose: Complete product image gallery management API using the
//          dedicated ProductImage table. Supports:
//   GET    — list all images (sorted by displayOrder)
//   POST   — upload files (multipart) OR import from URL(s) (JSON)
//   PATCH  — reorder, set primary, update metadata, replace image
//   DELETE — delete single or multiple images (with cloud file cleanup)
//
// All file I/O goes through the cloud storage service (src/lib/storage.ts)
// so uploads persist on Vercel's read-only filesystem.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, notFound, parseBody } from "@/lib/api";
import { storage, StorageError } from "@/lib/storage";
import { randomUUID, createHash } from "crypto";

type Ctx = { params: Promise<{ id: string }> };

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 50) || "image";
}

function generateFilename(productId: string, originalName: string, ext: string): string {
  const safe = sanitizeFilename(originalName.replace(/\.[^.]+$/, ""));
  return `${productId}-${safe}-${randomUUID().slice(0, 8)}.${ext}`;
}

function hashBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex").slice(0, 16);
}

// Simple image dimension extraction from buffer (PNG/JPEG/WEBP headers)
function getDimensions(buffer: Buffer, mime: string): { width: number; height: number } {
  try {
    if (mime === "image/png" && buffer.length > 24) {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }
    if (mime === "image/jpeg") {
      let offset = 2;
      while (offset < buffer.length - 1) {
        if (buffer[offset] !== 0xFF) break;
        const marker = buffer[offset + 1];
        if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
          return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
        }
        const len = buffer.readUInt16BE(offset + 2);
        offset += 2 + len;
      }
    }
    if (mime === "image/webp" && buffer.length > 30 && buffer.toString("ascii", 12, 16) === "VP8 ") {
      return { width: buffer.readUInt16LE(26) & 0x3FFF, height: buffer.readUInt16LE(28) & 0x3FFF };
    }
  } catch { /* ignore parse errors */ }
  return { width: 0, height: 0 };
}

// ---------------------------------------------------------------------------
// GET — List all product images
// ---------------------------------------------------------------------------
export async function GET(_req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;

  const product = await db.product.findUnique({ where: { id } });
  if (!product) return notFound("Product not found");

  const images = await db.productImage.findMany({
    where: { productId: id },
    orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }, { createdAt: "asc" }],
  });

  return ok({ images, count: images.length });
}

// ---------------------------------------------------------------------------
// POST — Upload files (multipart) OR import from URL(s) (JSON)
// ---------------------------------------------------------------------------
export async function POST(req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;

  const product = await db.product.findUnique({ where: { id } });
  if (!product) return notFound("Product not found");

  const contentType = req.headers.get("content-type") || "";

  // ── Mode 1: JSON body — import from URL(s) ──
  if (contentType.includes("application/json")) {
    const body = await parseBody<{ action?: string; urls?: string[]; url?: string }>(req);
    if (body?.action !== "import-url") return err("Unknown action", 400);

    const urls = body.urls || (body.url ? [body.url] : []);
    if (urls.length === 0) return err("No URLs provided", 400);

    const existingImages = await db.productImage.findMany({
      where: { productId: id },
      select: { hash: true, isPrimary: true },
    });
    const existingHashes = new Set(existingImages.map((i) => i.hash).filter(Boolean));
    // Track primary state LOCALLY across the loop. The captured `product`
    // snapshot is stale after the first promotion, so we must not re-read it.
    // This flag is the single source of truth for "does this product already
    // have a primary image?" during this batch import.
    let hasPrimary = existingImages.some((i) => i.isPrimary) || !!product.primaryImage;

    const imported: string[] = [];
    const errors: string[] = [];
    const maxOrder = await db.productImage.count({ where: { productId: id } });

    for (const rawUrl of urls) {
      const url = rawUrl.trim();
      if (!url) continue;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { "User-Agent": "PMS-ImageImporter/1.0" } });
        if (!res.ok) { errors.push(`${url}: HTTP ${res.status}`); continue; }
        const mime = (res.headers.get("content-type") || "").split(";")[0].trim();
        if (!ALLOWED_MIME.includes(mime)) { errors.push(`${url}: unsupported type ${mime}`); continue; }
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length < 100) { errors.push(`${url}: too small`); continue; }
        if (buffer.length > MAX_FILE_SIZE) { errors.push(`${url}: too large`); continue; }
        const hash = hashBuffer(buffer);
        if (existingHashes.has(hash)) { errors.push(`${url}: duplicate`); continue; }
        existingHashes.add(hash);

        const ext = MIME_EXT[mime] || "jpg";
        const origName = url.split("/").pop()?.split("?")[0] || "imported";
        const filename = generateFilename(id, origName, ext);
        const { width, height } = getDimensions(buffer, mime);

        // Upload via storage service (buffer mode — validation skipped since
        // we already validated the MIME + size above).
        const uploadResult = await storage.upload("products", buffer, {
          ownerId: id,
          filename,
        });

        // Decide primary status BEFORE creating the row, using the local
        // hasPrimary flag. Only the FIRST image (when no primary exists)
        // becomes primary — subsequent images are always non-primary.
        const shouldBePrimary = !hasPrimary;
        const img = await db.productImage.create({
          data: {
            productId: id,
            imagePath: uploadResult.url,
            originalName: origName,
            fileSize: buffer.length,
            mimeType: mime,
            hash,
            width, height,
            displayOrder: shouldBePrimary ? 0 : maxOrder + imported.length + 1,
            isPrimary: shouldBePrimary,
          },
        });
        imported.push(img.id);

        if (shouldBePrimary) {
          hasPrimary = true; // Update local flag so next iteration won't promote
          await db.product.update({
            where: { id },
            data: { primaryImage: uploadResult.url },
          });
        }
      } catch (e: any) {
        errors.push(`${url}: ${e?.message || "failed"}`);
      }
    }
    return ok({ imported, count: imported.length, errors });
  }

  // ── Mode 2: Multipart file upload ──
  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return err("No files uploaded", 400);

  const existingImages = await db.productImage.findMany({
    where: { productId: id },
    select: { hash: true, isPrimary: true },
  });
  const existingHashes = new Set(existingImages.map((i) => i.hash).filter(Boolean));
  // Track primary state LOCALLY — see the URL-import section above for why
  // we can't rely on the captured `product` snapshot.
  let hasPrimary = existingImages.some((i) => i.isPrimary) || !!product.primaryImage;

  const saved: string[] = [];
  const errors: string[] = [];
  const maxOrder = await db.productImage.count({ where: { productId: id } });

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const mime = (file.type || "").split(";")[0].trim();
      if (!ALLOWED_MIME.includes(mime)) { errors.push(`${file.name}: unsupported type`); continue; }
      if (file.size > MAX_FILE_SIZE) { errors.push(`${file.name}: too large`); continue; }
      if (file.size < 100) { errors.push(`${file.name}: too small`); continue; }

      const buffer = Buffer.from(await file.arrayBuffer());
      const hash = hashBuffer(buffer);
      if (existingHashes.has(hash)) { errors.push(`${file.name}: duplicate`); continue; }
      existingHashes.add(hash);

      const ext = MIME_EXT[mime] || "jpg";
      const filename = generateFilename(id, file.name, ext);
      const { width, height } = getDimensions(buffer, mime);

      // Upload via storage service (buffer mode for consistency).
      const uploadResult = await storage.upload("products", buffer, {
        ownerId: id,
        filename,
      });

      // Only the FIRST image (when no primary exists) becomes primary.
      const shouldBePrimary = !hasPrimary;
      const img = await db.productImage.create({
        data: {
          productId: id,
          imagePath: uploadResult.url,
          originalName: file.name,
          fileSize: file.size,
          mimeType: mime,
          hash,
          width, height,
          displayOrder: shouldBePrimary ? 0 : maxOrder + saved.length + 1,
          isPrimary: shouldBePrimary,
        },
      });
      saved.push(img.id);

      if (shouldBePrimary) {
        hasPrimary = true;
        await db.product.update({ where: { id }, data: { primaryImage: uploadResult.url } });
      }
    } catch (e: any) {
      if (e instanceof StorageError) {
        errors.push(`${file.name}: ${e.message}`);
      } else {
        errors.push(`${file.name}: ${e?.message || "failed"}`);
      }
    }
  }

  return ok({ uploaded: saved, count: saved.length, errors });
}

// ---------------------------------------------------------------------------
// PATCH — reorder, set primary, update metadata, replace image
// ---------------------------------------------------------------------------
export async function PATCH(req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;

  const product = await db.product.findUnique({ where: { id } });
  if (!product) return notFound("Product not found");

  const body = await parseBody<{
    action: string;
    imageId?: string;
    imageIds?: string[];
    newOrder?: string[];
    altText?: string;
    title?: string;
    caption?: string;
    description?: string;
    replaceWith?: string; // new image path for replace action
  }>(req);

  if (!body?.action) return err("Action is required", 400);

  switch (body.action) {
    case "reorder": {
      if (!body.newOrder) return err("newOrder is required", 400);
      // Update displayOrder for each image
      for (let i = 0; i < body.newOrder.length; i++) {
        await db.productImage.update({
          where: { id: body.newOrder[i] },
          data: { displayOrder: i },
        });
      }
      return ok({ reordered: body.newOrder.length });
    }

    case "set-primary": {
      if (!body.imageId) return err("imageId is required", 400);
      const img = await db.productImage.findUnique({ where: { id: body.imageId } });
      if (!img || img.productId !== id) return err("Image not found", 404);

      // Unset all other primaries
      await db.productImage.updateMany({
        where: { productId: id, isPrimary: true },
        data: { isPrimary: false },
      });
      // Set new primary
      await db.productImage.update({ where: { id: body.imageId }, data: { isPrimary: true, displayOrder: 0 } });
      // Update product's primaryImage cache field
      await db.product.update({
        where: { id },
        data: { primaryImage: img.imagePath },
      });
      return ok({ primaryImageId: body.imageId });
    }

    case "update-meta": {
      if (!body.imageId) return err("imageId is required", 400);
      const updated = await db.productImage.update({
        where: { id: body.imageId },
        data: {
          altText: body.altText,
          title: body.title,
          caption: body.caption,
          description: body.description,
        },
      });
      return ok({ image: updated });
    }

    case "replace": {
      if (!body.imageId || !body.replaceWith) return err("imageId and replaceWith are required", 400);
      const oldImg = await db.productImage.findUnique({ where: { id: body.imageId } });
      if (!oldImg) return err("Image not found", 404);

      // Delete old file from cloud storage (best-effort).
      await storage.delete("products", oldImg.imagePath).catch(() => {});

      // Update the record with new path
      const updated = await db.productImage.update({
        where: { id: body.imageId },
        data: { imagePath: body.replaceWith },
      });

      // Update product's primaryImage if this was primary
      if (oldImg.isPrimary) {
        await db.product.update({
          where: { id },
          data: { primaryImage: body.replaceWith },
        });
      }
      return ok({ image: updated });
    }

    default:
      return err(`Unknown action: ${body.action}`, 400);
  }
}

// ---------------------------------------------------------------------------
// DELETE — delete single or multiple images (with cloud file cleanup)
// ---------------------------------------------------------------------------
export async function DELETE(req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;

  const product = await db.product.findUnique({ where: { id } });
  if (!product) return notFound("Product not found");

  const url = new URL(req.url);
  const imageId = url.searchParams.get("id");

  // Read ALL `ids` query params. The frontend sends multiple `ids=xxx` params
  // (one per image), e.g. `?ids=abc&ids=def&ids=ghi`. We must use `getAll`
  // instead of `get` — `get` only returns the FIRST value, which would cause
  // bulk delete to silently delete only the first selected image.
  // We also support comma-separated format (`?ids=abc,def,ghi`) for backwards
  // compatibility with any older callers.
  const idsParams = url.searchParams.getAll("ids");

  const idsToDelete: string[] = [];
  for (const p of idsParams) {
    for (const part of p.split(",")) {
      const trimmed = part.trim();
      if (trimmed) idsToDelete.push(trimmed);
    }
  }
  if (imageId && !idsToDelete.includes(imageId)) idsToDelete.push(imageId);
  if (idsToDelete.length === 0) return err("Image id(s) required", 400);

  // De-duplicate (in case the same id appears twice) to keep the response
  // count accurate and avoid redundant delete queries.
  const uniqueIds = Array.from(new Set(idsToDelete));

  const images = await db.productImage.findMany({
    where: { id: { in: uniqueIds }, productId: id },
  });
  if (images.length === 0) return err("No matching images found", 404);

  // Delete files from cloud storage (best-effort — ignore errors so a missing
  // file doesn't block the DB cleanup).
  for (const img of images) {
    await storage.delete("products", img.imagePath).catch(() => {});
  }

  // Delete from DB
  await db.productImage.deleteMany({ where: { id: { in: images.map((i) => i.id) } } });

  // If the primary was deleted, promote the next image (lowest displayOrder).
  const deletedPrimary = images.find((i) => i.isPrimary);
  if (deletedPrimary) {
    const next = await db.productImage.findFirst({
      where: { productId: id },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    });
    if (next) {
      await db.productImage.update({ where: { id: next.id }, data: { isPrimary: true, displayOrder: 0 } });
      await db.product.update({
        where: { id },
        data: { primaryImage: next.imagePath },
      });
    } else {
      // No images remain — clear the primaryImage cache.
      await db.product.update({
        where: { id },
        data: { primaryImage: null, galleryImages: null },
      });
    }
  }

  return ok({ deleted: images.length });
}
