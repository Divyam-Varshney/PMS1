// ============================================================================
// File: src/components/admin/views/ProductsView.tsx
// Purpose: Product list — redesigned with stats row, enhanced filters, bulk
//          actions, better pagination, and CSV import/export. Includes:
//          - 4 stat cards (total, active, out of stock, low stock)
//          - search + category + brand + status + stock + sort filters
//          - bulk select / delete / export / status change
//          - "Showing X-Y of Z" pagination
// ============================================================================

"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, run } from "../api";
import {
  PageHeader,
  StatusBadge,
  ProductThumb,
  TableSkeleton,
  EmptyState,
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
  Plus, Search, Pencil, AlertTriangle, Package,
  Download, Upload, Trash2, Loader2, CheckCircle2,
  Boxes, PackageX, Archive, Eye, EyeOff,
  LayoutGrid, List, Copy,
} from "lucide-react";
import { useAdminStore } from "../admin-store";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Stat card — small KPI tile with icon + label + value
// ---------------------------------------------------------------------------
function StatCard({
  icon,
  label,
  value,
  tone = "default",
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "default" | "amber" | "rose" | "emerald";
  loading?: boolean;
}) {
  const toneCls = {
    default: "bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary",
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  }[tone];
  return (
    <Card className="p-0 admin-stat-card">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${toneCls}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground truncate">{label}</div>
          <div className="text-xl font-semibold leading-tight tabular-nums">
            {loading ? <span className="text-muted-foreground">—</span> : value}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Products view
// ---------------------------------------------------------------------------

export function ProductsView() {
  const navigate = useAdminStore((s) => s.navigate);
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // One-shot pre-fill from the dashboard's Inventory Alerts "View all"
  // deep link. Read on mount, then clear so manual navigation is unaffected.
  const presetStockFilter = useAdminStore((s) => s.productsStockFilter);
  const setProductsStockFilter = useAdminStore((s) => s.setProductsStockFilter);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [brandId, setBrandId] = useState("all");
  const [stock, setStock] = useState<"all" | "low" | "out">("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "name" | "price" | "stock">("newest");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkStatusUpdating, setBulkStatusUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  // F2: Quick stock adjustment state
  const [, setEditingStockId] = useState<string | null>(null);
  const [, setStockInput] = useState("");
  const pageSize = 20;

  // Apply (and clear) the deep-link pre-fill once on mount.
  useEffect(() => {
    if (presetStockFilter && presetStockFilter !== "all") {
      setStock(presetStockFilter);
      setProductsStockFilter("all");
    }
  }, [presetStockFilter, setProductsStockFilter]);

  const queryParams = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search.trim()) p.set("search", search.trim());
    if (status !== "all") p.set("status", status);
    if (categoryId !== "all") p.set("categoryId", categoryId);
    if (brandId !== "all") p.set("brandId", brandId);
    if (stock !== "all") p.set("stock", stock);
    // Map frontend sort values to API sort values
    const sortMap: Record<string, string> = {
      newest: "newest",
      oldest: "oldest",
      name: "name",
      price: "price-asc",
      stock: "stock",
    };
    p.set("sort", sortMap[sort] || "newest");
    return p.toString();
  }, [search, status, categoryId, brandId, stock, sort, page]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-products", "list", queryParams],
    queryFn: () =>
      api.get<{
        items: Array<any>;
        total: number;
        totalPages: number;
        page: number;
      }>(`/api/admin/products?${queryParams}`),
  });

  const { data: categories } = useQuery({
    queryKey: ["admin-categories-all"],
    queryFn: () => api.get<any[]>("/api/admin/categories"),
  });

  const { data: brands } = useQuery({
    queryKey: ["admin-brands-all"],
    queryFn: () => api.get<any[]>("/api/admin/brands"),
  });

  // ---- Stats (4 lightweight count queries — pageSize=1 means we only care
  // about the `total` field, not the items array) ----
  const statsParams = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ page: "1", pageSize: "1" });
    Object.entries(extra).forEach(([k, v]) => p.set(k, v));
    return p.toString();
  };
  const { data: totalData, isLoading: totalLoading } = useQuery({
    queryKey: ["admin-products", "stats", "total"],
    queryFn: () => api.get<{ total: number }>(`/api/admin/products?${statsParams({})}`),
  });
  const { data: activeData, isLoading: activeLoading } = useQuery({
    queryKey: ["admin-products", "stats", "active"],
    queryFn: () => api.get<{ total: number }>(`/api/admin/products?${statsParams({ status: "active" })}`),
  });
  const { data: outData, isLoading: outLoading } = useQuery({
    queryKey: ["admin-products", "stats", "out"],
    queryFn: () => api.get<{ total: number }>(`/api/admin/products?${statsParams({ stock: "out" })}`),
  });
  const { data: lowData, isLoading: lowLoading } = useQuery({
    queryKey: ["admin-products", "stats", "low"],
    queryFn: () => api.get<{ total: number }>(`/api/admin/products?${statsParams({ stock: "low" })}`),
  });

  // ---- Items from API (server-side sort) ----
  // Sort is now handled server-side for correct pagination across all pages.
  const sortedItems = data?.items ?? [];

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    qc.invalidateQueries({ queryKey: ["admin-products", "list"] });
  }

  function resetFilters() {
    setSearch("");
    setStatus("all");
    setCategoryId("all");
    setBrandId("all");
    setStock("all");
    setSort("newest");
    setPage(1);
  }

  // ---- Selection helpers ----
  const allOnPageSelected = sortedItems.length > 0 && sortedItems.every((p) => selected.has(p.id));
  function toggleAll() {
    const next = new Set(selected);
    if (allOnPageSelected) {
      sortedItems.forEach((p) => next.delete(p.id));
    } else {
      sortedItems.forEach((p) => next.add(p.id));
    }
    setSelected(next);
  }
  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }
  function clearSelection() { setSelected(new Set()); }

  // ---- Export (all or selected) ----
  function exportProducts(selectedOnly = false) {
    const url = selectedOnly && selected.size > 0
      ? `/api/admin/products/export?ids=${Array.from(selected).join(",")}`
      : "/api/admin/products/export";
    const a = document.createElement("a");
    a.href = url;
    a.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success(selectedOnly ? `Exporting ${selected.size} selected products` : "Exporting all products");
  }

  // ---- Import ----
  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/products/import", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Import failed");
      const { created, updated, errors } = json.data;
      toast.success(`Import complete: ${created} created, ${updated} updated${errors.length ? `, ${errors.length} errors` : ""}`);
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Import failed");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // ---- Bulk delete ----
  async function bulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected product(s)? Products with orders will be deactivated.`)) return;
    setBulkDeleting(true);
    const r = await run(
      () => api.post<{ deleted: number; softDeleted: number }>("/api/admin/products/bulk", { ids: Array.from(selected) }),
      { success: "Selected products processed", error: "Bulk delete failed", silent: true }
    );
    setBulkDeleting(false);
    if (r) {
      toast.success(`${r.deleted} deleted, ${r.softDeleted} deactivated`);
      clearSelection();
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    }
  }

  // ---- Bulk status change (client-side parallel PUTs) ----
  async function bulkStatusChange(newStatus: "active" | "inactive" | "draft") {
    if (selected.size === 0) return;
    if (!confirm(`Set ${selected.size} product(s) to "${newStatus}"?`)) return;
    setBulkStatusUpdating(true);
    const ids = Array.from(selected);
    const results = await Promise.allSettled(
      ids.map((id) => api.put(`/api/admin/products/${id}`, { status: newStatus }))
    );
    const okCount = results.filter((r) => r.status === "fulfilled").length;
    const failCount = results.length - okCount;
    setBulkStatusUpdating(false);
    if (failCount === 0) {
      toast.success(`${okCount} product(s) set to "${newStatus}"`);
    } else {
      toast.error(`${okCount} updated, ${failCount} failed`);
    }
    clearSelection();
    qc.invalidateQueries({ queryKey: ["admin-products"] });
  }

  // ---- Single-row delete ----
  async function deleteOne(p: any, e: React.MouseEvent) {
    e.stopPropagation();
    const isTrashed = p.status === "trashed";
    const message = isTrashed
      ? `Permanently delete "${p.name}"? This cannot be undone.`
      : `Move "${p.name}" to trash? You can restore it later from the Trashed filter.`;
    if (!confirm(message)) return;
    setDeletingId(p.id);
    const endpoint = isTrashed
      ? `/api/admin/products/${p.id}?permanent=true`
      : `/api/admin/products/${p.id}`;
    const r = await run(
      () => api.del<{ trashed?: boolean; deleted?: boolean }>(endpoint),
      { success: "Product processed", error: "Delete failed", silent: true }
    );
    setDeletingId(null);
    if (r) {
      if (r.deleted) toast.success("Product permanently deleted");
      else if (r.trashed) toast.success("Product moved to trash. Use Trashed filter to restore.");
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    }
  }

  // D5: Duplicate product — clones all fields with "(Copy)" suffix, opens editor
  async function duplicateProduct(p: any, e: React.MouseEvent) {
    e.stopPropagation();
    setDuplicatingId(p.id);
    try {
      const r = await run(
        () => api.post("/api/admin/products", {
          name: `${p.name} (Copy)`,
          slug: `${p.slug}-copy-${Date.now().toString(36)}`,
          sku: p.sku ? `${p.sku}-COPY` : null,
          shortDescription: p.shortDescription,
          description: p.description,
          composition: p.composition,
          genericName: p.genericName,
          manufacturer: p.manufacturer,
          hsnCode: p.hsnCode,
          prescriptionRequired: p.prescriptionRequired,
          isGeneric: p.isGeneric,
          brandId: p.brandId,
          categoryId: p.categoryId,
          unit: p.unit,
          packSize: p.packSize,
          mrp: p.mrp,
          sellingPrice: p.sellingPrice,
          baseDiscountPct: p.baseDiscountPct,
          maxDiscountPct: p.maxDiscountPct,
          costPrice: p.costPrice,
          stock: 0, // Start at 0 — admin should set stock manually
          lowStockThreshold: p.lowStockThreshold,
          primaryImage: p.primaryImage,
          galleryImages: p.galleryImages,
          isFeatured: false, // Don't auto-feature duplicates
          isBestSeller: false,
          isTrending: false,
          status: "draft", // Start as draft
          visibility: p.visibility,
        }),
        { success: "Product duplicated", error: "Duplicate failed", silent: true }
      );
      if (r) {
        toast.success("Product duplicated as draft");
        qc.invalidateQueries({ queryKey: ["admin-products"] });
        navigate({ name: "product-edit", id: r.id });
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to duplicate product");
    }
    setDuplicatingId(null);
  }

  // ---- Pagination display ----
  const total = data?.total ?? 0;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div>
      <PageHeader
        title="Products"
        description="Manage your medicine catalog — inventory, pricing, and visibility."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={onImportFile}
              className="hidden"
            />
            <Button variant="outline" size="sm" className="gap-1.5" disabled={importing} onClick={() => fileInputRef.current?.click()}>
              {importing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              Import CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportProducts(false)}>
              <Download className="size-4" /> Export All
            </Button>
            {/* F1: Grid/Table view toggle */}
            <div className="inline-flex items-center rounded-lg border bg-muted/30 p-0.5">
              <button
                onClick={() => setViewMode("table")}
                className={`px-2.5 py-1 text-xs rounded-md transition-all ${viewMode === "table" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
              >
                <List className="size-3.5 inline" /> Table
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`px-2.5 py-1 text-xs rounded-md transition-all ${viewMode === "grid" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
              >
                <LayoutGrid className="size-3.5 inline" /> Grid
              </button>
            </div>
            <Button onClick={() => navigate({ name: "product-edit" })}>
              <Plus className="size-4 mr-1" /> Add Product
            </Button>
          </div>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard
          icon={<Boxes className="size-5" />}
          label="Total Products"
          value={totalData?.total ?? 0}
          loading={totalLoading}
        />
        <StatCard
          icon={<CheckCircle2 className="size-5" />}
          label="Active"
          value={activeData?.total ?? 0}
          tone="emerald"
          loading={activeLoading}
        />
        <StatCard
          icon={<PackageX className="size-5" />}
          label="Out of Stock"
          value={outData?.total ?? 0}
          tone="rose"
          loading={outLoading}
        />
        <StatCard
          icon={<AlertTriangle className="size-5" />}
          label="Low Stock"
          value={lowData?.total ?? 0}
          tone="amber"
          loading={lowLoading}
        />
      </div>

      {/* Bulk action bar — shows when products are selected */}
      {selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 admin-bulk-bar p-3">
          <Badge variant="secondary" className="bg-primary/15 text-primary font-semibold">
            {selected.size} selected
          </Badge>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 btn-premium bg-background/60"
            disabled={bulkStatusUpdating}
            onClick={() => bulkStatusChange("active")}
          >
            <CheckCircle2 className="size-3.5" /> Set Active
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 btn-premium bg-background/60"
            disabled={bulkStatusUpdating}
            onClick={() => bulkStatusChange("inactive")}
          >
            <Archive className="size-3.5" /> Set Inactive
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 btn-premium bg-background/60" onClick={() => exportProducts(true)}>
            <Download className="size-3.5" /> Export Selected
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive btn-premium bg-background/60"
            disabled={bulkDeleting}
            onClick={bulkDelete}
          >
            {bulkDeleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            Delete Selected
          </Button>
          <Button size="sm" variant="ghost" onClick={clearSelection} className="ml-auto">Clear</Button>
        </div>
      )}

      {/* Filters */}
      <Card className="mb-4 admin-card">
        <CardContent className="pt-4 pb-4">
          <form
            onSubmit={onSearchSubmit}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3"
          >
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, SKU, generic, composition..."
                className="pl-9 admin-search h-9 focus-visible:ring-1 focus-visible:ring-primary/30"
              />
            </div>
            <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setPage(1); }}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {(categories || []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={brandId} onValueChange={(v) => { setBrandId(v); setPage(1); }}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Brand" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brands</SelectItem>
                {(brands || []).map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
            <Select value={stock} onValueChange={(v) => { setStock(v as "all" | "low" | "out"); setPage(1); }}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Stock" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stock</SelectItem>
                <SelectItem value="low">Low Stock</SelectItem>
                <SelectItem value="out">Out of Stock</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2 lg:col-span-6">
              <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
                <SelectTrigger className="w-full sm:w-52 h-9"><SelectValue placeholder="Sort by" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="name">Name (A-Z)</SelectItem>
                  <SelectItem value="price">Price (Low to High)</SelectItem>
                  <SelectItem value="stock">Stock (Low to High)</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" variant="secondary" className="btn-premium">Apply</Button>
              <Button type="button" variant="ghost" onClick={resetFilters}>Reset</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="admin-card">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4"><TableSkeleton rows={8} cols={8} /></div>
          ) : !data?.items?.length ? (
            <div className="p-4">
              <EmptyState
                title="No products found"
                description="Try adjusting your filters or add a new product."
                icon={<Package className="size-6" />}
                action={
                  <Button onClick={() => navigate({ name: "product-edit" })} className="btn-premium">
                    <Plus className="size-4 mr-1" /> Add Product
                  </Button>
                }
              />
            </div>
          ) : viewMode === "grid" ? (
            /* F1: Grid view — product cards instead of table rows */
            <div className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {sortedItems.map((p) => (
                  <div
                    key={p.id}
                    className="group cursor-pointer rounded-lg border border-border/70 bg-card p-3 transition-premium hover:shadow-premium hover:-translate-y-0.5 hover:border-primary/30"
                    onClick={() => navigate({ name: "product-edit", id: p.id })}
                  >
                    <div className="relative aspect-square mb-2 overflow-hidden rounded-md bg-muted/30 img-zoom-premium">
                      <ProductThumb product={p} />
                      {p.stock <= 0 && (
                        <Badge className="absolute top-1 left-1 bg-rose-500 text-white text-[9px] badge-premium">Out</Badge>
                      )}
                      {p.stock > 0 && p.stock <= (p.lowStockThreshold || 10) && (
                        <Badge className="absolute top-1 left-1 bg-amber-500 text-white text-[9px] badge-premium">Low</Badge>
                      )}
                    </div>
                    <p className="text-xs font-medium line-clamp-2 mb-1">{p.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.brand?.name || "—"}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(p.sellingPrice)}</span>
                      <span className="text-[10px] text-muted-foreground">Stock: {p.stock}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t mt-4 pt-3 text-sm">
                <span className="text-muted-foreground text-xs">
                  {total === 0 ? "No products" : `Showing ${from}–${to} of ${total}`}
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
                  <span className="text-xs text-muted-foreground px-2">Page {page} of {data?.totalPages || 1}</span>
                  <Button variant="outline" size="sm" disabled={page >= (data?.totalPages || 1)} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* Product count summary — visible vs. total. Especially useful
                  when filters are active (e.g. "Showing 5 of 50 products"). */}
              <div className="flex items-center justify-between border-b border-border/70 bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
                <span>
                  Showing <span className="font-semibold text-foreground">{sortedItems.length}</span> of{" "}
                  <span className="font-semibold text-foreground">{total}</span> product{total !== 1 ? "s" : ""}
                  {selected.size > 0 && (
                    <span className="ml-2 text-primary font-medium">· {selected.size} selected</span>
                  )}
                </span>
                <span className="hidden sm:inline">
                  Page {page} of {data?.totalPages || 1}
                </span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-border/70 hover:bg-transparent">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allOnPageSelected}
                        onCheckedChange={toggleAll}
                        aria-label="Select all on page"
                      />
                    </TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Discount %</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead>Stock Status</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Visibility</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedItems.map((p) => {
                    const low = p.stock <= p.lowStockThreshold;
                    const out = p.stock === 0;
                    const isSelected = selected.has(p.id);
                    // Effective discount % shown to customers — derived from
                    // MRP/sellingPrice when set, otherwise falls back to the
                    // admin-curated baseDiscountPct field on the product.
                    const effDiscountPct =
                      Number(p.mrp) > 0 && Number(p.mrp) > Number(p.sellingPrice)
                        ? Math.round(((Number(p.mrp) - Number(p.sellingPrice)) / Number(p.mrp)) * 1000) / 10
                        : Math.round(Number(p.baseDiscountPct) || 0);
                    const isPublic = p.visibility !== "hidden";
                    return (
                      <TableRow
                        key={p.id}
                        className={`${isSelected ? "bg-primary/5" : "cursor-pointer admin-table-row"} border-border/60`}
                        onClick={() => navigate({ name: "product-edit", id: p.id })}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleOne(p.id)}
                            aria-label={`Select ${p.name}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <ProductThumb image={p.primaryImage} name={p.name} brand={p.brand?.name} size={40} />
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate max-w-[240px]">{p.name}</div>
                              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                                {p.brand?.name || "No brand"}
                                {p.isGeneric && (
                                  <span className="text-primary font-medium">· GENERIC</span>
                                )}
                                {p.sku && (
                                  <span className="font-mono">· {p.sku}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {p.category?.name || <span className="text-muted-foreground italic">—</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end leading-tight">
                            <span className="text-sm font-semibold tabular-nums">
                              {formatCurrency(p.sellingPrice)}
                            </span>
                            {Number(p.mrp) > Number(p.sellingPrice) && (
                              <span className="text-[11px] text-muted-foreground line-through">
                                {formatCurrency(p.mrp)}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {effDiscountPct > 0 ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-50 text-emerald-700 border-emerald-200 admin-badge-emerald font-medium"
                            >
                              {effDiscountPct}%
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span
                              className={`text-sm font-medium tabular-nums ${
                                out ? "text-rose-600 dark:text-rose-400" : low ? "text-amber-600 dark:text-amber-400" : ""
                              }`}
                            >
                              {p.stock}
                            </span>
                            {out ? (
                              <PackageX className="size-3.5 text-rose-500" />
                            ) : low ? (
                              <AlertTriangle className="size-3.5 text-amber-500" />
                            ) : null}
                            {/* F2: Quick stock adjustment button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingStockId(p.id);
                                setStockInput(String(p.stock));
                              }}
                              className="ml-1 text-muted-foreground/50 hover:text-primary transition-colors"
                              title="Adjust stock"
                            >
                              <Pencil className="size-3" />
                            </button>
                          </div>
                        </TableCell>
                        <TableCell>
                          {out ? (
                            <Badge
                              variant="outline"
                              className="gap-1 border-rose-200 bg-rose-50 text-rose-700 admin-badge-rose"
                            >
                              <span className="size-1.5 rounded-full bg-rose-500" />
                              Out of Stock
                            </Badge>
                          ) : low ? (
                            <Badge
                              variant="outline"
                              className="gap-1 border-amber-200 bg-amber-50 text-amber-700 admin-badge-amber"
                            >
                              <span className="size-1.5 rounded-full bg-amber-500" />
                              Low Stock
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 admin-badge-emerald"
                            >
                              <span className="size-1.5 rounded-full bg-emerald-500" />
                              In Stock
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell><StatusBadge status={p.status} /></TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={isPublic
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 admin-badge-emerald"
                              : "bg-stone-100 text-stone-600 border-stone-200 admin-badge-stone"}
                          >
                            {isPublic ? <Eye className="size-3 mr-1" /> : <EyeOff className="size-3 mr-1" />}
                            {isPublic ? "Public" : "Hidden"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate({ name: "product-edit", id: p.id });
                              }}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            {/* D5: Duplicate product button */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-primary"
                              title="Duplicate product"
                              disabled={duplicatingId === p.id}
                              onClick={(e) => duplicateProduct(p, e)}
                            >
                              {duplicatingId === p.id
                                ? <Loader2 className="size-4 animate-spin" />
                                : <Copy className="size-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:bg-destructive/5"
                              disabled={deletingId === p.id}
                              onClick={(e) => deleteOne(p, e)}
                            >
                              {deletingId === p.id
                                ? <Loader2 className="size-4 animate-spin" />
                                : <Trash2 className="size-4" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-border/70 px-4 py-3 text-sm">
                <span className="text-muted-foreground">
                  {total === 0
                    ? "No products"
                    : `Showing ${from}–${to} of ${total} product${total !== 1 ? "s" : ""}`}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground px-2">
                    Page {page} of {data?.totalPages || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= (data?.totalPages || 1)}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
