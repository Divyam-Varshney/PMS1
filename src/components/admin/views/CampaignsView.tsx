// ============================================================================
// File: src/components/admin/views/CampaignsView.tsx
// Purpose: Campaign & Landing Page management. Admin can create, edit,
//          schedule, and publish custom landing pages for brands, categories,
//          festivals, flash sales, seasonal campaigns, etc.
// ============================================================================

"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { PageHeader } from "../ui";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Megaphone, Plus, Pencil, Trash2, Copy,
} from "lucide-react";
import { toast } from "sonner";

interface Campaign {
  id: string;
  title: string;
  slug: string;
  type: string;
  status: string;
  bannerImage: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroCtaText: string | null;
  heroCtaLink: string | null;
  promoText: string | null;
  productIds: string | null;
  categoryIds: string | null;
  seoTitle: string | null;
  metaDescription: string | null;
  startDate: string | null;
  endDate: string | null;
  displayOrder: number;
  createdAt: string;
}

const CAMPAIGN_TYPES = [
  { value: "landing", label: "Landing Page" },
  { value: "offer", label: "Offer Page" },
  { value: "brand", label: "Brand Page" },
  { value: "category", label: "Category Promotion" },
  { value: "festival", label: "Festival Campaign" },
  { value: "flash-sale", label: "Flash Sale" },
  { value: "seasonal", label: "Seasonal Sale" },
  { value: "collection", label: "Featured Collection" },
];

