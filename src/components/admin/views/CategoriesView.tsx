// ============================================================================
// File: src/components/admin/views/CategoriesView.tsx
// Purpose: Categories list + add/edit dialog supporting parent nesting.
//          Premium UI: hierarchy indentation with guide lines, search + sort,
//          responsive card-style table on mobile.
// ============================================================================

"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, run } from "../api";
import { PageHeader, StatusBadge, TableSkeleton, EmptyState } from "../ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Pencil, Trash2, FolderTree, Loader2, Upload, Image as ImageIcon, Search, ArrowUpDown, ChevronRight, CheckCircle2 } from "lucide-react";
import { slugify } from "@/lib/format";

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  image?: string | null;
  parentId?: string | null;
  displayOrder: number;
  status: string;
  visibility: string;
  parent?: { id: string; name: string } | null;
  _count?: { products: number };
}

const EMPTY = {
  name: "",
  slug: "",
  description: "",
  parentId: "",
  displayOrder: 0,
  status: "active",
  visibility: "public",
};

// Build a depth-aware flat list so we can render the tree with consistent
// indentation. Categories without a parent appear at depth 0; children follow
// their parent at depth+1. The algorithm is O(n²) but n is typically small
// (dozens of categories) so it's plenty fast for an admin view.
function buildHierarchy(categories: Category[]): Array<Category & { depth: number }> {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const childrenOf = (parentId: string | null): Category[] =>
    categories.filter((c) => (c.parentId ?? null) === parentId);
  const result: Array<Category & { depth: number }> = [];
  const walk = (parentId: string | null, depth: number) => {
    // Sort children by displayOrder then name for deterministic output.
    const children = childrenOf(parentId).sort((a, b) =>
      a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
    for (const c of children) {
      result.push({ ...c, depth });
      walk(c.id, depth + 1);
    }
  };
  walk(null, 0);
  // Append any categories that have a stale parentId (parent was deleted) —
  // these would otherwise vanish from the tree.
  for (const c of categories) {
    if (c.parentId && !byId.has(c.parentId) && !result.find((r) => r.id === c.id)) {
      result.push({ ...c, depth: 0 });
    }
  }
  return result;
}

export function CategoriesView() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-categories-all"],
    queryFn: () => api.get<Category[]>("/api/admin/categories"),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<"hierarchy" | "name" | "products" | "order">("hierarchy");

  function openNew() {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  }

  function openEdit(c: Category) {
    setEditing(c);
    setForm({
      name: c.name,
      slug: c.slug,
      description: c.description || "",
      parentId: c.parentId || "",
      displayOrder: c.displayOrder,
      status: c.status,
      visibility: c.visibility,
    });
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = { ...form, slug: form.slug?.trim() || slugify(form.name) };
    const r = editing
      ? await run(() => api.put(`/api/admin/categories/${editing.id}`, payload), {
          success: "Category updated",
          error: "Update failed",
        })
      : await run(() => api.post("/api/admin/categories", payload), {
          success: "Category created",
          error: "Create failed",
        });
    setSaving(false);
    if (r) {
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-categories-all"] });
    }
  }

  async function del(c: Category) {
    const r = await run(() => api.del(`/api/admin/categories/${c.id}`), {
      success: "Category removed",
      error: "Delete failed",
    });
    if (r) qc.invalidateQueries({ queryKey: ["admin-categories-all"] });
  }

  // Upload a category image — POST multipart/form-data to the dedicated
  // image endpoint. Mirrors the brand logo upload flow. After a successful
  // upload, the cached categories list is invalidated so the new image shows
  // up immediately in the table.
  async function uploadImage(file: File) {
    if (!editing) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const r = await run(() =>
      api.upload<{ category: Category; image: string }>(`/api/admin/categories/${editing.id}/image`, fd), {
        success: "Image uploaded",
        error: "Upload failed",
      });
    setUploading(false);
    if (r) {
      // Reflect the new image in the local editing state + invalidate cache
      setEditing({ ...editing, image: r.image });
      qc.invalidateQueries({ queryKey: ["admin-categories-all"] });
    }
  }

  // Compute the visible list — hierarchy-aware by default, flat-filtered by
  // search, then sorted by the selected mode.
  const visibleList = useMemo(() => {
    const all = data ?? [];
    const q = search.trim().toLowerCase();
    if (sortMode === "hierarchy" && !q) {
      return buildHierarchy(all);
    }
    let filtered = all;
    if (q) {
      filtered = all.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        (c.description || "").toLowerCase().includes(q));
    }
    if (sortMode === "name") {
      filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortMode === "products") {
      filtered = [...filtered].sort((a, b) => (b._count?.products ?? 0) - (a._count?.products ?? 0));
    } else if (sortMode === "order") {
      filtered = [...filtered].sort((a, b) => a.displayOrder - b.displayOrder);
    }
    // When searching in hierarchy mode, also include parents of matches so
    // the tree context isn't lost.
    if (sortMode === "hierarchy" && q) {
      const matches = new Set(filtered.map((c) => c.id));
      const include = new Set<string>();
      for (const c of all) {
        let cur: Category | undefined = c;
        while (cur) {
          if (matches.has(cur.id)) {
            let p: Category | undefined = cur;
            while (p) {
              include.add(p.id);
              p = p.parentId ? all.find((x) => x.id === p!.parentId) : undefined;
            }
          }
          cur = cur.parentId ? all.find((x) => x.id === cur!.parentId) : undefined;
        }
      }
      filtered = all.filter((c) => include.has(c.id));
      return buildHierarchy(filtered);
    }
    return filtered.map((c) => ({ ...c, depth: 0 }));
  }, [data, search, sortMode]);

  return (
    <div>
      <PageHeader
        title="Categories"
        description="Organize products into categories (nested supported)."
        actions={
          <Button onClick={openNew} className="btn-premium">
            <Plus className="size-4 mr-1" /> Add Category
          </Button>
        }
      />

      {/* Search + Sort */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories..."
            className="pl-9 h-9 admin-search focus-visible:ring-1 focus-visible:ring-primary/30"
          />
        </div>
        <div className="flex items-center gap-2">
          <ArrowUpDown className="size-3.5 text-muted-foreground" />
          <Select value={sortMode} onValueChange={(v) => setSortMode(v as typeof sortMode)}>
            <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="hierarchy">Hierarchy</SelectItem>
              <SelectItem value="name">Name (A-Z)</SelectItem>
              <SelectItem value="products">Most Products</SelectItem>
              <SelectItem value="order">Display Order</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {search && (
          <Badge variant="outline" className="bg-muted/40 text-muted-foreground font-medium">
            {visibleList.length} match{visibleList.length !== 1 ? "es" : ""}
          </Badge>
        )}
      </div>

      <Card className="admin-card">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4"><TableSkeleton rows={6} cols={5} /></div>
          ) : !visibleList.length ? (
            <div className="p-4">
              <EmptyState
                title={search ? "No matching categories" : "No categories yet"}
                description={search ? "Try a different search term." : "Add your first product category to organize your catalog."}
                icon={<FolderTree className="size-6" />}
                action={
                  <Button onClick={openNew} className="btn-premium"><Plus className="size-4 mr-1" /> Add Category</Button>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/70 hover:bg-transparent">
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="min-w-[240px]">Category</TableHead>
                    <TableHead className="min-w-[140px] hidden md:table-cell">Slug</TableHead>
                    <TableHead className="min-w-[120px] hidden lg:table-cell">Parent</TableHead>
                    <TableHead className="text-right w-24">Products</TableHead>
                    <TableHead className="text-right w-24 hidden sm:table-cell">Order</TableHead>
                    <TableHead className="w-32">Status</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleList.map((c) => (
                    <TableRow key={c.id} className="border-border/60 h-16 admin-table-row">
                      <TableCell>
                        {c.image ? (
                          <div className="relative group">
                            <img src={c.image} alt="" className="size-10 rounded-md object-cover border border-border/70 bg-muted/30" />
                            {/* Hover preview — larger image on hover */}
                            <div className="pointer-events-none absolute left-0 top-full mt-1 z-20 hidden group-hover:block">
                              <img src={c.image} alt="" className="size-24 rounded-md border border-border bg-background shadow-premium object-cover" />
                            </div>
                          </div>
                        ) : (
                          <div className="flex size-10 items-center justify-center rounded-md border border-border/70 bg-gradient-to-br from-emerald-400 to-teal-500 text-xs font-bold text-white shadow-premium-sm">
                            {(c.name?.[0] || "P").toUpperCase()}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {/* Hierarchy indentation — paddingLeft scales with depth. */}
                        <div className="flex items-center" style={{ paddingLeft: `${c.depth * 1.5}rem` }}>
                          {c.depth > 0 && (
                            <span className="flex items-center text-muted-foreground/60 mr-1.5 shrink-0">
                              <span className="inline-block w-3 h-px bg-border" />
                              <ChevronRight className="size-3" />
                            </span>
                          )}
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate">{c.name}</div>
                            {c.description && (
                              <div className="text-xs text-muted-foreground truncate max-w-[300px]">{c.description}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground hidden md:table-cell">{c.slug}</TableCell>
                      <TableCell className="text-sm hidden lg:table-cell">
                        {c.parent?.name || <span className="text-muted-foreground italic">—</span>}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{c._count?.products ?? 0}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums hidden sm:table-cell">{c.displayOrder}</TableCell>
                      <TableCell><StatusBadge status={c.status} /></TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(c)} title="Edit category">
                            <Pencil className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/5" onClick={() => del(c)} title="Delete category">
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
        <DialogContent className="max-w-lg shadow-premium-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Category" : "New Category"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update category information." : "Add a new product category."}
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
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5 col-span-1">
                <Label>Parent</Label>
                <Select value={form.parentId || "_none"} onValueChange={(v) => setForm({ ...form, parentId: v === "_none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— None —</SelectItem>
                    {(data || [])
                      .filter((c) => c.id !== editing?.id)
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Order</Label>
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
            </div>
            <div className="space-y-1.5">
              <Label>Visibility</Label>
              <Select value={form.visibility} onValueChange={(v) => setForm({ ...form, visibility: v })}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="hidden">Hidden</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Image upload — only available when editing an existing category
                (the upload endpoint requires an id). Mirrors the brand logo
                upload pattern. */}
            {editing && (
              <div className="space-y-2 border-t border-border/70 pt-3">
                <Label>Category Image</Label>
                <div className="flex items-start gap-3">
                  {editing.image ? (
                    <div className="relative">
                      <img src={editing.image} alt="" className="size-16 rounded-md object-cover border border-border/70" />
                      <Badge variant="outline" className="absolute -bottom-1.5 -right-1.5 bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] admin-badge-emerald">
                        <CheckCircle2 className="size-2.5 mr-0.5" /> Set
                      </Badge>
                    </div>
                  ) : (
                    <div className="flex size-16 items-center justify-center rounded-md border border-dashed border-border bg-muted/30 text-muted-foreground">
                      <ImageIcon className="size-5" />
                    </div>
                  )}
                  <div className="flex-1 space-y-2">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])}
                      />
                      <Button variant="outline" asChild disabled={uploading} className="btn-premium">
                        <span>
                          {uploading ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Upload className="size-4 mr-1" />}
                          {editing.image ? "Replace Image" : "Upload Image"}
                        </span>
                      </Button>
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Recommended: square image, 400×400px or larger. Used on the customer-facing categories page.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="btn-premium">
              {saving && <Loader2 className="size-4 mr-1 animate-spin" />}
              {editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
