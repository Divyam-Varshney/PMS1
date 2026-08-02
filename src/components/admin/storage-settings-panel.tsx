// ============================================================================
// File: src/components/admin/storage-settings-panel.tsx
// Purpose: Storage settings panel — admin UI for configuring the cloud storage
//          provider. Supports 9 providers: Amazon S3, Cloudflare R2, Backblaze
//          B2, DigitalOcean Spaces, MinIO, Google Cloud Storage, Custom
//          (S3-compatible), Supabase Storage, Azure Blob Storage. Plus a Local
//          dev fallback.
//
//          Switching providers requires only updating this config — no code
//          changes. The panel includes provider-specific credential forms,
//          upload rules, public/private bucket config, signed URL expiry,
//          file retention/cleanup, retry logic, test connection, and save.
//
// This panel has its OWN state + API calls (separate from the main settings
// form) because the storage config is stored under a dedicated Setting key
// ("storage.config") and needs secret-masking + test-connection logic.
// ============================================================================

"use client";

import { useState, useEffect } from "react";
import { api, run } from "./api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Save,
  Loader2,
  Cloud,
  CloudUpload,
  CheckCircle2,
  XCircle,
  HardDrive,
  Eye,
  EyeOff,
  Plug,
  Shield,
  Clock,
  Trash2,
  RotateCw,
  ExternalLink,
  Activity,
  FileImage,
  Database,
} from "lucide-react";
import { toast } from "sonner";
import { StorageUsageStats } from "./storage-usage-stats";

// ---------------------------------------------------------------------------
// Types — mirror src/lib/storage/types.ts (kept here to avoid importing server
// code into the client bundle).
// ---------------------------------------------------------------------------
type ProviderId =
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

interface StorageConfig {
  provider: ProviderId;
  enabled: boolean;
  displayName?: string;
  s3?: {
    endpoint?: string;
    region?: string;
    bucket: string;
    accessKey: string;
    secretKey: string;
    publicBaseUrl?: string;
    customDomain?: string;
    forcePathStyle?: boolean;
  };
  supabase?: { url: string; serviceRoleKey: string; bucket: string };
  azure?: {
    connectionString: string;
    containerName: string;
    publicBaseUrl?: string;
    accountName?: string;
  };
  maxFileSize: number;
  allowedMimeTypes: string[];
  pathPrefix?: string;
  publicBucketEnabled: boolean;
  privateCategories?: string[];
  signedUrlExpiry: number;
  autoCleanupOrphans: boolean;
  retentionDays: number;
  maxRetries: number;
  retryBackoffMs: number;
}

// Provider presets — auto-fill endpoint hints + region + forcePathStyle.
const PROVIDER_PRESETS: Record<
  Exclude<ProviderId, "supabase" | "azure-blob" | "local">,
  { label: string; endpointHint: string; regionDefault: string; forcePathStyle: boolean; docsUrl: string; hint: string }
> = {
  "cloudflare-r2": {
    label: "Cloudflare R2",
    endpointHint: "https://<account-id>.r2.cloudflarestorage.com",
    regionDefault: "auto",
    forcePathStyle: true,
    docsUrl: "https://developers.cloudflare.com/r2/api/s3/api/",
    hint: "Zero egress fees. Recommended for cost-conscious deployments.",
  },
  "amazon-s3": {
    label: "Amazon S3",
    endpointHint: "(leave blank — AWS uses the default endpoint)",
    regionDefault: "us-east-1",
    forcePathStyle: false,
    docsUrl: "https://docs.aws.amazon.com/s3/",
    hint: "Industry standard. Higher egress costs.",
  },
  "backblaze-b2": {
    label: "Backblaze B2",
    endpointHint: "https://s3.<region>.backblazeb2.com",
    regionDefault: "us-west-004",
    forcePathStyle: true,
    docsUrl: "https://www.backblaze.com/b2/docs/s3_compatible_api.html",
    hint: "Cheapest raw storage. Free egress via Cloudflare CDN.",
  },
  digitalocean: {
    label: "DigitalOcean Spaces",
    endpointHint: "https://<region>.digitaloceanspaces.com",
    regionDefault: "nyc3",
    forcePathStyle: false,
    docsUrl: "https://docs.digitalocean.com/products/spaces/",
    hint: "$5/month flat for 250 GB. Simple pricing.",
  },
  minio: {
    label: "MinIO (self-hosted)",
    endpointHint: "http://localhost:9000",
    regionDefault: "us-east-1",
    forcePathStyle: true,
    docsUrl: "https://min.io/docs/",
    hint: "Self-hosted S3-compatible. For on-premise or VPS.",
  },
  "google-cloud": {
    label: "Google Cloud Storage",
    endpointHint: "https://storage.googleapis.com",
    regionDefault: "auto",
    forcePathStyle: false,
    docsUrl: "https://cloud.google.com/storage/docs/aws-simple-migration",
    hint: "S3-compatible interop mode.",
  },
  custom: {
    label: "Custom S3-Compatible",
    endpointHint: "https://your-storage-endpoint.com",
    regionDefault: "us-east-1",
    forcePathStyle: true,
    docsUrl: "",
    hint: "Any S3-compatible service (Wasabi, Linode, etc.)",
  },
};

