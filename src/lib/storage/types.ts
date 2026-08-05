// ============================================================================
// File: src/lib/storage/types.ts
// Purpose: Provider-agnostic storage interfaces. Every storage backend (Local,
//          S3-compatible, Supabase, Azure, …) implements the StorageProvider
//          interface so the rest of the app never knows which provider is
//          active. The active provider + credentials are chosen at runtime
//          from the Admin Panel → Settings → Storage configuration (stored in
//          the Setting table under key "storage.config").
//
// SUPPORTED PROVIDERS (9 distinct presets + 1 dev fallback):
//   amazon-s3        → AWS S3 (uses the S3 adapter)
//   cloudflare-r2    → Cloudflare R2 (S3-compatible)
//   backblaze-b2     → Backblaze B2 (S3-compatible)
//   digitalocean     → DigitalOcean Spaces (S3-compatible)
//   minio            → MinIO self-hosted (S3-compatible)
//   google-cloud     → Google Cloud Storage (S3-compatible interop)
//   custom           → Any S3-compatible service (user supplies endpoint)
//   supabase         → Supabase Storage (native SDK)
//   azure-blob       → Azure Blob Storage (native SDK)
//   local            → Local filesystem (dev/sandbox fallback)
// ============================================================================

// ---------------------------------------------------------------------------
// Logical "category" of file — used as a folder prefix inside the bucket so
// files are organized (e.g. products/abc.jpg, brands/xyz.png). This is NOT
// tied to any provider; each provider simply prefixes the object key with it.
// ---------------------------------------------------------------------------
export type FileCategory =
  | "products"
  | "brands"
  | "categories"
  | "qr-codes"
  | "store"
  | "prescriptions"
  | "payments"
  | "reviews";

// Categories that contain sensitive files (customer prescriptions, payment
// screenshots). These are served through the authenticated /api/file proxy
// rather than via a direct public URL.
export const PRIVATE_CATEGORIES: ReadonlySet<FileCategory> = new Set([
  "prescriptions",
  "payments",
]);

// Backwards-compatible alias — the upload routes import `StorageBucket`.
export type StorageBucket = FileCategory;

// ---------------------------------------------------------------------------
// Provider identifiers. The S3-adapter providers (amazon-s3, cloudflare-r2,
// backblaze-b2, digitalocean, minio, google-cloud, custom) all resolve to the
// S3Provider class under the hood — they speak the same S3 protocol. Each
// preset auto-fills the correct endpoint + region defaults so the admin only
// needs to enter credentials + bucket. "azure-blob" and "supabase" use their
// own native SDKs. "local" is the dev fallback.
// ---------------------------------------------------------------------------
export type ProviderId =
  | "amazon-s3"
  | "cloudflare-r2"
  | "backblaze-b2"
  | "digitalocean"
  | "minio"
  | "google-cloud"
  | "custom"
  | "supabase"
  | "azure-blob"
  | "local";

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  "amazon-s3": "Amazon S3",
  "cloudflare-r2": "Cloudflare R2",
  "backblaze-b2": "Backblaze B2",
  digitalocean: "DigitalOcean Spaces",
  minio: "MinIO (S3-compatible)",
  "google-cloud": "Google Cloud Storage",
  custom: "Custom Storage Provider (S3-compatible)",
  supabase: "Supabase Storage",
  "azure-blob": "Azure Blob Storage",
  local: "Local Filesystem (dev only)",
};

export const PROVIDER_OPTIONS: Array<{ value: ProviderId; label: string }> = [
  { value: "cloudflare-r2", label: PROVIDER_LABELS["cloudflare-r2"] },
  { value: "amazon-s3", label: PROVIDER_LABELS["amazon-s3"] },
  { value: "backblaze-b2", label: PROVIDER_LABELS["backblaze-b2"] },
  { value: "digitalocean", label: PROVIDER_LABELS["digitalocean"] },
  { value: "minio", label: PROVIDER_LABELS["minio"] },
  { value: "google-cloud", label: PROVIDER_LABELS["google-cloud"] },
  { value: "supabase", label: PROVIDER_LABELS["supabase"] },
  { value: "azure-blob", label: PROVIDER_LABELS["azure-blob"] },
  { value: "custom", label: PROVIDER_LABELS["custom"] },
  { value: "local", label: PROVIDER_LABELS["local"] },
];

