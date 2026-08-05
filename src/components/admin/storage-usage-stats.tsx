// ============================================================================
// File: src/components/admin/storage-usage-stats.tsx
// Purpose: Storage usage statistics widget for the admin storage settings
//          panel. Shows total files, total storage used, and a per-category
//          breakdown with a visual bar chart. Helps admins monitor cloud
//          storage consumption and estimate costs.
// ============================================================================

"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Package,
  Tag,
  FolderTree,
  FileText,
  CreditCard,
  QrCode,
  HardDrive,
  Files,
  TrendingUp,
} from "lucide-react";

interface CategoryStat {
  key: string;
  label: string;
  fileCount: number;
  totalBytes: number;
  icon: string;
  exact: boolean;
}

interface UsageData {
  categories: CategoryStat[];
  totalFiles: number;
  totalBytes: number;
  totalBytesFormatted: string;
  estimatedNote: string;
}

const ICON_MAP: Record<string, typeof Package> = {
  Package,
  Tag,
  FolderTree,
  FileText,
  CreditCard,
  QrCode,
};

// Color themes per category — matches the customer panel color coding
const COLOR_MAP: Record<string, { bar: string; icon: string }> = {
  products: { bar: "bg-emerald-500", icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
  brands: { bar: "bg-cyan-500", icon: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300" },
  categories: { bar: "bg-teal-500", icon: "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300" },
  prescriptions: { bar: "bg-amber-500", icon: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
  payments: { bar: "bg-rose-500", icon: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" },
  "qr-codes": { bar: "bg-teal-500", icon: "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300" },
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function StorageUsageStats() {
  const { data, isLoading } = useQuery({
    queryKey: ["storage-usage"],
    queryFn: () => api.get<UsageData>("/api/admin/settings/storage/usage"),
    staleTime: 60 * 1000, // cache for 1 min
  });

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HardDrive className="size-4" /> Storage Usage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  const maxBytes = Math.max(...data.categories.map((c) => c.totalBytes), 1);
  const hasFiles = data.totalFiles > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HardDrive className="size-4" /> Storage Usage
        </CardTitle>
        <CardDescription>
          File counts and estimated storage consumption by category.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border bg-gradient-to-br from-emerald-50 to-teal-50 p-3 dark:from-emerald-950/20 dark:to-teal-950/20">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <Files className="size-4" />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Total Files
                </p>
                <p className="text-lg font-bold leading-none">
                  {data.totalFiles.toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border bg-gradient-to-br from-sky-50 to-cyan-50 p-3 dark:from-sky-950/20 dark:to-cyan-950/20">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
                <TrendingUp className="size-4" />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Total Storage
                </p>
                <p className="text-lg font-bold leading-none">
                  {data.totalBytesFormatted}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Per-category breakdown */}
        {hasFiles ? (
          <div className="space-y-2.5">
            {data.categories.map((cat) => {
              const Icon = ICON_MAP[cat.icon] || Package;
              const colors = COLOR_MAP[cat.key] || COLOR_MAP.products;
              const pct = Math.max((cat.totalBytes / maxBytes) * 100, cat.fileCount > 0 ? 5 : 0);
              return (
                <div key={cat.key} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`flex size-6 shrink-0 items-center justify-center rounded ${colors.icon}`}>
                        <Icon className="size-3.5" />
                      </div>
                      <span className="font-medium truncate">{cat.label}</span>
                      {!cat.exact && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">
                          est.
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 tabular-nums">
                      <span className="text-muted-foreground">{cat.fileCount} file{cat.fileCount !== 1 ? "s" : ""}</span>
                      <span className="font-semibold">{formatBytes(cat.totalBytes)}</span>
                    </div>
                  </div>
                  {/* Visual bar */}
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <HardDrive className="size-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium text-muted-foreground">No files uploaded yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Upload product images, brand logos, or prescriptions to see usage here.
            </p>
          </div>
        )}

        {/* Note */}
        <p className="text-[10px] text-muted-foreground border-t pt-2">
          {data.estimatedNote}
        </p>
      </CardContent>
    </Card>
  );
}
