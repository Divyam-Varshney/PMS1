// ============================================================================
// File: src/components/admin/views/DatabaseView.tsx
// Purpose: Database Management — secure table browser. Admin can view all
//          tables, browse records, search, and paginate. Read-only.
// ============================================================================

"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { PageHeader } from "../ui";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Database, Table, Search, ChevronLeft, ChevronRight, ArrowLeft,
} from "lucide-react";

interface TablesData {
  tables: Array<{ name: string; rowCount: number; size: string }>;
  totalSize: string;
  tableCount: number;
}

interface TableRecords {
  table: string;
  columns: string[];
  records: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function DatabaseView() {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const { data: tablesData, isLoading: tablesLoading } = useQuery({
    queryKey: ["admin-database-tables"],
    queryFn: () => api.get<TablesData>("/api/admin/database/tables"),
    enabled: !selectedTable,
  });

  const { data: recordsData, isLoading: recordsLoading } = useQuery({
    queryKey: ["admin-database-records", selectedTable, page, search],
    queryFn: () => api.get<TableRecords>(
      `/api/admin/database/tables/${selectedTable}?page=${page}&limit=50${search ? `&search=${encodeURIComponent(search)}` : ""}`
    ),
    enabled: !!selectedTable,
  });

  if (selectedTable) {
    // Record browser view
    return (
      <div>
        <div className="mb-4 flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => { setSelectedTable(null); setPage(1); setSearch(""); }} className="gap-1.5">
            <ArrowLeft className="size-3.5" /> Back to Tables
          </Button>
          <h1 className="text-xl font-bold font-mono">{selectedTable}</h1>
          {recordsData && (
            <Badge variant="secondary" className="tabular-nums">
              {recordsData.total.toLocaleString("en-IN")} records
            </Badge>
          )}
        </div>

        {/* Search */}
        <div className="mb-4 relative max-w-md">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search records..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-8"
          />
        </div>

        {recordsLoading || !recordsData ? (
          <Skeleton className="h-96 w-full" />
        ) : recordsData.records.length === 0 ? (
          <EmptyState icon={Table} title="No records" description="This table is empty or no records match your search." />
        ) : (
          <>
            <Card>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      {recordsData.columns.map((col) => (
                        <th key={col} className="px-3 py-2 text-left font-mono text-xs font-semibold text-muted-foreground">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recordsData.records.map((record, idx) => (
                      <tr key={idx} className="border-b hover:bg-muted/30">
                        {recordsData.columns.map((col) => {
                          const val = record[col];
                          const display = val === null ? "—" : typeof val === "object" ? JSON.stringify(val).slice(0, 50) : String(val).slice(0, 100);
                          return (
                            <td key={col} className="px-3 py-2 text-xs">
                              {val === null ? (
                                <span className="text-muted-foreground">{display}</span>
                              ) : (
                                <span className="break-all">{display}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Pagination */}
            {recordsData.totalPages > 1 && (
              <div className="flex items-center justify-between pt-3">
                <p className="text-xs text-muted-foreground">
                  Page {recordsData.page} of {recordsData.totalPages}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="gap-1">
                    <ChevronLeft className="size-3.5" /> Prev
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= recordsData.totalPages} onClick={() => setPage((p) => p + 1)} className="gap-1">
                    Next <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // Table list view
  return (
    <div>
      <PageHeader
        title="Database Management"
        description="Browse database tables and records. Read-only — no editing through this interface."
      />

      {/* Summary */}
      {tablesData && (
        <div className="mb-4 grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <Database className="size-5" />
              </div>
              <div>
                <p className="text-2xl font-bold leading-none">{tablesData.totalSize}</p>
                <p className="text-xs text-muted-foreground">Total Database Size</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="flex size-10 items-center justify-center rounded-lg bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
                <Table className="size-5" />
              </div>
              <div>
                <p className="text-2xl font-bold leading-none">{tablesData.tableCount}</p>
                <p className="text-xs text-muted-foreground">Tables</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table list */}
      {tablesLoading || !tablesData ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <div className="space-y-1">
          {tablesData.tables.map((t) => (
            <button
              key={t.name}
              onClick={() => { setSelectedTable(t.name); setPage(1); setSearch(""); }}
              className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors hover:bg-accent/50"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                  <Table className="size-4 text-muted-foreground" />
                </div>
                <span className="font-mono text-sm font-medium">{t.name}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="tabular-nums">{t.rowCount.toLocaleString("en-IN")} rows</span>
                <Badge variant="outline" className="tabular-nums">{t.size}</Badge>
                <ChevronRight className="size-4" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
