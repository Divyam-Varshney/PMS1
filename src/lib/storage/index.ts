// ============================================================================
// File: src/lib/storage/index.ts
// Purpose: Storage facade — the single entry point the rest of the app uses.
//          Exports `storage` (the active provider) plus helper functions.
//
//          The active provider is resolved at runtime from the Admin Panel →
//          Settings → Storage configuration (stored in the Setting table under
//          key "storage.config"). Changing the provider in the admin panel
//          takes effect immediately — no code changes, no redeploy.
//
// SUPPORTED PROVIDERS (9 + 1 dev fallback):
//   cloudflare-r2, amazon-s3, backblaze-b2, digitalocean, minio,
//   google-cloud, custom       → S3Provider (S3 protocol)
//   supabase                   → SupabaseProvider (native SDK)
//   azure-blob                 → AzureBlobProvider (native SDK)
//   local                      → LocalProvider (dev fallback)
//
// USAGE (upload routes — provider-agnostic):
//   import { storage } from "@/lib/storage";
//   const { url } = await storage.upload("brands", file, { ownerId: id });
//   await storage.delete("brands", oldUrl);
//   const signed = await storage.getSignedUrl("prescriptions", key, 3600);
// ============================================================================

import { getSetting, setSetting } from "@/lib/settings";
import {
  StorageProvider,
  StorageError,
  FileCategory,
  StorageBucket,
  UploadResult,
  UploadOptions,
  StorageConfig,
  ProviderId,
  S3Config,
  SupabaseConfig,
  AzureConfig,
  S3_BASED_PROVIDERS,
  PROVIDER_PRESETS,
  PROVIDER_OPTIONS,
  PROVIDER_LABELS,
  DEFAULT_ALLOWED_MIME,
  DEFAULT_MAX_FILE_SIZE,
  DEFAULT_SIGNED_URL_EXPIRY,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRY_BACKOFF_MS,
  DEFAULT_STORAGE_CONFIG,
  PRIVATE_CATEGORIES,
} from "./types";
// Providers are imported LAZILY (dynamic import) inside getProvider() so the
// AWS SDK (~13MB), Supabase SDK (~9MB), and Azure SDK (~30MB) are only loaded
// when the corresponding cloud provider is actually configured. This saves
// ~52MB of RAM on startup when using local storage, and speeds up cold starts.
// The LocalProvider is always available for dev fallback.
import { LocalProvider, readLocalPrivateFile } from "./providers/local";

// Re-export DEFAULT_STORAGE_CONFIG for convenience (it's defined in types.ts).
export { DEFAULT_STORAGE_CONFIG };

const STORAGE_CONFIG_KEY = "storage.config";

// ---------------------------------------------------------------------------
// In-memory provider cache. The provider instance is expensive to construct
// (S3 client setup, Supabase client setup), so we cache it. Cache is busted
// whenever the config is saved via saveStorageConfig().
// ---------------------------------------------------------------------------
let _provider: StorageProvider | null = null;
let _providerConfig: StorageConfig | null = null;

/** Load the storage config from the DB (with the settings cache). Merges with
 *  defaults so any new fields added in a release are always present. */
export async function getStorageConfig(): Promise<StorageConfig> {
  const raw = await getSetting<StorageConfig | null>(STORAGE_CONFIG_KEY);
  if (!raw) return { ...DEFAULT_STORAGE_CONFIG };
  return {
    ...DEFAULT_STORAGE_CONFIG,
    ...raw,
    // Ensure arrays/numbers are always present even if the stored JSON is old.
    allowedMimeTypes: raw.allowedMimeTypes?.length
      ? raw.allowedMimeTypes
      : DEFAULT_ALLOWED_MIME,
    maxFileSize: raw.maxFileSize || DEFAULT_MAX_FILE_SIZE,
    signedUrlExpiry: raw.signedUrlExpiry || DEFAULT_SIGNED_URL_EXPIRY,
    maxRetries: raw.maxRetries ?? DEFAULT_MAX_RETRIES,
    retryBackoffMs: raw.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS,
    publicBucketEnabled: raw.publicBucketEnabled ?? true,
    autoCleanupOrphans: raw.autoCleanupOrphans ?? true,
    retentionDays: raw.retentionDays ?? 0,
  };
}