const ALL_PROVIDERS: Array<{ value: ProviderId; label: string; hint: string }> = [
  { value: "cloudflare-r2", label: PROVIDER_PRESETS["cloudflare-r2"].label, hint: PROVIDER_PRESETS["cloudflare-r2"].hint },
  { value: "amazon-s3", label: PROVIDER_PRESETS["amazon-s3"].label, hint: PROVIDER_PRESETS["amazon-s3"].hint },
  { value: "backblaze-b2", label: PROVIDER_PRESETS["backblaze-b2"].label, hint: PROVIDER_PRESETS["backblaze-b2"].hint },
  { value: "digitalocean", label: PROVIDER_PRESETS["digitalocean"].label, hint: PROVIDER_PRESETS["digitalocean"].hint },
  { value: "minio", label: PROVIDER_PRESETS["minio"].label, hint: PROVIDER_PRESETS["minio"].hint },
  { value: "google-cloud", label: PROVIDER_PRESETS["google-cloud"].label, hint: PROVIDER_PRESETS["google-cloud"].hint },
  { value: "supabase", label: "Supabase Storage", hint: "Already using Supabase DB? Single account." },
  { value: "azure-blob", label: "Azure Blob Storage", hint: "Microsoft Azure native SDK." },
  { value: "custom", label: PROVIDER_PRESETS["custom"].label, hint: PROVIDER_PRESETS["custom"].hint },
  { value: "local", label: "Local Filesystem", hint: "Dev only — not for Vercel production" },
];

const DEFAULT_CONFIG: StorageConfig = {
  provider: "local",
  enabled: false,
  maxFileSize: 10 * 1024 * 1024,
  allowedMimeTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"],
  pathPrefix: "",
  publicBucketEnabled: true,
  privateCategories: ["prescriptions", "payments"],
  signedUrlExpiry: 3600,
  autoCleanupOrphans: true,
  retentionDays: 0,
  maxRetries: 3,
  retryBackoffMs: 500,
};