const STATUS_META: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  published: { label: "Published", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
  scheduled: { label: "Scheduled", className: "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300" },
  expired: { label: "Expired", className: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
};

const EMPTY_FORM = {
  title: "", slug: "", type: "landing", status: "draft",
  bannerImage: "", heroTitle: "", heroSubtitle: "",
  heroCtaText: "", heroCtaLink: "", promoText: "",
  productIds: "", categoryIds: "",
  seoTitle: "", metaDescription: "",
  startDate: "", endDate: "", displayOrder: 0,
};

export function CampaignsView() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [filterStatus, setFilterStatus] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-campaigns", filterStatus],
    queryFn: () => api.get<{ items: Campaign[]; total: number }>(
      `/api/admin/campaigns${filterStatus ? `?status=${filterStatus}` : ""}`
    ),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.post("/api/admin/campaigns", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
      toast.success("Campaign created");
      setShowForm(false);
      setForm(EMPTY_FORM);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof form }) =>
      api.patch(`/api/admin/campaigns/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
      toast.success("Campaign updated");
      setShowForm(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/api/admin/campaigns/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
      toast.success("Campaign deleted");
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(c: Campaign) {
    setEditing(c);
    setForm({
      title: c.title, slug: c.slug, type: c.type, status: c.status,
      bannerImage: c.bannerImage || "", heroTitle: c.heroTitle || "",
      heroSubtitle: c.heroSubtitle || "", heroCtaText: c.heroCtaText || "",
      heroCtaLink: c.heroCtaLink || "", promoText: c.promoText || "",
      productIds: c.productIds || "", categoryIds: c.categoryIds || "",
      seoTitle: c.seoTitle || "", metaDescription: c.metaDescription || "",
      startDate: c.startDate ? new Date(c.startDate).toISOString().slice(0, 16) : "",
      endDate: c.endDate ? new Date(c.endDate).toISOString().slice(0, 16) : "",
      displayOrder: c.displayOrder,
    });
    setShowForm(true);
  }

  function handleSave() {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  function copyUrl(slug: string) {
    const url = `${window.location.origin}/#v=campaign&slug=${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Campaign URL copied");
  }

  const items = data?.items ?? [];

  return (
    <div>
      <PageHeader
        title="Campaigns & Landing Pages"
        description="Create custom landing pages for brands, categories, festivals, flash sales, and seasonal campaigns."
        action={
          <Button onClick={openCreate} className="gap-2">
            <Plus className="size-4" /> New Campaign
          </Button>
        }
      />

      {/* Filter */}
      <div className="mb-4 flex items-center gap-2">
        <Select value={filterStatus || "all"} onValueChange={(v) => setFilterStatus(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Filter by status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          description="Create your first campaign or landing page to promote products, brands, or seasonal offers."
          action={<Button onClick={openCreate} className="gap-2"><Plus className="size-4" /> New Campaign</Button>}
        />
      ) : (
        <div className="space-y-3">
          {items.map((c) => {
            const statMeta = STATUS_META[c.status] || STATUS_META.draft;
            const typeLabel = CAMPAIGN_TYPES.find((t) => t.value === c.type)?.label || c.type;
            return (
              <Card key={c.id} className="admin-card">
                <CardContent className="flex items-start gap-3 py-4">
                  {/* Banner thumbnail or icon */}
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 text-white">
                    {c.bannerImage ? (
                      <img src={c.bannerImage} alt="" className="size-12 rounded-lg object-cover" />
                    ) : (
                      <Megaphone className="size-5" />
                    )}
                  </div>
                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold">{c.title}</h3>
                      <Badge variant="outline" className={statMeta.className}>{statMeta.label}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{typeLabel}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      /{c.slug}
                      {c.startDate && <span className="ml-2">· Starts: {new Date(c.startDate).toLocaleDateString("en-IN")}</span>}
                      {c.endDate && <span className="ml-1">→ Ends: {new Date(c.endDate).toLocaleDateString("en-IN")}</span>}
                    </p>
                    {c.heroTitle && <p className="mt-1 text-xs text-muted-foreground">{c.heroTitle}</p>}
                  </div>
                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-1">
                    {c.status === "published" && (
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => copyUrl(c.slug)} title="Copy URL">
                        <Copy className="size-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(c)} title="Edit">
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => {
                      if (confirm(`Delete campaign "${c.title}"?`)) deleteMutation.mutate(c.id);
                    }} title="Delete">
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={showForm} onOpenChange={(v) => !v && setShowForm(false)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Campaign" : "New Campaign"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update the campaign details." : "Create a new landing page or promotional campaign."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Basic */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Title *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Summer Health Sale" />
              </div>
              <div>
                <Label className="text-xs">URL Slug</Label>
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="summer-health-sale (auto from title)" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CAMPAIGN_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Hero */}
            <div className="border-t pt-4">
              <p className="text-sm font-semibold mb-2">Hero Section</p>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Banner Image URL</Label>
                  <Input value={form.bannerImage} onChange={(e) => setForm({ ...form, bannerImage: e.target.value })} placeholder="https://... (R2 URL)" />
                </div>
                <div>
                  <Label className="text-xs">Hero Title</Label>
                  <Input value={form.heroTitle} onChange={(e) => setForm({ ...form, heroTitle: e.target.value })} placeholder="Summer Health Sale" />
                </div>
                <div>
                  <Label className="text-xs">Hero Subtitle</Label>
                  <Textarea rows={2} value={form.heroSubtitle} onChange={(e) => setForm({ ...form, heroSubtitle: e.target.value })} placeholder="Up to 40% off on health supplements" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">CTA Button Text</Label>
                    <Input value={form.heroCtaText} onChange={(e) => setForm({ ...form, heroCtaText: e.target.value })} placeholder="Shop Now" />
                  </div>
                  <div>
                    <Label className="text-xs">CTA Button Link</Label>
                    <Input value={form.heroCtaLink} onChange={(e) => setForm({ ...form, heroCtaLink: e.target.value })} placeholder="shop or /#v=shop" />
                  </div>
                </div>
              </div>
            </div>

            {/* Featured */}
            <div className="border-t pt-4">
              <p className="text-sm font-semibold mb-2">Featured Products & Categories</p>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Product IDs (comma-separated)</Label>
                  <Input value={form.productIds} onChange={(e) => setForm({ ...form, productIds: e.target.value })} placeholder='["prod1","prod2"] or prod1,prod2' />
                  <p className="mt-1 text-xs text-muted-foreground">JSON array of product IDs to feature on this page</p>
                </div>
                <div>
                  <Label className="text-xs">Category IDs (comma-separated)</Label>
                  <Input value={form.categoryIds} onChange={(e) => setForm({ ...form, categoryIds: e.target.value })} placeholder='["cat1","cat2"] or cat1,cat2' />
                </div>
              </div>
            </div>

            {/* SEO */}
            <div className="border-t pt-4">
              <p className="text-sm font-semibold mb-2">SEO</p>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">SEO Title</Label>
                  <Input value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} placeholder="Summer Health Sale - Pradeep Medical Store" />
                </div>
                <div>
                  <Label className="text-xs">Meta Description</Label>
                  <Textarea rows={2} value={form.metaDescription} onChange={(e) => setForm({ ...form, metaDescription: e.target.value })} placeholder="Get up to 40% off on health supplements..." />
                </div>
              </div>
            </div>

            {/* Scheduling */}
            <div className="border-t pt-4">
              <p className="text-sm font-semibold mb-2">Scheduling</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Start Date</Label>
                  <Input type="datetime-local" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">End Date</Label>
                  <Input type="datetime-local" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
                {editing ? "Save Changes" : "Create Campaign"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