/** Save the storage config to the DB + invalidate the provider cache. */
export async function saveStorageConfig(config: StorageConfig): Promise<void> {
  await setSetting(STORAGE_CONFIG_KEY, config, "storage");
  _provider = null;
  _providerConfig = null;
}

/** Mask secrets for safe display in the admin UI. */
export function maskConfig(config: StorageConfig): StorageConfig {
  const masked: StorageConfig = JSON.parse(JSON.stringify(config));
  if (masked.s3) {
    if (masked.s3.accessKey)
      masked.s3.accessKey = masked.s3.accessKey.slice(0, 4) + "••••••••";
    if (masked.s3.secretKey) masked.s3.secretKey = "••••••••••••";
  }
  if (masked.supabase) {
    if (masked.supabase.serviceRoleKey)
      masked.supabase.serviceRoleKey =
        masked.supabase.serviceRoleKey.slice(0, 8) + "••••••••";
  }
  if (masked.azure) {
    if (masked.azure.connectionString)
      masked.azure.connectionString =
        masked.azure.connectionString.slice(0, 20) + "••••••••";
  }
  return masked;
}

/** Apply provider preset defaults to the S3 config when the admin selects a
 *  specific S3-based provider (e.g. cloudflare-r2 auto-fills forcePathStyle=true). */
export function applyProviderPreset(
  config: StorageConfig,
  providerId: ProviderId
): StorageConfig {
  const next = { ...config, provider: providerId };
  if (S3_BASED_PROVIDERS.has(providerId) && providerId !== "custom") {
    const preset = PROVIDER_PRESETS[providerId as keyof typeof PROVIDER_PRESETS];
    if (preset && next.s3) {
      // Only auto-fill region + forcePathStyle if they're empty/default — don't
      // clobber values the admin already entered.
      next.s3 = {
        ...next.s3,
        region: next.s3.region || preset.regionDefault,
        forcePathStyle: preset.forcePathStyle,
      };
    }
  }
  return next;
}

/**
 * Resolve the active provider from the current config. If cloud storage is
 * disabled or the configured provider is incomplete, falls back to Local.
 * The result is cached until the config changes.
 */
export async function getProvider(): Promise<StorageProvider> {
  if (_provider && _providerConfig) return _provider;

  const config = await getStorageConfig();

  // If cloud storage is disabled, use local (dev mode).
  if (!config.enabled) {
    _provider = new LocalProvider(config);
    _providerConfig = config;
    return _provider;
  }

  try {
    const providerName = PROVIDER_LABELS[config.provider] || config.provider;

    // S3-based providers (7 of the 9 cloud providers)
    if (S3_BASED_PROVIDERS.has(config.provider)) {
      if (!config.s3?.bucket || !config.s3?.accessKey || !config.s3?.secretKey) {
        throw new StorageError(
          `${providerName} requires bucket, accessKey, and secretKey. Falling back to local.`,
          500
        );
      }
      // Dynamic import — only loads the AWS SDK (~13MB) when an S3-based
      // provider is actually configured. Avoids loading it for local/supabase/azure.
      const { S3Provider } = await import("./providers/s3");
      _provider = new S3Provider(config, config.provider);
    }
    // Supabase Storage (native SDK)
    else if (config.provider === "supabase") {
      if (!config.supabase?.url || !config.supabase?.serviceRoleKey) {
        throw new StorageError(
          "Supabase provider requires url and serviceRoleKey. Falling back to local.",
          500
        );
      }
      const { SupabaseProvider } = await import("./providers/supabase");
      _provider = new SupabaseProvider(config);
    }
    // Azure Blob Storage (native SDK)
    else if (config.provider === "azure-blob") {
      if (!config.azure?.connectionString || !config.azure?.containerName) {
        throw new StorageError(
          "Azure Blob provider requires connectionString and containerName. Falling back to local.",
          500
        );
      }
      const { AzureBlobProvider } = await import("./providers/azure-blob");
      _provider = new AzureBlobProvider(config);
    }
    // Local (dev fallback)
    else {
      _provider = new LocalProvider(config);
    }
  } catch (e) {
    console.error("[storage] provider init failed, falling back to local:", e);
    _provider = new LocalProvider(config);
  }

  _providerConfig = config;
  return _provider;
}