/** Providers that use the S3 adapter under the hood. */
export const S3_BASED_PROVIDERS: ReadonlySet<ProviderId> = new Set([
  "amazon-s3",
  "cloudflare-r2",
  "backblaze-b2",
  "digitalocean",
  "minio",
  "google-cloud",
  "custom",
]);

/** Provider presets — auto-fill endpoint + region + forcePathStyle defaults
 *  so the admin only needs to enter credentials + bucket name. */
export interface ProviderPreset {
  label: string;
  endpointHint: string;
  regionDefault: string;
  forcePathStyle: boolean;
  docsUrl: string;
}

export const PROVIDER_PRESETS: Record<
  Extract<ProviderId, "amazon-s3" | "cloudflare-r2" | "backblaze-b2" | "digitalocean" | "minio" | "google-cloud" | "custom">,
  ProviderPreset
> = {
  "amazon-s3": {
    label: "Amazon S3",
    endpointHint: "(leave blank — AWS uses the default endpoint)",
    regionDefault: "us-east-1",
    forcePathStyle: false,
    docsUrl: "https://docs.aws.amazon.com/s3/",
  },
  "cloudflare-r2": {
    label: "Cloudflare R2",
    endpointHint: "https://<account-id>.r2.cloudflarestorage.com",
    regionDefault: "auto",
    forcePathStyle: true,
    docsUrl: "https://developers.cloudflare.com/r2/api/s3/api/",
  },
  "backblaze-b2": {
    label: "Backblaze B2",
    endpointHint: "https://s3.<region>.backblazeb2.com",
    regionDefault: "us-west-004",
    forcePathStyle: true,
    docsUrl: "https://www.backblaze.com/b2/docs/s3_compatible_api.html",
  },
  digitalocean: {
    label: "DigitalOcean Spaces",
    endpointHint: "https://<region>.digitaloceanspaces.com",
    regionDefault: "nyc3",
    forcePathStyle: false,
    docsUrl: "https://docs.digitalocean.com/products/spaces/how-to/use-aws-s3-sdk/",
  },
  minio: {
    label: "MinIO",
    endpointHint: "http://localhost:9000 (or your MinIO server URL)",
    regionDefault: "us-east-1",
    forcePathStyle: true,
    docsUrl: "https://min.io/docs/minio/linux/developers/javascript/API.html",
  },
  "google-cloud": {
    label: "Google Cloud Storage (S3 interop)",
    endpointHint: "https://storage.googleapis.com",
    regionDefault: "auto",
    forcePathStyle: false,
    docsUrl: "https://cloud.google.com/storage/docs/aws-simple-migration",
  },
  custom: {
    label: "Custom S3-Compatible",
    endpointHint: "https://your-storage-endpoint.com",
    regionDefault: "us-east-1",
    forcePathStyle: true,
    docsUrl: "",
  },
};

// ---------------------------------------------------------------------------
// Provider configuration — stored as JSON in the Setting table under
// "storage.config". Secrets are stored here too; the GET endpoint masks them
// before sending to the client.
// ---------------------------------------------------------------------------
export interface StorageConfig {
  /** Active provider. Only one provider is used at a time. */
  provider: ProviderId;

  /** Whether cloud storage is enabled. When false, falls back to local. */
  enabled: boolean;

  /** Custom display name (shown in the dashboard status card). Optional. */
  displayName?: string;

  // — S3-compatible config (Amazon S3, R2, B2, Spaces, MinIO, GCS, Custom) —
  s3?: S3Config;

  // — Supabase Storage config —
  supabase?: SupabaseConfig;

  // — Azure Blob Storage config —
  azure?: AzureConfig;

