// ============================================================================
// File: src/app/api/admin/settings/storage/test/route.ts
// Purpose: Test the storage provider connection. Admin-only.
//          - POST with { config } → instantiates a temporary provider from the
//            provided config (NOT the saved config) and runs testConnection().
//            This lets the admin verify credentials BEFORE saving them.
//          - POST with no body → tests the currently-saved config.
//
// Returns { ok, message, provider } — never throws (all errors are caught).
// ============================================================================

import { getAdminFromRequest } from "@/lib/auth";
import { ok, unauthorized, parseBody } from "@/lib/api";
import {
  getStorageConfig,
  StorageConfig,
  DEFAULT_ALLOWED_MIME,
  DEFAULT_MAX_FILE_SIZE,
  DEFAULT_SIGNED_URL_EXPIRY,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRY_BACKOFF_MS,
  StorageProvider,
  PROVIDER_LABELS,
  S3_BASED_PROVIDERS,
} from "@/lib/storage";
import { LocalProvider } from "@/lib/storage/providers/local";
import { S3Provider } from "@/lib/storage/providers/s3";
import { SupabaseProvider } from "@/lib/storage/providers/supabase";
import { AzureBlobProvider } from "@/lib/storage/providers/azure-blob";

export async function POST(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const body = await parseBody<{ config?: Partial<StorageConfig> } | null>(req).catch(
    () => null
  );

  // Use provided config (for "test before save") or fall back to saved config.
  const base = await getStorageConfig();
  const config: StorageConfig = body?.config
    ? {
        provider: body.config.provider || base.provider,
        enabled: body.config.enabled ?? base.enabled,
        displayName: body.config.displayName ?? base.displayName,
        maxFileSize: body.config.maxFileSize || DEFAULT_MAX_FILE_SIZE,
        allowedMimeTypes:
          body.config.allowedMimeTypes?.length
            ? body.config.allowedMimeTypes
            : DEFAULT_ALLOWED_MIME,
        pathPrefix: body.config.pathPrefix ?? base.pathPrefix,
        publicBucketEnabled: body.config.publicBucketEnabled ?? base.publicBucketEnabled ?? true,
        privateCategories: body.config.privateCategories ?? base.privateCategories,
        signedUrlExpiry: body.config.signedUrlExpiry ?? base.signedUrlExpiry ?? DEFAULT_SIGNED_URL_EXPIRY,
        autoCleanupOrphans: body.config.autoCleanupOrphans ?? base.autoCleanupOrphans ?? true,
        retentionDays: body.config.retentionDays ?? base.retentionDays ?? 0,
        maxRetries: body.config.maxRetries ?? base.maxRetries ?? DEFAULT_MAX_RETRIES,
        retryBackoffMs: body.config.retryBackoffMs ?? base.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS,
        s3: body.config.s3
          ? {
              endpoint: body.config.s3.endpoint ?? base.s3?.endpoint ?? "",
              region: body.config.s3.region ?? base.s3?.region ?? "",
              bucket: body.config.s3.bucket ?? base.s3?.bucket ?? "",
              accessKey: isMasked(body.config.s3.accessKey)
                ? (base.s3?.accessKey ?? "")
                : (body.config.s3.accessKey ?? ""),
              secretKey: isMasked(body.config.s3.secretKey)
                ? (base.s3?.secretKey ?? "")
                : (body.config.s3.secretKey ?? ""),
              publicBaseUrl: body.config.s3.publicBaseUrl ?? base.s3?.publicBaseUrl ?? "",
              customDomain: body.config.s3.customDomain ?? base.s3?.customDomain ?? "",
              forcePathStyle: body.config.s3.forcePathStyle ?? base.s3?.forcePathStyle ?? false,
            }
          : base.s3,
        supabase: body.config.supabase
          ? {
              url: body.config.supabase.url ?? base.supabase?.url ?? "",
              bucket: body.config.supabase.bucket ?? base.supabase?.bucket ?? "",
              serviceRoleKey: isMasked(body.config.supabase.serviceRoleKey)
                ? (base.supabase?.serviceRoleKey ?? "")
                : (body.config.supabase.serviceRoleKey ?? ""),
            }
          : base.supabase,
        azure: body.config.azure
          ? {
              connectionString: isMasked(body.config.azure.connectionString)
                ? (base.azure?.connectionString ?? "")
                : (body.config.azure.connectionString ?? ""),
              containerName: body.config.azure.containerName ?? base.azure?.containerName ?? "",
              publicBaseUrl: body.config.azure.publicBaseUrl ?? base.azure?.publicBaseUrl ?? "",
              accountName: body.config.azure.accountName ?? base.azure?.accountName ?? "",
            }
          : base.azure,
      }
    : base;

  const providerName = PROVIDER_LABELS[config.provider] || config.provider;

  // Instantiate a temporary provider (does NOT touch the cached singleton).
  let provider: StorageProvider;
  try {
    // S3-based providers (7: amazon-s3, cloudflare-r2, backblaze-b2, digitalocean, minio, google-cloud, custom)
    if (S3_BASED_PROVIDERS.has(config.provider)) {
      if (!config.s3?.bucket || !config.s3?.accessKey || !config.s3?.secretKey) {
        return ok({
          ok: false,
          provider: config.provider,
          message: `${providerName} requires bucket, accessKey, and secretKey. Fill in all fields and try again.`,
        });
      }
      provider = new S3Provider(config, config.provider);
    }
    // Supabase Storage
    else if (config.provider === "supabase") {
      if (!config.supabase?.url || !config.supabase?.serviceRoleKey) {
        return ok({
          ok: false,
          provider: config.provider,
          message: `${providerName} requires URL and service role key. Fill in all fields and try again.`,
        });
      }
      provider = new SupabaseProvider(config);
    }
    // Azure Blob Storage
    else if (config.provider === "azure-blob") {
      if (!config.azure?.connectionString || !config.azure?.containerName) {
        return ok({
          ok: false,
          provider: config.provider,
          message: `${providerName} requires a connection string and container name. Fill in all fields and try again.`,
        });
      }
      provider = new AzureBlobProvider(config);
    }
    // Local (dev fallback)
    else {
      provider = new LocalProvider(config);
    }
  } catch (e: any) {
    return ok({
      ok: false,
      provider: config.provider,
      message: `Failed to initialize ${providerName}: ${e.message}`,
    });
  }

  const result = await provider.testConnection();
  return ok({ ...result, provider: config.provider });
}

function isMasked(value: string | undefined): boolean {
  if (!value) return false;
  return value.includes("••••");
}
