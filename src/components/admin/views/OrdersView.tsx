// ============================================================================
// File: src/components/admin/views/OrdersView.tsx
// Purpose: Orders list — comprehensive admin Order Management view.
//          Features:
//            - Quick stats bar (total / pending / shipped / delivered /
//              cancelled / today's revenue)
//            - Debounced search (order #, customer name, phone, email)
//            - Multi-select status & payment-status filters with chips
//            - Payment method filter, date range, prescription-required,
//              has-notes toggles
//            - Active-filter chips with one-click removal + Clear All
//            - Comfortable / compact row density toggle
//            - Bulk select + bulk status update + export selected CSV
//            - Row-click → order detail
//            - Mobile: card list (each order is a card with key info)
//            - Inline quick status change on desktop rows
// ============================================================================

"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, run } from "../api";
import {
  PageHeader,
  StatusBadge,
  PaymentBadge,
  TableSkeleton,
  EmptyState,
  CustomerName,
  CustomerContact,
  ProductThumb,
} from "../ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  ShoppingCart,
  Download,
  Loader2,
  X,
  CheckSquare,
  Rows3,
  Rows4,
  Filter,
  ChevronRight,
  TrendingUp,
  Clock,
  Truck,
  CheckCircle2,
  XCircle,
  FileImage,
  StickyNote,
  CalendarDays,
  Printer,
} from "lucide-react";
import { useAdminStore } from "../admin-store";
import { formatCurrency, formatDate, timeAgo } from "@/lib/format";
import { ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

type OrderListItem = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  grandTotal: number;
  createdAt: string;
  shipName: string;
  shipPhone: string;
  source?: string;
  prescriptionId?: string | null;
  notes?: string | null;
  adminNotes?: string | null;
  customer: { id: string; name: string; email: string; phone: string } | null;
  itemCount: number;
  previewItems: { id: string; name: string; qty: number; image: string | null }[];
};

type Stats = {
  total: number;
  pending: number;
  confirmed: number;
  packed: number;
  out_for_delivery: number;
  shipped: number;
  delivered: number;
  cancelled: number;
  returned: number;
  todayRevenue: number;
  yesterdayRevenue: number;
};

const STATUS_OPTIONS = Object.keys(ORDER_STATUS_LABEL);
const PAYMENT_STATUS_OPTIONS = ["pending", "paid", "failed", "refunded"];
const PAYMENT_METHOD_OPTIONS = Object.keys(PAYMENT_METHOD_LABEL);

// Default filter preset — applied on first mount so the admin lands on
// the most actionable view (pending + confirmed orders first).
const DEFAULT_STATUS_PRESET = ["pending", "confirmed"];

