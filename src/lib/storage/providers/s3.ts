// ============================================================================
// File: src/lib/storage/providers/s3.ts
// Purpose: S3-compatible provider — works with Amazon S3, Cloudflare R2,
//          Backblaze B2, DigitalOcean Spaces, MinIO, Google Cloud Storage
//          (via S3 interop), and any custom S3-compatible service. All of
//          these speak the same S3 protocol, so one adapter covers them all.
//          Configuration (endpoint, region, bucket, credentials) comes from
//          the Admin Panel. The specific providerId is passed in so error
//          messages and test-connection results can reference the real
//          provider name (e.g. "Cloudflare R2" instead of generic "S3").
// ============================================================================

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl as awsGetSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  StorageProvider,
  StorageError,
  FileCategory,
  UploadResult,
  UploadOptions,
  StorageConfig,
  ProviderId,
  PROVIDER_LABELS,
  PRIVATE_CATEGORIES,
  validateImageFile,
  generateKey,
  withRetry,
} from "../types";

export class S3Provider implements StorageProvider {
  readonly id: ProviderId;
  private client: S3Client;
  private bucket: string;
  private publicBaseUrl: string;
  private config: StorageConfig;

  /**
   * @param config   The full storage config.
   * @param providerId  The specific S3-based provider (amazon-s3, cloudflare-r2,
   *                    backblaze-b2, digitalocean, minio, google-cloud, custom).
   *                    Used for human-readable error/test messages.
   */
  constructor(config: StorageConfig, providerId: ProviderId = "custom") {
    const s3 = config.s3;
    if (!s3?.bucket || !s3?.accessKey || !s3?.secretKey) {
      throw new StorageError(
        `${PROVIDER_LABELS[providerId]} requires bucket, accessKey, and secretKey`,
        500
      );
    }
    this.id = providerId;
    this.config = config;
    this.bucket = s3.bucket;
    // publicBaseUrl takes priority; fall back to customDomain.
    this.publicBaseUrl = (s3.publicBaseUrl || s3.customDomain || "").replace(/\/$/, "");

    // CRITICAL: Strip the bucket name from the endpoint URL if the admin
    // accidentally included it. R2/Spaces/MinIO dashboards often show the
    // S3 API URL WITH the bucket appended (e.g.
    // https://<id>.r2.cloudflarestorage.com/mybucket). The S3 SDK expects the
    // endpoint WITHOUT the bucket — the bucket goes in the `Bucket` param.
    // If we don't strip it, forcePathStyle doubles the bucket in the path,
    // causing files to upload to `<bucket>/<bucket>/<key>` instead of
    // `<bucket>/<key>`, which breaks public URL access.
    let endpoint = (s3.endpoint || "").replace(/\/$/, "");
    if (endpoint) {
      // Remove trailing /<bucket> from the endpoint if present.
      const bucketSuffix = `/${s3.bucket}`;
      if (endpoint.endsWith(bucketSuffix)) {
        endpoint = endpoint.slice(0, -bucketSuffix.length);
      }
    }

    this.client = new S3Client({
      region: s3.region || "us-east-1",
      endpoint: endpoint || undefined,
      credentials: {
        accessKeyId: s3.accessKey,
        secretAccessKey: s3.secretKey,
      },
      forcePathStyle: s3.forcePathStyle ?? false,
      // Retry config — the AWS SDK has built-in retry, but we also wrap
      // uploads in our own withRetry for consistent backoff across providers.
      maxRetries: 0, // we handle retries ourselves in upload()
    });
  }

  /** Build the full object key: [pathPrefix]/[category]/[filename]. */
  private objectKey(category: FileCategory, key: string): string {
    const prefix = this.config.pathPrefix
      ? `${this.config.pathPrefix.replace(/^\/|\/$/g, "")}/`
      : "";
    return `${prefix}${category}/${key}`;
  }

