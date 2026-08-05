// ============================================================================
// File: src/app/api/admin/branding/route.ts
// Purpose: Admin API for managing branding assets (logo, favicon, app icons,
//          OG image, etc.). Uploads files to cloud storage and stores URLs
//          in the Setting table.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, parseBody } from "@/lib/api";
import { storage } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET — list all branding assets
export async function GET() {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const keys = [
    "store.logo",
    "store.darkLogo",
    "store.lightLogo",
    "store.favicon",
    "store.appIcon",
    "store.appleTouchIcon",
    "store.ogImage",
    "store.socialImage",
    "store.loginLogo",
    "store.emailLogo",
    "store.invoiceLogo",
  ];

  const settings = await db.setting.findMany({
    where: { key: { in: keys } },
    select: { key: true, value: true },
  });

  const branding: Record<string, string> = {};
  for (const s of settings) {
    try {
      branding[s.key] = JSON.parse(s.value);
    } catch {
      branding[s.key] = s.value;
    }
  }

  return ok({ branding });
}

// POST — upload a branding asset
export async function POST(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const assetKey = form.get("key") as string | null;

  if (!file || !assetKey) {
    return err("File and key are required", 400);
  }

  // Validate file type
  const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml", "image/x-icon"];
  const mime = (file.type || "").split(";")[0].trim();
  if (!allowedTypes.includes(mime)) {
    return err(`Invalid file type: ${mime}. Allowed: PNG, JPEG, WEBP, SVG, ICO`, 400);
  }

  // Validate file size (max 5MB for branding assets)
  if (file.size > 5 * 1024 * 1024) {
    return err("File too large. Maximum 5MB for branding assets.", 400);
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : mime === "image/svg+xml" ? "svg" : "png";
    const filename = `branding-${assetKey.replace(/\./g, "-")}-${Date.now()}.${ext}`;

    const result = await storage.upload("brands", buffer, {
      ownerId: "branding",
      filename,
    });

    // Delete old file (best-effort)
    const oldSetting = await db.setting.findUnique({ where: { key: assetKey } });
    if (oldSetting) {
      try {
        const oldUrl = JSON.parse(oldSetting.value);
        if (typeof oldUrl === "string" && oldUrl.startsWith("http")) {
          await storage.delete("brands", oldUrl).catch(() => {});
        }
      } catch {}
    }

    // Save URL in settings
    await db.setting.upsert({
      where: { key: assetKey },
      update: { value: JSON.stringify(result.url) },
      create: { key: assetKey, value: JSON.stringify(result.url), category: "store" },
    });

    return ok({ key: assetKey, url: result.url });
  } catch (e: any) {
    return err("Upload failed: " + (e?.message || "unknown error"), 500);
  }
}

// DELETE — remove a branding asset (reset to default)
export async function DELETE(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (!key) return err("key query parameter is required", 400);

  // Delete file from cloud storage (best-effort)
  const setting = await db.setting.findUnique({ where: { key } });
  if (setting) {
    try {
      const fileUrl = JSON.parse(setting.value);
      if (typeof fileUrl === "string" && fileUrl.startsWith("http")) {
        await storage.delete("brands", fileUrl).catch(() => {});
      }
    } catch {}
    await db.setting.delete({ where: { key } });
  }

  return ok({ deleted: true, key });
}
