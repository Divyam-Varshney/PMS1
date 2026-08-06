// ============================================================================
// File: src/components/admin/views/PrescriptionsView.tsx
// Purpose: Prescriptions list + detail with image viewer + status update.
//          Clean, sober, premium — emerald accent palette (no indigo/blue).
// ============================================================================
"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api, run } from "../api";
import { PageHeader, TableSkeleton, EmptyState, CustomerName, CustomerContact, CustomerDetailBlock } from "../ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  FileImage,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  FileCheck2,
  Loader2,
  Maximize2,
  ChevronRight,
  ChevronLeft,
  Search,
  X,
  SlidersHorizontal,
  Calendar,
  RotateCw,
  Download,
} from "lucide-react";
import { useAdminStore } from "../admin-store";
import { formatDateTime, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

// ------------------------------- Types -------------------------------
type PrescriptionCustomer = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
};

type PrescriptionListItem = {
  id: string;
  requestNumber?: string | null;
  status: string;
  imageCount: number;
  createdAt: string;
  customer: PrescriptionCustomer | null;
};

type PrescriptionDetail = {
  id: string;
  requestNumber?: string | null;
  status: string;
  images: string[];
  notes: string | null;
  adminNotes: string | null;
  createdAt: string;
  convertedOrderId?: string | null;
  customer: PrescriptionCustomer | null;
};

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "under_review", label: "Under Review" },
  { value: "verified", label: "Approved" },
  { value: "converted", label: "Converted" },
  { value: "rejected", label: "Rejected" },
];

const STATUS_BADGE_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50",
  under_review: "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-900/50",
  verified: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50",
  converted: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50",
  rejected: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50",
};

const STATUS_DOT_STYLES: Record<string, string> = {
  pending: "bg-amber-500",
  under_review: "bg-cyan-500",
  verified: "bg-emerald-500",
  converted: "bg-emerald-600",
  rejected: "bg-rose-500",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  under_review: "Under Review",
  verified: "Approved",
  converted: "Converted",
  rejected: "Rejected",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_BADGE_STYLES[status] || "bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-900/40 dark:text-stone-300 dark:border-stone-800";
  const dot = STATUS_DOT_STYLES[status] || "bg-stone-400";
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium border", cls)}>
      <span className={cn("size-1.5 rounded-full", dot)} />
      {STATUS_LABEL[status] || status.replace(/_/g, " ")}
    </Badge>
  );
}

const PAGE_SIZE = 20;

