// ============================================================================
// File: src/components/admin/views/DealsView.tsx
// Purpose: Admin panel → "Today's Deals" management.
//          - List deals (title, product, discount %, validity window, status)
//          - Add / edit dialog (title, description, product picker, discount %,
//            start/end date, active toggle, display order)
//          - Delete
// Role: Powers the Admin → Marketing → Today's Deals nav item. The customer
//       home page consumes /api/deals (active-only) to render the deal strip.
// ============================================================================

"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, run } from "../api";
import { PageHeader, StatusBadge, TableSkeleton, EmptyState, ProductThumb } from "../ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Flame, Loader2, Search, X, Calendar } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface DealProduct {
  id: string;
  name: string;
  slug: string;
  mrp: number;
  sellingPrice: number;
  primaryImage?: string | null;
  brand?: { name: string } | null;
}

interface Deal {
  id: string;
  title: string;
  description?: string | null;
  productId?: string | null;
  discountPct: number;
  originalPrice?: number | null;
  dealPrice?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  product?: DealProduct | null;
}

interface DealFormState {
  title: string;
  description: string;
  productId: string | null;
  discountPct: number;
  originalPrice: string;
  dealPrice: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  displayOrder: number;
}

const EMPTY_FORM: DealFormState = {
  title: "",
  description: "",
  productId: null,
  discountPct: 0,
  originalPrice: "",
  dealPrice: "",
  startDate: "",
  endDate: "",
  isActive: true,
  displayOrder: 0,
};

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------
export function DealsView() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-deals"],
    queryFn: () => api.get<{ items: Deal[] }>("/api/admin/deals"),
  });
  const items = data?.items ?? [];

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);
  const [form, setForm] = useState<DealFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(d: Deal) {
    setEditing(d);
    setForm({
      title: d.title,
      description: d.description ?? "",
      productId: d.productId ?? null,
      discountPct: d.discountPct ?? 0,
      originalPrice: d.originalPrice != null ? String(d.originalPrice) : "",
      dealPrice: d.dealPrice != null ? String(d.dealPrice) : "",
      startDate: d.startDate ? new Date(d.startDate).toISOString().slice(0, 10) : "",
      endDate: d.endDate ? new Date(d.endDate).toISOString().slice(0, 10) : "",
      isActive: d.isActive,
      displayOrder: d.displayOrder ?? 0,
    });
    setOpen(true);
  }

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      productId: form.productId || null,
      discountPct: Number(form.discountPct) || 0,
      originalPrice: form.originalPrice === "" ? null : Number(form.originalPrice),
      dealPrice: form.dealPrice === "" ? null : Number(form.dealPrice),
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      isActive: form.isActive,
      displayOrder: Number(form.displayOrder) || 0,
    };
    const r = editing
      ? await run(() => api.patch(`/api/admin/deals/${editing.id}`, payload), {
          success: "Deal updated",
          error: "Update failed",
        })
      : await run(() => api.post("/api/admin/deals", payload), {
          success: "Deal created",
          error: "Create failed",
        });
    setSaving(false);
    if (r) {
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-deals"] });
    }
  }

  async function del(d: Deal) {
    if (!confirm(`Delete deal "${d.title}"? This cannot be undone.`)) return;
    const r = await run(() => api.del(`/api/admin/deals/${d.id}`), {
      success: "Deal deleted",
      error: "Delete failed",
    });
    if (r) qc.invalidateQueries({ queryKey: ["admin-deals"] });
  }

  return (
    <div>
      <PageHeader
        title="Today's Deals"
        description="Promotional deals shown on the customer home page. Link a product, set a discount %, and optionally constrain the validity window."
        actions={
          <Button onClick={openNew} className="gap-1.5">
            <Plus className="size-4" /> Add Deal
          </Button>
        }
      />

      <Card className="admin-card">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4">
              <TableSkeleton rows={6} cols={6} />
            </div>
          ) : !items.length ? (
            <div className="p-4">
              <EmptyState
                title="No deals yet"
                description="Add your first Today's Deal — it will appear on the customer home page strip."
                icon={<Flame className="size-6" />}
                action={
                  <Button onClick={openNew} className="gap-1.5">
                    <Plus className="size-4" /> Add Deal
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              {/* Stat strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 pb-0">
                <Card className="admin-stat-card border-border/50">
                  <CardContent className="p-3">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Total Deals
                    </div>
                    <div className="text-xl font-bold tabular-nums">{items.length}</div>
                  </CardContent>
                </Card>
                <Card className="admin-stat-card border-border/50">
                  <CardContent className="p-3">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Active
                    </div>
                    <div className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {items.filter((d) => d.isActive).length}
                    </div>
                  </CardContent>
                </Card>
                <Card className="admin-stat-card border-border/50">
                  <CardContent className="p-3">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Linked Product
                    </div>
                    <div className="text-xl font-bold tabular-nums">
                      {items.filter((d) => d.productId).length}
                    </div>
                  </CardContent>
                </Card>
                <Card className="admin-stat-card border-border/50">
                  <CardContent className="p-3">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Currently Live
                    </div>
                    <div className="text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
                      {items.filter((d) => isLiveNow(d)).length}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="overflow-x-auto mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Discount</TableHead>
                      <TableHead>Validity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell>
                          <div className="font-medium">{d.title}</div>
                          {d.description && (
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {d.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {d.product ? (
                            <div className="flex items-center gap-2">
                              <ProductThumb
                                image={d.product.primaryImage}
                                name={d.product.name}
                                brand={d.product.brand?.name}
                                size={32}
                              />
                              <div className="min-w-0">
                                <div className="text-sm font-medium truncate max-w-[180px]">
                                  {d.product.name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {d.product.brand?.name ?? "—"}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              No product linked
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-1">
                            <Badge variant="outline" className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 gap-0.5">
                              <Flame className="size-2.5" />
                              {d.discountPct || 0}% OFF
                            </Badge>
                            {d.dealPrice != null && (
                              <div className="text-xs font-semibold text-emerald-600">
                                {formatCurrency(Number(d.dealPrice))}
                              </div>
                            )}
                            {d.originalPrice != null && d.dealPrice != null && (
                              <div className="text-[10px] text-muted-foreground line-through">
                                {formatCurrency(Number(d.originalPrice))}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {d.startDate || d.endDate ? (
                            <div className="flex items-center gap-1">
                              <Calendar className="size-3" />
                              <span>
                                {d.startDate ? formatDate(d.startDate) : "—"}
                                {" → "}
                                {d.endDate ? formatDate(d.endDate) : "∞"}
                              </span>
                            </div>
                          ) : (
                            <span className="italic">Always</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <StatusBadge status={d.isActive ? "active" : "inactive"} />
                            {isLiveNow(d) && (
                              <Badge className="bg-amber-500 text-white hover:bg-amber-500 w-fit gap-1">
                                <span className="size-1.5 rounded-full bg-white animate-pulse" /> Live now
                              </Badge>
                            )}
                            {/* Quick toggle switch */}
                            <Switch
                              checked={d.isActive}
                              onCheckedChange={async (checked) => {
                                const r = await run(
                                  () => api.patch(`/api/admin/deals/${d.id}`, { isActive: checked }),
                                  { success: checked ? "Deal activated" : "Deal deactivated", error: "Update failed", silent: true }
                                );
                                if (r) qc.invalidateQueries({ queryKey: ["admin-deals"] });
                              }}
                              className="scale-75 origin-left"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(d)}
                              title="Edit"
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => del(d)}
                              title="Delete"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Deal" : "New Deal"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the deal details."
                : "Create a new promotional deal for the customer home page."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Summer Sale — 20% off vitamins"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Description (optional)</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Short subtitle shown under the deal title"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Linked Product (optional)</Label>
              <ProductPicker
                value={form.productId}
                onChange={(id) => setForm({ ...form, productId: id })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Discount %</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={form.discountPct}
                onChange={(e) =>
                  setForm({ ...form, discountPct: parseFloat(e.target.value) || 0 })
                }
              />
              <p className="text-[11px] text-muted-foreground">
                Percentage off shown on the deal card.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Deal Price (optional)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.dealPrice}
                onChange={(e) => setForm({ ...form, dealPrice: e.target.value })}
                placeholder="Override price"
              />
              <p className="text-[11px] text-muted-foreground">
                If set, shown as the final price on the deal card.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Start Date (optional)</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>End Date (optional)</Label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Original Price (optional)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.originalPrice}
                onChange={(e) => setForm({ ...form, originalPrice: e.target.value })}
                placeholder="Strike-through price"
              />
              <p className="text-[11px] text-muted-foreground">
                Shown with a line-through next to the deal price.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Display Order</Label>
              <Input
                type="number"
                min="0"
                value={form.displayOrder}
                onChange={(e) =>
                  setForm({ ...form, displayOrder: parseInt(e.target.value) || 0 })
                }
              />
              <p className="text-[11px] text-muted-foreground">
                Lower numbers appear first on the home page.
              </p>
            </div>

            <div className="flex items-center gap-2 sm:col-span-2">
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: v })}
              />
              <Label>Active</Label>
              <span className="text-xs text-muted-foreground ml-2">
                Only active deals appear on the customer home page.
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !form.title.trim()}>
              {saving && <Loader2 className="size-4 mr-1 animate-spin" />}
              {editing ? "Update Deal" : "Create Deal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** True if the deal is active AND within its validity window right now. */
function isLiveNow(d: Deal): boolean {
  if (!d.isActive) return false;
  const now = Date.now();
  if (d.startDate && new Date(d.startDate).getTime() > now) return false;
  if (d.endDate && new Date(d.endDate).getTime() < now) return false;
  return true;
}

// ---------------------------------------------------------------------------
// ProductPicker — debounced search of the admin products API.
// Lets the admin pick a product to link to the deal (optional).
// ---------------------------------------------------------------------------

interface ProductSearchItem {
  id: string;
  name: string;
  sku?: string | null;
  primaryImage?: string | null;
  mrp: number;
  sellingPrice: number;
  brand?: { name: string } | null;
}

function ProductPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Look up the currently-selected product so we can show its name/preview.
  const { data: selected } = useQuery({
    queryKey: ["admin-deal-selected-product", value],
    queryFn: () =>
      value
        ? api
            .get<{ items: ProductSearchItem[] }>(
              `/api/admin/products?search=&page=1&pageSize=1`
            )
            .then((res) => res.items.find((p) => p.id === value) ?? null)
        : Promise.resolve(null),
    enabled: !!value,
  });

  // Debounce the search input.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: results, isFetching } = useQuery({
    queryKey: ["admin-deal-product-search", debounced],
    queryFn: () =>
      api.get<{ items: ProductSearchItem[] }>(
        `/api/admin/products?search=${encodeURIComponent(debounced)}&page=1&pageSize=20`
      ),
    enabled: open && debounced.length > 0,
  });

  // Close dropdown when clicking outside.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function clear() {
    onChange(null);
    setQuery("");
  }

  return (
    <div className="relative" ref={containerRef}>
      {value ? (
        <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 p-2">
          <div className="flex items-center gap-2 min-w-0">
            <ProductThumb
              image={selected?.primaryImage}
              name={selected?.name ?? "Selected"}
              brand={selected?.brand?.name}
              size={32}
            />
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">
                {selected?.name ?? "Selected product"}
              </div>
              <div className="text-xs text-muted-foreground">
                {selected?.brand?.name ?? "—"}
                {selected ? ` · ${formatCurrency(selected.sellingPrice)}` : ""}
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            onClick={clear}
            title="Remove linked product"
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            placeholder="Search product by name, SKU, composition…"
            className="pl-8"
          />
          {isFetching && (
            <Loader2 className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
      )}

      {open && !value && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border bg-background shadow-lg">
          {!debounced ? (
            <div className="p-3 text-xs text-muted-foreground">
              Type to search products…
            </div>
          ) : !results || results.items.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">
              No products found{debounced ? ` for "${debounced}"` : ""}.
            </div>
          ) : (
            results.items.map((p) => (
              <button
                key={p.id}
                type="button"
                className="flex w-full items-center gap-2 border-b border-border/50 p-2 text-left last:border-b-0 hover:bg-muted/50"
                onClick={() => {
                  onChange(p.id);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <ProductThumb
                  image={p.primaryImage}
                  name={p.name}
                  brand={p.brand?.name}
                  size={32}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.brand?.name ?? "—"}
                    {p.sku ? ` · ${p.sku}` : ""}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground shrink-0">
                  {formatCurrency(p.sellingPrice)}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
