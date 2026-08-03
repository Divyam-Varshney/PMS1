// ============================================================================
// File: src/components/admin/views/OrdersView.tsx
// Purpose: Enterprise-grade admin Order Management view (PMS2 redesign).
//          Inspired by Shopify Admin, Stripe Dashboard & Amazon Seller Central.
//          Features:
//            • 14 dashboard summary cards (clickable status filters, trend %)
//            • Advanced search (order #, customer, phone, email, product, pay ID)
//            • Multi-select chips (status + payment status), payment method,
//              date range, prescription / manual / coupon toggles, amount range
//            • Quick date presets (Today / Yesterday / 7d / 30d)
//            • Active filter chips with one-click removal + Clear All
//            • Mobile filters in a Sheet (right side)
//            • 12-column advanced table — sticky header, hover, clickable rows,
//              compact/comfortable density, column visibility, search highlight
//            • Sticky bulk-action bar — Confirm / Pack / Ship / Deliver /
//              Cancel / Print Invoices / Export CSV / Clear
//            • Export CSV (all or selected), density toggle, column visibility
//            • Page-number pagination with "Showing 1-20 of N"
//          Accent palette: emerald / teal / cyan (NO indigo / blue).
// ============================================================================

"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, run } from "../api";
import {
  PageHeader,
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
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
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
  ChevronLeft,
  TrendingUp,
  TrendingDown,
  Clock,
  Truck,
  Package,
  PackageCheck,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Undo2,
  Wallet,
  Receipt,
  FileImage,
  Pill,
  CalendarDays,
  Printer,
  SlidersHorizontal,
  Columns3,
  ArrowUpDown,
  MoreHorizontal,
  Eye,
  Tag,
  Banknote,
  CheckCheck,
  Boxes,
  Send,
  Sparkles,
} from "lucide-react";
import { useAdminStore } from "../admin-store";
import { formatCurrency, formatDate, timeAgo } from "@/lib/format";
import { ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
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

// 12-column table definition (used for visibility toggle + render map).
type ColumnId =
  | "select"
  | "orderNumber"
  | "customer"
  | "date"
  | "paymentMethod"
  | "paymentStatus"
  | "status"
  | "amount"
  | "coupon"
  | "prescription"
  | "deliveryPartner"
  | "actions";

const COLUMNS: { id: ColumnId; label: string; align?: "right" | "center" }[] = [
  { id: "select", label: "", align: "center" },
  { id: "orderNumber", label: "Order #" },
  { id: "customer", label: "Customer" },
  { id: "date", label: "Date & Time" },
  { id: "paymentMethod", label: "Method" },
  { id: "paymentStatus", label: "Payment" },
  { id: "status", label: "Status" },
  { id: "amount", label: "Amount", align: "right" },
  { id: "coupon", label: "Coupon" },
  { id: "prescription", label: "Rx" },
  { id: "deliveryPartner", label: "Partner" },
  { id: "actions", label: "" },
];

// =============================== Component ===============================
export function OrdersView() {
  const navigate = useAdminStore((s) => s.navigate);
  const qc = useQueryClient();

  // --------------------- Filter state ---------------------
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statuses, setStatuses] = useState<Set<string>>(new Set());
  const [paymentStatuses, setPaymentStatuses] = useState<Set<string>>(new Set());
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rxOnly, setRxOnly] = useState(false);
  const [manualOnly, setManualOnly] = useState(false);
  const [hasCoupon, setHasCoupon] = useState(false);
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  // --------------------- View state ---------------------
  const [compact, setCompact] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnId, boolean>>(
    () =>
      Object.fromEntries(COLUMNS.map((c) => [c.id, true])) as Record<ColumnId, boolean>
  );
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // --------------------- Debounced search (300ms) ---------------------
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page to 1 whenever any filter changes — prevents landing on a
  // non-existent page after the result set shrinks.
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
    manualOnly,
    hasCoupon,
    minAmount,
    maxAmount,
  ]);

  // --------------------- Query params ---------------------
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
    if (manualOnly) p.set("isManualRequest", "true");
    if (hasCoupon) p.set("hasCoupon", "true");
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
    manualOnly,
    hasCoupon,
    minAmount,
    maxAmount,
    page,
  ]);

  // --------------------- Queries ---------------------
  const { data, isLoading } = useQuery({
    queryKey: ["admin-orders", queryParams],
    queryFn: () =>
      api.get<{
        items: OrderListItem[];
        total: number;
        totalPages: number;
        page: number;
      }>(`/api/admin/orders?${queryParams}`),
  });

  const { data: stats } = useQuery<Stats>({
    queryKey: ["admin-orders-stats"],
    queryFn: () => api.get<Stats>("/api/admin/orders/stats"),
    refetchInterval: 60_000,
  });

  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalItems = data?.total ?? 0;

  // --------------------- Selection helpers ---------------------
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

  const toggleOne = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    []
  );

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // --------------------- Filter helpers ---------------------
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
    setManualOnly(false);
    setHasCoupon(false);
    setMinAmount("");
    setMaxAmount("");
    setSearch("");
    setDebouncedSearch("");
  }, []);

  // --------------------- Quick date presets ---------------------
  const applyPreset = useCallback((preset: "today" | "yesterday" | "7d" | "30d") => {
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
    } else if (preset === "yesterday") {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const ys = fmt(startOf(y));
      setFrom(ys);
      setTo(ys);
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
    (manualOnly ? 1 : 0) +
    (hasCoupon ? 1 : 0) +
    (minAmount ? 1 : 0) +
    (maxAmount ? 1 : 0) +
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

  // --------------------- Print invoices (hidden iframe per invoice) ---------------------
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
          setTimeout(() => {
            URL.revokeObjectURL(url);
            iframe.remove();
          }, 5000);
        };
      } catch (e: any) {
        toast.error(`Failed to fetch invoice for order ${id.slice(-6)}`);
      }
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

  // Inline single-order status change
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

  // --------------------- Column visibility ---------------------
  const toggleColumn = (id: ColumnId) =>
    setColumnVisibility((prev) => ({ ...prev, [id]: !prev[id] }));

  // =============================== Render ===============================
  return (
    <div className="space-y-5 pb-24">
      <PageHeader
        title="Orders"
        description="View, filter, and manage customer orders — enterprise control center."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportCsv(false)}>
              <Download className="size-4" /> Export All
            </Button>
          </div>
        }
      />

      {/* ----------------------- 14 Summary Cards ----------------------- */}
      <SummaryGrid stats={stats} statuses={statuses} toggleStatus={toggleStatus} />

      {/* ----------------------- Search + Presets + Mobile filter trigger ----------------------- */}
      <Card className="shadow-premium-sm">
        <CardContent className="pt-5 pb-4 space-y-4">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search order #, customer, phone, email, product, payment ID…"
                className="pl-10 h-11 rounded-xl"
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

            {/* Quick date presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <PresetButton label="Today" onClick={() => applyPreset("today")} />
              <PresetButton label="Yesterday" onClick={() => applyPreset("yesterday")} />
              <PresetButton label="Last 7 Days" onClick={() => applyPreset("7d")} />
              <PresetButton label="Last 30 Days" onClick={() => applyPreset("30d")} />
            </div>

            {/* Mobile filters trigger */}
            <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="lg:hidden gap-1.5 h-11 rounded-xl">
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
                    manualOnly={manualOnly}
                    setManualOnly={setManualOnly}
                    hasCoupon={hasCoupon}
                    setHasCoupon={setHasCoupon}
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
              manualOnly={manualOnly}
              setManualOnly={setManualOnly}
              hasCoupon={hasCoupon}
              setHasCoupon={setHasCoupon}
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
          <AnimatePresence>
            {activeFilterCount > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-wrap items-center gap-2 pt-3 border-t"
              >
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
                {manualOnly && <FilterChip label="Manual Requests" onRemove={() => setManualOnly(false)} />}
                {hasCoupon && <FilterChip label="Has Coupon" onRemove={() => setHasCoupon(false)} />}
                {minAmount && <FilterChip label={`Min: Rs. ${minAmount}`} onRemove={() => setMinAmount("")} />}
                {maxAmount && <FilterChip label={`Max: Rs. ${maxAmount}`} onRemove={() => setMaxAmount("")} />}
                <Button variant="ghost" size="sm" className="h-7 ml-auto text-xs" onClick={clearAllFilters}>
                  <X className="size-3 mr-1" /> Clear All
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* ----------------------- Toolbar: density + columns + export ----------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-9 rounded-lg"
            onClick={() => setCompact((v) => !v)}
            title="Toggle row density"
          >
            {compact ? <Rows3 className="size-3.5" /> : <Rows4 className="size-3.5" />}
            {compact ? "Compact" : "Comfortable"}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-9 rounded-lg">
                <Columns3 className="size-3.5" /> Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wide">
                Toggle columns
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {COLUMNS.filter((c) => c.id !== "select" && c.id !== "actions").map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={columnVisibility[c.id]}
                  onCheckedChange={() => toggleColumn(c.id)}
                  className="text-sm"
                >
                  {c.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-9 rounded-lg"
            onClick={() => exportCsv(false)}
          >
            <Download className="size-3.5" /> Export CSV
          </Button>
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
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-5xl"
          >
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-50/95 dark:bg-emerald-950/90 px-4 py-3 backdrop-blur-md shadow-premium-lg ring-1 ring-emerald-500/20">
              <Badge className="bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 gap-1.5 border-emerald-200 dark:border-emerald-800">
                <CheckSquare className="size-3.5" />
                {selectedIds.size} order{selectedIds.size === 1 ? "" : "s"} selected
              </Badge>

              <div className="h-5 w-px bg-emerald-300/40 dark:bg-emerald-700/40 mx-1" />

              <BulkActionButton
                icon={<CheckCheck className="size-3.5" />}
                label="Confirm"
                onClick={() => bulkUpdateStatus("confirmed")}
                disabled={bulkBusy}
                tint="emerald"
              />
              <BulkActionButton
                icon={<Package className="size-3.5" />}
                label="Pack"
                onClick={() => bulkUpdateStatus("packed")}
                disabled={bulkBusy}
                tint="teal"
              />
              <BulkActionButton
                icon={<Send className="size-3.5" />}
                label="Ship"
                onClick={() => bulkUpdateStatus("out_for_delivery")}
                disabled={bulkBusy}
                tint="cyan"
              />
              <BulkActionButton
                icon={<Truck className="size-3.5" />}
                label="Deliver"
                onClick={() => bulkUpdateStatus("delivered")}
                disabled={bulkBusy}
                tint="emerald"
              />
              <BulkActionButton
                icon={<XCircle className="size-3.5" />}
                label="Cancel"
                onClick={() => bulkUpdateStatus("cancelled")}
                disabled={bulkBusy}
                tint="rose"
              />

              <div className="h-5 w-px bg-emerald-300/40 dark:bg-emerald-700/40 mx-1" />

              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-8 bg-white/60 dark:bg-transparent"
                onClick={printInvoices}
              >
                <Printer className="size-3.5" /> Print
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-8 bg-white/60 dark:bg-transparent"
                onClick={() => exportCsv(true)}
              >
                <Download className="size-3.5" /> CSV
              </Button>

              {bulkBusy && <Loader2 className="size-4 animate-spin text-emerald-600 ml-1" />}

              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 ml-auto h-8"
                onClick={clearSelection}
              >
                <X className="size-3.5" /> Clear
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ----------------------- Order List ----------------------- */}
      <Card className="shadow-premium-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4">
              <TableSkeleton rows={10} cols={8} />
            </div>
          ) : !items.length ? (
            <div className="p-6">
              <EmptyState
                title="No orders found"
                icon={<ShoppingCart className="size-6" />}
                description={
                  activeFilterCount > 0
                    ? "Try adjusting your filters or clear them all to see every order."
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
              {/* Desktop: full 12-column table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40 sticky top-0 z-10">
                      {columnVisibility.select && (
                        <TableHead className="w-10 text-center">
                          <Checkbox
                            checked={headerChecked}
                            onCheckedChange={toggleAll}
                            aria-label="Select all visible orders"
                          />
                        </TableHead>
                      )}
                      {columnVisibility.orderNumber && <TableHead>Order #</TableHead>}
                      {columnVisibility.customer && <TableHead>Customer</TableHead>}
                      {columnVisibility.date && <TableHead>Date & Time</TableHead>}
                      {columnVisibility.paymentMethod && <TableHead>Method</TableHead>}
                      {columnVisibility.paymentStatus && <TableHead>Payment</TableHead>}
                      {columnVisibility.status && <TableHead>Status</TableHead>}
                      {columnVisibility.amount && (
                        <TableHead className="text-right">Amount</TableHead>
                      )}
                      {columnVisibility.coupon && <TableHead>Coupon</TableHead>}
                      {columnVisibility.prescription && <TableHead>Rx</TableHead>}
                      {columnVisibility.deliveryPartner && <TableHead>Partner</TableHead>}
                      {columnVisibility.actions && <TableHead className="w-12" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((o) => {
                      const isSelected = selectedIds.has(o.id);
                      return (
                        <TableRow
                          key={o.id}
                          className={cn(
                            "cursor-pointer transition-colors group",
                            isSelected
                              ? "bg-emerald-50/60 dark:bg-emerald-950/30"
                              : "hover:bg-muted/40",
                            compact ? "py-0.5" : ""
                          )}
                          onClick={() => navigate({ name: "order-detail", id: o.id })}
                        >
                          {columnVisibility.select && (
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
                          )}
                          {columnVisibility.orderNumber && (
                            <TableCell className={compact ? "py-1.5" : ""}>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-semibold text-foreground">
                                  {highlightMatch(o.orderNumber, debouncedSearch)}
                                </span>
                                {o.source === "manual_request" && (
                                  <Badge
                                    variant="outline"
                                    className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50 text-[10px] px-1.5 py-0 h-4"
                                  >
                                    <Pill className="size-2.5 mr-0.5" /> MR
                                  </Badge>
                                )}
                              </div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                {o.itemCount} item{o.itemCount === 1 ? "" : "s"}
                              </div>
                            </TableCell>
                          )}
                          {columnVisibility.customer && (
                            <TableCell className={compact ? "py-1.5" : ""}>
                              <CustomerName customer={o.customer} fallback={o.shipName} />
                              <CustomerContact customer={o.customer} fallback={o.shipPhone} />
                            </TableCell>
                          )}
                          {columnVisibility.date && (
                            <TableCell
                              className={cn(
                                "text-xs text-muted-foreground",
                                compact ? "py-1.5" : ""
                              )}
                            >
                              <div className="font-medium text-foreground">
                                {formatDate(o.createdAt)}
                              </div>
                              <div className="text-[10px]">{timeAgo(o.createdAt)}</div>
                            </TableCell>
                          )}
                          {columnVisibility.paymentMethod && (
                            <TableCell className={compact ? "py-1.5" : ""}>
                              <PaymentMethodBadge method={o.paymentMethod} />
                            </TableCell>
                          )}
                          {columnVisibility.paymentStatus && (
                            <TableCell className={compact ? "py-1.5" : ""}>
                              <PaymentStatusBadge status={o.paymentStatus} />
                            </TableCell>
                          )}
                          {columnVisibility.status && (
                            <TableCell
                              className={compact ? "py-1.5" : ""}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <OrderStatusBadge status={o.status} />
                            </TableCell>
                          )}
                          {columnVisibility.amount && (
                            <TableCell
                              className={cn(
                                "text-right font-bold text-sm tabular-nums",
                                compact ? "py-1.5" : ""
                              )}
                            >
                              {formatCurrency(o.grandTotal)}
                            </TableCell>
                          )}
                          {columnVisibility.coupon && (
                            <TableCell className={compact ? "py-1.5" : ""}>
                              {o.voucherCode ? (
                                <Badge
                                  variant="outline"
                                  className="bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900/50 gap-1"
                                >
                                  <Tag className="size-3" />
                                  {o.voucherCode}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          )}
                          {columnVisibility.prescription && (
                            <TableCell className={compact ? "py-1.5" : ""}>
                              {o.prescriptionId || o.source === "prescription" ? (
                                <Badge
                                  variant="outline"
                                  className="bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900/50 gap-1"
                                >
                                  <FileImage className="size-3" /> Rx
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          )}
                          {columnVisibility.deliveryPartner && (
                            <TableCell className={compact ? "py-1.5" : ""}>
                              <span className="text-xs text-muted-foreground">In-house</span>
                            </TableCell>
                          )}
                          {columnVisibility.actions && (
                            <TableCell
                              className={compact ? "py-1.5" : ""}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                                    aria-label="Quick actions"
                                  >
                                    <MoreHorizontal className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-52">
                                  <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wide">
                                    Quick actions
                                  </DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => navigate({ name: "order-detail", id: o.id })}
                                  >
                                    <Eye className="size-3.5 mr-2" /> View detail
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wide">
                                    Set status
                                  </DropdownMenuLabel>
                                  {STATUS_OPTIONS.map((s) => (
                                    <DropdownMenuItem
                                      key={s}
                                      disabled={s === o.status}
                                      onClick={() => inlineStatusChange(o.id, s)}
                                    >
                                      <span className="size-1.5 rounded-full mr-2 inline-block bg-current opacity-70" />
                                      {ORDER_STATUS_LABEL[s]}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          )}
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
                      className={cn(
                        "p-3 transition-colors",
                        isSelected ? "bg-emerald-50/60 dark:bg-emerald-950/30" : ""
                      )}
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
                              <span className="font-mono text-sm font-semibold truncate">
                                {highlightMatch(o.orderNumber, debouncedSearch)}
                              </span>
                              {o.prescriptionId && (
                                <FileImage className="size-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                              )}
                              {o.voucherCode && (
                                <Badge
                                  variant="outline"
                                  className="bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900/50 text-[10px] px-1.5 py-0 h-4"
                                >
                                  <Tag className="size-2.5 mr-0.5" />
                                  {o.voucherCode}
                                </Badge>
                              )}
                            </div>
                            <span className="text-sm font-bold shrink-0 tabular-nums">
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
                            <OrderStatusBadge status={o.status} />
                            <PaymentStatusBadge status={o.paymentStatus} />
                            <PaymentMethodBadge method={o.paymentMethod} />
                            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                              <CalendarDays className="size-3" /> {formatDate(o.createdAt)}
                            </span>
                          </div>
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
      {totalPages > 1 && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="text-sm text-muted-foreground">
            Page <span className="font-semibold text-foreground">{page}</span> of{" "}
            <span className="font-semibold text-foreground">{totalPages}</span> ·{" "}
            <span className="font-semibold text-foreground">{totalItems}</span> total orders
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-9 rounded-lg"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="size-4" /> Prev
            </Button>
            <div className="flex items-center gap-1">
              {getPageRange(page, totalPages).map((p, i) =>
                p === "..." ? (
                  <span
                    key={`gap-${i}`}
                    className="px-2 text-muted-foreground text-sm select-none"
                  >
                    …
                  </span>
                ) : (
                  <Button
                    key={p}
                    variant={p === page ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "h-9 min-w-9 px-2 rounded-lg tabular-nums",
                      p === page &&
                        "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
                    )}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </Button>
                )
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-9 rounded-lg"
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

// ============================ Summary Grid (14 cards) ============================
function SummaryGrid({
  stats,
  statuses,
  toggleStatus,
}: {
  stats: Stats | undefined;
  statuses: Set<string>;
  toggleStatus: (s: string) => void;
}) {
  const v = (n: number | undefined) => (n === undefined ? "—" : n.toLocaleString("en-IN"));
  const revenueTrend = stats?.revenueTrend ?? 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-3">
      <SummaryCard
        icon={<ShoppingCart className="size-5" />}
        label="Total Orders"
        value={v(stats?.total)}
        gradient="from-emerald-500 to-teal-600"
      />
      <SummaryCard
        icon={<Clock className="size-5" />}
        label="Today's Orders"
        value={v(stats?.today)}
        gradient="from-cyan-500 to-teal-600"
      />
      <SummaryCard
        icon={<Clock className="size-5" />}
        label="Pending"
        value={v(stats?.pending)}
        gradient="from-amber-500 to-orange-600"
        onClick={() => toggleStatus("pending")}
        active={statuses.has("pending")}
      />
      <SummaryCard
        icon={<CheckCheck className="size-5" />}
        label="Confirmed"
        value={v(stats?.confirmed)}
        gradient="from-emerald-500 to-green-600"
        onClick={() => toggleStatus("confirmed")}
        active={statuses.has("confirmed")}
      />
      <SummaryCard
        icon={<Package className="size-5" />}
        label="Packed"
        value={v(stats?.packed)}
        gradient="from-teal-500 to-emerald-600"
        onClick={() => toggleStatus("packed")}
        active={statuses.has("packed")}
      />
      <SummaryCard
        icon={<Send className="size-5" />}
        label="Out for Delivery"
        value={v(stats?.out_for_delivery)}
        gradient="from-cyan-500 to-sky-600"
        onClick={() => toggleStatus("out_for_delivery")}
        active={statuses.has("out_for_delivery")}
      />
      <SummaryCard
        icon={<PackageCheck className="size-5" />}
        label="Delivered"
        value={v(stats?.delivered)}
        gradient="from-emerald-500 to-teal-700"
        onClick={() => toggleStatus("delivered")}
        active={statuses.has("delivered")}
      />
      <SummaryCard
        icon={<XCircle className="size-5" />}
        label="Cancelled"
        value={v(stats?.cancelled)}
        gradient="from-rose-500 to-red-600"
        onClick={() => toggleStatus("cancelled")}
        active={statuses.has("cancelled")}
      />
      <SummaryCard
        icon={<RotateCcw className="size-5" />}
        label="Returned"
        value={v(stats?.returned)}
        gradient="from-orange-500 to-amber-600"
        onClick={() => toggleStatus("returned")}
        active={statuses.has("returned")}
      />
      <SummaryCard
        icon={<Undo2 className="size-5" />}
        label="Refunded"
        value={v(stats?.refunded)}
        gradient="from-rose-500 to-pink-600"
      />
      <SummaryCard
        icon={<Wallet className="size-5" />}
        label="Total Revenue"
        value={stats ? formatCurrency(stats.totalRevenue) : "—"}
        gradient="from-emerald-500 to-teal-700"
        trend={revenueTrend}
        subtitle={stats ? `Today: ${formatCurrency(stats.todayRevenue)}` : undefined}
      />
      <SummaryCard
        icon={<Receipt className="size-5" />}
        label="Avg Order Value"
        value={stats ? formatCurrency(stats.averageOrderValue) : "—"}
        gradient="from-teal-500 to-cyan-600"
      />
      <SummaryCard
        icon={<FileImage className="size-5" />}
        label="Prescription Orders"
        value={v(stats?.prescriptionOrders)}
        gradient="from-cyan-500 to-teal-700"
      />
      <SummaryCard
        icon={<Pill className="size-5" />}
        label="Medicine Requests"
        value={v(stats?.medicineRequests)}
        gradient="from-amber-500 to-yellow-600"
      />
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  gradient,
  subtitle,
  trend,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  gradient: string;
  subtitle?: string;
  trend?: number;
  onClick?: () => void;
  active?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="h-full"
    >
      <Tag
        onClick={onClick}
        className={cn(
          "group relative w-full h-full text-left flex flex-col gap-2 p-3.5 rounded-xl border bg-card transition-premium",
          onClick && "hover:-translate-y-0.5 hover:shadow-premium cursor-pointer",
          active
            ? "border-emerald-500 ring-2 ring-emerald-500/30 shadow-premium-sm"
            : "border-border/70 hover:border-emerald-400/50"
        )}
      >
        <div className="flex items-start justify-between">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md ring-1 ring-white/15",
              gradient
            )}
          >
            {icon}
          </div>
          {trend !== undefined && (
            <div
              className={cn(
                "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold",
                trend >= 0
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                  : "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
              )}
            >
              {trend >= 0 ? (
                <TrendingUp className="size-3" />
              ) : (
                <TrendingDown className="size-3" />
              )}
              {Math.abs(trend)}%
            </div>
          )}
        </div>
        <div>
          <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums leading-none">
            {value}
          </div>
          <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          {subtitle && (
            <div className="mt-1 text-[10px] text-muted-foreground/80">{subtitle}</div>
          )}
        </div>
        {active && (
          <div className="absolute top-2 right-2 size-1.5 rounded-full bg-emerald-500 animate-pulse" />
        )}
      </Tag>
    </motion.div>
  );
}

// ============================ Filter Panel (shared desktop + mobile) ============================
function FilterPanel({
  paymentMethod,
  setPaymentMethod,
  from,
  setFrom,
  to,
  setTo,
  rxOnly,
  setRxOnly,
  manualOnly,
  setManualOnly,
  hasCoupon,
  setHasCoupon,
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
  manualOnly: boolean;
  setManualOnly: (v: boolean | ((p: boolean) => boolean)) => void;
  hasCoupon: boolean;
  setHasCoupon: (v: boolean | ((p: boolean) => boolean)) => void;
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
      {/* Row 1: payment method, date range, amount range */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <Label>Payment Method</Label>
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
          <Label>From Date</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10" />
        </div>
        <div>
          <Label>To Date</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10" />
        </div>
        <div>
          <Label>Amount Range (Rs.)</Label>
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

      {/* Row 2: status chips */}
      <div>
        <Label>Order Status</Label>
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

      {/* Row 3: payment status chips */}
      <div>
        <Label>Payment Status</Label>
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

      {/* Row 4: toggles */}
      <div>
        <Label>Special Filters</Label>
        <div className="flex flex-wrap items-center gap-2">
          <ChipToggle active={rxOnly} onClick={() => setRxOnly((v) => !v)}>
            <FileImage className="size-3 mr-1" /> Prescription Orders
          </ChipToggle>
          <ChipToggle active={manualOnly} onClick={() => setManualOnly((v) => !v)}>
            <Pill className="size-3 mr-1" /> Manual Requests
          </ChipToggle>
          <ChipToggle active={hasCoupon} onClick={() => setHasCoupon((v) => !v)}>
            <Tag className="size-3 mr-1" /> Coupon Used
          </ChipToggle>
          <Button variant="ghost" size="sm" className="h-8 ml-auto text-xs" onClick={onClear}>
            <X className="size-3 mr-1" /> Reset
          </Button>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
      {children}
    </div>
  );
}

// ============================ Badges (colored per status) ============================
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
  failed: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50",
  refunded: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50",
  refund_initiated: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900/50",
  cancelled: "bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700",
};

const PAYMENT_STATUS_DOT_STYLES: Record<string, string> = {
  pending: "bg-amber-500",
  paid: "bg-emerald-500",
  partially_paid: "bg-cyan-500",
  failed: "bg-rose-500",
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
  const Icon =
    method === "cod"
      ? Banknote
      : method === "qr"
        ? Receipt
        : method === "upi"
          ? Wallet
          : method === "online"
            ? Send
            : method === "razorpay" || method === "cashfree"
              ? Sparkles
              : Banknote;
  return (
    <Badge variant="outline" className="bg-muted/50 gap-1 font-medium">
      <Icon className="size-3 text-muted-foreground" />
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

function PresetButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-9 px-3 rounded-lg text-xs font-medium hover:border-emerald-400/60 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30"
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

function BulkActionButton({
  icon,
  label,
  onClick,
  disabled,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tint: "emerald" | "teal" | "cyan" | "rose";
}) {
  const tintCls: Record<string, string> = {
    emerald:
      "hover:bg-emerald-600 hover:text-white hover:border-emerald-600 text-emerald-700 dark:text-emerald-300",
    teal:
      "hover:bg-teal-600 hover:text-white hover:border-teal-600 text-teal-700 dark:text-teal-300",
    cyan:
      "hover:bg-cyan-600 hover:text-white hover:border-cyan-600 text-cyan-700 dark:text-cyan-300",
    rose:
      "hover:bg-rose-600 hover:text-white hover:border-rose-600 text-rose-700 dark:text-rose-300",
  };
  return (
    <Button
      size="sm"
      variant="outline"
      className={cn("gap-1.5 h-8 bg-white/60 dark:bg-transparent", tintCls[tint])}
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}

// ============================ Utilities ============================
/** Wrap the matched substring of `text` in a <mark> for search highlighting. */
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.trim().toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-emerald-200/80 dark:bg-emerald-500/40 text-inherit rounded px-0.5">
        {text.slice(idx, idx + query.trim().length)}
      </mark>
      {text.slice(idx + query.trim().length)}
    </>
  );
}

/** Build a compact page-number range like 1 … 4 5 [6] 7 8 … 20. */
function getPageRange(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "...", total];
  if (current >= total - 3)
    return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "...", current - 1, current, current + 1, "...", total];
}
