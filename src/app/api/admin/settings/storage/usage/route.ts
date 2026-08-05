// ============================================================================
// File: src/app/api/admin/settings/storage/usage/route.ts
// Purpose: Storage usage statistics — returns file counts + total sizes per
//          category so the admin can monitor cloud storage consumption.
//          Queries every table that holds file references:
//            - ProductImage (has fileSize + imagePath)
//            - Brand.logo
//            - Category.image
//            - Prescription.images (JSON array of paths)
//            - Order.paymentScreenshot
//            - PaymentMethod.config (QR images, JSON with qrImage field)
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, unauthorized } from "@/lib/api";

export async function GET() {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  // --- Product images (have explicit fileSize + mimeType) ---
  const productImages = await db.productImage.aggregate({
    _count: true,
    _sum: { fileSize: true },
  });

  // --- Brands with a logo ---
  const brandsWithLogo = await db.brand.count({
    where: { logo: { not: null } },
  });

  // --- Categories with an image ---
  const categoriesWithImage = await db.category.count({
    where: { image: { not: null } },
  });

  // --- Prescriptions (images stored as JSON array) ---
  const prescriptions = await db.prescription.findMany({
    select: { images: true },
  });
  let prescriptionImageCount = 0;
  for (const p of prescriptions) {
    try {
      const imgs = JSON.parse(p.images) as string[];
      if (Array.isArray(imgs)) prescriptionImageCount += imgs.length;
    } catch {
      /* ignore malformed JSON */
    }
  }

  // --- Orders with a payment screenshot ---
  const ordersWithScreenshot = await db.order.count({
    where: { paymentScreenshot: { not: null } },
  });

  // --- Payment methods with a QR image (stored in config JSON) ---
  const qrPaymentMethods = await db.paymentMethod.findMany({
    where: { key: "qr" },
    select: { config: true },
  });
  let qrImageCount = 0;
  for (const pm of qrPaymentMethods) {
    try {
      if (!pm.config) continue;
      const cfg = JSON.parse(pm.config) as Record<string, unknown>;
      if (cfg.qrImage) qrImageCount++;
    } catch {
      /* ignore */
    }
  }

  // --- Build per-category stats ---
  // Products have exact sizes; other categories we estimate (avg 200KB per
  // logo/image/screenshot) since the DB doesn't track their file sizes.
  const AVG_LOGO_SIZE = 50 * 1024;       // 50 KB
  const AVG_CATEGORY_IMAGE = 80 * 1024;  // 80 KB
  const AVG_RX_IMAGE = 500 * 1024;       // 500 KB (prescription photos)
  const AVG_SCREENSHOT = 300 * 1024;     // 300 KB (payment screenshots)
  const AVG_QR_IMAGE = 20 * 1024;        // 20 KB (QR codes)

  const categories = [
    {
      key: "products",
      label: "Product Images",
      fileCount: productImages._count,
      totalBytes: productImages._sum.fileSize ?? 0,
      icon: "Package",
      exact: true,
    },
    {
      key: "brands",
      label: "Brand Logos",
      fileCount: brandsWithLogo,
      totalBytes: brandsWithLogo * AVG_LOGO_SIZE,
      icon: "Tag",
      exact: false,
    },
    {
      key: "categories",
      label: "Category Images",
      fileCount: categoriesWithImage,
      totalBytes: categoriesWithImage * AVG_CATEGORY_IMAGE,
      icon: "FolderTree",
      exact: false,
    },
    {
      key: "prescriptions",
      label: "Prescription Images",
      fileCount: prescriptionImageCount,
      totalBytes: prescriptionImageCount * AVG_RX_IMAGE,
      icon: "FileText",
      exact: false,
    },
    {
      key: "payments",
      label: "Payment Screenshots",
      fileCount: ordersWithScreenshot,
      totalBytes: ordersWithScreenshot * AVG_SCREENSHOT,
      icon: "CreditCard",
      exact: false,
    },
    {
      key: "qr-codes",
      label: "QR Code Images",
      fileCount: qrImageCount,
      totalBytes: qrImageCount * AVG_QR_IMAGE,
      icon: "QrCode",
      exact: false,
    },
  ];

  const totalFiles = categories.reduce((s, c) => s + c.fileCount, 0);
  const totalBytes = categories.reduce((s, c) => s + c.totalBytes, 0);

  return ok({
    categories,
    totalFiles,
    totalBytes,
    totalBytesFormatted: formatBytes(totalBytes),
    estimatedNote:
      "Sizes for brands, categories, prescriptions, payments, and QR codes are estimated averages. Product image sizes are exact.",
  });
}

/** Format bytes into a human-readable string (e.g. "1.2 MB"). */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