  // — Global upload rules —
  /** Max file size in bytes (default 10 MB). */
  maxFileSize: number;
  /** Allowed MIME types. */
  allowedMimeTypes: string[];
  /** Path prefix inside the bucket (e.g. "pms" → pms/products/abc.jpg). */
  pathPrefix?: string;

  // — Public/Private bucket configuration —
  /** When true, public categories serve via direct CDN URL. When false, ALL
   *  files go through the authenticated /api/file proxy. Default: true. */
  publicBucketEnabled: boolean;
  /** Categories treated as private (served via signed URL / proxy). */
  privateCategories?: FileCategory[];

  // — Signed URL settings (for private files) —
  /** Signed URL expiration in seconds. Default: 3600 (1 hour). */
  signedUrlExpiry: number;

  // — File retention & cleanup —
  /** When a file is replaced/deleted, automatically remove the old object
   *  from the bucket. Default: true. */
  autoCleanupOrphans: boolean;
  /** Retention period in days. Files older than this in a "trash" prefix are
   *  permanently deleted. 0 = no retention (delete immediately). Default: 0. */
  retentionDays: number;

  // — Retry logic —
  /** Max retry attempts on transient upload failures. Default: 3. */
  maxRetries: number;
  /** Initial backoff in ms (doubles each retry). Default: 500. */
  retryBackoffMs: number;
}

export interface S3Config {
  endpoint?: string;       // Custom endpoint (R2, Spaces, MinIO, B2, GCS). Omit for AWS S3.
  region?: string;         // e.g. "us-east-1", "auto" for R2.
  bucket: string;          // Bucket / container name.
  accessKey: string;       // Access key ID.
  secretKey: string;       // Secret access key.
  publicBaseUrl?: string;  // CDN/base URL for public file access.
  customDomain?: string;   // Custom domain (e.g. https://cdn.example.com). Aliased with publicBaseUrl.
  forcePathStyle?: boolean;// true for MinIO/R2/B2; false for AWS virtual-host style.
}

export interface SupabaseConfig {
  url: string;             // https://<project-ref>.supabase.co
  serviceRoleKey: string;  // service_role key (server-only).
  bucket: string;          // Bucket name.
}

export interface AzureConfig {
  connectionString: string; // Azure Storage connection string (AccountKey-based).
  containerName: string;    // Container name (lowercase, no special chars).
  publicBaseUrl?: string;   // Custom domain (optional). Falls back to blob core URL.
  accountName?: string;     // Extracted from connection string for URL building.
}

// ---------------------------------------------------------------------------
// Result of an upload — what the upload routes store in the DB.
// ---------------------------------------------------------------------------
export interface UploadResult {
  /** Public URL (public categories) or proxy path (private categories). */
  url: string;
  /** Object key within the bucket (without any URL decoration). */
  key: string;
  /** File size in bytes. */
  size: number;
  /** MIME type. */
  contentType: string;
  /** Original filename (sanitized). */
  originalName: string;
}

export interface UploadOptions {
  /** ID prefix for the filename (e.g. brandId, productId). */
  ownerId?: string;
  /** Override the generated filename (used by product URL-import). */
  filename?: string;
}

// ---------------------------------------------------------------------------
// The contract every storage backend implements. The facade (index.ts)
// delegates to whichever provider is active.
// ---------------------------------------------------------------------------
export interface StorageProvider {
  /** Human-readable provider id. */
  readonly id: ProviderId;

  /** Upload a file. Throws StorageError on validation/network failure.
   *  Includes automatic retry on transient failures. */
  upload(
    category: FileCategory,
    file: File | Buffer,
    opts?: UploadOptions
  ): Promise<UploadResult>;

  /** Delete a file by its stored URL or key. Best-effort (never throws). */
  delete(category: FileCategory, urlOrKey: string): Promise<void>;

  /** Generate a public URL for a key (public categories only). */
  getPublicUrl(category: FileCategory, key: string): string;

  /** Generate a time-limited signed URL (private categories). */
  getSignedUrl(
    category: FileCategory,
    key: string,
    expiresIn?: number
  ): Promise<string>;