  async upload(
    category: FileCategory,
    file: File | Buffer,
    opts?: UploadOptions
  ): Promise<UploadResult> {
    let buffer: Buffer;
    let mime: string;
    let originalName: string;
    let size: number;

    if (file instanceof File) {
      mime = validateImageFile(file, this.config.allowedMimeTypes, this.config.maxFileSize);
      buffer = Buffer.from(await file.arrayBuffer());
      originalName = file.name;
      size = file.size;
    } else {
      mime = "image/png";
      buffer = file;
      originalName = opts?.filename || "imported";
      size = buffer.length;
      if (size > this.config.maxFileSize) {
        throw new StorageError("File too large", 400);
      }
    }

    const key = generateKey(category, { name: originalName, type: mime }, opts);
    const fullKey = this.objectKey(category, key);

    // Wrap the S3 PUT in withRetry for transient failure resilience.
    // Cache-Control: 5 min browser cache + 1 hr CDN (stale-while-revalidate).
    // This balances fast loading with timely image updates — when an admin
    // replaces an image, the URL changes (new UUID hash in filename), so the
    // browser fetches the new URL immediately. For the SAME URL (rare), the
    // 5-min browser cache ensures customers see updates within 5 minutes.
    await withRetry(
      () =>
        this.client.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: fullKey,
            Body: buffer,
            ContentType: mime,
            CacheControl: "public, max-age=300, stale-while-revalidate=3600",
          })
        ),
      this.config.maxRetries,
      this.config.retryBackoffMs,
      "S3 upload"
    ).catch((e: any) => {
      throw new StorageError(`${PROVIDER_LABELS[this.id]} upload failed: ${e.message}`, 500);
    });

    const isPrivate = PRIVATE_CATEGORIES.has(category);
    const url = isPrivate
      ? `/api/file/${category}/${key}`
      : this.publicBaseUrl
        ? `${this.publicBaseUrl}/${fullKey}`
        : `https://${this.bucket}.s3.${this.config.s3!.region || "us-east-1"}.amazonaws.com/${fullKey}`;

    return { url, key, size, contentType: mime, originalName };
  }

  async delete(category: FileCategory, urlOrKey: string): Promise<void> {
    try {
      const key = urlOrKey.split("/").pop() || urlOrKey;
      const fullKey = this.objectKey(category, key);
      await withRetry(
        () =>
          this.client.send(
            new DeleteObjectCommand({ Bucket: this.bucket, Key: fullKey })
          ),
        Math.min(this.config.maxRetries, 2), // fewer retries for deletes
        this.config.retryBackoffMs,
        "S3 delete"
      );
    } catch (e) {
      console.error(`[storage:${this.id}] delete failed:`, e);
    }
  }

  getPublicUrl(category: FileCategory, key: string): string {
    const fullKey = this.objectKey(category, key);
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl}/${fullKey}`;
    }
    return `https://${this.bucket}.s3.${this.config.s3!.region || "us-east-1"}.amazonaws.com/${fullKey}`;
  }

  async getSignedUrl(
    category: FileCategory,
    key: string,
    expiresIn?: number
  ): Promise<string> {
    const fullKey = this.objectKey(category, key);
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: fullKey });
    const expiry = expiresIn ?? this.config.signedUrlExpiry ?? 3600;
    try {
      return await awsGetSignedUrl(this.client, cmd, { expiresIn: expiry });
    } catch (e: any) {
      throw new StorageError(`Failed to generate signed URL: ${e.message}`, 500);
    }
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    const providerName = PROVIDER_LABELS[this.id];
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return {
        ok: true,
        message: `Connected to ${providerName} bucket "${this.bucket}" successfully.`,
      };
    } catch (e: any) {
      const status = e?.$metadata?.httpStatusCode;
      const name = e?.name || "Error";
      let hint = "Check endpoint, region, credentials, and bucket name.";
      if (status === 403) hint = "Credentials valid but access denied. Check IAM permissions / bucket policy.";
      else if (status === 404) hint = "Bucket not found. Check the bucket name and region.";
      else if (name === "NoSuchBucket") hint = "Bucket does not exist. Create it in your provider dashboard.";
      else if (name === "CredentialsProviderError") hint = "Invalid credentials. Check accessKey and secretKey.";
      else if (e?.message?.includes("fetch failed") || e?.message?.includes("ENOTFOUND")) {
        hint = "Cannot reach the endpoint URL. Check the endpoint and network.";
      }
      return {
        ok: false,
        message: `${providerName} connection failed${status ? ` (HTTP ${status})` : ""}: ${e?.message || name}. ${hint}`,
      };
    }
  }
}
