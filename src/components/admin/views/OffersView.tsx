// ============================================================================
// File: src/components/admin/views/OffersView.tsx
// Purpose: Premium Offers/Banner management — redesigned with:
//   - Stats bar (total / active / scheduled / custom)
//   - Color preset palette (quick-pick gradients)
//   - Position icons + visual indicators
//   - Schedule (start/end date) support
//   - Gradient background toggle
//   - Live preview with gradient support
//   - Premium card design with hover effects
// ============================================================================

"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { PageHeader, EmptyState } from "../ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Megaphone, Plus, Trash2, Edit, Loader2, Code, Calendar, Palette,
  Layout, Sparkles, Clock, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { sanitizeHtml } from "@/lib/sanitize";

interface Offer {
  id: string;
  title: string;
  subtitle?: string;
  ctaText?: string;
  ctaView?: string;
  bgColor: string;
  textColor: string;
  position: "top-banner" | "hero" | "mid-banner" | "custom";
  isActive: boolean;
  displayOrder: number;
  customHtml?: string;
  // New fields (stored alongside existing — ignored by old API if not present)
  gradientTo?: string;
  useGradient?: boolean;
  startDate?: string;
  endDate?: string;
}

// Color presets — curated gradient combos for quick selection
const COLOR_PRESETS: Array<{ name: string; bg: string; to: string; text: string }> = [
  { name: "Emerald", bg: "#059669", to: "#0d9488", text: "#ffffff" },
  { name: "Teal", bg: "#0d9488", to: "#0891b2", text: "#ffffff" },
  { name: "Sunset", bg: "#ea580c", to: "#dc2626", text: "#ffffff" },
  { name: "Purple", bg: "#7c3aed", to: "#c026d3", text: "#ffffff" },
  { name: "Ocean", bg: "#0284c7", to: "#0ea5e9", text: "#ffffff" },
  { name: "Rose", bg: "#e11d48", to: "#f43f5e", text: "#ffffff" },
  { name: "Amber", bg: "#d97706", to: "#f59e0b", text: "#ffffff" },
  { name: "Dark", bg: "#1e293b", to: "#334155", text: "#ffffff" },
];