  /** Test that the provider is reachable & credentials are valid.
   *  Returns { ok, message } — never throws. */
  testConnection(): Promise<{ ok: boolean; message: string }>;
}

// ---------------------------------------------------------------------------
// Custom error with HTTP status code for clean API error handling.
// ---------------------------------------------------------------------------
export class StorageError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "StorageError";
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Default validation rules — applied by every provider.
// ---------------------------------------------------------------------------
export const DEFAULT_ALLOWED_MIME = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

export const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export const DEFAULT_SIGNED_URL_EXPIRY = 3600; // 1 hour

export const DEFAULT_MAX_RETRIES = 3;

export const DEFAULT_RETRY_BACKOFF_MS = 500;

export const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

// ---------------------------------------------------------------------------
// Default config — used when nothing is stored in the DB yet. Falls back to
// local filesystem so the app works out-of-the-box in dev.
// ---------------------------------------------------------------------------
export const DEFAULT_STORAGE_CONFIG: StorageConfig = {
  provider: "local",
  enabled: false,
  maxFileSize: DEFAULT_MAX_FILE_SIZE,
  allowedMimeTypes: DEFAULT_ALLOWED_MIME,
  pathPrefix: "",
  publicBucketEnabled: true,
  privateCategories: ["prescriptions", "payments"],
  signedUrlExpiry: DEFAULT_SIGNED_URL_EXPIRY,
  autoCleanupOrphans: true,
  retentionDays: 0,
  maxRetries: DEFAULT_MAX_RETRIES,
  retryBackoffMs: DEFAULT_RETRY_BACKOFF_MS,
};

// ---------------------------------------------------------------------------
// Shared validation + filename helpers (used by every provider).
// ---------------------------------------------------------------------------
export function validateImageFile(
  file: { type?: string; size: number; name?: string },
  allowedMime: string[] = DEFAULT_ALLOWED_MIME,
  maxSize: number = DEFAULT_MAX_FILE_SIZE
): string {
  const mime = (file.type || "").split(";")[0].trim();
  if (!allowedMime.includes(mime)) {
    throw new StorageError(
      `Unsupported file type: ${mime || "unknown"}. Allowed: ${allowedMime
        .map((m) => m.split("/")[1])
        .join(", ")
        .toUpperCase()}.`,
      400
    );
  }
  if (file.size > maxSize) {
    throw new StorageError(
      `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum ${(
        maxSize /
        1024 /
        1024
      ).toFixed(0)} MB.`,
      400
    );
  }
  return mime;
}

export function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 50) || "file"
  );
}

export function generateKey(
  _category: FileCategory,
  file: { name?: string; type?: string },
  opts?: UploadOptions
): string {
  const mime = (file.type || "image/png").split(";")[0].trim();
  const ext = MIME_TO_EXT[mime] || "png";
  const owner = opts?.ownerId ? `${opts.ownerId}-` : "";
  const safeName = file.name ? sanitizeFilename(file.name) : "upload";
  const unique = Math.random().toString(36).slice(2, 10);
  return opts?.filename || `${owner}${safeName}-${unique}.${ext}`;
}

// ---------------------------------------------------------------------------
// Retry helper — wraps an async operation with exponential backoff. Used by
// every provider's upload method to handle transient network failures.
// ---------------------------------------------------------------------------
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = DEFAULT_MAX_RETRIES,
  backoffMs: number = DEFAULT_RETRY_BACKOFF_MS,
  label: string = "operation"
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      lastError = e;
      // Don't retry on validation errors (HTTP 4xx) — only retry on network/
      // server errors (5xx) or connection failures.
      const isValidation = e instanceof StorageError && e.status >= 400 && e.status < 500;
      if (isValidation || attempt === maxRetries) throw e;
      const wait = backoffMs * Math.pow(2, attempt);
      console.warn(`[storage] ${label} attempt ${attempt + 1}/${maxRetries + 1} failed: ${e.message}. Retrying in ${wait}ms...`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastError;
}
