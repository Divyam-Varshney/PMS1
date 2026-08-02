// ============================================================================
// File: src/components/admin/views/BackupsView.tsx
// Purpose: Backup Management — shows database table statistics + storage
//          file inventory. Provides an overview for backup planning.
// ============================================================================

"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { PageHeader } from "../ui";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Database, HardDrive, Cloud, FileImage, Table } from "lucide-react";

interface BackupData {
  database: {
    totalSize: string;
    tables: Array<{ name: string; rowCount: number; size: string }>;
    tableCount: number;
  };
  storage: {
    provider: string;
    enabled: boolean;
    isCloudActive: boolean;
    files: {
      productImages: number;
      brandLogos: number;
      categoryImages: number;
      prescriptions: number;
      screenshots: number;
    };
  };
}

export function BackupsView() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-backups"],
    queryFn: () => api.get<BackupData>("/api/admin/backups"),
  });

  if (isLoading || !data) {
    return (
      <div>
        <PageHeader title="Backup Management" />
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const fileCount = Object.values(data.storage.files).reduce((s, n) => s + n, 0);

  return (
    <div>
      <PageHeader
        title="Backup Management"
        description="Database + storage backup overview. Monitor data size and plan backups."
      />

      {/* Summary cards */}
      <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="overflow-hidden">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Database className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{data.database.totalSize}</p>
              <p className="text-xs text-muted-foreground">Database Size</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex size-10 items-center justify-center rounded-lg bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
              <Table className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{data.database.tableCount}</p>
              <p className="text-xs text-muted-foreground">Database Tables</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <FileImage className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{fileCount}</p>
              <p className="text-xs text-muted-foreground">Storage Files</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Storage status */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Cloud className="size-4" /> Storage Status
          </CardTitle>
          <CardDescription>Where uploaded files are stored</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Badge variant={data.storage.isCloudActive ? "secondary" : "outline"} className="gap-1">
              <Cloud className="size-3" />
              {data.storage.isCloudActive ? "Cloud Active" : "Local (Dev)"}
            </Badge>
            <span className="text-sm font-medium capitalize">{data.storage.provider}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { label: "Product Images", count: data.storage.files.productImages, tint: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
              { label: "Brand Logos", count: data.storage.files.brandLogos, tint: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300" },
              { label: "Category Images", count: data.storage.files.categoryImages, tint: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
              { label: "Prescriptions", count: data.storage.files.prescriptions, tint: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
              { label: "Screenshots", count: data.storage.files.screenshots, tint: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" },
            ].map((f) => (
              <div key={f.label} className="rounded-lg border p-3 text-center">
                <div className={`mx-auto mb-1 flex size-8 items-center justify-center rounded-lg ${f.tint}`}>
                  <HardDrive className="size-4" />
                </div>
                <p className="text-lg font-bold leading-none">{f.count}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{f.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Database tables */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="size-4" /> Database Tables
          </CardTitle>
          <CardDescription>Table sizes and row counts for backup planning</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {data.database.tables.map((t) => (
              <div key={t.name} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div className="flex items-center gap-2">
                  <Table className="size-3.5 text-muted-foreground" />
                  <span className="font-mono text-sm">{t.name}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="tabular-nums">{t.rowCount.toLocaleString("en-IN")} rows</span>
                  <Badge variant="outline" className="tabular-nums">{t.size}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
