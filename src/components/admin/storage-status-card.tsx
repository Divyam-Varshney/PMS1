// ============================================================================
// File: src/components/admin/storage-status-card.tsx
// Purpose: Compact storage health indicator for the admin dashboard. Shows
//          whether cloud storage is configured + active, or if the app is
//          running in local dev mode (which won't work on Vercel). One-click
//          shortcut to Settings → Storage to fix it.
// ============================================================================

"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Cloud,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Settings,
  ArrowRight,
} from "lucide-react";
import { useAdminStore } from "./admin-store";

interface StorageConfig {
  provider: string;
  enabled: boolean;
  displayName?: string;
  s3?: { bucket?: string; region?: string };
  supabase?: { bucket?: string };
  azure?: { containerName?: string };
}

const PROVIDER_LABELS: Record<string, string> = {
  "cloudflare-r2": "Cloudflare R2",
  "amazon-s3": "Amazon S3",
  "backblaze-b2": "Backblaze B2",
  digitalocean: "DigitalOcean Spaces",
  minio: "MinIO",
  "google-cloud": "Google Cloud Storage",
  custom: "Custom Storage",
  supabase: "Supabase Storage",
  "azure-blob": "Azure Blob Storage",
  local: "Local Filesystem",
};

export function StorageStatusCard() {
  const navigate = useAdminStore((s) => s.navigate);
  const { data, isLoading } = useQuery({
    queryKey: ["storage-config-status"],
    queryFn: () => api.get<{ config: StorageConfig }>("/api/admin/settings/storage"),
    staleTime: 60 * 1000, // storage config rarely changes
  });

  if (isLoading || !data?.config) {
    return (
      <Card className="mb-6">
        <CardContent className="flex items-center gap-3 pt-6">
          <div className="size-8 animate-pulse rounded-lg bg-muted" />
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  const cfg = data.config;
  const isCloudActive = cfg.enabled && cfg.provider !== "local";
  const providerLabel =
    cfg.displayName ||
    PROVIDER_LABELS[cfg.provider] ||
    cfg.provider;
  const bucketName =
    cfg.s3?.bucket || cfg.supabase?.bucket || cfg.azure?.containerName || "—";

  return (
    <Card
      className={
        isCloudActive
          ? "mb-6 border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-950/10"
          : "mb-6 border-amber-200 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/10"
      }
    >
      <CardContent className="flex flex-wrap items-center gap-3 pt-6">
        <div
          className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
            isCloudActive
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
          }`}
        >
          {isCloudActive ? <Cloud className="size-4.5" /> : <HardDrive className="size-4.5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">
              Storage: {providerLabel}
            </p>
            <Badge
              variant="outline"
              className={
                isCloudActive
                  ? "gap-1 border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300"
                  : "gap-1 border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300"
              }
            >
              {isCloudActive ? (
                <>
                  <CheckCircle2 className="size-3" /> Cloud active
                </>
              ) : (
                <>
                  <AlertTriangle className="size-3" /> Dev mode
                </>
              )}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isCloudActive
              ? `Bucket: ${bucketName} · Uploads persist on Vercel ✓`
              : "Local filesystem — uploads will NOT persist on Vercel. Configure a cloud provider."}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => navigate({ name: "settings", section: "storage" })}
        >
          <Settings className="size-3.5" />
          Configure
          <ArrowRight className="size-3" />
        </Button>
      </CardContent>
    </Card>
  );
}