export function StorageSettingsPanel() {
  const [config, setConfig] = useState<StorageConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [showSecrets, setShowSecrets] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get<{ config: StorageConfig }>("/api/admin/settings/storage");
        setConfig({ ...DEFAULT_CONFIG, ...data.config });
      } catch (e: any) {
        toast.error("Failed to load storage config: " + e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function update(patch: Partial<StorageConfig>) {
    setConfig((c) => ({ ...c, ...patch }));
    setTestResult(null);
  }

  function updateS3(patch: Partial<NonNullable<StorageConfig["s3"]>>) {
    setConfig((c) => ({ ...c, s3: { ...c.s3, ...patch } }));
    setTestResult(null);
  }

  function updateSupabase(patch: Partial<NonNullable<StorageConfig["supabase"]>>) {
    setConfig((c) => ({ ...c, supabase: { ...c.supabase, ...patch } }));
    setTestResult(null);
  }

  function updateAzure(patch: Partial<NonNullable<StorageConfig["azure"]>>) {
    setConfig((c) => ({ ...c, azure: { ...c.azure, ...patch } }));
    setTestResult(null);
  }

  /** When the provider changes, auto-fill the preset region + forcePathStyle. */
  function changeProvider(p: ProviderId) {
    const next = { ...config, provider: p };
    if (p in PROVIDER_PRESETS) {
      const preset = PROVIDER_PRESETS[p as keyof typeof PROVIDER_PRESETS];
      next.s3 = {
        ...(next.s3 || {}),
        region: next.s3?.region || preset.regionDefault,
        forcePathStyle: preset.forcePathStyle,
      };
    }
    setConfig(next);
    setTestResult(null);
  }

  async function handleSave() {
    setSaving(true);
    const r = await run(
      () => api.put<{ config: StorageConfig }>("/api/admin/settings/storage", { config }),
      { success: "Storage configuration saved", error: "Save failed" }
    );
    if (r) setConfig({ ...DEFAULT_CONFIG, ...r.config });
    setSaving(false);
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api.post<{ ok: boolean; message: string; provider: string }>(
        "/api/admin/settings/storage/test",
        { config }
      );
      setTestResult({ ok: r.ok, message: r.message });
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    } catch (e: any) {
      const msg = e?.message || "Test failed";
      setTestResult({ ok: false, message: msg });
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 h-48 bg-muted/30 animate-pulse" />
      </Card>
    );
  }

  const isLocalActive = !config.enabled || config.provider === "local";
  const isS3Based = config.provider in PROVIDER_PRESETS;
  const currentPreset = isS3Based
    ? PROVIDER_PRESETS[config.provider as keyof typeof PROVIDER_PRESETS]
    : null;

  return (
    <div className="space-y-4">
      {/* — Status banner — */}
      <Card
        className={
          isLocalActive
            ? "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20"
            : "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20"
        }
      >
        <CardContent className="flex items-start gap-3 pt-6">
          {isLocalActive ? (
            <HardDrive className="size-5 shrink-0 text-amber-600" />
          ) : (
            <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
          )}
          <div className="flex-1">
            <p className="text-sm font-semibold">
              {isLocalActive
                ? "Local filesystem mode (dev only)"
                : `Cloud storage active: ${ALL_PROVIDERS.find((p) => p.value === config.provider)?.label || config.provider}`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isLocalActive
                ? "Files are saved to public/uploads/ on the server. This will NOT work on Vercel (read-only filesystem). Configure a cloud provider below."
                : config.provider === "supabase"
                  ? `Bucket: ${config.supabase?.bucket || "—"}`
                  : config.provider === "azure-blob"
                    ? `Container: ${config.azure?.containerName || "—"}`
                    : `Bucket: ${config.s3?.bucket || "—"} · Region: ${config.s3?.region || "—"}`}
            </p>
          </div>
          <Badge variant={isLocalActive ? "outline" : "secondary"} className="gap-1">
            <Cloud className="size-3" />
            {isLocalActive ? "Dev mode" : "Production-ready"}
          </Badge>
        </CardContent>
      </Card>

      {/* — Storage usage statistics (file counts + sizes per category) — */}
      <StorageUsageStats />

      {/* — Provider selector + enable toggle — */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CloudUpload className="size-4" /> Storage Provider
          </CardTitle>
          <CardDescription>
            Choose where uploaded files are stored. Switch providers anytime — no code changes needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm font-medium">Enable cloud storage</Label>
              <p className="text-xs text-muted-foreground">
                When off, files use the local filesystem (dev mode).
              </p>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(v) => update({ enabled: v })}
            />
          </div>

          <div>
            <Label className="text-sm">Provider</Label>
            <Select value={config.provider} onValueChange={(v: ProviderId) => changeProvider(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_PROVIDERS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              {ALL_PROVIDERS.find((p) => p.value === config.provider)?.hint}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* — S3-compatible credentials (7 providers) — */}
      {isS3Based && currentPreset && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {currentPreset.label} Credentials
              {currentPreset.docsUrl && (
                <a
                  href={currentPreset.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-0.5"
                >
                  Docs <ExternalLink className="size-3" />
                </a>
              )}
            </CardTitle>
            <CardDescription>
              {config.provider === "custom"
                ? "Connect any S3-compatible storage service by entering the endpoint and credentials."
                : `S3-compatible. Endpoint hint: ${currentPreset.endpointHint}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {config.provider === "custom" && (
              <div>
                <Label className="text-xs">Display Name (optional)</Label>
                <Input
                  value={config.displayName || ""}
                  onChange={(e) => update({ displayName: e.target.value })}
                  placeholder="My Custom Storage"
                />
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Bucket Name</Label>
                <Input
                  value={config.s3?.bucket || ""}
                  onChange={(e) => updateS3({ bucket: e.target.value })}
                  placeholder="my-pharmacy-uploads"
                />
              </div>
              <div>
                <Label className="text-xs">Region</Label>
                <Input
                  value={config.s3?.region || ""}
                  onChange={(e) => updateS3({ region: e.target.value })}
                  placeholder={currentPreset.regionDefault}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Endpoint URL</Label>
              <Input
                value={config.s3?.endpoint || ""}
                onChange={(e) => updateS3({ endpoint: e.target.value })}
                placeholder={currentPreset.endpointHint}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {config.provider === "amazon-s3"
                  ? "Leave blank for AWS S3 (uses the default regional endpoint)."
                  : "Required for this provider."}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Public Base URL (optional)</Label>
                <Input
                  value={config.s3?.publicBaseUrl || ""}
                  onChange={(e) => updateS3({ publicBaseUrl: e.target.value })}
                  placeholder="https://cdn.example.com"
                />
              </div>
              <div>
                <Label className="text-xs">Custom Domain (optional)</Label>
                <Input
                  value={config.s3?.customDomain || ""}
                  onChange={(e) => updateS3({ customDomain: e.target.value })}
                  placeholder="https://cdn.example.com"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Access Key</Label>
                <Input
                  type={showSecrets ? "text" : "password"}
                  value={config.s3?.accessKey || ""}
                  onChange={(e) => updateS3({ accessKey: e.target.value })}
                  placeholder="AKIA…"
                />
              </div>
              <div>
                <Label className="text-xs">Secret Key</Label>
                <Input
                  type={showSecrets ? "text" : "password"}
                  value={config.s3?.secretKey || ""}
                  onChange={(e) => updateS3({ secretKey: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="text-sm font-medium">Force path-style URLs</Label>
                <p className="text-xs text-muted-foreground">
                  {currentPreset.forcePathStyle
                    ? "Required for this provider. Enabled by default."
                    : "Not recommended for this provider."}
                </p>
              </div>
              <Switch
                checked={config.s3?.forcePathStyle ?? currentPreset.forcePathStyle}
                onCheckedChange={(v) => updateS3({ forcePathStyle: v })}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* — Supabase credentials — */}
      {config.provider === "supabase" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Supabase Storage Credentials</CardTitle>
            <CardDescription>
              Get these from Supabase Dashboard → Project Settings → API.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">Project URL</Label>
              <Input
                value={config.supabase?.url || ""}
                onChange={(e) => updateSupabase({ url: e.target.value })}
                placeholder="https://xxxx.supabase.co"
              />
            </div>
            <div>
              <Label className="text-xs">Bucket Name</Label>
              <Input
                value={config.supabase?.bucket || ""}
                onChange={(e) => updateSupabase({ bucket: e.target.value })}
                placeholder="pms-uploads"
              />
            </div>
            <div>
              <Label className="text-xs">Service Role Key (secret)</Label>
              <Input
                type={showSecrets ? "text" : "password"}
                value={config.supabase?.serviceRoleKey || ""}
                onChange={(e) => updateSupabase({ serviceRoleKey: e.target.value })}
                placeholder="eyJhbGci…"
              />
              <p className="mt-1 text-xs text-amber-600">
                Use the service_role key (not the anon key). Never expose this to the client.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* — Azure Blob credentials — */}
      {config.provider === "azure-blob" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Azure Blob Storage Credentials</CardTitle>
            <CardDescription>
              Get the connection string from Azure Portal → Storage Account → Access keys.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">Connection String</Label>
              <Input
                type={showSecrets ? "text" : "password"}
                value={config.azure?.connectionString || ""}
                onChange={(e) => updateAzure({ connectionString: e.target.value })}
                placeholder="DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Must contain AccountName and AccountKey.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Container Name</Label>
                <Input
                  value={config.azure?.containerName || ""}
                  onChange={(e) => updateAzure({ containerName: e.target.value })}
                  placeholder="pms-uploads (lowercase)"
                />
              </div>
              <div>
                <Label className="text-xs">Public Base URL (optional)</Label>
                <Input
                  value={config.azure?.publicBaseUrl || ""}
                  onChange={(e) => updateAzure({ publicBaseUrl: e.target.value })}
                  placeholder="https://<account>.blob.core.windows.net/<container>"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* — Local dev mode notice — */}
      {config.provider === "local" && (
        <Card className="border-muted">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <HardDrive className="size-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Local Filesystem Mode</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Files are saved to <code className="rounded bg-muted px-1">public/uploads/</code> on the
                  server. This works for local development but{" "}
                  <strong>will not work on Vercel</strong> (read-only filesystem). Switch to a cloud
                  provider for production.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* — Upload rules — */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload Rules</CardTitle>
          <CardDescription>Global file validation — applies to all providers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Max File Size (MB)</Label>
              <Input
                type="number"
                value={Math.round(config.maxFileSize / (1024 * 1024))}
                onChange={(e) =>
                  update({ maxFileSize: (parseInt(e.target.value) || 10) * 1024 * 1024 })
                }
                min={1}
                max={50}
              />
            </div>
            <div>
              <Label className="text-xs">Upload Path Prefix (optional)</Label>
              <Input
                value={config.pathPrefix || ""}
                onChange={(e) => update({ pathPrefix: e.target.value })}
                placeholder="pms (→ pms/products/abc.jpg)"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Allowed File Types</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {config.allowedMimeTypes.map((m) => (
                <Badge key={m} variant="secondary" className="text-[10px]">
                  {m.split("/")[1].toUpperCase()}
                </Badge>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {config.allowedMimeTypes.join(", ")}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* — Public/Private bucket + signed URLs — */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="size-4" /> Public / Private Access
          </CardTitle>
          <CardDescription>
            Control how files are served. Private categories use signed URLs via the authenticated proxy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm font-medium">Public bucket access</Label>
              <p className="text-xs text-muted-foreground">
                When on, public categories (products, brands, etc.) serve via direct CDN URL. Turn off to route ALL files through the authenticated proxy.
              </p>
            </div>
            <Switch
              checked={config.publicBucketEnabled}
              onCheckedChange={(v) => update({ publicBucketEnabled: v })}
            />
          </div>
          <div>
            <Label className="text-xs flex items-center gap-1">
              <Clock className="size-3" /> Signed URL Expiration (seconds)
            </Label>
            <Input
              type="number"
              value={config.signedUrlExpiry}
              onChange={(e) => update({ signedUrlExpiry: parseInt(e.target.value) || 3600 })}
              min={60}
              max={86400}
              placeholder="3600 (1 hour)"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              How long signed URLs for private files (prescriptions, payments) remain valid. Default: 3600s (1 hour). Range: 60s – 86400s (24h).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* — File retention & cleanup — */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trash2 className="size-4" /> File Retention & Cleanup
          </CardTitle>
          <CardDescription>
            Automatic cleanup of orphaned files when records are deleted or replaced.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm font-medium">Auto-cleanup orphaned files</Label>
              <p className="text-xs text-muted-foreground">
                When a brand logo / product image / prescription is replaced or its record deleted, automatically remove the old file from storage.
              </p>
            </div>
            <Switch
              checked={config.autoCleanupOrphans}
              onCheckedChange={(v) => update({ autoCleanupOrphans: v })}
            />
          </div>
          <div>
            <Label className="text-xs">Retention Period (days)</Label>
            <Input
              type="number"
              value={config.retentionDays}
              onChange={(e) => update({ retentionDays: parseInt(e.target.value) || 0 })}
              min={0}
              max={365}
              placeholder="0"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              0 = delete immediately (default). Set to 7/30 to keep files in a trash prefix for that many days before permanent deletion — useful for accidental-delete recovery.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* — Retry logic — */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <RotateCw className="size-4" /> Retry Logic
          </CardTitle>
          <CardDescription>
            Automatic retry on transient upload failures (network errors, 5xx server errors).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Max Retry Attempts</Label>
              <Input
                type="number"
                value={config.maxRetries}
                onChange={(e) => update({ maxRetries: parseInt(e.target.value) || 3 })}
                min={0}
                max={10}
                placeholder="3"
              />
            </div>
            <div>
              <Label className="text-xs">Initial Backoff (ms)</Label>
              <Input
                type="number"
                value={config.retryBackoffMs}
                onChange={(e) => update({ retryBackoffMs: parseInt(e.target.value) || 500 })}
                min={100}
                max={10000}
                step={100}
                placeholder="500"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Backoff doubles each retry: {config.retryBackoffMs}ms → {config.retryBackoffMs * 2}ms → {config.retryBackoffMs * 4}ms…
            Validation errors (HTTP 4xx) are never retried.
          </p>
        </CardContent>
      </Card>

      {/* — Test + Save actions — */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={handleTest} disabled={testing} className="gap-2">
              {testing ? <Loader2 className="size-4 animate-spin" /> : <Plug className="size-4" />}
              Test Connection
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save Configuration
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSecrets((s) => !s)}
              className="gap-1.5 text-xs"
            >
              {showSecrets ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              {showSecrets ? "Hide" : "Show"} secrets
            </Button>
          </div>

          {testResult && (
            <div
              className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                testResult.ok
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
                  : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="size-4 shrink-0 mt-0.5" />
              )}
              <span className="flex-1">{testResult.message}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* — Storage Diagnostics —
          Live verification that uploads are actually reaching the cloud
          bucket. Shows: connection status, object count, recent uploads
          (with direct URLs), and a DB image URL audit. Helps the admin
          answer "are my uploads really in R2?" without logging into the
          Cloudflare dashboard. */}
      <StorageDiagnosticsCard />
    </div>
  );
}

// ---------------------------------------------------------------------------
// StorageDiagnosticsCard — fetches /api/admin/storage/diagnostics and displays
// the results in a clean, actionable card.
// ---------------------------------------------------------------------------
function StorageDiagnosticsCard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDiagnostics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<any>("/api/admin/storage/diagnostics");
      setData(res);
    } catch (e: any) {
      setError(e?.message || "Failed to load diagnostics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="size-4 text-emerald-600" />
              Storage Diagnostics
            </CardTitle>
            <CardDescription className="mt-1">
              Live verification that uploads are reaching your cloud bucket.
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchDiagnostics} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCw className="size-3.5" />}
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && !data ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
            <XCircle className="size-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : data ? (
          <>
            {/* Connection status */}
            <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
              data.connection?.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
                : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"
            }`}>
              {data.connection?.ok ? <CheckCircle2 className="size-4 shrink-0 mt-0.5" /> : <XCircle className="size-4 shrink-0 mt-0.5" />}
              <span className="flex-1">{data.connection?.message}</span>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border bg-card p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Database className="size-3" /> Provider
                </div>
                <p className="mt-1 text-sm font-semibold capitalize">{data.config?.provider?.replace(/-/g, " ") || "—"}</p>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <HardDrive className="size-3" /> Bucket
                </div>
                <p className="mt-1 truncate text-sm font-semibold">{data.config?.s3?.bucket || "—"}</p>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <FileImage className="size-3" /> Objects in R2
                </div>
                <p className="mt-1 text-sm font-semibold">{data.bucket?.objectCount ?? "—"}</p>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CloudUpload className="size-3" /> DB Images (cloud)
                </div>
                <p className="mt-1 text-sm font-semibold">
                  {data.dbAudit?.urlDistribution?.cloud ?? 0}
                  <span className="text-xs text-muted-foreground"> / {data.dbAudit?.productImageCount ?? 0}</span>
                </p>
              </div>
            </div>

            {/* Recent uploads */}
            {data.bucket?.recentObjects?.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Recent uploads in R2 (last {data.bucket.recentObjects.length})
                </p>
                <div className="max-h-48 space-y-1.5 overflow-y-auto scrollbar-thin">
                  {data.bucket.recentObjects.map((obj: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-xs">
                      <FileImage className="size-3 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate font-mono text-[11px]" title={obj.key}>
                        {obj.key}
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {(obj.size / 1024).toFixed(0)}KB
                      </span>
                      <a
                        href={obj.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-emerald-600 hover:text-emerald-700"
                        title="Open image"
                      >
                        <ExternalLink className="size-3" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* URL distribution */}
            {data.dbAudit?.urlDistribution && (
              <div className="flex items-center gap-3 rounded-lg border bg-card p-3 text-xs">
                <span className="font-medium">DB URL audit:</span>
                <Badge className="bg-emerald-100 text-emerald-700">{data.dbAudit.urlDistribution.cloud} cloud</Badge>
                {data.dbAudit.urlDistribution.local > 0 && (
                  <Badge className="bg-amber-100 text-amber-700">{data.dbAudit.urlDistribution.local} local</Badge>
                )}
                {data.dbAudit.urlDistribution.other > 0 && (
                  <Badge className="bg-rose-100 text-rose-700">{data.dbAudit.urlDistribution.other} other</Badge>
                )}
                {data.dbAudit.urlDistribution.local === 0 && data.dbAudit.urlDistribution.other === 0 && (
                  <span className="text-emerald-600">✓ All images point to cloud storage</span>
                )}
              </div>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
