// ============================================================================
// File: src/components/admin/search-product-images.tsx
// Purpose: "Search Product Images" — automatically reads the product title
//          from the form and searches trusted pharmacy sources for REAL
//          product packaging photos. No manual typing needed.
//
//          Workflow:
//            1. Product title is auto-read from the parent form (prop)
//            2. Admin selects a source (Google, Amazon, Apollo, 1mg, etc.)
//            3. Click "Search Images" → API searches the web
//            4. Results are grouped by source website in a clean gallery
//            5. Admin selects one or multiple images
//            6. Click "Save Selected to Gallery" → images are uploaded
//               to the product's gallery via the gallery API
//
//          Key features:
//            • Auto-reads product title (no manual input)
//            • Source selector (6 trusted pharmacy sources)
//            • Results grouped by source website
//            • Multi-select with checkboxes
//            • Bulk upload to product gallery
//            • "Set as Primary" toggle
//            • Per-image upload
//            • Clean, professional, production-ready UI
// ============================================================================

"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, Loader2, Upload, CheckCircle2,
  Trash2, Star, ExternalLink, AlertTriangle, ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { api } from "./api";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchResult {
  url: string;
  source: string;
  width?: string;
  height?: string;
  selected: boolean;
  uploaded?: boolean;
}

interface SourceOption {
  id: string;
  label: string;
  badgeColor: string;
}

