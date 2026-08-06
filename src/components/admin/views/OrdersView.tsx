// ============================================================================
// File: src/components/admin/views/OrdersView.tsx
// Purpose: Admin Orders list view — clean, premium, enterprise-grade.
//          Inspired by Shopify Admin / Stripe Dashboard / Notion.
//          Sober emerald accent palette, no flashy gradients.
// ============================================================================
"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api, run } from "../api";
import { PageHeader, TableSkeleton, EmptyState } from "../ui";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  ShoppingCart,
  Download,
  X,
  Filter,
  ChevronRight,
  ChevronLeft,
  Clock,
  Truck,
  Package,
  PackageCheck,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Wallet,
  FileImage,
  Pill,
  CalendarDays,
  SlidersHorizontal,
  MoreHorizontal,
  Eye,
  CheckCheck,
  Users,
  Boxes,
  Send,
} from "lucide-react";
import { useAdminStore } from "../admin-store";
import { formatCurrency, formatDate } from "@/lib/format";
import { ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ------------------------------- Types -------------------------------
type OrderListItem = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  paymentId?: string | null;
  grandTotal: number | string;
  voucherCode?: string | null;
  source?: string;
  prescriptionId?: string | null;
  manualRequestId?: string | null;
  createdAt: string;
  shipName: string;
  shipPhone: string;
  shipCity?: string;
  customer: { id: string; name: string; email: string; phone: string } | null;
  itemCount: number;
  previewItems: { id: string; name: string; qty: number; image: string | null }[];
};

type Stats = {
  total: number;
  today: number;
  pending: number;
  confirmed: number;
  packed: number;
  out_for_delivery: number;
  delivered: number;
  cancelled: number;
  returned: number;
  refunded: number;
  prescriptionOrders: number;
  medicineRequests: number;
  todayRevenue: number;
  yesterdayRevenue: number;
  totalRevenue: number;
  averageOrderValue: number;
  revenueTrend: number;
  totalCustomers?: number;
  totalProducts?: number;
};

// ------------------------------- Constants -------------------------------
const STATUS_OPTIONS = Object.keys(ORDER_STATUS_LABEL);
const PAYMENT_STATUS_OPTIONS = [
  "pending",
  "paid",
  "partially_paid",
  "failed",
  "refunded",
  "refund_initiated",
  "cancelled",
];
const PAYMENT_METHOD_OPTIONS = Object.keys(PAYMENT_METHOD_LABEL);

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  paid: "Paid",
  partially_paid: "Partially Paid",
  failed: "Failed",
  refunded: "Refunded",
  refund_initiated: "Refund Initiated",
  cancelled: "Cancelled",
};

const PAGE_SIZE = 20;

// Allowed inline status transitions per row's current status.
const NEXT_ACTIONS: Record<string, { status: string; label: string; icon: any }[]> = {
  pending: [
    { status: "confirmed", label: "Confirm", icon: CheckCircle2 },
  ],
  confirmed: [
    { status: "packed", label: "Pack", icon: Package },
  ],
  packed: [
    { status: "out_for_delivery", label: "Ship", icon: Send },
  ],
  out_for_delivery: [
    { status: "delivered", label: "Deliver", icon: PackageCheck },
  ],
  delivered: [
    { status: "returned", label: "Return", icon: RotateCcw },
  ],
  cancelled: [],
  returned: [],
};