const POSITION_INFO: Record<string, { label: string; icon: typeof Megaphone; color: string }> = {
  "top-banner": { label: "Top Banner", icon: Layout, color: "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300" },
  "hero": { label: "Hero Section", icon: Sparkles, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
  "mid-banner": { label: "Mid Banner", icon: Megaphone, color: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
  "custom": { label: "Custom HTML", icon: Code, color: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" },
};

export function OffersView() {
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Offer | null>(null);

  const { data: offers, isLoading } = useQuery({
    queryKey: ["admin-offers"],
    queryFn: () => api.get<Offer[]>("/api/admin/offers"),
  });

  const saveMutation = useMutation({
    mutationFn: (offer: Offer) => {
      // Always use POST — the API upserts based on offer.id.
      // Generate an ID for new offers (id is empty string).
      const payload = { ...offer };
      if (!payload.id) {
        payload.id = `offer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      }
      return api.post("/api/admin/offers", payload);
    },
    onSuccess: () => {
      toast.success(editing?.id ? "Offer updated" : "Offer created");
      setEditOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin-offers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: (offer: Offer) => api.post("/api/admin/offers", { ...offer, isActive: !offer.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-offers"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/api/admin/offers?id=${id}`),
    onSuccess: () => {
      toast.success("Offer deleted");
      qc.invalidateQueries({ queryKey: ["admin-offers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() {
    setEditing(null);
    setEditOpen(true);
    setEditing({
      id: "",
      title: "",
      subtitle: "",
      ctaText: "Shop Now",
      ctaView: "shop",
      bgColor: "#059669",
      textColor: "#ffffff",
      position: "top-banner",
      isActive: true,
      displayOrder: (offers?.length ?? 0) + 1,
      customHtml: "",
      gradientTo: "#0d9488",
      useGradient: true,
      startDate: "",
      endDate: "",
    });
  }

  function openEdit(offer: Offer) {
    setEditing({ ...offer, useGradient: !!offer.gradientTo, gradientTo: offer.gradientTo || "#0d9488" });
    setEditOpen(true);
  }

  const activeCount = offers?.filter((o) => o.isActive).length ?? 0;
  const scheduledCount = offers?.filter((o) => o.startDate || o.endDate).length ?? 0;
  const customCount = offers?.filter((o) => o.position === "custom").length ?? 0;

  // Check if offer is currently scheduled/active
  const isLive = (o: Offer) => {
    if (!o.isActive) return false;
    const now = new Date();
    if (o.startDate && new Date(o.startDate) > now) return false;
    if (o.endDate && new Date(o.endDate) < now) return false;
    return true;
  };

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Offers & Banners" description="Manage promotional banners shown on the customer website." />
        <div className="flex justify-center py-20"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Offers & Banners"
        description="Create promotional banners to highlight deals, new arrivals, or seasonal offers."
        actions={<Button onClick={openNew} className="gap-2"><Plus className="size-4" /> New Offer</Button>}
      />

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Offers", value: offers?.length ?? 0, icon: Megaphone, tint: "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300" },
          { label: "Active", value: activeCount, icon: CheckCircle2, tint: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
          { label: "Scheduled", value: scheduledCount, icon: Calendar, tint: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
          { label: "Custom HTML", value: customCount, icon: Code, tint: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" },
        ].map((s) => (
          <Card key={s.label} className="overflow-hidden admin-stat-card">
            <CardContent className="flex items-center gap-3 p-3">
              <div className={`size-9 rounded-lg flex items-center justify-center shrink-0 ${s.tint}`}>
                <s.icon className="size-4" />
              </div>
              <div>
                <div className="text-lg font-bold tabular-nums">{s.value}</div>
                <div className="text-[10px] text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!offers || offers.length === 0 ? (
        <EmptyState
          type="default"
          title="No offers yet"
          description="Create promotional banners to highlight deals, new arrivals, or seasonal offers on your customer website."
          action={<Button onClick={openNew} className="gap-2"><Plus className="size-4" /> Create your first offer</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {offers.map((offer, i) => {
            const posInfo = POSITION_INFO[offer.position] || POSITION_INFO["top-banner"];
            const live = isLive(offer);
            const bgStyle = offer.useGradient && offer.gradientTo
              ? { background: `linear-gradient(135deg, ${offer.bgColor}, ${offer.gradientTo})` }
              : { backgroundColor: offer.bgColor };

            return (
              <motion.div
                key={offer.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5">
                  {/* Preview banner */}
                  {offer.position === "custom" && offer.customHtml ? (
                    <div className="min-h-[100px] border-b" dangerouslySetInnerHTML={{ __html: sanitizeHtml(offer.customHtml) }} />
                  ) : (
                    <div
                      className="relative flex min-h-[110px] flex-col justify-center p-4"
                      style={{ ...bgStyle, color: offer.textColor }}
                    >
                      {/* Live badge */}
                      {live && (
                        <Badge className="absolute right-2 top-2 bg-white/25 text-white backdrop-blur-sm gap-1 text-[9px]">
                          <span className="size-1.5 rounded-full bg-emerald-300 animate-pulse" /> LIVE
                        </Badge>
                      )}
                      <p className="text-sm font-bold">{offer.title || "Offer title"}</p>
                      {offer.subtitle && <p className="mt-0.5 text-xs opacity-90">{offer.subtitle}</p>}
                      {offer.ctaText && (
                        <span className="mt-2 inline-flex w-fit rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-semibold backdrop-blur-sm">
                          {offer.ctaText}
                        </span>
                      )}
                    </div>
                  )}

                  <CardContent className="space-y-2 p-3">
                    {/* Position badge + schedule indicator */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className={`gap-1 ${posInfo.color} border-0`}>
                          <posInfo.icon className="size-3" />
                          {posInfo.label}
                        </Badge>
                        {offer.startDate && (
                          <Badge variant="outline" className="gap-1 text-[9px] text-muted-foreground">
                            <Calendar className="size-2.5" /> Scheduled
                          </Badge>
                        )}
                      </div>
                      <Switch
                        checked={offer.isActive}
                        onCheckedChange={() => toggleMutation.mutate(offer)}
                        aria-label="Toggle offer"
                      />
                    </div>

                    {/* Schedule info */}
                    {(offer.startDate || offer.endDate) && (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="size-2.5" />
                        {offer.startDate && new Date(offer.startDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                        {offer.startDate && offer.endDate && " → "}
                        {offer.endDate && new Date(offer.endDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => openEdit(offer)}>
                        <Edit className="size-3.5" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:bg-destructive/5"
                        onClick={() => deleteMutation.mutate(offer.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Edit / create dialog — premium with color presets + gradient + schedule */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit Offer" : "New Offer"}</DialogTitle>
            <DialogDescription>Configure the banner content, appearance, position, and schedule.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              {/* Position selector */}
              <div>
                <Label className="text-xs font-medium">Position</Label>
                <Select
                  value={editing.position}
                  onValueChange={(v) => setEditing({ ...editing, position: v as Offer["position"] })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top-banner">Top Banner — above header (promotional strip)</SelectItem>
                    <SelectItem value="hero">Hero Section — replaces the homepage hero</SelectItem>
                    <SelectItem value="mid-banner">Mid Banner — between homepage sections</SelectItem>
                    <SelectItem value="custom">Custom HTML — raw HTML/CSS (full control)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editing.position === "custom" ? (
                <div>
                  <Label className="text-xs font-medium">Custom HTML <span className="text-muted-foreground">(inline CSS allowed)</span></Label>
                  <Textarea
                    rows={6}
                    value={editing.customHtml || ""}
                    onChange={(e) => setEditing({ ...editing, customHtml: e.target.value })}
                    placeholder={'<div style="background: linear-gradient(135deg, #059669, #0d9488); color: white; padding: 16px; text-align: center;">\n  <h2>Your custom banner</h2>\n</div>'}
                    className="font-mono text-xs"
                  />
                  {editing.customHtml && (
                    <div className="mt-2">
                      <Label className="text-xs">Preview</Label>
                      <div className="rounded-lg border p-2" dangerouslySetInnerHTML={{ __html: sanitizeHtml(editing.customHtml) }} />
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Content fields */}
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <Label className="text-xs font-medium">Title *</Label>
                      <Input
                        value={editing.title}
                        onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                        placeholder="e.g. Flat 20% off on all medicines"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium">Subtitle</Label>
                      <Input
                        value={editing.subtitle || ""}
                        onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })}
                        placeholder="e.g. Limited time offer. Use code WELCOME20"
                      />
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-medium">Button text</Label>
                      <Input
                        value={editing.ctaText || ""}
                        onChange={(e) => setEditing({ ...editing, ctaText: e.target.value })}
                        placeholder="Shop Now"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium">Button links to</Label>
                      <Select
                        value={editing.ctaView || "shop"}
                        onValueChange={(v) => setEditing({ ...editing, ctaView: v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="shop">Shop</SelectItem>
                          <SelectItem value="prescription">Upload Prescription</SelectItem>
                          <SelectItem value="manual-request">Request Medicines</SelectItem>
                          <SelectItem value="home">Home</SelectItem>
                          <SelectItem value="about">About</SelectItem>
                          <SelectItem value="contact">Contact</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Color presets */}
                  <div>
                    <Label className="text-xs font-medium flex items-center gap-1">
                      <Palette className="size-3" /> Color Presets
                    </Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {COLOR_PRESETS.map((preset) => (
                        <button
                          key={preset.name}
                          onClick={() => setEditing({ ...editing, bgColor: preset.bg, gradientTo: preset.to, textColor: preset.text, useGradient: true })}
                          className="flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-medium transition-all hover:scale-105"
                          style={{ background: `linear-gradient(135deg, ${preset.bg}, ${preset.to})`, color: preset.text }}
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Gradient toggle + color pickers */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={editing.useGradient ?? false}
                        onCheckedChange={(v) => setEditing({ ...editing, useGradient: v })}
                      />
                      <Label className="text-xs font-medium">Use gradient background</Label>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs font-medium">{editing.useGradient ? "Gradient from" : "Background color"}</Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={editing.bgColor}
                            onChange={(e) => setEditing({ ...editing, bgColor: e.target.value })}
                            className="size-9 rounded-md border"
                          />
                          <Input
                            value={editing.bgColor}
                            onChange={(e) => setEditing({ ...editing, bgColor: e.target.value })}
                            className="flex-1 text-xs"
                          />
                        </div>
                      </div>
                      {editing.useGradient && (
                        <div>
                          <Label className="text-xs font-medium">Gradient to</Label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={editing.gradientTo || "#0d9488"}
                              onChange={(e) => setEditing({ ...editing, gradientTo: e.target.value })}
                              className="size-9 rounded-md border"
                            />
                            <Input
                              value={editing.gradientTo || ""}
                              onChange={(e) => setEditing({ ...editing, gradientTo: e.target.value })}
                              className="flex-1 text-xs"
                            />
                          </div>
                        </div>
                      )}
                      <div>
                        <Label className="text-xs font-medium">Text color</Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={editing.textColor}
                            onChange={(e) => setEditing({ ...editing, textColor: e.target.value })}
                            className="size-9 rounded-md border"
                          />
                          <Input
                            value={editing.textColor}
                            onChange={(e) => setEditing({ ...editing, textColor: e.target.value })}
                            className="flex-1 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Schedule */}
                  <div>
                    <Label className="text-xs font-medium flex items-center gap-1">
                      <Calendar className="size-3" /> Schedule (optional)
                    </Label>
                    <div className="grid grid-cols-2 gap-3 mt-1">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Start date</Label>
                        <Input
                          type="datetime-local"
                          value={editing.startDate || ""}
                          onChange={(e) => setEditing({ ...editing, startDate: e.target.value })}
                          className="text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">End date</Label>
                        <Input
                          type="datetime-local"
                          value={editing.endDate || ""}
                          onChange={(e) => setEditing({ ...editing, endDate: e.target.value })}
                          className="text-xs"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">Leave empty for always active.</p>
                  </div>

                  {/* Live preview */}
                  <div>
                    <Label className="text-xs font-medium">Live Preview</Label>
                    <div
                      className="flex min-h-[70px] flex-col justify-center rounded-lg p-3 mt-1"
                      style={
                        editing.useGradient
                          ? { background: `linear-gradient(135deg, ${editing.bgColor}, ${editing.gradientTo || "#0d9488"})`, color: editing.textColor }
                          : { backgroundColor: editing.bgColor, color: editing.textColor }
                      }
                    >
                      <p className="text-sm font-bold">{editing.title || "Offer title"}</p>
                      {editing.subtitle && <p className="mt-0.5 text-xs opacity-90">{editing.subtitle}</p>}
                      {editing.ctaText && (
                        <span className="mt-2 inline-flex w-fit rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-semibold backdrop-blur-sm">
                          {editing.ctaText}
                        </span>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Display order */}
              <div>
                <Label className="text-xs font-medium">Display order (lower = first)</Label>
                <Input
                  type="number"
                  value={editing.displayOrder}
                  onChange={(e) => setEditing({ ...editing, displayOrder: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              disabled={!editing?.title || saveMutation.isPending}
              onClick={() => editing && saveMutation.mutate(editing)}
              className="gap-2"
            >
              {saveMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              {editing?.id ? "Save Changes" : "Create Offer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