const SOURCE_OPTIONS: SourceOption[] = [
  { id: "all-pharmacy", label: "All Pharmacy Sources (Recommended)", badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" },
  { id: "amazon", label: "Amazon Pharmacy", badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300" },
  { id: "1mg", label: "Tata 1mg", badgeColor: "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300" },
  { id: "apollo", label: "Apollo Pharmacy", badgeColor: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300" },
  { id: "pharmeasy", label: "PharmEasy", badgeColor: "bg-teal-100 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300" },
  { id: "netmeds", label: "Netmeds", badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" },
  { id: "practo", label: "Practo", badgeColor: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300" },
  { id: "medplus", label: "MedPlus", badgeColor: "bg-pink-100 text-pink-800 dark:bg-pink-950/40 dark:text-pink-300" },
  { id: "apollo247", label: "Apollo 247", badgeColor: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300" },
  { id: "google", label: "Google (All Sources)", badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300" },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  /** Product title — auto-read from the parent form, no manual input needed */
  productName: string;
  /** Brand name — used to improve search accuracy */
  brandName?: string;
  /** Composition — optional, used for search context */
  composition?: string;
  /** Product ID — required for uploading images to the gallery */
  productId?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SearchProductImages({
  productName,
  brandName,
  composition,
  productId,
}: Props) {
  const qc = useQueryClient();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [setAsPrimary, setSetAsPrimary] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedSource, setSelectedSource] = useState("all-pharmacy");
  const [activeSourceLabel, setActiveSourceLabel] = useState("");

  const isEdit = !!productId;

  // Clear results when product changes
  useEffect(() => {
    setResults([]);
    setActiveSourceLabel("");
  }, [productId]);

  // ── Search for real product images ──
  const doSearch = useCallback(async (source?: string) => {
    const src = source || selectedSource;
    if (!productName.trim()) {
      toast.error("Enter a product name first (Basic Info tab).");
      return;
    }
    if (isSearching) return;

    setResults([]);
    setIsSearching(true);

    try {
      const r = await api.post<{
        results: SearchResult[];
        count: number;
        sourceLabel: string;
      }>("/api/admin/ai/search-product-images", {
        productName,
        brand: brandName,
        composition,
        source: src,
        count: 15,
      });

      setResults(r.results || []);
      setActiveSourceLabel(r.sourceLabel);

      if (r.count > 0) {
        toast.success(`Found ${r.count} images from ${r.sourceLabel}`);
      } else {
        toast.info(`No images found from ${r.sourceLabel}. Try another source.`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Image search failed");
    } finally {
      setIsSearching(false);
    }
  }, [productName, brandName, composition, selectedSource, isSearching]);

  // ── Toggle selection ──
  const toggleSelect = (index: number) => {
    setResults((prev) =>
      prev.map((r, i) => (i === index ? { ...r, selected: !r.selected } : r))
    );
  };

  const selectAll = () => {
    const allSelected = results.every((r) => r.selected || r.uploaded);
    setResults((prev) =>
      prev.map((r) => (r.uploaded ? r : { ...r, selected: !allSelected }))
    );
  };

  // ── Upload a single image ──
  const uploadImage = useCallback(async (index: number) => {
    const result = results[index];
    if (!result?.url || !isEdit) return;

    try {
      const imgRes = await fetch(result.url);
      if (!imgRes.ok) throw new Error(`Failed to fetch image (HTTP ${imgRes.status})`);
      const blob = await imgRes.blob();
      const formData = new FormData();
      const ext = blob.type === "image/png" ? "png" : "jpg";
      formData.append("files", blob, `product-image-${Date.now()}-${index}.${ext}`);

      const r = await api.upload<{ uploaded: string[]; errors: string[] }>(
        `/api/admin/products/${productId}/gallery`,
        formData
      );

      if (r.uploaded?.length > 0) {
        if (setAsPrimary && r.uploaded[0]) {
          try {
            await api.patch(`/api/admin/products/${productId}/gallery`, {
              action: "set-primary",
              imageId: r.uploaded[0],
            });
            toast.success("Image uploaded and set as primary");
          } catch {
            toast.success("Image uploaded to gallery");
          }
        } else {
          toast.success("Image uploaded to gallery");
        }

        setResults((prev) =>
          prev.map((res, i) => (i === index ? { ...res, uploaded: true, selected: false } : res))
        );
        qc.invalidateQueries({ queryKey: ["admin-product", productId] });
        qc.invalidateQueries({ queryKey: ["product-gallery", productId] });
      } else {
        toast.error(r.errors?.[0] || "Upload failed");
      }
    } catch (e: any) {
      toast.error(`Upload failed: ${e?.message || "unknown error"}`);
    }
  }, [results, isEdit, productId, setAsPrimary, qc]);

  // ── Upload ALL selected images ──
  const uploadSelected = useCallback(async () => {
    const selectedIndices = results
      .map((r, i) => (r.selected && !r.uploaded ? i : -1))
      .filter((i) => i >= 0);

    if (selectedIndices.length === 0) {
      toast.error("No images selected.");
      return;
    }
    if (!isEdit) {
      toast.error("Save the product first, then upload images.");
      return;
    }

    setUploading(true);
    let successCount = 0;
    let failCount = 0;
    let firstUploadedImageId: string | undefined;

    for (const index of selectedIndices) {
      const result = results[index];
      try {
        const imgRes = await fetch(result.url);
        if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status}`);
        const blob = await imgRes.blob();
        const formData = new FormData();
        const ext = blob.type === "image/png" ? "png" : "jpg";
        formData.append("files", blob, `product-image-${Date.now()}-${index}.${ext}`);

        const r = await api.upload<{ uploaded: string[]; errors: string[] }>(
          `/api/admin/products/${productId}/gallery`,
          formData
        );

        if (r.uploaded?.length > 0) {
          if (!firstUploadedImageId) firstUploadedImageId = r.uploaded[0];
          successCount++;
          setResults((prev) =>
            prev.map((res, i) => (i === index ? { ...res, uploaded: true, selected: false } : res))
          );
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    if (setAsPrimary && firstUploadedImageId) {
      try {
        await api.patch(`/api/admin/products/${productId}/gallery`, {
          action: "set-primary",
          imageId: firstUploadedImageId,
        });
      } catch { /* best-effort */ }
    }

    setUploading(false);

    if (successCount > 0) {
      toast.success(`Uploaded ${successCount} image${successCount !== 1 ? "s" : ""} to gallery`, {
        description: failCount > 0 ? `${failCount} failed` : undefined,
      });
      qc.invalidateQueries({ queryKey: ["admin-product", productId] });
      qc.invalidateQueries({ queryKey: ["product-gallery", productId] });
    } else {
      toast.error("All uploads failed.");
    }
  }, [results, isEdit, productId, setAsPrimary, qc]);

  const clearResults = useCallback(() => {
    setResults([]);
    setActiveSourceLabel("");
  }, []);

  const selectedCount = results.filter((r) => r.selected && !r.uploaded).length;
  const uploadedCount = results.filter((r) => r.uploaded).length;
  const allSelected = results.length > 0 && results.every((r) => r.selected || r.uploaded);

  // Group results by source for display
  const groupedResults = results.reduce<Record<string, SearchResult[]>>((acc, r, i) => {
    const key = r.source || "Unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push({ ...r, _index: i } as any);
    return acc;
  }, {});
  const sourceNames = Object.keys(groupedResults);

  return (
    <Card className="mb-4 border-amber-200 dark:border-amber-900 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="size-4 text-amber-600 dark:text-amber-400" /> Search Product Images
            </CardTitle>
            <CardDescription className="mt-1">
              Automatically searches for <strong>real product packaging photos</strong> using the
              product title. Select images and save them to the gallery.
            </CardDescription>
          </div>
          {results.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearResults} className="text-muted-foreground">
              <Trash2 className="size-3.5 mr-1" /> Clear
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Product title indicator */}
        {productName.trim() && !isSearching && results.length === 0 && (
          <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
            <ShieldCheck className="size-3.5" />
            <span>Product title ready: <strong>"{productName}"</strong> — click Search to find images.</span>
          </div>
        )}

        {/* Source selector + search button */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Source
            </Label>
            <Select
              value={selectedSource}
              onValueChange={(v) => {
                setSelectedSource(v);
              }}
              disabled={isSearching}
            >
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SOURCE_OPTIONS.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            disabled={isSearching || uploading || !productName.trim()}
            onClick={() => doSearch()}
            className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isSearching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            {isSearching ? "Searching..." : "Search Images"}
          </Button>
          {results.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              disabled={isSearching}
              onClick={() => doSearch()}
              className="gap-1.5"
              title="Search again with the same source"
            >
              <RefreshCw className="size-3.5" /> Refresh
            </Button>
          )}
        </div>

        {/* Searching indicator */}
        {isSearching && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
            <Loader2 className="size-3.5 animate-spin" />
            Searching {SOURCE_OPTIONS.find(s => s.id === selectedSource)?.label} for "{productName}"... (5-90 seconds)
          </div>
        )}

        {/* Active source badge */}
        {activeSourceLabel && !isSearching && (
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30 px-3 py-2 text-xs">
            <ShieldCheck className="size-3.5 text-amber-600" />
            <span className="text-muted-foreground">Source: </span>
            <Badge className={SOURCE_OPTIONS.find(s => s.id === selectedSource)?.badgeColor}>
              {activeSourceLabel}
            </Badge>
            <span className="text-muted-foreground">· {results.length} image{results.length !== 1 ? "s" : ""} found</span>
          </div>
        )}

        {/* Set-as-primary toggle */}
        {isEdit && selectedCount > 0 && (
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30 px-3 py-2">
            <Switch id="set-primary-search" checked={setAsPrimary} onCheckedChange={setSetAsPrimary} />
            <Label htmlFor="set-primary-search" className="text-xs cursor-pointer flex items-center gap-1">
              <Star className="size-3 text-amber-500" />
              Set first uploaded image as primary
            </Label>
          </div>
        )}

        {/* Bulk actions bar */}
        {results.length > 0 && !isSearching && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-accent/30 p-2">
            <Button variant="ghost" size="sm" onClick={selectAll} className="gap-1.5 text-xs">
              <div className={`size-3.5 rounded ${allSelected ? "bg-amber-600" : "border border-muted-foreground/30"}`} />
              {allSelected ? "Deselect all" : "Select all"}
            </Button>
            {selectedCount > 0 && (
              <>
                <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  {selectedCount} selected
                </Badge>
                {isEdit && (
                  <Button size="sm" onClick={uploadSelected} disabled={uploading} className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white">
                    {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                    {uploading ? "Uploading..." : `Save Selected (${selectedCount})`}
                  </Button>
                )}
              </>
            )}
            {uploadedCount > 0 && (
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="size-3 mr-1" /> {uploadedCount} saved
              </Badge>
            )}
          </div>
        )}

        {/* Results — grouped by source website */}
        {results.length > 0 && (
          <div className="space-y-4">
            {sourceNames.map((sourceName) => (
              <div key={sourceName}>
                {/* Source group header */}
                <div className="mb-2 flex items-center gap-2">
                  <Badge className="text-[10px] gap-0.5 bg-black/70 text-white">
                    <ShieldCheck className="size-2.5" /> {sourceName}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {groupedResults[sourceName].length} image{groupedResults[sourceName].length !== 1 ? "s" : ""}
                  </span>
                </div>
                {/* Image grid for this source */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {groupedResults[sourceName].map((result: any) => {
                    const i = (result as any)._index;
                    return (
                      <div key={i} className={`group relative overflow-hidden rounded-lg border bg-card transition-all ${
                        result.uploaded ? "border-emerald-300 dark:border-emerald-800"
                        : result.selected ? "border-amber-400 ring-2 ring-amber-300 dark:border-amber-700 dark:ring-amber-800"
                        : "border-border hover:border-amber-300"
                      }`}>
                        <div className="relative aspect-square w-full bg-accent/20">
                          <img
                            src={result.url}
                            alt={`Product image from ${sourceName}`}
                            className="size-full object-contain"
                            loading="lazy"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                          {/* Selection checkbox */}
                          {!result.uploaded && (
                            <button
                              onClick={() => toggleSelect(i)}
                              className="absolute left-1.5 top-1.5 z-10 flex size-7 items-center justify-center rounded-md bg-white/90 shadow-sm backdrop-blur-sm transition-all hover:bg-white"
                              aria-label={result.selected ? "Deselect" : "Select"}
                            >
                              {result.selected
                                ? <CheckCircle2 className="size-5 text-amber-600" />
                                : <div className="size-5 rounded-full border-2 border-muted-foreground/30" />
                              }
                            </button>
                          )}
                          {/* Uploaded badge */}
                          {result.uploaded && (
                            <div className="absolute right-1.5 top-1.5 z-10 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm">
                              <CheckCircle2 className="size-4" />
                            </div>
                          )}
                          {/* External link */}
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute bottom-1 right-1 z-10 flex size-5 items-center justify-center rounded bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
                            aria-label="Open original image"
                          >
                            <ExternalLink className="size-3" />
                          </a>
                        </div>
                        {/* Footer */}
                        <div className="p-2 space-y-1">
                          {result.width && result.height && (
                            <p className="text-[9px] text-muted-foreground/70">{result.width} × {result.height}</p>
                          )}
                          {isEdit && !result.uploaded && (
                            <Button
                              size="sm"
                              variant={result.selected ? "default" : "outline"}
                              onClick={() => uploadImage(i)}
                              disabled={uploading}
                              className="w-full h-7 text-[10px] gap-1"
                            >
                              <Upload className="size-3" /> Save
                            </Button>
                          )}
                          {result.uploaded && (
                            <p className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="size-3" /> Saved to gallery
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {results.length === 0 && !isSearching && !productName.trim() && (
          <div className="rounded-lg border border-dashed border-amber-200 dark:border-amber-800 p-6 text-center">
            <Search className="mx-auto mb-2 size-8 text-amber-400" />
            <p className="text-sm font-medium text-foreground">Enter a product title to search for images</p>
            <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
              Images are searched automatically once the product title is entered.
              <br /><span className="text-[11px] text-muted-foreground/70">
              Sources: Amazon Pharmacy, Tata 1mg, Apollo, PharmEasy, Netmeds, Practo, MedPlus, Apollo 247, Google
              </span>
            </p>
          </div>
        )}

        {/* Info note */}
        <div className="rounded-md border border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30 px-3 py-2">
          <p className="flex items-start gap-1.5 text-[11px] text-amber-800 dark:text-amber-300">
            <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
            <span><strong>Important:</strong> All images come from trusted pharmacy sources.
            Always review images before publishing. Ensure you have the right to use each image.</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
