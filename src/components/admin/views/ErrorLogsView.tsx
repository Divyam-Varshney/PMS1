// ============================================================================
// File: src/components/admin/views/ErrorLogsView.tsx
// Purpose: Error Logs management — automatic error capture for production
//          troubleshooting. Shows timestamp, severity, module, endpoint,
//          message, user info, with search, filter, pagination, and bulk
//          actions (resolve, ignore, delete, clear all, export).
// ============================================================================

"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, run } from "../api";
import { PageHeader } from "../ui";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  Search,
  Trash2,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  Ban,
} from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";

interface ErrorLog {
  id: string;
  timestamp: string;
  severity: string;
  module: string | null;
  endpoint: string | null;
  method: string | null;
  message: string;
  stack: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  userId: string | null;
  userEmail: string | null;
  requestUrl: string | null;
  statusCode: number | null;
  status: string;
}

interface ErrorLogsResponse {
  items: ErrorLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: { openCount: number; criticalCount: number; todayCount: number };
}

const SEVERITY_META: Record<string, { label: string; icon: typeof Info; className: string }> = {
  info: { label: "Info", icon: Info, className: "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300" },
  warning: { label: "Warning", icon: AlertTriangle, className: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
  error: { label: "Error", icon: XCircle, className: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" },
  critical: { label: "Critical", icon: AlertTriangle, className: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300" },
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
  resolved: { label: "Resolved", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
  ignored: { label: "Ignored", className: "bg-muted text-muted-foreground" },
};

export function ErrorLogsView() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [severity, setSeverity] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [search, setSearch] = useState("");
  const [detailLog, setDetailLog] = useState<ErrorLog | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: "50",
    ...(severity && { severity }),
    ...(status && { status }),
    ...(search && { search }),
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-error-logs", page, severity, status, search],
    queryFn: () => api.get<ErrorLogsResponse>(`/api/admin/error-logs?${queryParams}`),
    refetchInterval: 60 * 1000, // 60s (was 30s — reduced for memory) // auto-refresh every 30s
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/api/admin/error-logs/${id}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-error-logs"] });
      toast.success("Status updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteLog = useMutation({
    mutationFn: (id: string) => api.del(`/api/admin/error-logs/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-error-logs"] });
      toast.success("Log deleted");
    },
  });

  const clearAll = useMutation({
    mutationFn: () => api.del("/api/admin/error-logs?all=1"),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["admin-error-logs"] });
      toast.success(`Cleared ${r?.deleted || "all"} logs`);
      setSelected(new Set());
    },
  });

  const deleteSelected = useMutation({
    mutationFn: () => {
      const ids = Array.from(selected).join(",");
      return api.del(`/api/admin/error-logs?ids=${ids}`);
    },
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["admin-error-logs"] });
      toast.success(`Deleted ${r?.deleted || 0} logs`);
      setSelected(new Set());
    },
  });

  function exportLogs() {
    if (!data?.items?.length) {
      toast.error("No logs to export");
      return;
    }
    const headers = ["Timestamp", "Severity", "Status", "Module", "Endpoint", "Method", "StatusCode", "Message", "UserEmail", "RequestUrl", "IPAddress"];
    const rows = data.items.map((log) => [
      formatDateTime(log.timestamp),
      log.severity,
      log.status,
      log.module || "",
      log.endpoint || "",
      log.method || "",
      log.statusCode || "",
      `"${log.message.replace(/"/g, '""')}"`,
      log.userEmail || "",
      log.requestUrl || "",
      log.ipAddress || "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `error-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Logs exported");
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const items = data?.items ?? [];
  const stats = data?.stats;

  return (
    <div>
      <PageHeader
        title="Error Logs"
        description="Automatic error capture for production troubleshooting."
      />

      {/* Stats cards */}
      {stats && (
        <div className="mb-4 grid grid-cols-3 gap-3">
          <Card className={stats.openCount > 0 ? "border-amber-200" : ""}>
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="flex size-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                <AlertTriangle className="size-4" />
              </div>
              <div>
                <p className="text-2xl font-bold leading-none">{stats.openCount}</p>
                <p className="text-xs text-muted-foreground">Open</p>
              </div>
            </CardContent>
          </Card>
          <Card className={stats.criticalCount > 0 ? "border-red-200" : ""}>
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="flex size-9 items-center justify-center rounded-lg bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300">
                <XCircle className="size-4" />
              </div>
              <div>
                <p className="text-2xl font-bold leading-none">{stats.criticalCount}</p>
                <p className="text-xs text-muted-foreground">Critical (open)</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="flex size-9 items-center justify-center rounded-lg bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
                <Info className="size-4" />
              </div>
              <div>
                <p className="text-2xl font-bold leading-none">{stats.todayCount}</p>
                <p className="text-xs text-muted-foreground">Today</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters + actions */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search message, endpoint, user..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-8"
          />
        </div>
        <Select value={severity || "all"} onValueChange={(v) => { setSeverity(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status || "all"} onValueChange={(v) => { setStatus(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="ignored">Ignored</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["admin-error-logs"] })} className="gap-1.5">
          <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
        <Button variant="outline" size="sm" onClick={exportLogs} className="gap-1.5">
          <Download className="size-3.5" /> Export
        </Button>
        {selected.size > 0 && (
          <Button variant="outline" size="sm" onClick={() => run(() => deleteSelected.mutateAsync())} className="gap-1.5 text-destructive">
            <Trash2 className="size-3.5" /> Delete ({selected.size})
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => { if (confirm("Clear ALL error logs? This cannot be undone.")) clearAll.mutate(); }} className="gap-1.5 text-destructive">
          <Trash2 className="size-3.5" /> Clear All
        </Button>
      </div>

      {/* Error log list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="No error logs"
          description="No errors have been captured. The system is running smoothly."
        />
      ) : (
        <div className="space-y-2">
          {items.map((log) => {
            const sevMeta = SEVERITY_META[log.severity] || SEVERITY_META.error;
            const statMeta = STATUS_META[log.status] || STATUS_META.open;
            const SevIcon = sevMeta.icon;
            return (
              <Card key={log.id} className={log.status === "open" && log.severity === "critical" ? "border-red-300" : ""}>
                <CardContent className="flex items-start gap-3 py-3">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selected.has(log.id)}
                    onChange={() => toggleSelect(log.id)}
                    className="mt-1.5 size-4 cursor-pointer rounded border-muted-foreground"
                  />
                  {/* Severity icon */}
                  <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${sevMeta.className}`}>
                    <SevIcon className="size-4" />
                  </div>
                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={sevMeta.className}>{sevMeta.label}</Badge>
                      <Badge variant="outline" className={statMeta.className}>{statMeta.label}</Badge>
                      {log.module && <span className="text-xs font-mono text-muted-foreground">{log.module}</span>}
                      {log.statusCode && <span className="text-xs text-muted-foreground">HTTP {log.statusCode}</span>}
                      <span className="text-xs text-muted-foreground">{formatDateTime(log.timestamp)}</span>
                    </div>
                    <p className="mt-1 truncate text-sm font-medium">{log.message}</p>
                    {log.endpoint && (
                      <p className="truncate text-xs text-muted-foreground">
                        {log.method} {log.endpoint}
                      </p>
                    )}
                    {log.userEmail && (
                      <p className="text-xs text-muted-foreground">User: {log.userEmail}</p>
                    )}
                  </div>
                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => setDetailLog(log)} aria-label="View details">
                      <Eye className="size-3.5" />
                    </Button>
                    {log.status === "open" && (
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => updateStatus.mutate({ id: log.id, status: "resolved" })} aria-label="Resolve">
                        <CheckCircle2 className="size-3.5 text-emerald-600" />
                      </Button>
                    )}
                    {log.status !== "ignored" && (
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => updateStatus.mutate({ id: log.id, status: "ignored" })} aria-label="Ignore">
                        <Ban className="size-3.5 text-muted-foreground" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => deleteLog.mutate(log.id)} aria-label="Delete">
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                {data.total} total · Page {data.page} of {data.totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="gap-1">
                  <ChevronLeft className="size-3.5" /> Prev
                </Button>
                <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)} className="gap-1">
                  Next <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!detailLog} onOpenChange={(v) => !v && setDetailLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detailLog && (() => {
                const m = SEVERITY_META[detailLog.severity] || SEVERITY_META.error;
                return <Badge variant="outline" className={m.className}>{m.label}</Badge>;
              })()}
              Error Details
            </DialogTitle>
            <DialogDescription>{detailLog && formatDateTime(detailLog.timestamp)}</DialogDescription>
          </DialogHeader>
          {detailLog && (
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-semibold">Message</p>
                <p className="mt-0.5 text-muted-foreground">{detailLog.message}</p>
              </div>
              {detailLog.module && (
                <div><p className="font-semibold">Module</p><p className="text-muted-foreground">{detailLog.module}</p></div>
              )}
              {detailLog.endpoint && (
                <div><p className="font-semibold">Endpoint</p><p className="font-mono text-xs text-muted-foreground">{detailLog.method} {detailLog.endpoint}</p></div>
              )}
              {detailLog.requestUrl && (
                <div><p className="font-semibold">Request URL</p><p className="font-mono text-xs text-muted-foreground break-all">{detailLog.requestUrl}</p></div>
              )}
              {detailLog.statusCode && (
                <div><p className="font-semibold">Status Code</p><p className="text-muted-foreground">HTTP {detailLog.statusCode}</p></div>
              )}
              {detailLog.userEmail && (
                <div><p className="font-semibold">User</p><p className="text-muted-foreground">{detailLog.userEmail} ({detailLog.userId})</p></div>
              )}
              {detailLog.ipAddress && (
                <div><p className="font-semibold">IP Address</p><p className="font-mono text-xs text-muted-foreground">{detailLog.ipAddress}</p></div>
              )}
              {detailLog.userAgent && (
                <div><p className="font-semibold">User Agent</p><p className="font-mono text-xs text-muted-foreground break-all">{detailLog.userAgent}</p></div>
              )}
              {detailLog.stack && (
                <div>
                  <p className="font-semibold">Stack Trace</p>
                  <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs">{detailLog.stack}</pre>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                {detailLog.status === "open" && (
                  <Button size="sm" onClick={() => { updateStatus.mutate({ id: detailLog.id, status: "resolved" }); setDetailLog(null); }} className="gap-1.5">
                    <CheckCircle2 className="size-4" /> Mark Resolved
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => { updateStatus.mutate({ id: detailLog.id, status: "ignored" }); setDetailLog(null); }} className="gap-1.5">
                  <Ban className="size-4" /> Ignore
                </Button>
                <Button size="sm" variant="outline" onClick={() => { deleteLog.mutate(detailLog.id); setDetailLog(null); }} className="gap-1.5 text-destructive">
                  <Trash2 className="size-4" /> Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
