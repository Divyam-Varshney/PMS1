// ============================================================================
// File: src/app/api/admin/settings/storage/route.ts
// Purpose: Read & save the storage provider configuration. Admin-only.
//          - GET  → returns the current config with secrets MASKED (safe for
//                   display in the admin UI).
//          - PUT  → saves a new config (with real secrets) + invalidates the
//                   provider cache so the next upload uses the new provider.
//
// The config is stored in the Setting table under key "storage.config" as a
// JSON blob. Secrets are included so the server can connect — but they are
// NEVER returned unmasked by GET.
// ============================================================================

import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, parseBody } from "@/lib/api";
import {
  getStorageConfig,
  saveStorageConfig,
  maskConfig,
  applyProviderPreset,
  StorageConfig,
  DEFAULT_ALLOWED_MIME,
  DEFAULT_MAX_FILE_SIZE,
} from "@/lib/storage";

export async function GET() {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const config = await getStorageConfig();
  // Mask secrets before sending to the client.
  return ok({ config: maskConfig(config) });
}

export async function PUT(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const raw = await parseBody<{ config?: Partial<StorageConfig> } | Partial<StorageConfig>>(req);
  if (!raw) return err("Config body is required", 400);

  // The frontend sends { config: { ... } } (nested). Some API clients might
  // send the config directly. Handle both shapes robustly.
  const body: Partial<StorageConfig> =
    raw && typeof raw === "object" && "config" in raw && raw.config
      ? (raw.config as Partial<StorageConfig>)
      : (raw as Partial<StorageConfig>);

  const current = await getStorageConfig();

  // Build the new config from the request, preserving existing secrets when
  // the client sends back the masked placeholder ("••••").
  const next: StorageConfig = {
    provider: body.provider || current.provider,
    enabled: body.enabled ?? current.enabled,
    displayName: body.displayName ?? current.displayName,
    maxFileSize: body.maxFileSize || DEFAULT_MAX_FILE_SIZE,
    allowedMimeTypes:
      body.allowedMimeTypes?.length ? body.allowedMimeTypes : DEFAULT_ALLOWED_MIME,
    pathPrefix: body.pathPrefix ?? current.pathPrefix,

    // Public/Private bucket config
    publicBucketEnabled: body.publicBucketEnabled ?? current.publicBucketEnabled ?? true,
    privateCategories: body.privateCategories ?? current.privateCategories,

    // Signed URL settings
    signedUrlExpiry: body.signedUrlExpiry ?? current.signedUrlExpiry ?? 3600,

    // File retention & cleanup
    autoCleanupOrphans: body.autoCleanupOrphans ?? current.autoCleanupOrphans ?? true,
    retentionDays: body.retentionDays ?? current.retentionDays ?? 0,

    // Retry logic
    maxRetries: body.maxRetries ?? current.maxRetries ?? 3,
    retryBackoffMs: body.retryBackoffMs ?? current.retryBackoffMs ?? 500,
  };

  // Merge S3 config — preserve secrets if the client sent masked placeholders.
  if (body.s3) {
    const prev = current.s3 ?? { endpoint: "", region: "", bucket: "", accessKey: "", secretKey: "", publicBaseUrl: "", customDomain: "", forcePathStyle: false };
    next.s3 = {
      endpoint: body.s3.endpoint ?? prev.endpoint,
      region: body.s3.region ?? prev.region,
      bucket: body.s3.bucket ?? prev.bucket,
      accessKey: isMasked(body.s3.accessKey) ? prev.accessKey : body.s3.accessKey || "",
      secretKey: isMasked(body.s3.secretKey) ? prev.secretKey : body.s3.secretKey || "",
      publicBaseUrl: body.s3.publicBaseUrl ?? prev.publicBaseUrl,
      customDomain: body.s3.customDomain ?? prev.customDomain,
      forcePathStyle: body.s3.forcePathStyle ?? prev.forcePathStyle,
    };
  } else if (current.s3) {
    // Preserve existing S3 config if the client didn't send one (e.g. the
    // admin only changed upload rules, not credentials).
    next.s3 = current.s3;
  }

  // Merge Supabase config — same secret-preservation logic.
  if (body.supabase) {
    const prev = current.supabase ?? { url: "", bucket: "", serviceRoleKey: "" };
    next.supabase = {
      url: body.supabase.url ?? prev.url,
      bucket: body.supabase.bucket ?? prev.bucket,
      serviceRoleKey: isMasked(body.supabase.serviceRoleKey)
        ? prev.serviceRoleKey
        : body.supabase.serviceRoleKey || "",
    };
  } else if (current.supabase) {
    next.supabase = current.supabase;
  }

  // Merge Azure Blob config — same secret-preservation logic.
  if (body.azure) {
    const prev = current.azure ?? { connectionString: "", containerName: "", publicBaseUrl: "", accountName: "" };
    next.azure = {
      connectionString: isMasked(body.azure.connectionString)
        ? prev.connectionString
        : body.azure.connectionString || "",
      containerName: body.azure.containerName ?? prev.containerName,
      publicBaseUrl: body.azure.publicBaseUrl ?? prev.publicBaseUrl,
      accountName: body.azure.accountName ?? prev.accountName,
    };
  } else if (current.azure) {
    next.azure = current.azure;
  }

  // Apply provider preset auto-fills (region, forcePathStyle) for S3-based
  // providers so the admin doesn't have to remember provider-specific quirks.
  const presetConfig = applyProviderPreset(next, next.provider);

  await saveStorageConfig(presetConfig);
  return ok({ config: maskConfig(presetConfig) });
}

/** Detect masked placeholder values so we don't overwrite real secrets. */
function isMasked(value: string | undefined): boolean {
  if (!value) return false;
  return value.includes("••••");
}
