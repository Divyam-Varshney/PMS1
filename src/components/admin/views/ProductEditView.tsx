// ============================================================================
// File: src/components/admin/views/ProductEditView.tsx
// Purpose: Product create/edit form — full catalog fields + image management.
//          Redesigned with 5 tabs (Basic Info, Pricing, Inventory, Attributes,
//          Images) and a sticky bottom save bar with unsaved-changes indicator.
// ============================================================================

"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, run } from "../api";
import { ProductGalleryManager } from "../product-gallery-manager";
import { SearchProductImages } from "../search-product-images";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "../RichTextEditor";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trash2, Upload, Star, TrendingUp, Award, Save, ArrowLeft,
  Loader2, Package, DollarSign, Boxes, SlidersHorizontal, RotateCcw,
  ImagePlus,
  Search, ShieldCheck, Sparkles, CheckCircle2, AlertCircle,
  ChevronDown, ChevronUp, ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAdminStore } from "../admin-store";
import { slugify, formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// ── AI Content Generator types ──
// Mirrors the response shape of POST /api/admin/ai/generate-product (3-step
// pipeline: primary search → validation → AI generation with field verification).
type StepStatus = "pending" | "running" | "done";

interface VerifiedFieldInfo {
  field: string;
  value: string;
  sources: string[];
  confidence: "high" | "medium" | "low";
}

interface AIGenerateResult {
  generated: any;
  title: string;
  pipeline: {
    step1PrimarySearch: {
      sourcesSearched: string[];
      sourcesWithResults: string[];
      totalHits: number;
    };
    step2Validation: {
      sourcesChecked: string[];
      sourcesWithResults: string[];
      totalHits: number;
    };
    step3Verification: {
      verifiedFields: VerifiedFieldInfo[];
      verifiedCount: number;
      conflictsDetected: number;
    };
  };
  sourcesUsed: string[];
  sourcesFoundCount: number;
  searchResultsCount: number;
  verifiedFieldsCount: number;
}

// Quick-pick suggestion chips — help admins understand the expected format.
const QUICK_SUGGESTIONS = [
  "Dolo 650",
  "Crocin Advance",
  "Augmentin 625",
  "Monocef 250 Injection",
  "Azithral 500",
];

// Human-readable labels for the verified-field keys returned by the API.
const VERIFIED_FIELD_LABELS: Record<string, string> = {
  brandName: "Brand",
  manufacturer: "Manufacturer",
  genericName: "Generic Name",
  composition: "Composition",
  mrp: "MRP",
};

export function ProductEditView({ id }: { id?: string }) {
  const navigate = useAdminStore((s) => s.navigate);
  const back = useAdminStore((s) => s.back);
  const qc = useQueryClient();
  const isEdit = !!id;

  const { data: product } = useQuery({
    queryKey: ["admin-product", id],
    queryFn: () => api.get<any>(`/api/admin/products/${id}`),
    enabled: !!id,
  });
  const { data: brands } = useQuery({
    queryKey: ["admin-brands-all"],
    queryFn: () => api.get<any[]>("/api/admin/brands"),
  });
  const { data: categories } = useQuery({
    queryKey: ["admin-categories-all"],
    queryFn: () => api.get<any[]>("/api/admin/categories"),
  });

  const [form, setForm] = useState<any>({
    name: "",
    slug: "",
    sku: "",
    shortDescription: "",
    description: "",
    composition: "",
    genericName: "",
    manufacturer: "",
    hsnCode: "",
    brandId: "",
    categoryId: "",
    unit: "",
    packSize: "",
    mrp: 0,
    sellingPrice: 0,
    baseDiscountPct: 0,
    maxDiscountPct: 0,
    costPrice: "",
    taxPct: 0,
    stock: 0,
    lowStockThreshold: 10,
    prescriptionRequired: false,
    isGeneric: false,
    isFeatured: false,
    isBestSeller: false,
    isTrending: false,
    status: "active",
    visibility: "public",
    displayOrder: 0,
  });
  const [gallery, setGallery] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  // When true, baseDiscountPct auto-follows (MRP - Selling) / MRP * 100 as the
  // admin edits MRP or Selling Price. Turned off when the admin manually
  // overrides the Base Discount field (they can re-enable it to recapture).
  const [autoBase, setAutoBase] = useState(true);
  // ── AI Content Generator state ──
  // Single input box for the medicine name + 3-step pipeline visualization.
  // The API is one call, but we fake sequential step progression with timers
  // so the admin sees a live "search → validate → generate" workflow.
  const [medicineName, setMedicineName] = useState("");
  const [aiState, setAiState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AIGenerateResult | null>(null);
  const [step1Status, setStep1Status] = useState<StepStatus>("pending");
  const [step2Status, setStep2Status] = useState<StepStatus>("pending");
  const [step3Status, setStep3Status] = useState<StepStatus>("pending");
  const [reportOpen, setReportOpen] = useState(true);

  // ---- Dirty-state tracking for the sticky save bar ----
  // Snapshot of the form + gallery right after load (or after a successful
  // save). Compared against the live form to show "Unsaved changes".
  const [snapshot, setSnapshot] = useState<string>("");
  const isDirty = JSON.stringify({ form, gallery }) !== snapshot;
  function captureSnapshot() {
    setSnapshot(JSON.stringify({ form, gallery }));
  }

  useEffect(() => {
    if (product) {
      const mrp = product.mrp ?? 0;
      const sellingPrice = product.sellingPrice ?? 0;
      const storedBase = product.baseDiscountPct ?? 0;
      const derivedBase =
        mrp > 0
          ? Math.round(((mrp - sellingPrice) / mrp) * 1000) / 10
          : 0;
      // If the stored baseDiscountPct matches the derived value, the admin
      // hasn't overridden it — keep autoBase on. Otherwise, treat as override.
       
      setAutoBase(Math.abs(storedBase - derivedBase) < 0.05);
      const nextForm = {
        ...product,
        brandId: product.brandId || "",
        categoryId: product.categoryId || "",
        mrp,
        sellingPrice,
        baseDiscountPct: storedBase,
        maxDiscountPct: product.maxDiscountPct ?? storedBase,
        costPrice: product.costPrice != null ? product.costPrice : "",
        taxPct: product.taxPct ?? 0,
        stock: product.stock ?? 0,
        lowStockThreshold: product.lowStockThreshold ?? 10,
        displayOrder: product.displayOrder ?? 0,
      };
      setForm(nextForm);
      // Pre-fill the AI generator input with the current product name so the
      // admin can regenerate without re-typing. (Only runs on product load —
      // subsequent edits to medicineName are preserved since this effect only
      // fires when the product query refetches, which happens after save.)
      setMedicineName(product.name || "");
      let nextGallery: string[] = [];
      try {
        nextGallery = product.galleryImages ? JSON.parse(product.galleryImages) : [];
      } catch {
        nextGallery = [];
      }
      setGallery(nextGallery);
      // Capture snapshot AFTER state updates are flushed. Using a microtask
      // ensures we read the values that will actually be rendered.
      queueMicrotask(() => {
        setSnapshot(JSON.stringify({ form: nextForm, gallery: nextGallery }));
      });
    }
  }, [product]);

  // For new products, capture the initial empty snapshot once on mount.
  useEffect(() => {
    if (!isEdit) {
       
      captureSnapshot();
    }
  }, []);

  // auto-compute baseDiscountPct when mrp/sellingPrice changes AND the admin
  // hasn't manually overridden it (autoBase=true). When autoBase is false, the
  // admin's value is preserved even if they later tweak MRP/Selling.
  useEffect(() => {
    if (!autoBase) return;
    if (form.mrp > 0 && form.sellingPrice >= 0) {
      const d = Math.round(((Number(form.mrp) - Number(form.sellingPrice)) / Number(form.mrp)) * 1000) / 10;
       
      setForm((f: any) => ({ ...f, baseDiscountPct: d > 0 ? d : 0 }));
    }
  }, [form.mrp, form.sellingPrice, autoBase]);

  function set<K extends keyof typeof form>(k: K, v: any) {
    setForm((f: any) => ({ ...f, [k]: v }));
  }

  // ── AI Product Generator (Search → Validate → Generate pipeline) ──
  // 1. Step 1: web-searches 4 primary pharmacy sources + general pharmacy query
  // 2. Step 2: cross-validates against 15 trusted healthcare references
  // 3. Step 3: AI generates all fields grounded in the verified context
  // Auto-creates brand + category if they don't exist, then applies every
  // generated field to the form. The pipeline metadata is preserved in
  // `aiResult` so the transparency report can render after completion.
  async function aiGenerate() {
    const title = medicineName.trim();
    if (!title) {
      toast.error("Enter a medicine name first");
      return;
    }

    // Reset pipeline state for a fresh run.
    setAiState("running");
    setAiError(null);
    setAiResult(null);
    setStep1Status("running");
    setStep2Status("pending");
    setStep3Status("pending");

    // Sequential step progression (purely visual — the API is a single call).
    // Step 1 (search) shows "running" for ~2.5s, Step 2 (validate) for ~3.5s,
    // Step 3 (generate) stays "running" until the API responds.
    const t1 = setTimeout(() => {
      setStep1Status("done");
      setStep2Status("running");
    }, 2500);
    const t2 = setTimeout(() => {
      setStep2Status("done");
      setStep3Status("running");
    }, 6000);

    try {
      const r = await api.post<AIGenerateResult>(
        "/api/admin/ai/generate-product",
        { title }
      );
      clearTimeout(t1);
      clearTimeout(t2);

      // Mark all steps done — the full pipeline completed.
      setStep1Status("done");
      setStep2Status("done");
      setStep3Status("done");
      setAiResult(r);

      const g = r.generated;
      if (!g) {
        setAiState("error");
        setAiError("AI did not return any data");
        return;
      }

      // Auto-create brand if it doesn't exist
      let brandId = g.brandId;
      if (!brandId && g.brandName) {
        const created = await run(
          () => api.post<any>("/api/admin/brands", {
            name: g.brandName,
            slug: slugify(g.brandName),
            status: "active",
            visibility: "public",
          }),
          { silent: true }
        );
        if (created) {
          brandId = created.id;
          qc.invalidateQueries({ queryKey: ["admin-brands-all"] });
          toast.success(`Created new brand: ${g.brandName}`);
        }
      }

      // Auto-create category if it doesn't exist
      let categoryId = g.categoryId;
      if (!categoryId && g.categoryName) {
        const created = await run(
          () => api.post<any>("/api/admin/categories", {
            name: g.categoryName,
            slug: slugify(g.categoryName),
            status: "active",
            visibility: "public",
          }),
          { silent: true }
        );
        if (created) {
          categoryId = created.id;
          qc.invalidateQueries({ queryKey: ["admin-categories-all"] });
          toast.success(`Created new category: ${g.categoryName}`);
        }
      }

      // Apply all generated fields to the form. The medicine name the admin
      // entered becomes the product name — it's the source of truth.
      setForm((f: any) => ({
        ...f,
        name: title,
        slug: g.slug || slugify(title),
        sku: g.sku || f.sku,
        hsnCode: g.hsnCode || f.hsnCode,
        shortDescription: g.shortDescription || f.shortDescription,
        description: g.description || f.description,
        composition: g.composition || f.composition,
        genericName: g.genericName || f.genericName,
        manufacturer: g.manufacturer || g.brandName || f.manufacturer,
        brandId: brandId || f.brandId,
        categoryId: categoryId || f.categoryId,
        unit: g.unit || f.unit,
        packSize: g.packSize || f.packSize,
        mrp: g.mrp ? Number(g.mrp) : f.mrp,
        sellingPrice: g.sellingPrice ? Number(g.sellingPrice) : f.sellingPrice,
        baseDiscountPct: g.baseDiscountPct || f.baseDiscountPct,
        maxDiscountPct: g.maxDiscountPct || f.maxDiscountPct,
        prescriptionRequired: g.prescriptionRequired ?? f.prescriptionRequired,
        isGeneric: g.isGeneric ?? f.isGeneric,
      }));

      setAiState("done");

      // Tailored toast based on whether sources were found.
      if (r.sourcesFoundCount === 0) {
        toast.warning("AI generated data from its own knowledge", {
          description: "No pharmacy sources found — please verify carefully before publishing.",
        });
      } else {
        toast.success(`✓ Product data generated from ${r.sourcesFoundCount} verified source${r.sourcesFoundCount !== 1 ? "s" : ""}`, {
          description: r.sourcesUsed?.length ? r.sourcesUsed.join(" · ") : undefined,
        });
      }
    } catch (e: any) {
      clearTimeout(t1);
      clearTimeout(t2);
      // Advance all steps to done so the error card can render cleanly below
      // the completed pipeline visualization.
      setStep1Status("done");
      setStep2Status("done");
      setStep3Status("done");
      setAiState("error");
      setAiError(e?.message || "AI generation failed");
    }
  }

  async function save(exitAfter: boolean = true) {
    if (!form.name.trim()) {
      toast.error("Product name is required");
      return;
    }
    setSaving(true);
    const payload = { ...form, slug: form.slug?.trim() || slugify(form.name) };
    const result = isEdit
      ? await run(() => api.put<{ id: string }>(`/api/admin/products/${id}`, payload), {
          success: "Product saved",
          error: "Save failed",
          silent: true,
        })
      : await run(() => api.post<{ id: string }>("/api/admin/products", payload), {
          success: "Product created",
          error: "Create failed",
          silent: true,
        });
    setSaving(false);
    if (result) {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["admin-product", id] });
      // Re-capture snapshot so the unsaved indicator clears.
      captureSnapshot();
      if (exitAfter) {
        toast.success(isEdit ? "Product saved" : "Product created");
        back();
      } else {
        toast.success(isEdit ? "Product saved — continuing to edit" : "Product created — continuing to edit");
        // If it was a new product, navigate to the edit view with the new ID
        if (!isEdit && result.id) {
          navigate({ name: "product-edit", id: result.id });
        }
      }
    }
  }

  function discard() {
    if (!isDirty) return;
    if (!confirm("Discard unsaved changes?")) return;
    try {
      const snap = JSON.parse(snapshot);
      setForm(snap.form);
      setGallery(snap.gallery || []);
      // Reset autoBase based on whether the snapshot's base matches derived.
      const f = snap.form;
      const derived = f.mrp > 0
        ? Math.round(((Number(f.mrp) - Number(f.sellingPrice)) / Number(f.mrp)) * 1000) / 10
        : 0;
      setAutoBase(Math.abs((f.baseDiscountPct ?? 0) - derived) < 0.05);
    } catch {
      toast.error("Could not restore previous state");
    }
  }

  async function del() {
    if (!id) return;
    if (!confirm(`Move this product to trash? You can restore it later from the Trashed filter.`)) return;
    const r = await run(() => api.del<{ trashed?: boolean }>(`/api/admin/products/${id}`), {
      success: "Product moved to trash",
      error: "Delete failed",
      silent: true,
    });
    if (r) {
      toast.success("Product moved to trash. Use Trashed filter to restore.");
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      navigate({ name: "products" });
    }
  }

  return (
    <div className="pb-24">
      {/* Top header — Back + title + Delete (for edit) */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={back}>
            <ArrowLeft className="size-4 mr-1" /> Back
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isEdit ? "Edit Product" : "New Product"}
          </h1>
          {isEdit && isDirty && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
              Unsaved
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isEdit && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive hover:text-destructive">
                  <Trash2 className="size-4 mr-1" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this product?</AlertDialogTitle>
                  <AlertDialogDescription>
                    If the product has been ordered before, it will be marked inactive instead of being deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={del} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <Tabs defaultValue="basic">
        <TabsList className="mb-4 flex-wrap h-auto">
          <TabsTrigger value="basic" className="gap-1.5"><Package className="size-3.5" /> Basic Info</TabsTrigger>
          <TabsTrigger value="pricing" className="gap-1.5"><DollarSign className="size-3.5" /> Pricing</TabsTrigger>
          <TabsTrigger value="inventory" className="gap-1.5"><Boxes className="size-3.5" /> Inventory</TabsTrigger>
          <TabsTrigger value="attributes" className="gap-1.5"><SlidersHorizontal className="size-3.5" /> Attributes</TabsTrigger>
          <TabsTrigger value="gallery" className="gap-1.5"><ImagePlus className="size-3.5" /> Gallery</TabsTrigger>
        </TabsList>

        {/* ============================ Basic Info ============================ */}
        <TabsContent value="basic">
          {/* AI Content Generator — single input + 3-step pipeline visualization */}
          <Card className="mb-4 border-emerald-200 dark:border-emerald-900/50 overflow-hidden">
            <div className="bg-linear-to-br from-emerald-50/60 to-teal-50/60 dark:from-emerald-950/20 dark:to-teal-950/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className="flex size-7 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      <Sparkles className="size-4" />
                    </span>
                    AI Content Generator
                    <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800 text-[10px] font-semibold">
                      Beta
                    </Badge>
                  </CardTitle>
                </div>
                <CardDescription>
                  Enter the exact medicine name as sold in Indian pharmacies. The AI searches trusted
                  pharmacy sources, verifies the data against healthcare references, and fills all
                  fields automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* ── Single input box + Generate button ── */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Enter Medicine Name</Label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      value={medicineName}
                      onChange={(e) => setMedicineName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && medicineName.trim() && aiState !== "running") {
                          aiGenerate();
                        }
                      }}
                      placeholder="e.g., Monocef 250 Injection, Dolo 650 Tablet, Crocin Advance"
                      disabled={aiState === "running"}
                      className="flex-1"
                    />
                    <Button
                      onClick={aiGenerate}
                      disabled={aiState === "running" || !medicineName.trim()}
                      className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white sm:w-auto"
                    >
                      {aiState === "running" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Sparkles className="size-4" />
                      )}
                      {aiState === "running" ? "Generating..." : "Search & Generate with AI"}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Enter the exact medicine name as sold in Indian pharmacies. The AI will search
                    trusted pharmacy sources, verify the data, and fill all fields automatically.
                  </p>
                  {/* Quick-suggestion chips */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-muted-foreground mr-0.5">Try:</span>
                    {QUICK_SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setMedicineName(s)}
                        disabled={aiState === "running"}
                        className="rounded-full border border-emerald-200 bg-white/60 dark:border-emerald-900/50 dark:bg-emerald-950/20 px-2.5 py-0.5 text-[11px] text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <span>⏱</span> Takes 15–45 seconds
                  </p>
                </div>

                {/* ── 3-step pipeline visualization ── */}
                <AnimatePresence>
                  {aiState !== "idle" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-2 rounded-lg border border-emerald-100 dark:border-emerald-900/40 bg-white/40 dark:bg-emerald-950/10 p-3">
                        <PipelineStep
                          status={step1Status}
                          stepNum={1}
                          icon={Search}
                          title="Searching Pharmacy Sources"
                          subtitle="Amazon Pharmacy · Tata 1mg · Apollo · PharmEasy"
                          doneMessage={
                            aiResult?.pipeline?.step1PrimarySearch
                              ? `${aiResult.pipeline.step1PrimarySearch.sourcesWithResults.length} sources returned results · ${aiResult.pipeline.step1PrimarySearch.totalHits} hits`
                              : undefined
                          }
                        />
                        <PipelineStep
                          status={step2Status}
                          stepNum={2}
                          icon={ShieldCheck}
                          title="Cross-Validating with Healthcare References"
                          subtitle="Drugs.com · MedlinePlus · WebMD · MIMS · 15 trusted sources"
                          doneMessage={
                            aiResult?.pipeline
                              ? `${aiResult.pipeline.step2Validation.sourcesWithResults.length} references confirmed · ${aiResult.pipeline.step3Verification.verifiedCount} fields verified`
                              : undefined
                          }
                        />
                        <PipelineStep
                          status={step3Status}
                          stepNum={3}
                          icon={Sparkles}
                          title="Generating Product Data with AI"
                          subtitle="Filling all fields with verified information"
                          doneMessage={aiResult ? "Generated all fields" : undefined}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ── Error state ── */}
                {aiState === "error" && aiError && (
                  <Alert variant="destructive">
                    <AlertCircle className="size-4" />
                    <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                      <span>
                        <span className="font-medium">Generation failed:</span> {aiError}
                      </span>
                      <Button
                        onClick={aiGenerate}
                        variant="outline"
                        size="sm"
                        className="shrink-0 h-7"
                      >
                        Try Again
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                {/* ── No-sources warning ── */}
                {aiState === "done" && aiResult && aiResult.sourcesFoundCount === 0 && (
                  <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                    <AlertCircle className="size-4" />
                    <AlertDescription>
                      No pharmacy sources found for this medicine. The AI generated data from its own
                      knowledge — please verify carefully before publishing.
                    </AlertDescription>
                  </Alert>
                )}

                {/* ── Transparency report (collapsible) ── */}
                {aiState === "done" && aiResult && (
                  <TransparencyReport
                    result={aiResult}
                    open={reportOpen}
                    onOpenChange={setReportOpen}
                  />
                )}
              </CardContent>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Basic Information</CardTitle>
              <CardDescription>Product identification & taxonomy.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Name" required>
                <Input value={form.name || ""} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Paracetamol 500mg" />
              </Field>
              <Field label="Slug">
                <Input value={form.slug || ""} onChange={(e) => set("slug", e.target.value)} placeholder="auto from name" />
              </Field>
              <Field label="SKU">
                <Input value={form.sku || ""} onChange={(e) => set("sku", e.target.value)} placeholder="PARA-500" />
              </Field>
              <Field label="HSN Code">
                <Input value={form.hsnCode || ""} onChange={(e) => set("hsnCode", e.target.value)} placeholder="30049099" />
              </Field>
              <Field label="Brand">
                <Select value={form.brandId || "_none"} onValueChange={(v) => set("brandId", v === "_none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— No brand —</SelectItem>
                    {(brands || []).map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Category">
                <Select value={form.categoryId || "_none"} onValueChange={(v) => set("categoryId", v === "_none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— No category —</SelectItem>
                    {(categories || []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Short Description">
                <Input value={form.shortDescription || ""} onChange={(e) => set("shortDescription", e.target.value)} placeholder="One-liner for cards" />
              </Field>
              <Field label="Manufacturer">
                <Input value={form.manufacturer || ""} onChange={(e) => set("manufacturer", e.target.value)} placeholder="Acme Pharma" />
              </Field>
              <div className="md:col-span-2">
                <Field label="Full Description">
                  <RichTextEditor
                    value={form.description || ""}
                    onChange={(html) => set("description", html)}
                    placeholder="Write a detailed product description. Use the toolbar to format text, add headings, lists, and links..."
                  />
                </Field>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================ Pricing ============================ */}
        <TabsContent value="pricing">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pricing</CardTitle>
              <CardDescription>
                Base discount auto-follows MRP → Selling Price. Max discount caps the total
                discount ever applied (including cart-upgrade and voucher-driven). Set cost price
                to enable margin alerts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="MRP (Rs.)" required>
                  <Input type="number" step="0.01" value={form.mrp} onChange={(e) => set("mrp", parseFloat(e.target.value) || 0)} />
                </Field>
                <Field label="Selling Price (Rs.)" required>
                  <Input type="number" step="0.01" value={form.sellingPrice} onChange={(e) => set("sellingPrice", parseFloat(e.target.value) || 0)} />
                </Field>
                <Field label="Cost Price (Rs.) — optional">
                  <Input
                    type="number"
                    step="0.01"
                    value={form.costPrice ?? ""}
                    onChange={(e) => set("costPrice", e.target.value)}
                    placeholder="blank = not tracked"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Your purchase cost (optional, for margin alerts).
                  </p>
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Base Discount %">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.1"
                      value={form.baseDiscountPct}
                      readOnly={autoBase}
                      onChange={(e) => {
                        // Editing the field turns off auto-follow so the
                        // override survives future MRP/Selling edits.
                        setAutoBase(false);
                        set("baseDiscountPct", parseFloat(e.target.value) || 0);
                      }}
                      className={autoBase ? "bg-muted/50 cursor-not-allowed" : ""}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant={autoBase ? "secondary" : "outline"}
                      className="shrink-0"
                      onClick={() => {
                        const next = !autoBase;
                        setAutoBase(next);
                        if (next) {
                          // Recapture: immediately recompute base from MRP/Selling.
                          const d =
                            form.mrp > 0
                              ? Math.round(((Number(form.mrp) - Number(form.sellingPrice)) / Number(form.mrp)) * 1000) / 10
                              : 0;
                          set("baseDiscountPct", d > 0 ? d : 0);
                        }
                      }}
                      title={autoBase ? "Auto is ON — click to override" : "Override is ON — click to recapture from MRP/Selling"}
                    >
                      {autoBase ? "Auto" : "Manual"}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Discount shown to customer by default. Auto-calculated from MRP→Selling Price,
                    but you can override.
                  </p>
                </Field>
                <Field label="Max Discount %">
                  <Input
                    type="number"
                    step="0.1"
                    value={form.maxDiscountPct}
                    onChange={(e) => set("maxDiscountPct", parseFloat(e.target.value) || 0)}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Hard ceiling — total discount (including cart-upgrade) never exceeds this.
                    Protects your margin. Set equal to Base Discount % if no extra discount should
                    ever be given.
                  </p>
                </Field>
              </div>

              {/* Live margin indicator (only when costPrice is set) */}
              {form.costPrice !== "" && form.costPrice != null && Number(form.costPrice) > 0 && (
                <MarginIndicator
                  mrp={Number(form.mrp) || 0}
                  sellingPrice={Number(form.sellingPrice) || 0}
                  costPrice={Number(form.costPrice) || 0}
                  maxDiscountPct={Number(form.maxDiscountPct) || 0}
                />
              )}

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2 border-t">
                <Field label="Status">
                  <Select value={form.status} onValueChange={(v) => set("status", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Visibility">
                  <Select value={form.visibility} onValueChange={(v) => set("visibility", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="hidden">Hidden</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================ Inventory ============================ */}
        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Inventory & Packaging</CardTitle>
              <CardDescription>
                Stock levels, low-stock alerts, and packaging details.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Stock Quantity">
                <Input type="number" value={form.stock} onChange={(e) => set("stock", parseInt(e.target.value) || 0)} />
              </Field>
              <Field label="Low Stock Threshold">
                <Input type="number" value={form.lowStockThreshold} onChange={(e) => set("lowStockThreshold", parseInt(e.target.value) || 0)} />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Show a low-stock warning when stock falls to or below this number.
                </p>
              </Field>
              <Field label="Unit">
                <Input value={form.unit || ""} onChange={(e) => set("unit", e.target.value)} placeholder="strip" />
              </Field>
              <Field label="Pack Size">
                <Input value={form.packSize || ""} onChange={(e) => set("packSize", e.target.value)} placeholder="10 tablets" />
              </Field>
              <Field label="Display Order">
                <Input type="number" value={form.displayOrder} onChange={(e) => set("displayOrder", parseInt(e.target.value) || 0)} />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Lower numbers appear first in catalog listings.
                </p>
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================ Attributes ============================ */}
        <TabsContent value="attributes">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Attributes & Display Flags</CardTitle>
              <CardDescription>
                Composition / generic info and storefront highlights.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Composition">
                  <Input value={form.composition || ""} onChange={(e) => set("composition", e.target.value)} placeholder="Paracetamol 500mg" />
                </Field>
                <Field label="Generic Name">
                  <Input value={form.genericName || ""} onChange={(e) => set("genericName", e.target.value)} placeholder="Paracetamol" />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t">
                <FlagRow
                  label="Prescription Required"
                  description="Customer must upload a valid prescription"
                  checked={!!form.prescriptionRequired}
                  onChange={(v) => set("prescriptionRequired", v)}
                  icon={<Upload className="size-4" />}
                />
                <FlagRow
                  label="Generic Medicine"
                  description="Eligible for auto generic discount"
                  checked={!!form.isGeneric}
                  onChange={(v) => set("isGeneric", v)}
                  icon={<Award className="size-4" />}
                />
                <FlagRow
                  label="Featured"
                  description="Show on home page featured grid"
                  checked={!!form.isFeatured}
                  onChange={(v) => set("isFeatured", v)}
                  icon={<Star className="size-4" />}
                />
                <FlagRow
                  label="Best Seller"
                  description="Show as best seller"
                  checked={!!form.isBestSeller}
                  onChange={(v) => set("isBestSeller", v)}
                  icon={<Award className="size-4" />}
                />
                <FlagRow
                  label="Trending"
                  description="Show in trending section"
                  checked={!!form.isTrending}
                  onChange={(v) => set("isTrending", v)}
                  icon={<TrendingUp className="size-4" />}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================ Gallery ============================ */}
        <TabsContent value="gallery">
          {/* Search Product Images — auto-reads product title, searches trusted sources */}
          <SearchProductImages
            productName={form.name}
            brandName={(brands || []).find((b: any) => b.id === form.brandId)?.name}
            composition={form.composition}
            productId={isEdit ? id : undefined}
          />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Product Gallery</CardTitle>
              <CardDescription>
                Upload, import, and manage product images — drag-and-drop, bulk actions, reorder, set primary, SEO metadata, and more.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProductGalleryManager productId={isEdit ? id : ""} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ============================ Sticky save bar ============================ */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto max-w-[1600px] px-4 md:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            {isDirty ? (
              <>
                <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-amber-700 font-medium">Unsaved changes</span>
              </>
            ) : (
              <>
                <span className="size-2 rounded-full bg-emerald-500" />
                <span className="text-muted-foreground">All changes saved</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={back}>
              Cancel
            </Button>
            {isDirty && (
              <Button variant="ghost" onClick={discard} className="gap-1.5">
                <RotateCcw className="size-4" /> Discard
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => save(false)}
              disabled={saving || !form.name.trim()}
              className="gap-1.5"
            >
              {saving ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Save className="size-4 mr-1" />}
              {saving ? "Saving..." : "Save & Continue"}
            </Button>
            <Button
              onClick={() => save(true)}
              disabled={saving || !form.name.trim()}
              className="gap-1.5"
            >
              {saving ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Save className="size-4 mr-1" />}
              {saving ? "Saving..." : isEdit ? "Save & Exit" : "Create Product"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

function FlagRow({
  label,
  description,
  checked,
  onChange,
  icon,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-md border bg-muted/30">
      <div className="flex items-center gap-3">
        <div className="size-9 rounded-md bg-primary/10 text-primary flex items-center justify-center">{icon}</div>
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/**
 * Live margin indicator. Shows the current profit margin (relative to MRP, so
 * it's directly comparable to discount percentages) and warns if the configured
 * maxDiscountPct would push the worst-case selling price below cost.
 */
function MarginIndicator({
  mrp,
  sellingPrice,
  costPrice,
  maxDiscountPct,
}: {
  mrp: number;
  sellingPrice: number;
  costPrice: number;
  maxDiscountPct: number;
}) {
  // Margin % is MRP-relative: (MRP - Cost) / MRP * 100. This is the maximum
  // discount that can be applied before the discounted price drops below cost.
  const marginPct =
    mrp > 0 ? Math.round(((mrp - costPrice) / mrp) * 1000) / 10 : 0;
  const profitPerUnit = sellingPrice - costPrice;
  const wouldCauseLoss = maxDiscountPct > marginPct && mrp > 0 && marginPct >= 0;

  return (
    <div
      className={`rounded-md border p-3 text-sm flex flex-wrap items-center gap-x-4 gap-y-1 ${
        wouldCauseLoss
          ? "border-rose-200 bg-rose-50 text-rose-900"
          : "border-emerald-200 bg-emerald-50 text-emerald-900"
      }`}
    >
      <span className="font-medium">
        Margin: {marginPct.toFixed(1)}%
        <span className="text-xs font-normal opacity-80"> (MRP-relative)</span>
      </span>
      <span className="text-xs opacity-80">
        Profit at selling price: {formatCurrency(Math.max(0, profitPerUnit))} / unit
      </span>
      {wouldCauseLoss && (
        <span className="text-xs font-medium">
          ⚠ Max discount ({maxDiscountPct.toFixed(1)}%) exceeds margin — worst-case
          selling price {formatCurrency(mrp * (1 - maxDiscountPct / 100))} is below
          cost ({formatCurrency(costPrice)}).
        </span>
      )}
    </div>
  );
}

// ============================================================================
// AI Content Generator — sub-components
// Declared OUTSIDE the main component (stable refs, no re-creation per render,
// satisfies react-hooks/static-components lint rule). All purely presentational.
// ============================================================================

/**
 * PipelineStep — one row in the 3-step workflow visualization.
 * Shows step number, icon, title, subtitle, and status (pending/running/done).
 * When running: spinner + animated bouncing dots + pulsing ring.
 * When done: green checkmark + doneMessage (e.g. "3 sources returned results").
 */
function PipelineStep({
  status,
  stepNum,
  icon: Icon,
  title,
  subtitle,
  doneMessage,
}: {
  status: StepStatus;
  stepNum: number;
  icon: typeof Search;
  title: string;
  subtitle: string;
  doneMessage?: string;
}) {
  const isRunning = status === "running";
  const isDone = status === "done";

  return (
    <motion.div
      initial={{ opacity: 0.4 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={`flex items-start gap-3 rounded-md border p-2.5 transition-colors ${
        isRunning
          ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30"
          : isDone
            ? "border-emerald-100 bg-white/50 dark:border-emerald-900/30 dark:bg-emerald-950/10"
            : "border-muted bg-muted/20 opacity-60"
      }`}
    >
      {/* Step number / status icon with pulsing ring when running */}
      <div className="relative flex shrink-0 items-center justify-center">
        <div
          className={`flex size-8 items-center justify-center rounded-full ${
            isDone
              ? "bg-emerald-600 text-white"
              : isRunning
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                : "bg-muted text-muted-foreground"
          }`}
        >
          {isDone ? (
            <CheckCircle2 className="size-4" />
          ) : isRunning ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Icon className="size-4" />
          )}
        </div>
        {isRunning && (
          <span className="absolute inset-0 rounded-full bg-emerald-400/30 animate-ping" />
        )}
      </div>

      {/* Step content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-muted-foreground">
            STEP {stepNum}
          </span>
          {isDone && (
            <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              DONE
            </span>
          )}
          {isRunning && (
            <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 animate-pulse">
              RUNNING
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Icon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          {title}
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</div>

        {/* Done message — e.g. "3 sources returned results · 12 hits" */}
        {isDone && doneMessage && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300"
          >
            ✓ {doneMessage}
          </motion.div>
        )}

        {/* Running indicator — animated bouncing dots */}
        {isRunning && (
          <div className="mt-1 flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.3s]" />
            <span className="size-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.15s]" />
            <span className="size-1.5 rounded-full bg-emerald-500 animate-bounce" />
          </div>
        )}
      </div>
    </motion.div>
  );
}

/**
 * TransparencyReport — collapsible card shown after AI generation completes.
 * Renders the full pipeline metadata: pharmacy sources searched (with hit/no-hit
 * indicators), healthcare references checked, field-level verification (value +
 * confidence badge + verifying sources), and the top source domains used.
 */
function TransparencyReport({
  result,
  open,
  onOpenChange,
}: {
  result: AIGenerateResult;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const step1 = result.pipeline?.step1PrimarySearch;
  const step2 = result.pipeline?.step2Validation;
  const verifiedFields = result.pipeline?.step3Verification?.verifiedFields || [];

  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className="rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-white/60 dark:bg-emerald-950/10"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 p-3 text-left hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-colors">
        <div className="flex items-center gap-2 flex-wrap">
          <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="text-sm font-medium">Transparency Report</span>
          <Badge
            variant="outline"
            className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800"
          >
            {result.sourcesFoundCount} sources · {result.verifiedFieldsCount} verified · {result.searchResultsCount} hits
          </Badge>
        </div>
        {open ? (
          <ChevronUp className="size-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-4 border-t border-emerald-100 dark:border-emerald-900/40 p-3">
          {/* Step 1 — pharmacy sources searched */}
          {step1 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Search className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-semibold">
                  Step 1 — Pharmacy Sources Searched
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {step1.sourcesSearched.map((src) => {
                  const found = step1.sourcesWithResults.includes(src);
                  return (
                    <SourcePill key={src} label={src} found={found} />
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2 — healthcare references checked */}
          {step2 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-semibold">
                  Step 2 — Healthcare References Checked
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {step2.sourcesChecked.map((src) => {
                  const found = step2.sourcesWithResults.includes(src);
                  return (
                    <SourcePill key={src} label={src} found={found} />
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3 — field-level verification */}
          {verifiedFields.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-semibold">
                  Step 3 — Field-Level Verification
                </span>
              </div>
              <div className="space-y-1.5">
                {verifiedFields.map((vf) => (
                  <VerifiedFieldRow key={vf.field} field={vf} />
                ))}
              </div>
            </div>
          )}

          {/* Top source domains used (max 8) */}
          {result.sourcesUsed && result.sourcesUsed.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <ExternalLink className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-semibold">Top Sources Used</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {result.sourcesUsed.map((src) => (
                  <span
                    key={src}
                    className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20 px-2 py-0.5 text-[11px] text-emerald-700 dark:text-emerald-300"
                  >
                    {src}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * SourcePill — a single source domain in the transparency report.
 * Green check if it returned results, gray dash if no results.
 */
function SourcePill({ label, found }: { label: string; found: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${
        found
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
          : "bg-muted text-muted-foreground"
      }`}
      title={found ? "Returned results" : "No results found"}
    >
      {found ? (
        <CheckCircle2 className="size-3" />
      ) : (
        <span className="inline-block size-3 text-center leading-3 text-[10px]">—</span>
      )}
      {label}
    </span>
  );
}

/**
 * VerifiedFieldRow — one verified field in the transparency report.
 * Shows: confidence badge (high=green, medium=amber, low=gray), field label,
 * verified value, and "verified by N sources: X, Y, Z".
 */
function VerifiedFieldRow({ field }: { field: VerifiedFieldInfo }) {
  const confidenceConfig: Record<
    "high" | "medium" | "low",
    { label: string; className: string }
  > = {
    high: {
      label: "High",
      className:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    },
    medium: {
      label: "Medium",
      className:
        "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    },
    low: {
      label: "Low",
      className: "bg-muted text-muted-foreground",
    },
  };
  const conf = confidenceConfig[field.confidence] || confidenceConfig.low;
  const fieldLabel = VERIFIED_FIELD_LABELS[field.field] || field.field;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 rounded-md border border-emerald-100 dark:border-emerald-900/30 bg-white/40 dark:bg-emerald-950/10 p-2">
      <div className="flex items-center gap-2 sm:w-36 shrink-0">
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${conf.className}`}
        >
          {conf.label}
        </span>
        <span className="text-xs font-medium text-muted-foreground">{fieldLabel}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate" title={field.value}>
          {field.value}
        </div>
        <div className="text-[10px] text-muted-foreground">
          verified by {field.sources.length} source{field.sources.length !== 1 ? "s" : ""}: {field.sources.join(", ")}
        </div>
      </div>
    </div>
  );
}