// ---------------------------------------------------------------------------
// The `storage` facade — delegates every call to the active provider.
// This is what every upload route imports.
// ---------------------------------------------------------------------------
export const storage: StorageProvider = {
  get id() {
    return _provider?.id ?? "local";
  },
  upload: (category, file, opts) => getProvider().then((p) => p.upload(category, file, opts)),
  delete: (category, urlOrKey) =>
    getProvider().then((p) => p.delete(category, urlOrKey)),
  getPublicUrl: (category, key) => {
    if (_provider) return _provider.getPublicUrl(category, key);
    return `/uploads/${category}/${key}`;
  },
  getSignedUrl: (category, key, expiresIn) =>
    getProvider().then((p) => p.getSignedUrl(category, key, expiresIn)),
  testConnection: () => getProvider().then((p) => p.testConnection()),
};

// ---------------------------------------------------------------------------
// Helper for the /api/file proxy — reads a private-category file from the
// active provider. Returns either a buffer (local) or a signed-URL redirect
// (cloud).
// ---------------------------------------------------------------------------
export async function readPrivateFile(
  category: FileCategory,
  key: string
): Promise<
  | { type: "buffer"; data: Buffer; contentType: string }
  | { type: "redirect"; url: string }
> {
  const provider = await getProvider();
  if (provider.id === "local") {
    const { data, contentType } = await readLocalPrivateFile(category, key);
    return { type: "buffer", data, contentType };
  }
  // Cloud providers — generate a short-lived signed URL + redirect.
  const url = await provider.getSignedUrl(category, key, 300); // 5 min
  return { type: "redirect", url };
}

// ---------------------------------------------------------------------------
// Utility exports — re-exported from types for convenience. Type-only exports
// use `export type` so Turbopack's isolatedModules doesn't choke on interfaces.
// ---------------------------------------------------------------------------
export {
  StorageError,
  PROVIDER_OPTIONS,
  PROVIDER_LABELS,
  PROVIDER_PRESETS,
  S3_BASED_PROVIDERS,
  DEFAULT_ALLOWED_MIME,
  DEFAULT_MAX_FILE_SIZE,
  DEFAULT_SIGNED_URL_EXPIRY,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRY_BACKOFF_MS,
  PRIVATE_CATEGORIES,
};
export type {
  StorageConfig,
  StorageProvider,
  StorageBucket,
  FileCategory,
  UploadResult,
  UploadOptions,
  ProviderId,
  S3Config,
  SupabaseConfig,
  AzureConfig,
};

/** Extract the object key from any stored URL/path format. */
export function extractStorageKey(urlOrKey: string): string {
  if (!urlOrKey) return urlOrKey;
  // S3 CDN / custom domain: https://cdn.example.com/[prefix/][category]/[key]
  if (urlOrKey.startsWith("http")) {
    return urlOrKey.split("?")[0].split("/").pop() || urlOrKey;
  }
  // Proxy path: /api/file/<category>/<key>
  if (urlOrKey.startsWith("/api/file/")) {
    return urlOrKey.split("/api/file/")[1].split("/").slice(1).join("/");
  }
  // Legacy local path: /uploads/<folder>/<key>
  if (urlOrKey.startsWith("/uploads/")) {
    return urlOrKey.split("/").pop() || urlOrKey;
  }
  return urlOrKey;
}

/** Check if a cloud provider is active (vs local dev fallback). */
export async function isCloudStorage(): Promise<boolean> {
  const config = await getStorageConfig();
  return config.enabled && config.provider !== "local";
}
