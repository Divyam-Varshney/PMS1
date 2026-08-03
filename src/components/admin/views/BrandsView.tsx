// ============================================================================
// File: src/components/admin/views/BrandsView.tsx
// Purpose: Brands list + add/edit dialog with logo upload.
// ============================================================================

"use client";

import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, run } from "../api";
import { PageHeader, StatusBadge, TableSkeleton, EmptyState } from "../ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Pencil, Trash2, Tags, Loader2, Upload, Download, Search, Sparkles, CheckCircle2 } from "lucide-react";
import { slugify } from "@/lib/format";
import { toast } from "sonner";

interface Brand {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  logo?: string | null;
  displayMode?: string; // "logo_only" | "name_only" | "both"
  displayOrder: number;
  isFeaturedOnHomepage?: boolean;
  status: string;
  visibility: string;
  _count?: { products: number };
}

const EMPTY = {
  name: "",
  slug: "",
  description: "",
  displayMode: "both",
  displayOrder: 0,
  isFeaturedOnHomepage: false,
  status: "active",
  visibility: "public",
};

export function BrandsView() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-brands-all"],
    queryFn: () => api.get<Brand[]>("/api/admin/brands"),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [search, setSearch] = useState("");

  function openNew() {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  }

  function openEdit(b: Brand) {
    setEditing(b);
    setForm({
      name: b.name,
      slug: b.slug,
      description: b.description || "",
      displayMode: b.displayMode || "both",
      displayOrder: b.displayOrder,
      isFeaturedOnHomepage: !!b.isFeaturedOnHomepage,
      status: b.status,
      visibility: b.visibility,
    });
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error("Brand name is required");
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      isFeaturedOnHomepage: !!form.isFeaturedOnHomepage,
      slug: form.slug?.trim() || slugify(form.name),
    };
    const r = editing
      ? await run(() => api.put(`/api/admin/brands/${editing.id}`, payload), {
          success: "Brand updated",
          error: "Update failed",
        })
      : await run(() => api.post("/api/admin/brands", payload), {
          success: "Brand created",
          error: "Create failed",
        });
    setSaving(false);
    if (r) {
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-brands-all"] });
    }
  }

  async function del(b: Brand) {
    const r = await run(() => api.del(`/api/admin/brands/${b.id}`), {
      success: "Brand removed",
      error: "Delete failed",
    });
    if (r) qc.invalidateQueries({ queryKey: ["admin-brands-all"] });
  }

  async function uploadLogo(file: File) {
    if (!editing) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const r = await run(() =>
      api.upload<{ brand: Brand; logo: string }>(`/api/admin/brands/${editing.id}/logo`, fd), {
      success: "Logo uploaded",
      error: "Upload failed",
    });
    setUploading(false);
    if (r) qc.invalidateQueries({ queryKey: ["admin-brands-all"] });
  }


  async function toggleFeatured(b: Brand) {
    const next = !b.isFeaturedOnHomepage;
    const r = await run(
      () => api.put(`/api/admin/brands/${b.id}`, { isFeaturedOnHomepage: next }),
      { success: next ? "Brand featured on homepage" : "Brand removed from homepage", error: "Update failed", silent: true }
    );
    if (r) qc.invalidateQueries({ queryKey: ["admin-brands-all"] });
  }

  // ---- Selection helpers ----
  const filtered = (data || []).filter((b) =>
    !search.trim() || b.name.toLowerCase().includes(search.toLowerCase())
  );
  const allSelected = filtered.length > 0 && filtered.every((b) => selected.has(b.id));
  function toggleAll() {
    const next = new Set(selected);
    if (allSelected) filtered.forEach((b) => next.delete(b.id));
    else filtered.forEach((b) => next.add(b.id));
    setSelected(next);
  }
  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }
  function clearSelection() { setSelected(new Set()); }

  function exportBrands(selectedOnly = false) {
    const url = selectedOnly && selected.size > 0
      ? `/api/admin/brands/export?ids=${Array.from(selected).join(",")}`
      : "/api/admin/brands/export";
    const a = document.createElement("a");
    a.href = url;
    a.download = `brands-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success(selectedOnly ? `Exporting ${selected.size} selected brands` : "Exporting all brands");
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/brands/import", { method: "POST", credentials: "include", body: form });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Import failed");
      toast.success(`Import: ${json.data.created} created, ${json.data.updated} updated`);
      qc.invalidateQueries({ queryKey: ["admin-brands-all"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Import failed");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function bulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected brand(s)? Brands with products will be deactivated.`)) return;
    setBulkDeleting(true);
    const r = await run(
      () => api.post<{ deleted: number; softDeleted: number }>("/api/admin/brands/bulk", { ids: Array.from(selected) }),
      { success: "Selected brands processed", error: "Bulk delete failed", silent: true }
    );
    setBulkDeleting(false);
    if (r) {
      toast.success(`${r.deleted} deleted, ${r.softDeleted} deactivated`);
      clearSelection();
      qc.invalidateQueries({ queryKey: ["admin-brands-all"] });
    }
  }

  return (
    <div>
      <PageHeader
        title="Brands"
        description="Manage product brands."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileInputRef} type="file" accept=".csv" onChange={onImportFile} className="hidden" />
            <Button variant="outline" size="sm" className="gap-1.5" disabled={importing} onClick={() => fileInputRef.current?.click()}>
              {importing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              Import
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportBrands(false)}>
              <Download className="size-4" /> Export
            </Button>
            <Button onClick={openNew}>
              <Plus className="size-4 mr-1" /> Add Brand
            </Button>
          </div>
        }
      />

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 admin-bulk-bar p-3">
          <Badge variant="secondary" className="bg-primary/15 text-primary font-semibold">
            {selected.size} selected
          </Badge>
          <Button size="sm" variant="outline" className="gap-1.5 btn-premium bg-background/60" onClick={() => exportBrands(true)}>
            <Download className="size-3.5" /> Export Selected
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive btn-premium bg-background/60" disabled={bulkDeleting} onClick={bulkDelete}>
            {bulkDeleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            Delete Selected
          </Button>
          <Button size="sm" variant="ghost" onClick={clearSelection} className="ml-auto">Clear</Button>
        </div>
      )}

      {/* Search */}
      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search brands..."
          className="pl-9 h-9 admin-search focus-visible:ring-1 focus-visible:ring-primary/30"
        />
      </div>

      <Card className="admin-card">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4"><TableSkeleton rows={6} cols={6} /></div>
          ) : !filtered?.length ? (
            <div className="p-4">
              <EmptyState title="No brands found" description="Try a different search or add a new brand to your catalog." icon={<Tags className="size-6" />} action={
                <Button onClick={openNew} className="btn-premium"><Plus className="size-4 mr-1" /> Add Brand</Button>
              } />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/70 hover:bg-transparent">
                    <TableHead className="w-10">
                      <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                    </TableHead>
                    <TableHead className="min-w-[220px]">Brand</TableHead>
                    <TableHead className="min-w-[140px] hidden md:table-cell">Slug</TableHead>
                    <TableHead className="text-right w-24">Products</TableHead>
                    <TableHead className="text-right w-28 hidden sm:table-cell">Order</TableHead>
                    <TableHead className="w-32">Status</TableHead>
                    <TableHead className="w-32 hidden lg:table-cell">Homepage</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((b) => (
                    <TableRow key={b.id} className={`border-border/60 h-16 ${selected.has(b.id) ? "bg-primary/5" : "admin-table-row"}`}>
                      <TableCell>
                        <Checkbox checked={selected.has(b.id)} onCheckedChange={() => toggleOne(b.id)} aria-label={`Select ${b.name}`} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {b.logo ? (
                            <div className="relative group">
                              <img src={b.logo} alt="" className="size-10 rounded-md object-contain border border-border/70 bg-muted/30 p-1" />
                              {/* Hover preview tooltip — larger logo on hover */}
                              <div className="pointer-events-none absolute left-0 top-full mt-1 z-20 hidden group-hover:block">
                                <img src={b.logo} alt="" className="size-24 rounded-md border border-border bg-background p-2 shadow-premium object-contain" />
                              </div>
                            </div>
                          ) : (
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-emerald-400 to-teal-500 text-sm font-bold text-white shadow-premium-sm">
                              {b.name[0]?.toUpperCase() ?? "?"}
                            </span>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-sm truncate">{b.name}</span>
                              {b.isFeaturedOnHomepage && (
                                <Badge variant="outline" className="shrink-0 gap-0.5 border-emerald-200 bg-emerald-50 px-1.5 py-0 text-[9px] font-semibold text-emerald-700 admin-badge-emerald">
                                  <Sparkles className="size-2.5" /> Home
                                </Badge>
                              )}
                              {!b.logo && (
                                <Badge variant="outline" className="shrink-0 gap-0.5 border-amber-200 bg-amber-50 px-1.5 py-0 text-[9px] font-semibold text-amber-700 admin-badge-amber">
                                  No logo
                                </Badge>
                              )}
                            </div>
                            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              {b.displayMode === "logo_only"
                                ? "Logo only"
                                : b.displayMode === "name_only"
                                  ? "Name only"
                                  : "Logo + Name"}
                            </div>
                            {b.description && (
                              <div className="text-xs text-muted-foreground truncate max-w-[300px]">{b.description}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground hidden md:table-cell">{b.slug}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{b._count?.products ?? 0}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums hidden sm:table-cell">{b.displayOrder}</TableCell>
                      <TableCell>
                        <StatusBadge status={b.status} />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <button
                          type="button"
                          onClick={() => toggleFeatured(b)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-premium ${
                            b.isFeaturedOnHomepage
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50"
                              : "bg-muted text-muted-foreground hover:bg-muted/70"
                          }`}
                          title={b.isFeaturedOnHomepage ? "Featured on homepage — click to remove" : "Click to feature on homepage"}
                        >
                          <span className={`size-1.5 rounded-full ${b.isFeaturedOnHomepage ? "bg-emerald-500" : "bg-muted-foreground/50"}`} />
                          {b.isFeaturedOnHomepage ? "Featured" : "Not featured"}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(b)} title="Edit brand">
                            <Pencil className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/5" onClick={() => del(b)} title="Delete brand">
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Brand" : "New Brand"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update brand information." : "Add a new brand to your catalog."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Slug</Label>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto from name" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Display Mode</Label>
                <Select value={form.displayMode} onValueChange={(v) => setForm({ ...form, displayMode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Both (Logo + Name)</SelectItem>
                    <SelectItem value="logo_only">Logo Only</SelectItem>
                    <SelectItem value="name_only">Name Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Display Order</Label>
                <Input type="number" value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Visibility</Label>
                <Select value={form.visibility} onValueChange={(v) => setForm({ ...form, visibility: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="hidden">Hidden</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Homepage feature toggle — controls whether the brand appears
                in the homepage marquee strip (Trusted Brands section). */}
            <label
              htmlFor="brand-featured-toggle"
              className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5 transition-premium hover:border-primary/40 hover:bg-primary/5"
            >
              <span className="flex items-start gap-2.5">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <Sparkles className="size-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium leading-tight">Featured on Homepage</span>
                  <span className="block text-[11px] text-muted-foreground">Show this brand in the homepage &quot;Trusted Brands&quot; marquee.</span>
                </span>
              </span>
              <Checkbox
                id="brand-featured-toggle"
                checked={!!form.isFeaturedOnHomepage}
                onCheckedChange={(v) => setForm({ ...form, isFeaturedOnHomepage: !!v })}
              />
            </label>

            {editing && (
              <div className="space-y-2 border-t border-border/70 pt-3">
                <Label>Logo</Label>
                <div className="flex items-start gap-3">
                  {editing.logo ? (
                    <div className="relative">
                      <img src={editing.logo} alt="" className="size-16 rounded-md object-contain border border-border bg-muted/30 p-1.5" />
                      <Badge variant="outline" className="absolute -bottom-1.5 -right-1.5 bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] admin-badge-emerald">
                        <CheckCircle2 className="size-2.5 mr-0.5" /> Set
                      </Badge>
                    </div>
                  ) : (
                    <div className="flex size-16 items-center justify-center rounded-md border border-dashed border-border bg-muted/30 text-muted-foreground">
                      <Tags className="size-5" />
                    </div>
                  )}
                  <div className="flex-1 space-y-2">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
                      />
                      <Button variant="outline" asChild disabled={uploading}>
                        <span>
                          {uploading ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Upload className="size-4 mr-1" />}
                          {editing.logo ? "Replace Logo" : "Upload Logo"}
                        </span>
                      </Button>
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Recommended: square PNG/SVG, 200×200px or larger. Brands without a logo are hidden from the public catalog.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
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