// ===========================================================================
// LIST VIEW
// ===========================================================================
export function PrescriptionsView() {
  const navigate = useAdminStore((s) => s.navigate);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, from, to]);

  const query = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (status !== "all") p.set("status", status);
    if (debouncedSearch.trim()) p.set("search", debouncedSearch.trim());
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return p.toString();
  }, [status, debouncedSearch, from, to, page]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-prescriptions", query],
    queryFn: () =>
      api.get<{ items: PrescriptionListItem[]; total: number; totalPages: number; page: number }>(
        `/api/admin/prescriptions?${query}`
      ),
    refetchInterval: 60_000, // 60s (was 30s — reduced for memory) // Auto-refresh every 30s — preserves filters + pagination
    placeholderData: keepPreviousData, // Smooth transitions when changing pages
  });

  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalItems = data?.total ?? 0;

  const activeFilterCount =
    (status !== "all" ? 1 : 0) +
    (debouncedSearch.trim() ? 1 : 0) +
    (from ? 1 : 0) +
    (to ? 1 : 0);

  function clearAllFilters() {
    setStatus("all");
    setSearch("");
    setDebouncedSearch("");
    setFrom("");
    setTo("");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Prescriptions"
        description="Review prescriptions uploaded by customers."
      />

      {/* Search + filters */}
      <Card className="shadow-sm">
        <CardContent className="pt-5 pb-4 space-y-4">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customer name, phone, request number…"
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

            <div className="flex items-center gap-2 flex-wrap">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-40 h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

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
                  <div className="px-4 pb-6 space-y-4">
                    <DateRangeFilter from={from} setFrom={setFrom} to={to} setTo={setTo} />
                    {activeFilterCount > 0 && (
                      <Button variant="ghost" size="sm" className="w-full" onClick={clearAllFilters}>
                        <X className="size-3 mr-1" /> Clear All Filters
                      </Button>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          {/* Desktop date range */}
          <div className="hidden lg:flex items-end gap-3">
            <DateRangeFilter from={from} setFrom={setFrom} to={to} setTo={setTo} />
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" className="ml-auto h-9" onClick={clearAllFilters}>
                <X className="size-3 mr-1" /> Clear All
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table / cards */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4"><TableSkeleton rows={6} cols={5} /></div>
          ) : items.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No prescriptions found"
                description="Try adjusting your filters or search query."
                icon={<FileImage className="size-6" />}
                action={
                  activeFilterCount > 0 ? (
                    <Button variant="outline" size="sm" onClick={clearAllFilters}>Clear filters</Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Request #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-center">Images</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((p) => (
                      <TableRow
                        key={p.id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => navigate({ name: "prescription-detail", id: p.id })}
                      >
                        <TableCell className="font-mono text-xs">
                          {p.requestNumber || `#${p.id.slice(-8)}`}
                        </TableCell>
                        <TableCell>
                          <CustomerName customer={p.customer} />
                          <CustomerContact customer={p.customer} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="gap-1 bg-muted/50">
                            <FileImage className="size-3" /> {p.imageCount}
                          </Badge>
                        </TableCell>
                        <TableCell><StatusBadge status={p.status} /></TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateTime(p.createdAt)}
                        </TableCell>
                        <TableCell>
                          <ChevronRight className="size-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y">
                {items.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => navigate({ name: "prescription-detail", id: p.id })}
                    className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/40"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      <FileImage className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          <CustomerName customer={p.customer} />
                        </span>
                        <StatusBadge status={p.status} />
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {p.requestNumber || `#${p.id.slice(-8)}`} · {p.imageCount} image(s) · {formatDate(p.createdAt)}
                      </div>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {totalItems > 0 ? (
              <>
                Showing{" "}
                <span className="font-semibold text-foreground">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalItems)}
                </span>{" "}
                of <span className="font-semibold text-foreground">{totalItems}</span>
              </>
            ) : "No prescriptions"}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-9" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="size-4" /> Prev
            </Button>
            <span className="text-xs text-muted-foreground px-2">
              Page <span className="font-semibold text-foreground">{page}</span> / {totalPages}
            </span>
            <Button variant="outline" size="sm" className="h-9" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function DateRangeFilter({
  from,
  setFrom,
  to,
  setTo,
}: {
  from: string;
  setFrom: (v: string) => void;
  to: string;
  setTo: (v: string) => void;
}) {
  return (
    <>
      <div>
        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">From</Label>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10" />
      </div>
      <div>
        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">To</Label>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10" />
      </div>
    </>
  );
}

// ===========================================================================
// DETAIL VIEW
// ===========================================================================
export function PrescriptionDetailView({ id }: { id: string }) {
  const back = useAdminStore((s) => s.back);
  const navigate = useAdminStore((s) => s.navigate);
  const qc = useQueryClient();
  const [adminNotes, setAdminNotes] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Convert-to-order dialog state
  const [convertOpen, setConvertOpen] = useState(false);
  const [lineItems, setLineItems] = useState<Array<{ productId: string; qty: number; name: string; price: number }>>([]);
  const [productSearch, setProductSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [converting, setConverting] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("qr");

  // Fetch active payment methods for the convert dialog dropdown.
  // Dynamic — automatically reflects newly added methods from Admin Settings.
  const { data: paymentMethods } = useQuery({
    queryKey: ["admin", "payment-methods", "active"],
    queryFn: () => api.get<{ items: Array<{ key: string; label: string }> }>("/api/admin/payment-methods"),
    staleTime: 60_000,
  });
  const activePaymentMethods = (paymentMethods?.items || []).filter((m: any) => m.isActive !== false);

  const { data: p, isLoading } = useQuery({
    queryKey: ["admin-prescription", id],
    queryFn: () => api.get<PrescriptionDetail>(`/api/admin/prescriptions/${id}`),
  });

  useEffect(() => {
    if (p && adminNotes === "" && p.adminNotes) setAdminNotes(p.adminNotes);
  }, [p, adminNotes]);

  async function update(status: string) {
    setBusy(true);
    const r = await run(() =>
      api.patch(`/api/admin/prescriptions/${id}`, { status, adminNotes }), {
      success: `Prescription ${STATUS_LABEL[status] || status}`,
      error: "Update failed",
    });
    setBusy(false);
    if (r) qc.invalidateQueries({ queryKey: ["admin-prescription", id] });
  }

  async function searchProducts(q: string) {
    setProductSearch(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await api.get<{ items: any[] }>(
        `/api/admin/products?search=${encodeURIComponent(q)}&pageSize=8`
      );
      setSearchResults(res.items || []);
    } catch { setSearchResults([]); }
    setSearching(false);
  }

  function addProduct(prod: any) {
    if (lineItems.some((li) => li.productId === prod.id)) return;
    setLineItems([...lineItems, { productId: prod.id, qty: 1, name: prod.name, price: prod.sellingPrice }]);
    setProductSearch("");
    setSearchResults([]);
  }

  function removeLineItem(productId: string) {
    setLineItems(lineItems.filter((li) => li.productId !== productId));
  }

  function setLineQty(productId: string, qty: number) {
    setLineItems(lineItems.map((li) => li.productId === productId ? { ...li, qty: Math.max(1, qty) } : li));
  }

  async function convertToOrder() {
    if (lineItems.length === 0) return;
    setConverting(true);
    const r = await run(() =>
      api.post<{ id: string }>(`/api/admin/prescriptions/${id}/convert`, {
        items: lineItems.map((li) => ({ productId: li.productId, qty: li.qty })),
        paymentMethod: selectedPaymentMethod,
      }), {
      success: "Order created from prescription",
      error: "Conversion failed",
    });
    setConverting(false);
    if (r) {
      setConvertOpen(false);
      setLineItems([]);
      qc.invalidateQueries({ queryKey: ["admin-prescription", id] });
      qc.invalidateQueries({ queryKey: ["admin-prescriptions"] });
      navigate({ name: "order-detail", id: r.id });
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={back} className="gap-1.5">
          <ArrowLeft className="size-4" /> Back
        </Button>
        <Card><CardContent className="pt-6 h-48 bg-muted/30 animate-pulse rounded-xl" /></Card>
      </div>
    );
  }
  if (!p) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={back} className="gap-1.5">
          <ArrowLeft className="size-4" /> Back
        </Button>
        <EmptyState title="Prescription not found" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={back} className="gap-1.5">
          <ArrowLeft className="size-4" /> Back
        </Button>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
          Prescription
        </h1>
        <StatusBadge status={p.status} />
        <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground ml-auto">
          <Calendar className="size-3.5" />
          {formatDateTime(p.createdAt)}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Images */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileImage className="size-4 text-emerald-600" /> Prescription Images ({p.images?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {p.images?.length ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {p.images.map((img: string, i: number) => (
                    <button
                      key={i}
                      onClick={() => setLightbox(img)}
                      className="relative group aspect-square rounded-md overflow-hidden border bg-muted/30 hover:border-emerald-400 transition-colors"
                    >
                      <img src={img} alt={`Prescription ${i + 1}`} className="size-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center">
                        <Maximize2 className="size-5 text-white opacity-0 group-hover:opacity-100" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState title="No images attached" />
              )}
            </CardContent>
          </Card>

          {/* Customer Notes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Customer Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground whitespace-pre-wrap min-h-[60px]">{p.notes || "—"}</p>
            </CardContent>
          </Card>
        </div>

        {/* Side column */}
        <div className="space-y-4">
          {/* Customer */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Customer</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <CustomerDetailBlock
                customer={p.customer}
                extra={<div className="text-xs text-muted-foreground mt-2">Submitted: {formatDateTime(p.createdAt)}</div>}
              />
            </CardContent>
          </Card>

          {/* Admin Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Admin Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Admin Notes</Label>
                <Textarea rows={4} value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} placeholder="Internal notes..." />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Button variant="outline" className="text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30" disabled={busy || p.status === "under_review"} onClick={() => update("under_review")}>
                  <CheckCircle2 className="size-4 mr-1" /> Mark Reviewing
                </Button>
                <Button variant="outline" className="text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30" disabled={busy} onClick={() => update("verified")}>
                  <CheckCircle2 className="size-4 mr-1" /> Approve
                </Button>
                <Button variant="outline" className="text-destructive hover:bg-rose-50 dark:hover:bg-rose-950/30" disabled={busy} onClick={() => update("rejected")}>
                  <XCircle className="size-4 mr-1" /> Reject
                </Button>
              </div>
              {p.status === "converted" ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900/50 p-3 text-center text-sm text-emerald-700 dark:text-emerald-300">
                  <FileCheck2 className="mx-auto mb-1 size-5" />
                  Converted to an order
                  {p.convertedOrderId && (
                    <Button
                      variant="link"
                      size="sm"
                      className="mt-1 block h-auto p-0 text-emerald-700 dark:text-emerald-300"
                      onClick={() => navigate({ name: "order-detail", id: p.convertedOrderId! })}
                    >
                      View order →
                    </Button>
                  )}
                </div>
              ) : (
                <Button
                  className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={busy}
                  onClick={() => setConvertOpen(true)}
                >
                  <FileCheck2 className="size-4" /> Create Order from Prescription
                </Button>
              )}
              <p className="text-[11px] text-muted-foreground">
                Add the products from this prescription, then create an order with
                automatic pricing-engine pricing.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Convert-to-order dialog */}
      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Order from Prescription</DialogTitle>
            <DialogDescription>
              Search and add the products mentioned in the prescription. Pricing
              is computed automatically by the discount engine.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Input
                placeholder="Search products by name, composition, SKU..."
                value={productSearch}
                onChange={(e) => searchProducts(e.target.value)}
              />
              {searchResults.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-background shadow-lg">
                  {searchResults.map((prod) => (
                    <button
                      key={prod.id}
                      onClick={() => addProduct(prod)}
                      className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{prod.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {prod.brand?.name} · Rs. {prod.sellingPrice}
                        </p>
                      </div>
                      <span className="ml-2 shrink-0 text-xs text-primary">+ Add</span>
                    </button>
                  ))}
                </div>
              )}
              {searching && <p className="mt-1 text-xs text-muted-foreground">Searching...</p>}
            </div>

            {lineItems.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                No products added yet. Search above to add medicines from the prescription.
              </div>
            ) : (
              <div className="space-y-2">
                {lineItems.map((li) => (
                  <div key={li.productId} className="flex items-center gap-2 rounded-md border p-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{li.name}</p>
                      <p className="text-xs text-muted-foreground">Rs. {li.price}</p>
                    </div>
                    <Input
                      type="number"
                      min={1}
                      value={li.qty}
                      onChange={(e) => setLineQty(li.productId, parseInt(e.target.value) || 1)}
                      className="h-8 w-16 text-center"
                    />
                    <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => removeLineItem(li.productId)}>
                      <XCircle className="size-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex justify-between border-t pt-2 text-sm font-semibold">
                  <span>{lineItems.length} item(s)</span>
                  <span>Rs. {lineItems.reduce((s, li) => s + li.price * li.qty, 0).toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Payment Method Selector — defaults to QR Code Payment */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Payment Method</label>
              <select
                value={selectedPaymentMethod}
                onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                {activePaymentMethods.length > 0 ? (
                  activePaymentMethods.map((m: any) => (
                    <option key={m.key} value={m.key}>{m.label}</option>
                  ))
                ) : (
                  <>
                    <option value="qr">QR Code Payment</option>
                    <option value="cod">Cash on Delivery</option>
                    <option value="upi">UPI Payment</option>
                    <option value="razorpay">Razorpay</option>
                  </>
                )}
              </select>
              <p className="text-xs text-muted-foreground">
                The selected payment method will be saved on the order and displayed everywhere (invoice, customer portal, email).
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertOpen(false)}>Cancel</Button>
            <Button
              disabled={lineItems.length === 0 || converting}
              onClick={convertToOrder}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {converting ? <Loader2 className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />}
              Create Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      {lightbox && (
        <Dialog open onOpenChange={(o) => !o && setLightbox(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Prescription Image</DialogTitle>
              <DialogDescription>Zoom in for verification.</DialogDescription>
            </DialogHeader>
            <img src={lightbox} alt="Prescription" className="w-full max-h-[70vh] object-contain rounded-md" />
            <DialogFooter>
              <a href={lightbox} download>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Download className="size-4" /> Download
                </Button>
              </a>
              <Button variant="outline" size="sm" onClick={() => setLightbox(null)} className="gap-1.5">
                <RotateCw className="size-4" /> Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
