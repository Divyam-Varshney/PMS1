// ============================================================================
// File: src/app/api/admin/storage/diagnostics/route.ts
// Purpose: Storage diagnostic endpoint — lets the admin verify that uploads
//          are actually reaching the configured cloud storage provider.
//
//          Returns:
//            - Active provider + config summary (secrets masked)
//            - Connection test result (HeadBucket for S3-based)
//            - Object count in the bucket (via ListObjectsV2)
//            - Recent uploads (last 10 objects with keys + sizes + dates)
//            - DB image URL audit (how many product images point to cloud
//              vs local vs other)
//
//          This helps the admin answer "are my uploads really in R2?" without
//          needing to log into the Cloudflare dashboard.
// ============================================================================

import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized } from "@/lib/api";
import { getStorageConfig, isCloudStorage } from "@/lib/storage";
import { db } from "@/lib/db";

// Lazy-load AWS SDK only when diagnostics are actually requested.
// The AWS SDK is ~13MB — loading it eagerly on every server startup wastes
// RAM. Dynamic import means it's only loaded when the admin visits the
// storage diagnostics page.
async function loadAwsSdk() {
  const { S3Client, ListObjectsV2Command, HeadBucketCommand } = await import("@aws-sdk/client-s3");
  return { S3Client, ListObjectsV2Command, HeadBucketCommand };
}

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  try {
    const config = await getStorageConfig();
    const cloudActive = await isCloudStorage();

    // Mask secrets for the response
    const maskedConfig = {
      provider: config.provider,
      enabled: config.enabled,
      isCloudActive: cloudActive,
      pathPrefix: config.pathPrefix || "(none)",
      s3: config.s3
        ? {
            bucket: config.s3.bucket,
            region: config.s3.region,
            endpoint: config.s3.endpoint,
            publicBaseUrl: config.s3.publicBaseUrl || "(none)",
            customDomain: config.s3.customDomain || "(none)",
            forcePathStyle: config.s3.forcePathStyle,
            accessKey: config.s3.accessKey
              ? config.s3.accessKey.slice(0, 8) + "••••••••"
              : "(empty)",
            secretKey: config.s3.secretKey ? "••••••••" + config.s3.secretKey.slice(-4) : "(empty)",
          }
        : null,
    };

    // If local storage is active, we can't list cloud objects
    if (!cloudActive) {
      return ok({
        config: maskedConfig,
        connection: { ok: true, message: "Local storage is active (dev mode). Files are stored on the server filesystem." },
        bucket: { objectCount: 0, recentObjects: [], message: "Local storage — no cloud bucket to list." },
        dbAudit: await auditDbImages(),
      });
    }

    // For S3-based providers, run a live diagnostic
    let connection: { ok: boolean; message: string } = { ok: false, message: "Not tested" };
    let bucketInfo: { objectCount: number; recentObjects: any[]; message?: string } = {
      objectCount: 0,
      recentObjects: [],
    };

    if (config.s3) {
      const { S3Client, ListObjectsV2Command, HeadBucketCommand } = await loadAwsSdk();
      const client = new S3Client({
        region: config.s3.region || "auto",
        endpoint: config.s3.endpoint,
        credentials: {
          accessKeyId: config.s3.accessKey,
          secretAccessKey: config.s3.secretKey,
        },
        forcePathStyle: config.s3.forcePathStyle ?? true,
      });

      // 1. HeadBucket — verify the bucket exists + credentials work
      try {
        await client.send(new HeadBucketCommand({ Bucket: config.s3.bucket }));
        connection = {
          ok: true,
          message: `Connected to bucket "${config.s3.bucket}" successfully. Credentials are valid.`,
        };
      } catch (e: any) {
        const status = e?.$metadata?.httpStatusCode;
        let hint = "Check endpoint, region, credentials, and bucket name.";
        if (status === 403) hint = "Credentials valid but access denied. Check IAM/bucket policy.";
        else if (status === 404) hint = "Bucket not found. Check the bucket name.";
        else if (e?.name === "CredentialsProviderError") hint = "Invalid credentials.";
        connection = {
          ok: false,
          message: `Connection failed${status ? ` (HTTP ${status})` : ""}: ${e?.message || e?.name}. ${hint}`,
        };
      }

      // 2. ListObjectsV2 — count objects + get recent uploads
      if (connection.ok) {
        try {
          const listRes = await client.send(
            new ListObjectsV2Command({
              Bucket: config.s3.bucket,
              MaxKeys: 100,
            })
          );
          const objects = listRes.Contents || [];
          // Sort by LastModified desc to get the most recent
          const sorted = objects.sort(
            (a, b) => (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0)
          );
          bucketInfo = {
            objectCount: listRes.KeyCount || objects.length,
            recentObjects: sorted.slice(0, 10).map((obj) => ({
              key: obj.Key,
              size: obj.Size,
              lastModified: obj.LastModified?.toISOString(),
              // Construct the public URL for verification
              url: config.s3!.publicBaseUrl
                ? `${config.s3!.publicBaseUrl}/${obj.Key}`
                : `${config.s3!.endpoint}/${config.s3!.bucket}/${obj.Key}`,
            })),
          };
        } catch (e: any) {
          bucketInfo = {
            objectCount: 0,
            recentObjects: [],
            message: `ListObjects failed: ${e?.message || e?.name}`,
          };
        }
      }
    }

    return ok({
      config: maskedConfig,
      connection,
      bucket: bucketInfo,
      dbAudit: await auditDbImages(),
    });
  } catch (e: any) {
    return err("Storage diagnostic failed: " + (e?.message || "unknown error"), 500);
  }
}

/** Audit all image URLs in the DB — how many point to cloud vs local vs other. */
async function auditDbImages() {
  const [productImages, products, brands, categories] = await Promise.all([
    db.productImage.count(),
    db.product.count({ where: { primaryImage: { not: null } } }),
    db.brand.count({ where: { logo: { not: null } } }),
    db.category.count({ where: { image: { not: null } } }),
  ]);

  // Sample a few product images to check URL patterns
  const sampleImages = await db.productImage.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    select: { imagePath: true, originalName: true, createdAt: true },
  });

  let cloudUrls = 0,
    localUrls = 0,
    otherUrls = 0;
  const allImages = await db.productImage.findMany({ select: { imagePath: true } });
  for (const img of allImages) {
    if (img.imagePath.includes("r2.dev") || img.imagePath.includes("cloudflarestorage.com") || img.imagePath.includes("amazonaws.com")) {
      cloudUrls++;
    } else if (img.imagePath.startsWith("/uploads/") || img.imagePath.startsWith("/api/file/")) {
      localUrls++;
    } else {
      otherUrls++;
    }
  }

  return {
    productImageCount: productImages,
    productsWithPrimaryImage: products,
    brandsWithLogo: brands,
    categoriesWithImage: categories,
    urlDistribution: { cloud: cloudUrls, local: localUrls, other: otherUrls },
    recentUploads: sampleImages.map((img) => ({
      originalName: img.originalName,
      imagePath: img.imagePath,
      uploadedAt: img.createdAt.toISOString(),
    })),
  };
}