export function OrdersView() {
  const navigate = useAdminStore((s) => s.navigate);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statuses, setStatuses] = useState<Set<string>>(
    () => new Set(DEFAULT_STATUS_PRESET)
  );
  const [paymentStatuses, setPaymentStatuses] = useState<Set<string>>(new Set());
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rxOnly, setRxOnly] = useState(false);
  const [notesOnly, setNotesOnly] = useState(false);
  const [compact, setCompact] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const pageSize = 20;

  // --------------------- Debounced search (300ms) ---------------------
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page to 1 whenever any filter changes (so we don't end up on a
  // page that doesn't exist for the new filter set).
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statuses, paymentStatuses, paymentMethod, from, to, rxOnly, notesOnly]);

  const queryParams = useMemo(() => {
    const p = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (debouncedSearch.trim()) p.set("search", debouncedSearch.trim());
    if (statuses.size > 0) p.set("statuses", Array.from(statuses).join(","));
    if (paymentStatuses.size > 0) p.set("paymentStatuses", Array.from(paymentStatuses).join(","));
    if (paymentMethod !== "all") p.set("paymentMethod", paymentMethod);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (rxOnly) p.set("prescriptionRequired", "true");
    if (notesOnly) p.set("hasNotes", "true");
    return p.toString();
  }, [debouncedSearch, statuses, paymentStatuses, paymentMethod, from, to, rxOnly, notesOnly, page]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-orders", queryParams],
    queryFn: () =>
      api.get<{ items: OrderListItem[]; total: number; totalPages: number; page: number }>(
        `/api/admin/orders?${queryParams}`
      ),
  });

  const { data: stats } = useQuery<Stats>({
    queryKey: ["admin-orders-stats"],
    queryFn: () => api.get<Stats>("/api/admin/orders/stats"),
    refetchInterval: 60_000, // refresh stats every minute
  });

  const items = data?.items ?? [];

  // --------------------- Selection helpers ---------------------
  const allSelected = items.length > 0 && items.every((o) => selectedIds.has(o.id));
  const someSelected = items.some((o) => selectedIds.has(o.id));

  function toggleAll() {
    const next = new Set(selectedIds);
    if (allSelected) items.forEach((o) => next.delete(o.id));
    else items.forEach((o) => next.add(o.id));
    setSelectedIds(next);
  }
  function toggleOne(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }
  function clearSelection() {
    setSelectedIds(new Set());
  }

  const headerChecked: boolean | "indeterminate" = allSelected
    ? true
    : someSelected
      ? "indeterminate"
      : false;

  // --------------------- Filter helpers ---------------------
  function toggleStatus(s: string) {
    const next = new Set(statuses);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    setStatuses(next);
  }
  function togglePaymentStatus(s: string) {
    const next = new Set(paymentStatuses);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    setPaymentStatuses(next);
  }
  function clearAllFilters() {
    setStatuses(new Set());
    setPaymentStatuses(new Set());
    setPaymentMethod("all");
    setFrom("");
    setTo("");
    setRxOnly(false);
    setNotesOnly(false);
    setSearch("");
    setDebouncedSearch("");
  }

  const activeFilterCount =
    statuses.size + paymentStatuses.size + (paymentMethod !== "all" ? 1 : 0) +
    (from ? 1 : 0) + (to ? 1 : 0) + (rxOnly ? 1 : 0) + (notesOnly ? 1 : 0) +
    (debouncedSearch.trim() ? 1 : 0);

  // --------------------- Export CSV ---------------------
  function exportCsv(selectedOnly = false) {
    const shouldExportSelected = selectedOnly && selectedIds.size > 0;
    const url = shouldExportSelected
      ? `/api/admin/orders/export?ids=${Array.from(selectedIds).join(",")}`
      : `/api/admin/orders/export?${queryParams}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success(
      shouldExportSelected
        ? `Exporting ${selectedIds.size} selected order(s)`
        : "Exporting all matching orders"
    );
  }

  // --------------------- Print invoices for selected ---------------------
  // Sequentially fetches each invoice PDF and triggers a print. Browsers
  // usually collapse multiple print() calls into one job per page — we
  // open each invoice in a hidden iframe and print it.
  async function printInvoices() {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    toast.info(`Preparing ${ids.length} invoice(s) for printing...`);
    for (const id of ids) {
      try {
        const buf = await api.raw(`/api/admin/orders/${id}/invoice`);
        const blob = new Blob([buf], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.src = url;
        document.body.appendChild(iframe);
        iframe.onload = () => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (e) {
            console.error("[invoices] print failed", e);
          }
          // Clean up the iframe after a short delay (let the print dialog
          // finish using the blob URL first).
          setTimeout(() => {
            URL.revokeObjectURL(url);
            iframe.remove();
          }, 5000);
        };
      } catch (e: any) {
        toast.error(`Failed to fetch invoice for order ${id.slice(-6)}`);
      }
      // Small delay between prints so the browser doesn't choke.
      await new Promise((r) => setTimeout(r, 800));
    }
  }

  // --------------------- Bulk status update ---------------------
  async function bulkUpdateStatus(nextStatus: string) {
    if (selectedIds.size === 0) return;
    const label = ORDER_STATUS_LABEL[nextStatus] || nextStatus;
    if (!confirm(`Update ${selectedIds.size} selected order(s) to "${label}"?`)) return;
    setBulkBusy(true);
    const r = await run(
      () =>
        api.post<{ updated: number }>("/api/admin/orders/bulk", {
          ids: Array.from(selectedIds),
          action: "status",
          status: nextStatus,
        }),
      { success: "Bulk update complete", error: "Bulk update failed", silent: true }
    );
    setBulkBusy(false);
    if (r) {
      toast.success(`${r.updated} order(s) marked as ${label}`);
      clearSelection();
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["admin-orders-stats"] });
    }
  }

  // Inline single-order status change from the list
  async function inlineStatusChange(orderId: string, nextStatus: string) {
    const label = ORDER_STATUS_LABEL[nextStatus] || nextStatus;
    const r = await run(
      () => api.patch(`/api/admin/orders/${orderId}/status`, { status: nextStatus }),
      { success: `Order marked as ${label}`, error: "Status update failed", silent: true }
    );
    if (r) {
      toast.success(`Order marked as ${label}`);
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["admin-orders-stats"] });
    }
  }

  return (
    <div>
      <PageHeader
        title="Orders"
        description="View, filter, and manage customer orders."
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportCsv(false)}>
            <Download className="size-4" /> Export All
          </Button>
        }
      />

      {/* ----------------------- Quick Stats Bar ----------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <StatCard
          icon={<ShoppingCart className="size-4" />}
          label="Total Orders"
          value={stats?.total?.toString() ?? "—"}
          tint="bg-emerald-50 text-emerald-700 border-emerald-200"
        />
        <StatCard
          icon={<Clock className="size-4" />}
          label="Pending"
          value={stats?.pending?.toString() ?? "—"}
          tint="bg-amber-50 text-amber-700 border-amber-200"
          onClick={() => toggleStatus("pending")}
          active={statuses.has("pending")}
        />
        <StatCard
          icon={<Truck className="size-4" />}
          label="Shipped"
          value={stats?.shipped?.toString() ?? "—"}
          tint="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-900/50"
          onClick={() => {
            // Toggle both packed + out_for_delivery together
            const next = new Set(statuses);
            const bothActive = next.has("packed") && next.has("out_for_delivery");
            if (bothActive) {
              next.delete("packed");
              next.delete("out_for_delivery");
            } else {
              next.add("packed");
              next.add("out_for_delivery");
            }
            setStatuses(next);
          }}
          active={statuses.has("packed") && statuses.has("out_for_delivery")}
        />
        <StatCard
          icon={<CheckCircle2 className="size-4" />}
          label="Delivered"
          value={stats?.delivered?.toString() ?? "—"}
          tint="bg-emerald-50 text-emerald-700 border-emerald-200"
          onClick={() => toggleStatus("delivered")}
          active={statuses.has("delivered")}
        />
        <StatCard
          icon={<XCircle className="size-4" />}
          label="Cancelled"
          value={stats?.cancelled?.toString() ?? "—"}
          tint="bg-rose-50 text-rose-700 border-rose-200"
          onClick={() => toggleStatus("cancelled")}
          active={statuses.has("cancelled")}
        />
        <StatCard
          icon={<TrendingUp className="size-4" />}
          label="Today's Revenue"
          value={stats ? formatCurrency(stats.todayRevenue) : "—"}
          tint="bg-emerald-50 text-emerald-700 border-emerald-200"
          subtitle={
            stats
              ? `Yesterday: ${formatCurrency(stats.yesterdayRevenue)}`
              : undefined
          }
        />
      </div>

      {/* ----------------------- Filter Bar ----------------------- */}
      <Card className="mb-4">
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Order #, customer name, email, phone"
                className="pl-9 h-10"
              />
            </div>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="h-10"><SelectValue placeholder="Payment Method" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                {PAYMENT_METHOD_OPTIONS.map((m) => (
                  <SelectItem key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10" />
          </div>

          {/* Status multi-select chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide mr-1">
              Status:
            </span>
            {STATUS_OPTIONS.map((s) => (
              <ChipToggle
                key={s}
                active={statuses.has(s)}
                onClick={() => toggleStatus(s)}
              >
                {ORDER_STATUS_LABEL[s]}
              </ChipToggle>
            ))}
          </div>

          {/* Payment status multi-select chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide mr-1">
              Payment:
            </span>
            {PAYMENT_STATUS_OPTIONS.map((s) => (
              <ChipToggle
                key={s}
                active={paymentStatuses.has(s)}
                onClick={() => togglePaymentStatus(s)}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </ChipToggle>
            ))}

            {/* Toggles + compact switch (right-aligned) */}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <ChipToggle active={rxOnly} onClick={() => setRxOnly((v) => !v)}>
                <FileImage className="size-3 mr-1" /> Rx Required
              </ChipToggle>
              <ChipToggle active={notesOnly} onClick={() => setNotesOnly((v) => !v)}>
                <StickyNote className="size-3 mr-1" /> Has Notes
              </ChipToggle>
              <Button
                variant={compact ? "default" : "outline"}
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => setCompact((v) => !v)}
                title="Toggle row density"
              >
                {compact ? <Rows3 className="size-3.5" /> : <Rows4 className="size-3.5" />}
                {compact ? "Compact" : "Comfortable"}
              </Button>
            </div>
          </div>

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <Filter className="size-3" /> {activeFilterCount} active:
              </span>
              {debouncedSearch.trim() && (
                <FilterChip label={`"${debouncedSearch.trim()}"`} onRemove={() => setSearch("")} />
              )}
              {Array.from(statuses).map((s) => (
                <FilterChip
                  key={`s-${s}`}
                  label={ORDER_STATUS_LABEL[s]}
                  onRemove={() => toggleStatus(s)}
                />
              ))}
              {Array.from(paymentStatuses).map((s) => (
                <FilterChip
                  key={`p-${s}`}
                  label={`Pay: ${s}`}
                  onRemove={() => togglePaymentStatus(s)}
                />
              ))}
              {paymentMethod !== "all" && (
                <FilterChip
                  label={`Method: ${PAYMENT_METHOD_LABEL[paymentMethod] || paymentMethod}`}
                  onRemove={() => setPaymentMethod("all")}
                />
              )}
              {from && (
                <FilterChip
                  label={`From: ${formatDate(from)}`}
                  onRemove={() => setFrom("")}
                />
              )}
              {to && (
                <FilterChip
                  label={`To: ${formatDate(to)}`}
                  onRemove={() => setTo("")}
                />
              )}
              {rxOnly && <FilterChip label="Rx Required" onRemove={() => setRxOnly(false)} />}
              {notesOnly && <FilterChip label="Has Notes" onRemove={() => setNotesOnly(false)} />}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 ml-auto text-xs"
                onClick={clearAllFilters}
              >
                <X className="size-3 mr-1" /> Clear All
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ----------------------- Bulk Action Bar ----------------------- */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-400/40 bg-emerald-50/95 dark:bg-emerald-950/80 p-3 backdrop-blur shadow-sm"
          >
            <Badge className="bg-emerald-100 text-emerald-700 gap-1.5 border-emerald-200">
              <CheckSquare className="size-3.5" />
              {selectedIds.size} order{selectedIds.size === 1 ? "" : "s"} selected
            </Badge>

            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => exportCsv(true)}>
              <Download className="size-3.5" /> Export CSV
            </Button>

            <Button size="sm" variant="outline" className="gap-1.5" onClick={printInvoices}>
              <Printer className="size-3.5" /> Print Invoices
            </Button>

            <Select
              value=""
              onValueChange={(v) => {
                if (v) bulkUpdateStatus(v);
              }}
            >
              <SelectTrigger className="h-8 w-44 gap-1.5 text-sm" disabled={bulkBusy}>
                {bulkBusy ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span className="text-muted-foreground">Updating…</span>
                  </>
                ) : (
                  <SelectValue placeholder="Update status" />
                )}
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button size="sm" variant="ghost" className="gap-1.5 ml-auto" onClick={clearSelection}>
              <X className="size-3.5" /> Clear
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ----------------------- Order List (desktop) / Cards (mobile) ----------------------- */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4"><TableSkeleton rows={8} cols={6} /></div>
          ) : !items.length ? (
            <div className="p-4">
              <EmptyState
                title="No orders found"
                icon={<ShoppingCart className="size-6" />}
                description={
                  activeFilterCount > 0
                    ? "Try adjusting your filters or clear them all."
                    : "Orders will appear here once customers start placing them."
                }
                action={
                  activeFilterCount > 0 ? (
                    <Button variant="outline" size="sm" onClick={clearAllFilters}>
                      <X className="size-3.5 mr-1" /> Clear All Filters
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <>
              {/* Desktop: full table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={headerChecked}
                          onCheckedChange={toggleAll}
                          aria-label="Select all visible orders"
                        />
                      </TableHead>
                      <TableHead>Order #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((o) => {
                      const isSelected = selectedIds.has(o.id);
                      return (
                        <TableRow
                          key={o.id}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-emerald-50/60 dark:bg-emerald-950/30"
                              : "hover:bg-muted/40"
                          } ${compact ? "py-0.5" : ""}`}
                          onClick={() => navigate({ name: "order-detail", id: o.id })}
                        >
                          <TableCell
                            className={compact ? "py-1.5" : ""}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleOne(o.id)}
                              aria-label={`Select order ${o.orderNumber}`}
                            />
                          </TableCell>
                          <TableCell className={compact ? "py-1.5" : ""}>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-medium">
                                {o.orderNumber}
                              </span>
                              {o.prescriptionId && (
                                <FileImage className="size-3.5 text-teal-600 dark:text-teal-400" aria-label="Prescription order" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className={compact ? "py-1.5" : ""}>
                            <CustomerName customer={o.customer} fallback={o.shipName} />
                            <CustomerContact customer={o.customer} fallback={o.shipPhone} />
                          </TableCell>
                          <TableCell className={compact ? "py-1.5" : ""}>
                            <div className="flex items-center gap-1.5">
                              {/* Stacked thumbnails (max 3) + "+N more" pill */}
                              <div className="flex -space-x-2">
                                {o.previewItems.slice(0, 3).map((it) => (
                                  <div
                                    key={it.id}
                                    className="rounded-md ring-2 ring-background overflow-hidden"
                                    title={it.name}
                                  >
                                    <ProductThumb
                                      image={it.image}
                                      name={it.name}
                                      size={compact ? 24 : 28}
                                    />
                                  </div>
                                ))}
                                {o.itemCount > 3 && (
                                  <div className={`rounded-md ring-2 ring-background bg-muted text-muted-foreground flex items-center justify-center font-medium text-[10px] ${compact ? "size-6" : "size-7"}`}>
                                    +{o.itemCount - 3}
                                  </div>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {o.itemCount} item{o.itemCount === 1 ? "" : "s"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className={`text-right font-semibold text-sm ${compact ? "py-1.5" : ""}`}>
                            {formatCurrency(o.grandTotal)}
                          </TableCell>
                          <TableCell className={compact ? "py-1.5" : ""}>
                            <PaymentBadge method={o.paymentMethod} status={o.paymentStatus} />
                          </TableCell>
                          <TableCell
                            className={compact ? "py-1.5" : ""}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-1.5">
                              <StatusBadge status={o.status} />
                              {/* Inline quick status change */}
                              <select
                                value=""
                                onChange={(e) => {
                                  if (e.target.value && e.target.value !== o.status) {
                                    inlineStatusChange(o.id, e.target.value);
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="h-6 text-[10px] rounded border border-border bg-background px-1 cursor-pointer hover:border-emerald-400"
                                title="Quick status change"
                              >
                                <option value="">Change…</option>
                                {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => (
                                  <option key={k} value={k} disabled={k === o.status}>{v}</option>
                                ))}
                              </select>
                            </div>
                          </TableCell>
                          <TableCell className={`text-xs text-muted-foreground ${compact ? "py-1.5" : ""}`}>
                            <div>{formatDate(o.createdAt)}</div>
                            <div className="text-[10px]">{timeAgo(o.createdAt)}</div>
                          </TableCell>
                          <TableCell
                            className={compact ? "py-1.5" : ""}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={() => navigate({ name: "order-detail", id: o.id })}
                              aria-label="View order detail"
                            >
                              <ChevronRight className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: card list */}
              <div className="md:hidden divide-y">
                {items.map((o) => {
                  const isSelected = selectedIds.has(o.id);
                  return (
                    <div
                      key={o.id}
                      className={`p-3 ${isSelected ? "bg-emerald-50/60" : ""}`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleOne(o.id)}
                          aria-label={`Select order ${o.orderNumber}`}
                          className="mt-1"
                        />
                        <button
                          className="flex-1 min-w-0 text-left"
                          onClick={() => navigate({ name: "order-detail", id: o.id })}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-mono text-sm font-medium truncate">
                                {o.orderNumber}
                              </span>
                              {o.prescriptionId && (
                                <FileImage className="size-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                              )}
                            </div>
                            <span className="text-sm font-semibold shrink-0">
                              {formatCurrency(o.grandTotal)}
                            </span>
                          </div>
                          <div className="mt-1">
                            <CustomerName customer={o.customer} fallback={o.shipName} />
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            <CustomerContact customer={o.customer} fallback={o.shipPhone} />
                          </div>
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            <StatusBadge status={o.status} />
                            <StatusBadge status={o.paymentStatus} />
                            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                              <CalendarDays className="size-3" /> {formatDate(o.createdAt)}
                            </span>
                          </div>
                          {/* Thumbnails row */}
                          {o.previewItems.length > 0 && (
                            <div className="flex items-center gap-1.5 mt-2">
                              <div className="flex -space-x-2">
                                {o.previewItems.slice(0, 3).map((it) => (
                                  <div
                                    key={it.id}
                                    className="rounded-md ring-2 ring-background overflow-hidden"
                                  >
                                    <ProductThumb image={it.image} name={it.name} size={24} />
                                  </div>
                                ))}
                                {o.itemCount > 3 && (
                                  <div className="size-6 rounded-md ring-2 ring-background bg-muted text-muted-foreground flex items-center justify-center font-medium text-[10px]">
                                    +{o.itemCount - 3}
                                  </div>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {o.itemCount} item{o.itemCount === 1 ? "" : "s"}
                              </span>
                            </div>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ----------------------- Pagination ----------------------- */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 flex-wrap gap-2">
          <div className="text-sm text-muted-foreground">
            Page {data.page} of {data.totalPages} · {data.total} orders
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------- Small presentational helpers -----------------------

function StatCard({
  icon,
  label,
  value,
  tint,
  subtitle,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tint: string;
  subtitle?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`text-left flex flex-col gap-1 p-3 rounded-lg border transition-all ${tint} ${
        onClick ? "hover:shadow-sm hover:scale-[1.02] cursor-pointer" : ""
      } ${active ? "ring-2 ring-emerald-500 ring-offset-1" : ""}`}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium opacity-80">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-xl font-bold tracking-tight">{value}</div>
      {subtitle && <div className="text-[10px] opacity-70">{subtitle}</div>}
    </Tag>
  );
}

function ChipToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border transition-colors min-h-[28px] ${
        active
          ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
          : "bg-background text-muted-foreground border-border hover:bg-muted/50"
      }`}
    >
      {children}
    </button>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
      {label}
      <button
        onClick={onRemove}
        className="hover:bg-emerald-200 dark:hover:bg-emerald-800 rounded-full p-0.5"
        aria-label={`Remove filter ${label}`}
      >
        <X className="size-3" />
      </button>
    </span>
  );
}