// =============================== Component ===============================
export function OrdersView() {
  const navigate = useAdminStore((s) => s.navigate);
  const qc = useQueryClient();

  // ----- Filter state -----
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statuses, setStatuses] = useState<Set<string>>(new Set());
  const [paymentStatuses, setPaymentStatuses] = useState<Set<string>>(new Set());
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rxOnly, setRxOnly] = useState(false);
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  // ----- View state -----
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [
    debouncedSearch,
    statuses,
    paymentStatuses,
    paymentMethod,
    from,
    to,
    rxOnly,
    minAmount,
    maxAmount,
  ]);

  const queryParams = useMemo(() => {
    const p = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    if (debouncedSearch.trim()) p.set("search", debouncedSearch.trim());
    if (statuses.size > 0) p.set("statuses", Array.from(statuses).join(","));
    if (paymentStatuses.size > 0)
      p.set("paymentStatuses", Array.from(paymentStatuses).join(","));
    if (paymentMethod !== "all") p.set("paymentMethod", paymentMethod);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (rxOnly) p.set("prescriptionRequired", "true");
    if (minAmount) p.set("minAmount", minAmount);
    if (maxAmount) p.set("maxAmount", maxAmount);
    return p.toString();
  }, [
    debouncedSearch,
    statuses,
    paymentStatuses,
    paymentMethod,
    from,
    to,
    rxOnly,
    minAmount,
    maxAmount,
    page,
  ]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-orders", queryParams],
    queryFn: () =>
      api.get<{
        items: OrderListItem[];
        total: number;
        totalPages: number;
        page: number;
      }>(`/api/admin/orders?${queryParams}`),
    refetchInterval: 60_000, // 60s (was 30s — reduced for memory) // Auto-refresh every 30s — preserves filters + pagination
    placeholderData: keepPreviousData, // Smooth transitions when changing pages
  });

  const { data: stats } = useQuery<Stats>({
    queryKey: ["admin-orders-stats"],
    queryFn: () => api.get<Stats>("/api/admin/orders/stats"),
    refetchInterval: 60_000,
  });

  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalItems = data?.total ?? 0;

  // ----- Selection -----
  const allSelected = items.length > 0 && items.every((o) => selectedIds.has(o.id));
  const someSelected = items.some((o) => selectedIds.has(o.id));
  const headerChecked: boolean | "indeterminate" = allSelected
    ? true
    : someSelected
      ? "indeterminate"
      : false;

  const toggleAll = useCallback(() => {
    const next = new Set(selectedIds);
    if (allSelected) items.forEach((o) => next.delete(o.id));
    else items.forEach((o) => next.add(o.id));
    setSelectedIds(next);
  }, [allSelected, items, selectedIds]);

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // ----- Filter helpers -----
  const toggleStatus = useCallback((s: string) => {
    setStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }, []);

  const togglePaymentStatus = useCallback((s: string) => {
    setPaymentStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setStatuses(new Set());
    setPaymentStatuses(new Set());
    setPaymentMethod("all");
    setFrom("");
    setTo("");
    setRxOnly(false);
    setMinAmount("");
    setMaxAmount("");
    setSearch("");
    setDebouncedSearch("");
  }, []);

  const applyPreset = useCallback((preset: "today" | "7d" | "30d") => {
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const startOf = (d: Date) => {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      return x;
    };
    if (preset === "today") {
      const t = fmt(now);
      setFrom(t);
      setTo(t);
    } else if (preset === "7d") {
      const s = new Date(now);
      s.setDate(s.getDate() - 6);
      setFrom(fmt(startOf(s)));
      setTo(fmt(now));
    } else if (preset === "30d") {
      const s = new Date(now);
      s.setDate(s.getDate() - 29);
      setFrom(fmt(startOf(s)));
      setTo(fmt(now));
    }
  }, []);

  const activeFilterCount =
    statuses.size +
    paymentStatuses.size +
    (paymentMethod !== "all" ? 1 : 0) +
    (from ? 1 : 0) +
    (to ? 1 : 0) +
    (rxOnly ? 1 : 0) +
    (minAmount ? 1 : 0) +
    (maxAmount ? 1 : 0) +
    (debouncedSearch.trim() ? 1 : 0);

  // ----- Export CSV -----
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

  // ----- Bulk status update -----
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

  // ----- Inline single-order status change -----
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

  // =============================== Render ===============================
  return (
    <div className="space-y-5 pb-24">
      <PageHeader
        title="Orders"
        description="View, filter, and manage customer orders."
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportCsv(false)}>
            <Download className="size-4" /> Export
          </Button>
        }
      />

      {/* ----------------------- Summary Cards ----------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3">
        <SummaryCard icon={<ShoppingCart className="size-4" />} label="Total Orders" value={stats?.total} />
        <SummaryCard icon={<Clock className="size-4" />} label="Today" value={stats?.today} />
        <SummaryCard icon={<Clock className="size-4" />} label="Pending" value={stats?.pending} onClick={() => toggleStatus("pending")} active={statuses.has("pending")} />
        <SummaryCard icon={<CheckCircle2 className="size-4" />} label="Confirmed" value={stats?.confirmed} onClick={() => toggleStatus("confirmed")} active={statuses.has("confirmed")} />
        <SummaryCard icon={<PackageCheck className="size-4" />} label="Delivered" value={stats?.delivered} onClick={() => toggleStatus("delivered")} active={statuses.has("delivered")} />
        <SummaryCard icon={<Wallet className="size-4" />} label="Revenue" value={stats ? formatCurrency(stats.totalRevenue) : undefined} />
        <SummaryCard icon={<Users className="size-4" />} label="Customers" value={stats?.totalCustomers} />
        <SummaryCard icon={<Boxes className="size-4" />} label="Products Sold" value={stats?.prescriptionOrders ?? 0} />
      </div>

      {/* ----------------------- Search + Filter Bar ----------------------- */}
      <Card className="shadow-sm">
        <CardContent className="pt-5 pb-4 space-y-4">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search order #, customer, phone, email, product, payment ID…"
                className="pl-10 h-10"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <Button variant="outline" size="sm" className="h-10" onClick={() => applyPreset("today")}>
                <CalendarDays className="size-3.5 mr-1" /> Today
              </Button>
              <Button variant="outline" size="sm" className="h-10" onClick={() => applyPreset("7d")}>
                7d
              </Button>
              <Button variant="outline" size="sm" className="h-10" onClick={() => applyPreset("30d")}>
                30d
              </Button>
            </div>

            <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="lg:hidden h-10 gap-1.5">
                  <SlidersHorizontal className="size-4" />
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge className="bg-emerald-600 text-white ml-1 px-1.5 py-0 h-5 text-[10px]">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <SlidersHorizontal className="size-4 text-emerald-600" /> Filters
                  </SheetTitle>
                </SheetHeader>
                <div className="px-4 pb-6 space-y-5">
                  <FilterPanel
                    paymentMethod={paymentMethod}
                    setPaymentMethod={setPaymentMethod}
                    from={from}
                    setFrom={setFrom}
                    to={to}
                    setTo={setTo}
                    rxOnly={rxOnly}
                    setRxOnly={setRxOnly}
                    minAmount={minAmount}
                    setMinAmount={setMinAmount}
                    maxAmount={maxAmount}
                    setMaxAmount={setMaxAmount}
                    statuses={statuses}
                    toggleStatus={toggleStatus}
                    paymentStatuses={paymentStatuses}
                    togglePaymentStatus={togglePaymentStatus}
                    onClear={clearAllFilters}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Desktop filter panel */}
          <div className="hidden lg:block">
            <FilterPanel
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              from={from}
              setFrom={setFrom}
              to={to}
              setTo={setTo}
              rxOnly={rxOnly}
              setRxOnly={setRxOnly}
              minAmount={minAmount}
              setMinAmount={setMinAmount}
              maxAmount={maxAmount}
              setMaxAmount={setMaxAmount}
              statuses={statuses}
              toggleStatus={toggleStatus}
              paymentStatuses={paymentStatuses}
              togglePaymentStatus={togglePaymentStatus}
              onClear={clearAllFilters}
            />
          </div>

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t">
              <span className="text-xs font-medium text-muted-foreground inline-flex items-center gap-1">
                <Filter className="size-3" /> {activeFilterCount} active:
              </span>
              {debouncedSearch.trim() && (
                <FilterChip label={`"${debouncedSearch.trim()}"`} onRemove={() => setSearch("")} />
              )}
              {Array.from(statuses).map((s) => (
                <FilterChip key={`s-${s}`} label={ORDER_STATUS_LABEL[s]} onRemove={() => toggleStatus(s)} />
              ))}
              {Array.from(paymentStatuses).map((s) => (
                <FilterChip
                  key={`p-${s}`}
                  label={`Pay: ${PAYMENT_STATUS_LABEL[s] || s}`}
                  onRemove={() => togglePaymentStatus(s)}
                />
              ))}
              {paymentMethod !== "all" && (
                <FilterChip
                  label={`Method: ${PAYMENT_METHOD_LABEL[paymentMethod] || paymentMethod}`}
                  onRemove={() => setPaymentMethod("all")}
                />
              )}
              {from && <FilterChip label={`From: ${formatDate(from)}`} onRemove={() => setFrom("")} />}
              {to && <FilterChip label={`To: ${formatDate(to)}`} onRemove={() => setTo("")} />}
              {rxOnly && <FilterChip label="Rx Orders" onRemove={() => setRxOnly(false)} />}
              {minAmount && <FilterChip label={`Min: Rs. ${minAmount}`} onRemove={() => setMinAmount("")} />}
              {maxAmount && <FilterChip label={`Max: Rs. ${maxAmount}`} onRemove={() => setMaxAmount("")} />}
              <Button variant="ghost" size="sm" className="h-7 ml-auto text-xs" onClick={clearAllFilters}>
                <X className="size-3 mr-1" /> Clear All
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ----------------------- Toolbar ----------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={() => exportCsv(false)}>
            <Download className="size-3.5" /> Export CSV
          </Button>
          {selectedIds.size > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={() => exportCsv(true)}>
              <Download className="size-3.5" /> Export Selected ({selectedIds.size})
            </Button>
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          {totalItems > 0 ? (
            <>
              Showing{" "}
              <span className="font-semibold text-foreground">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalItems)}
              </span>{" "}
              of <span className="font-semibold text-foreground">{totalItems}</span> orders
            </>
          ) : (
            "No orders"
          )}
        </div>
      </div>

      {/* ----------------------- Bulk Action Bar (sticky bottom) ----------------------- */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-50/95 dark:bg-emerald-950/90 px-4 py-3 backdrop-blur-md shadow-lg ring-1 ring-emerald-500/20">
            <Badge className="bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 gap-1.5 border-emerald-200 dark:border-emerald-800">
              {selectedIds.size} selected
            </Badge>
            <div className="h-5 w-px bg-emerald-300/40 dark:bg-emerald-700/40 mx-1" />
            <Button size="sm" variant="outline" className="h-8" disabled={bulkBusy} onClick={() => bulkUpdateStatus("confirmed")}>
              <CheckCheck className="size-3.5 mr-1" /> Confirm
            </Button>
            <Button size="sm" variant="outline" className="h-8" disabled={bulkBusy} onClick={() => bulkUpdateStatus("packed")}>
              <Package className="size-3.5 mr-1" /> Pack
            </Button>
            <Button size="sm" variant="outline" className="h-8" disabled={bulkBusy} onClick={() => bulkUpdateStatus("out_for_delivery")}>
              <Send className="size-3.5 mr-1" /> Ship
            </Button>
            <Button size="sm" variant="outline" className="h-8" disabled={bulkBusy} onClick={() => bulkUpdateStatus("delivered")}>
              <PackageCheck className="size-3.5 mr-1" /> Deliver
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-rose-600 hover:text-rose-700" disabled={bulkBusy} onClick={() => bulkUpdateStatus("cancelled")}>
              <XCircle className="size-3.5 mr-1" /> Cancel
            </Button>
            <Button variant="ghost" size="sm" className="h-8 ml-auto" onClick={clearSelection}>
              <X className="size-3.5 mr-1" /> Clear
            </Button>
          </div>
        </div>
      )}

      {/* ----------------------- Table / Cards ----------------------- */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4">
              <TableSkeleton rows={8} cols={8} />
            </div>
          ) : items.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No orders found"
                description="Try adjusting your filters or search query."
                icon={<ShoppingCart className="size-6" />}
                action={
                  activeFilterCount > 0 ? (
                    <Button variant="outline" size="sm" onClick={clearAllFilters}>
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={headerChecked}
                          onCheckedChange={toggleAll}
                          aria-label="Select all"
                        />
                      </TableHead>
                      <TableHead>Order #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Rx</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((o) => {
                      const isSel = selectedIds.has(o.id);
                      const actions = NEXT_ACTIONS[o.status] ?? [];
                      return (
                        <TableRow
                          key={o.id}
                          className={cn("cursor-pointer", isSel && "bg-emerald-50/50 dark:bg-emerald-950/20")}
                          onClick={() => navigate({ name: "order-detail", id: o.id })}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSel}
                              onCheckedChange={() => toggleOne(o.id)}
                              aria-label={`Select order ${o.orderNumber}`}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs font-medium">
                            {o.orderNumber}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium truncate max-w-[180px]">
                              {o.customer?.name || o.shipName || "—"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {o.customer?.phone || o.shipPhone || "—"}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDate(o.createdAt)}
                          </TableCell>
                          <TableCell>
                            <PaymentMethodBadge method={o.paymentMethod} />
                          </TableCell>
                          <TableCell>
                            <PaymentStatusBadge status={o.paymentStatus} />
                          </TableCell>
                          <TableCell>
                            <OrderStatusBadge status={o.status} />
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {formatCurrency(o.grandTotal)}
                          </TableCell>
                          <TableCell>
                            {o.prescriptionId ? (
                              <Badge variant="outline" className="gap-1 text-amber-700 border-amber-200 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50">
                                <FileImage className="size-3" /> Rx
                              </Badge>
                            ) : o.manualRequestId ? (
                              <Badge variant="outline" className="gap-1 text-cyan-700 border-cyan-200 bg-cyan-50 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-900/50">
                                <Pill className="size-3" /> Manual
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="size-8">
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => navigate({ name: "order-detail", id: o.id })}>
                                  <Eye className="size-3.5 mr-2" /> View Details
                                </DropdownMenuItem>
                                {actions.length > 0 && (
                                  <>
                                    <DropdownMenuSeparator />
                                    {actions.map((a) => {
                                      const Icon = a.icon;
                                      return (
                                        <DropdownMenuItem
                                          key={a.status}
                                          onClick={() => inlineStatusChange(o.id, a.status)}
                                        >
                                          <Icon className="size-3.5 mr-2" /> {a.label}
                                        </DropdownMenuItem>
                                      );
                                    })}
                                  </>
                                )}
                                {o.status !== "cancelled" && o.status !== "returned" && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-rose-600 focus:text-rose-700"
                                      onClick={() => inlineStatusChange(o.id, "cancelled")}
                                    >
                                      <XCircle className="size-3.5 mr-2" /> Cancel Order
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="lg:hidden divide-y">
                {items.map((o) => {
                  const isSel = selectedIds.has(o.id);
                  return (
                    <div
                      key={o.id}
                      className={cn("p-4", isSel && "bg-emerald-50/50 dark:bg-emerald-950/20")}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={isSel}
                          onCheckedChange={() => toggleOne(o.id)}
                          aria-label={`Select ${o.orderNumber}`}
                          className="mt-1"
                        />
                        <button
                          className="flex-1 min-w-0 text-left"
                          onClick={() => navigate({ name: "order-detail", id: o.id })}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-sm font-semibold truncate">
                              {o.orderNumber}
                            </span>
                            <span className="text-sm font-semibold tabular-nums">
                              {formatCurrency(o.grandTotal)}
                            </span>
                          </div>
                          <div className="text-sm mt-1 truncate">
                            {o.customer?.name || o.shipName || "—"}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {o.customer?.phone || o.shipPhone || "—"} · {formatDate(o.createdAt)}
                          </div>
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            <OrderStatusBadge status={o.status} />
                            <PaymentStatusBadge status={o.paymentStatus} />
                            {o.prescriptionId && (
                              <Badge variant="outline" className="gap-1 text-amber-700 border-amber-200 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50">
                                <FileImage className="size-3" /> Rx
                              </Badge>
                            )}
                            {o.manualRequestId && (
                              <Badge variant="outline" className="gap-1 text-cyan-700 border-cyan-200 bg-cyan-50 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-900/50">
                                <Pill className="size-3" /> Manual
                              </Badge>
                            )}
                          </div>
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
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            Page <span className="font-semibold text-foreground">{page}</span> of{" "}
            <span className="font-semibold text-foreground">{totalPages}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="size-4" /> Prev
            </Button>
            {getPageRange(page, totalPages).map((p, i) =>
              p === "..." ? (
                <span key={`gap-${i}`} className="px-2 text-muted-foreground text-sm select-none">
                  …
                </span>
              ) : (
                <Button
                  key={p}
                  variant={p === page ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "h-9 min-w-9 px-2 tabular-nums",
                    p === page && "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
                  )}
                  onClick={() => setPage(p)}
                >
                  {p}
                </Button>
              )
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================ Summary Card ============================
function SummaryCard({
  icon,
  label,
  value,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string | undefined;
  onClick?: () => void;
  active?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  const display = value === undefined ? "—" : typeof value === "number" ? value.toLocaleString("en-IN") : value;
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "group relative w-full text-left flex items-center gap-3 p-3 rounded-xl border bg-card transition-colors",
        onClick && "hover:border-emerald-400/60 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 cursor-pointer",
        active
          ? "border-emerald-500 ring-1 ring-emerald-500/30"
          : "border-border/70"
      )}
    >
      <div className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg",
        active
          ? "bg-emerald-600 text-white"
          : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      )}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xl font-bold tracking-tight tabular-nums leading-none truncate">
          {display}
        </div>
        <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
      </div>
    </Tag>
  );
}

// ============================ Filter Panel ============================
function FilterPanel({
  paymentMethod,
  setPaymentMethod,
  from,
  setFrom,
  to,
  setTo,
  rxOnly,
  setRxOnly,
  minAmount,
  setMinAmount,
  maxAmount,
  setMaxAmount,
  statuses,
  toggleStatus,
  paymentStatuses,
  togglePaymentStatus,
  onClear,
}: {
  paymentMethod: string;
  setPaymentMethod: (v: string) => void;
  from: string;
  setFrom: (v: string) => void;
  to: string;
  setTo: (v: string) => void;
  rxOnly: boolean;
  setRxOnly: (v: boolean | ((p: boolean) => boolean)) => void;
  minAmount: string;
  setMinAmount: (v: string) => void;
  maxAmount: string;
  setMaxAmount: (v: string) => void;
  statuses: Set<string>;
  toggleStatus: (s: string) => void;
  paymentStatuses: Set<string>;
  togglePaymentStatus: (s: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <FilterLabel>Payment Method</FilterLabel>
          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="All Methods" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Methods</SelectItem>
              {PAYMENT_METHOD_OPTIONS.map((m) => (
                <SelectItem key={m} value={m}>
                  {PAYMENT_METHOD_LABEL[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <FilterLabel>From Date</FilterLabel>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10" />
        </div>
        <div>
          <FilterLabel>To Date</FilterLabel>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10" />
        </div>
        <div>
          <FilterLabel>Amount Range (Rs.)</FilterLabel>
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              inputMode="numeric"
              min="0"
              placeholder="Min"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              className="h-10"
            />
            <span className="text-muted-foreground text-xs">–</span>
            <Input
              type="number"
              inputMode="numeric"
              min="0"
              placeholder="Max"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              className="h-10"
            />
          </div>
        </div>
      </div>

      <div>
        <FilterLabel>Order Status</FilterLabel>
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_OPTIONS.map((s) => (
            <StatusChip
              key={s}
              status={s}
              active={statuses.has(s)}
              onClick={() => toggleStatus(s)}
            >
              {ORDER_STATUS_LABEL[s]}
            </StatusChip>
          ))}
        </div>
      </div>

      <div>
        <FilterLabel>Payment Status</FilterLabel>
        <div className="flex flex-wrap items-center gap-2">
          {PAYMENT_STATUS_OPTIONS.map((s) => (
            <PaymentStatusChip
              key={s}
              status={s}
              active={paymentStatuses.has(s)}
              onClick={() => togglePaymentStatus(s)}
            >
              {PAYMENT_STATUS_LABEL[s] || s}
            </PaymentStatusChip>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <FilterLabel className="mb-0">Special Filters</FilterLabel>
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onClear}>
          <X className="size-3 mr-1" /> Reset
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 -mt-2">
        <ChipToggle active={rxOnly} onClick={() => setRxOnly((v) => !v)}>
          <FileImage className="size-3 mr-1" /> Prescription Orders
        </ChipToggle>
      </div>
    </div>
  );
}

function FilterLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5", className)}>
      {children}
    </div>
  );
}

// ============================ Badges ============================
const STATUS_BADGE_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50",
  confirmed: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50",
  packed: "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900/50",
  out_for_delivery: "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-900/50",
  delivered: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50",
  cancelled: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50",
  returned: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900/50",
};

const STATUS_DOT_STYLES: Record<string, string> = {
  pending: "bg-amber-500",
  confirmed: "bg-emerald-500",
  packed: "bg-teal-600",
  out_for_delivery: "bg-cyan-500",
  delivered: "bg-emerald-600",
  cancelled: "bg-rose-500",
  returned: "bg-orange-500",
};

function OrderStatusBadge({ status }: { status: string }) {
  const cls = STATUS_BADGE_STYLES[status] || "bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-900/40 dark:text-stone-300 dark:border-stone-800";
  const dot = STATUS_DOT_STYLES[status] || "bg-stone-400";
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium border", cls)}>
      <span className={cn("size-1.5 rounded-full", dot)} />
      {ORDER_STATUS_LABEL[status] || status}
    </Badge>
  );
}

const PAYMENT_STATUS_BADGE_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50",
  paid: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50",
  partially_paid: "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-900/50",
  failed: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/50",
  refunded: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50",
  refund_initiated: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900/50",
  cancelled: "bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700",
};

const PAYMENT_STATUS_DOT_STYLES: Record<string, string> = {
  pending: "bg-amber-500",
  paid: "bg-emerald-500",
  partially_paid: "bg-cyan-500",
  failed: "bg-red-500",
  refunded: "bg-rose-500",
  refund_initiated: "bg-orange-500",
  cancelled: "bg-slate-400",
};

function PaymentStatusBadge({ status }: { status: string }) {
  const cls = PAYMENT_STATUS_BADGE_STYLES[status] || "bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-900/40 dark:text-stone-300 dark:border-stone-800";
  const dot = PAYMENT_STATUS_DOT_STYLES[status] || "bg-stone-400";
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium border", cls)}>
      <span className={cn("size-1.5 rounded-full", dot)} />
      {PAYMENT_STATUS_LABEL[status] || status.replace(/_/g, " ")}
    </Badge>
  );
}

function PaymentMethodBadge({ method }: { method: string }) {
  return (
    <Badge variant="outline" className="bg-muted/50 gap-1 font-medium">
      {PAYMENT_METHOD_LABEL[method] || method}
    </Badge>
  );
}

// ============================ Small presentational helpers ============================
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
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border transition-colors min-h-[28px]",
        active
          ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
          : "bg-background text-muted-foreground border-border hover:bg-muted/50 hover:border-emerald-400/50"
      )}
    >
      {children}
    </button>
  );
}

function StatusChip({
  status,
  active,
  onClick,
  children,
}: {
  status: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const dot = STATUS_DOT_STYLES[status] || "bg-stone-400";
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors min-h-[28px]",
        active
          ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
          : "bg-background text-muted-foreground border-border hover:bg-muted/50 hover:border-emerald-400/50"
      )}
    >
      <span className={cn("size-1.5 rounded-full", dot)} />
      {children}
    </button>
  );
}

function PaymentStatusChip({
  status,
  active,
  onClick,
  children,
}: {
  status: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const dot = PAYMENT_STATUS_DOT_STYLES[status] || "bg-stone-400";
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors min-h-[28px]",
        active
          ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
          : "bg-background text-muted-foreground border-border hover:bg-muted/50 hover:border-emerald-400/50"
      )}
    >
      <span className={cn("size-1.5 rounded-full", dot)} />
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

// ============================ Utilities ============================
function getPageRange(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "...", total];
  if (current >= total - 3)
    return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "...", current - 1, current, current + 1, "...", total];
}
