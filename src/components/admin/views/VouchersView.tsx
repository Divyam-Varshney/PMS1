// ============================================================================
// File: src/components/admin/views/VouchersView.tsx
// Purpose: Voucher management — flat-amount deductions scoped to cart,
//          specific products, or specific categories. Replaces the legacy
//          Coupons + Discount Rules views.
// ============================================================================

"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, run } from "../api";
import { PageHeader, StatusBadge, TableSkeleton, EmptyState } from "../ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Ticket, Plus, Pencil, Trash2, Loader2, Search } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VoucherScope = "cart" | "product" | "category";

interface Voucher {
  id: string;
  code: string;
  description?: string | null;
  amount: number;
  scope: VoucherScope;
  targetIds?: string | null; // JSON string of id array
  minOrder: number;
  maxRedemptions: number;
  usedCount: number;
  perCustomerLimit: number;
  validFrom: string;
  validTo?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { usages: number };
}

interface ProductListItem {
  id: string;
  name: string;
  sku?: string | null;
  brand?: { id: string; name: string } | null;
}

interface Category {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseTargetIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function toDateInput(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  // yyyy-mm-dd in local time
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const SCOPE_LABEL: Record<VoucherScope, string> = {
  cart: "Cart-wide",
  product: "Specific Products",
  category: "Specific Categories",
};

const SCOPE_BADGE_STYLE: Record<VoucherScope, string> = {
  cart: "bg-emerald-100 text-emerald-800 border-emerald-200 admin-badge-emerald",
  product: "bg-amber-100 text-amber-800 border-amber-200 admin-badge-amber",
  category: "bg-teal-100 text-teal-800 border-teal-200 admin-badge-teal",
};

// ---------------------------------------------------------------------------
// Empty form template
// ---------------------------------------------------------------------------

const EMPTY = {
  code: "",
  description: "",
  amount: 0,
  scope: "cart" as VoucherScope,
  targetIds: [] as string[],
  minOrder: 0,
  maxRedemptions: 0,
  perCustomerLimit: 0,
  validFrom: toDateInput(new Date()),
  validTo: "",
  isActive: true,
};

// ---------------------------------------------------------------------------
// Multi-select picker (search + checkbox list). Used for both products and
// categories. We keep it intentionally lightweight (no command-popover).
// ---------------------------------------------------------------------------

function MultiSelectList({
  items,
  selected,
  onToggle,
  placeholder,
  emptyText,
  getLabel,
}: {
  items: { id: string; name: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  placeholder: string;
  emptyText: string;
  getLabel?: (item: { id: string; name: string }) => string;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => (getLabel ? getLabel(i) : i.name).toLowerCase().includes(q));
  }, [items, search, getLabel]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder}
          className="h-8 pl-8 text-sm"
        />
      </div>
      <div className="border rounded-md max-h-56 overflow-y-auto divide-y divide-border">
        {filtered.length === 0 ? (
          <div className="p-3 text-xs text-muted-foreground text-center">{emptyText}</div>
        ) : (
          filtered.map((item) => {
            const checked = selected.includes(item.id);
            return (
              <label
                key={item.id}
                className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-muted/40"
              >
                <Checkbox checked={checked} onCheckedChange={() => onToggle(item.id)} />
                <span className="text-sm truncate">{getLabel ? getLabel(item) : item.name}</span>
              </label>
            );
          })
        )}
      </div>
      <p className="text-xs text-muted-foreground">{selected.length} selected</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function VouchersView() {
  const qc = useQueryClient();
  const { data: vouchers, isLoading } = useQuery({
    queryKey: ["admin-vouchers"],
    queryFn: () => api.get<Voucher[]>("/api/admin/vouchers"),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Voucher | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);

  // Products list for scope=product multi-select. Page size 100 caps at API.
  // Lazy: only fetch when the dialog is open with scope=product.
  const { data: productsPage } = useQuery({
    queryKey: ["admin-products", "vouchers-picker", { pageSize: 100 }],
    queryFn: () =>
      api.get<{ items: ProductListItem[]; total: number }>(
        "/api/admin/products?pageSize=100&status=active"
      ),
    enabled: open && form.scope === "product",
  });

  const { data: categories } = useQuery({
    queryKey: ["admin-categories-all"],
    queryFn: () => api.get<Category[]>("/api/admin/categories"),
    enabled: open && form.scope === "category",
  });

  function openNew() {
    setEditing(null);
    setForm({ ...EMPTY, validFrom: toDateInput(new Date()) });
    setOpen(true);
  }

  function openEdit(v: Voucher) {
    setEditing(v);
    setForm({
      code: v.code,
      description: v.description || "",
      amount: v.amount,
      scope: v.scope,
      targetIds: parseTargetIds(v.targetIds),
      minOrder: v.minOrder,
      maxRedemptions: v.maxRedemptions,
      perCustomerLimit: v.perCustomerLimit,
      validFrom: toDateInput(v.validFrom),
      validTo: toDateInput(v.validTo),
      isActive: v.isActive,
    });
    setOpen(true);
  }

  function set<K extends keyof typeof form>(k: K, v: any) {
    setForm((f: any) => ({ ...f, [k]: v }));
  }

  function toggleTarget(id: string) {
    setForm((f: any) => {
      const has = f.targetIds.includes(id);
      return {
        ...f,
        targetIds: has ? f.targetIds.filter((x: string) => x !== id) : [...f.targetIds, id],
      };
    });
  }

  function onScopeChange(v: string) {
    const scope = v as VoucherScope;
    set("scope", scope);
    // When leaving a scoped mode, clear stale targetIds so we don't submit
    // ids for the wrong entity type. The useQuery `enabled` flags above take
    // care of fetching products/categories on demand when scope changes.
    if (scope === "cart") set("targetIds", []);
  }

  async function save() {
    if (!form.code.trim()) {
      toast.error("Voucher code is required");
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error("Voucher amount must be greater than 0");
      return;
    }
    if (form.scope !== "cart" && form.targetIds.length === 0) {
      toast.error(`Select at least one ${form.scope} for this voucher`);
      return;
    }
    if (form.validTo && form.validFrom && form.validTo < form.validFrom) {
      toast.error("validTo must be on or after validFrom");
      return;
    }

    setSaving(true);
    const payload = {
      code: form.code.toUpperCase().trim(),
      description: form.description?.trim() || null,
      amount: Number(form.amount),
      scope: form.scope,
      targetIds: form.scope === "cart" ? [] : form.targetIds,
      minOrder: Number(form.minOrder) || 0,
      maxRedemptions: Number(form.maxRedemptions) || 0,
      perCustomerLimit: Number(form.perCustomerLimit) || 0,
      validFrom: form.validFrom || new Date().toISOString(),
      validTo: form.validTo || null,
      isActive: form.isActive,
    };
    const r = editing
      ? await run(() => api.patch(`/api/admin/vouchers/${editing.id}`, payload), {
          success: "Voucher updated",
          error: "Update failed",
        })
      : await run(() => api.post("/api/admin/vouchers", payload), {
          success: "Voucher created",
          error: "Create failed",
        });
    setSaving(false);
    if (r) {
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-vouchers"] });
    }
  }

  async function del(v: Voucher) {
    if (!confirm(`Delete voucher "${v.code}"? This cannot be undone.`)) return;
    const r = await run(() => api.del(`/api/admin/vouchers/${v.id}`), {
      success: "Voucher deleted",
      error: "Delete failed",
    });
    if (r) qc.invalidateQueries({ queryKey: ["admin-vouchers"] });
  }

  // Build lookups for label resolution in the table & multi-select
  const productLabel = useMemo(() => {
    const m = new Map<string, string>();
    (productsPage?.items || []).forEach((p) => {
      m.set(p.id, p.brand ? `${p.name} — ${p.brand.name}` : p.name);
    });
    return m;
  }, [productsPage]);
  const productName = useMemo(() => {
    const m = new Map<string, string>();
    (productsPage?.items || []).forEach((p) => m.set(p.id, p.name));
    return m;
  }, [productsPage]);

  return (
    <div>
      <PageHeader
        title="Vouchers"
        description="Flat-amount deductions applied at checkout. Scoped to cart, products, or categories."
        actions={
          <Button onClick={openNew}>
            <Plus className="size-4 mr-1" /> Add Voucher
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4"><TableSkeleton rows={5} cols={7} /></div>
          ) : !vouchers?.length ? (
            <div className="p-4">
              <EmptyState
                title="No vouchers yet"
                description="Create a flat-amount voucher code that customers can apply at checkout."
                icon={<Ticket className="size-6" />}
                action={
                  <Button onClick={openNew}>
                    <Plus className="size-4 mr-1" /> Add Voucher
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead className="text-right">Min Order</TableHead>
                    <TableHead className="text-right">Usage</TableHead>
                    <TableHead>Validity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vouchers.map((v) => {
                    const targets = parseTargetIds(v.targetIds);
                    let scopeDetail = "";
                    if (v.scope === "product") {
                      const known = targets
                        .map((id) => productName.get(id))
                        .filter(Boolean) as string[];
                      scopeDetail =
                        known.length > 0
                          ? `${targets.length} product${targets.length > 1 ? "s" : ""}`
                          : `${targets.length} selected`;
                    } else if (v.scope === "category") {
                      scopeDetail = `${targets.length} categor${targets.length > 1 ? "ies" : "y"}`;
                    }
                    return (
                      <TableRow key={v.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-mono font-semibold text-sm tracking-wide">
                              {v.code}
                            </span>
                            {v.description && (
                              <span className="text-xs text-muted-foreground truncate max-w-[260px]">
                                {v.description}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {formatCurrency(v.amount)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 items-start">
                            <Badge variant="outline" className={SCOPE_BADGE_STYLE[v.scope]}>
                              {SCOPE_LABEL[v.scope]}
                            </Badge>
                            {scopeDetail && (
                              <span className="text-xs text-muted-foreground">{scopeDetail}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {v.minOrder > 0 ? formatCurrency(v.minOrder) : "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          <span className="font-medium">{v.usedCount}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            / {v.maxRedemptions > 0 ? v.maxRedemptions : "∞"}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <div>{formatDate(v.validFrom)}</div>
                          <div>
                            {v.validTo ? `→ ${formatDate(v.validTo)}` : "→ no end"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={v.isActive ? "active" : "inactive"} />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(v)}>
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => del(v)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Voucher" : "New Voucher"}</DialogTitle>
            <DialogDescription>
              Flat-amount deduction. The amount is subtracted from the eligible subtotal — never
              goes negative.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Code</Label>
                <Input
                  value={form.code}
                  onChange={(e) => set("code", e.target.value.toUpperCase())}
                  placeholder="SAVE100"
                  className="font-mono uppercase"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Amount (Rs.)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={(e) => set("amount", parseFloat(e.target.value) || 0)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Flat amount deducted from eligible lines.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Diwali festive voucher — Rs. 100 off orders above Rs. 999"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Scope</Label>
              <Select value={form.scope} onValueChange={onScopeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cart">Cart-wide</SelectItem>
                  <SelectItem value="product">Specific Products</SelectItem>
                  <SelectItem value="category">Specific Categories</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {form.scope === "cart" &&
                  "Applies to the entire order subtotal (after product discounts)."}
                {form.scope === "product" &&
                  "Applies only to cart lines matching the selected products."}
                {form.scope === "category" &&
                  "Applies only to cart lines in the selected categories."}
              </p>
            </div>

            {form.scope === "product" && (
              <div className="space-y-1.5">
                <Label>Target Products</Label>
                <MultiSelectList
                  items={(productsPage?.items || []).map((p) => ({
                    id: p.id,
                    name: productLabel.get(p.id) || p.name,
                  }))}
                  selected={form.targetIds}
                  onToggle={toggleTarget}
                  placeholder="Search products..."
                  emptyText="No products found."
                />
                {productsPage && productsPage.total > productsPage.items.length && (
                  <p className="text-[11px] text-amber-700">
                    Showing first {productsPage.items.length} of {productsPage.total} active
                    products. Narrow your search to find more.
                  </p>
                )}
              </div>
            )}

            {form.scope === "category" && (
              <div className="space-y-1.5">
                <Label>Target Categories</Label>
                <MultiSelectList
                  items={(categories || []).map((c) => ({ id: c.id, name: c.name }))}
                  selected={form.targetIds}
                  onToggle={toggleTarget}
                  placeholder="Search categories..."
                  emptyText="No categories found."
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Min Order (Rs.)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.minOrder}
                  onChange={(e) => set("minOrder", parseFloat(e.target.value) || 0)}
                />
                <p className="text-[11px] text-muted-foreground">0 = no minimum</p>
              </div>
              <div className="space-y-1.5">
                <Label>Max Redemptions</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.maxRedemptions}
                  onChange={(e) => set("maxRedemptions", parseInt(e.target.value) || 0)}
                />
                <p className="text-[11px] text-muted-foreground">0 = unlimited (total)</p>
              </div>
              <div className="space-y-1.5">
                <Label>Per-Customer Limit</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.perCustomerLimit}
                  onChange={(e) => set("perCustomerLimit", parseInt(e.target.value) || 0)}
                />
                <p className="text-[11px] text-muted-foreground">0 = unlimited per customer</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valid From</Label>
                <Input
                  type="date"
                  value={form.validFrom}
                  onChange={(e) => set("validFrom", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Valid To (optional)</Label>
                <Input
                  type="date"
                  value={form.validTo}
                  onChange={(e) => set("validTo", e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">Blank = never expires</p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => set("isActive", v)}
              />
              <Label>Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="size-4 mr-1 animate-spin" />}
              {editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
