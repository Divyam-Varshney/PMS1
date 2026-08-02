// ============================================================================
// File: src/components/admin/product-gallery-manager.tsx
// Purpose: Professional media-manager-style product gallery editor.
//   Features:
//   - Drag & drop upload + click to upload + multi-file queue
//   - Per-file upload progress (XMLHttpRequest)
//   - Client-side image compression before upload (Canvas API, toggle)
//   - File validation (type / size / total) with inline error feedback
//   - Import from URL (single or multiple)
//   - Drag-to-reorder with emerald drop indicator line + dragged ghost
//   - Touch-friendly mobile reorder (Move Up / Move Down buttons)
//   - Prominent primary-image ribbon (amber) + always-visible Star button
//   - Bulk select, bulk set primary, bulk delete, bulk download
//   - Lightbox with zoom, prev/next, metadata sidebar, Edit SEO shortcut
//   - Duplicate detection (client-side hash + API error feedback)
//   - SEO completeness badge on cards with alt text
//   - Sticky/fixed bulk action bar (sticky top on desktop, fixed bottom on mobile)
//   - Stats bar (count, total size, primary count, alt-text coverage)
//   - Mobile bottom-sheet action menu per card
// ============================================================================

"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "./api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Tooltip, TooltipTrigger, TooltipContent, TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Upload, Link as LinkIcon, Trash2, Star, Copy, Download, Eye,
  GripVertical, X, Loader2, Image as ImageIcon,
  RefreshCw, AlertCircle, ZoomIn, ZoomOut, ChevronLeft, ChevronRight,
  MoreVertical, CheckCircle2, BadgeCheck, Search, MoveUp, MoveDown,
  Sparkles, FileWarning, ImageOff, Layers, HardDrive,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProductImage {
  id: string;
  productId: string;
  imagePath: string;
  originalName: string;
  altText: string | null;
  title: string | null;
  caption: string | null;
  description: string | null;
  displayOrder: number;
  isPrimary: boolean;
  width: number | null;
  height: number | null;
  fileSize: number;
  mimeType: string;
  hash: string | null;
  createdAt: string;
}

interface UploadItem {
  id: string;
  file: File;
  status: "queued" | "compressing" | "uploading" | "done" | "error" | "skipped";
  progress: number;
  error?: string;
  originalSize: number;
  compressedSize?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB per file
const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB total per batch
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSize(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

/** Compress an image client-side using the Canvas API. Targets max 1600px on
 *  the longest side and JPEG quality 0.85. PNGs with transparency get a white
 *  background baked in (since JPEG doesn't support alpha). Returns the original
 *  file unchanged if compression fails or isn't applicable. */
async function compressImage(file: File, maxDim = 1600, quality = 0.85): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  // Skip tiny JPEGs — already small enough.
  if (file.size < 200 * 1024 && file.type === "image/jpeg") return file;
  try {
    const img = await createImageBitmap(file);
    let { width, height } = img;
    if (width > maxDim || height > maxDim) {
      const ratio = Math.min(maxDim / width, maxDim / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    // White background so transparent PNGs don't get black when JPEG-encoded.
    if (file.type === "image/png") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    if (!blob || blob.size >= file.size) return file; // don't upscale
    return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/** XMLHttpRequest-based uploader with real per-file progress events.
 *  Returns the same shape as `api.upload<T>` but resolves once the XHR
 *  completes. Throws ApiError on non-2xx or network failure. */
function uploadWithProgress(
  url: string,
  formData: FormData,
  onProgress: (loaded: number, total: number) => void
): Promise<{ uploaded: string[]; count: number; errors: string[] }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded, e.total);
    };
    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && json.ok) {
          resolve(json.data as { uploaded: string[]; count: number; errors: string[] });
        } else {
          reject(new ApiError(json.error || `Upload failed (${xhr.status})`, xhr.status));
        }
      } catch {
        reject(new ApiError(`Upload failed (${xhr.status})`, xhr.status));
      }
    };
    xhr.onerror = () => reject(new ApiError("Network error during upload", 0));
    xhr.send(formData);
  });
}

/** Compute a short SHA-256 prefix for a file (used for client-side duplicate
 *  detection). Returns "" if the SubtleCrypto API is unavailable (e.g. insecure
 *  context) so callers can gracefully fall back. */
async function computeFileHash(file: File): Promise<string> {
  try {
    if (!crypto?.subtle) return "";
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
      .slice(0, 8)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return "";
  }
}

function downloadFile(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "download";
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ===========================================================================
// SUB-COMPONENTS (declared OUTSIDE the main component so they have stable
// references and don't trigger react-hooks/static-components lint warnings)
// ===========================================================================

// ---------------------------------------------------------------------------
// StatsBar — quick overview: count · total size · primary · alt-text coverage
// ---------------------------------------------------------------------------

function StatsBar({
  images,
}: {
  images: ProductImage[];
}) {
  const count = images.length;
  const totalBytes = images.reduce((sum, i) => sum + (i.fileSize || 0), 0);
  const primaryCount = images.filter((i) => i.isPrimary).length;
  const withAlt = images.filter((i) => i.altText && i.altText.trim()).length;

  const stats = [
    { icon: ImageIcon, label: `${count} ${count === 1 ? "image" : "images"}`, color: "text-emerald-600" },
    { icon: HardDrive, label: formatSize(totalBytes), color: "text-teal-600" },
    { icon: Star, label: `${primaryCount} primary`, color: "text-amber-600" },
    { icon: BadgeCheck, label: `${withAlt}/${count} alt text`, color: withAlt === count && count > 0 ? "text-emerald-600" : "text-muted-foreground" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-emerald-200/60 bg-emerald-50/40 px-4 py-2.5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
      {stats.map((s, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <s.icon className={cn("size-3.5", s.color)} />
          <span className="text-xs font-medium text-foreground/80">{s.label}</span>
          {i < stats.length - 1 && <span className="text-muted-foreground/40 ml-3 hidden sm:inline">·</span>}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// UploadZone — drag-drop + click + per-file progress + compression toggle
// ---------------------------------------------------------------------------

function UploadZone({
  productId,
  onUploaded,
  existingHashes,
}: {
  productId: string;
  onUploaded: (count: number) => void;
  existingHashes: Set<string>;
}) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [compress, setCompress] = useState(true);
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const dragCounter = useRef(0);

  // Reset queue UI 6s after the last item finishes, so the drop zone reappears.
  useEffect(() => {
    if (queue.length === 0 || processing) return;
    const allDone = queue.every((q) => q.status === "done" || q.status === "error" || q.status === "skipped");
    if (!allDone) return;
    const t = setTimeout(() => setQueue([]), 6000);
    return () => clearTimeout(t);
  }, [queue, processing]);

  const updateItem = useCallback((id: string, patch: Partial<UploadItem>) => {
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }, []);

  const processQueue = useCallback(async (items: UploadItem[], compressOn: boolean) => {
    setProcessing(true);
    let successCount = 0;
    let dupCount = 0;
    for (const item of items) {
      if (item.status === "skipped") continue;
      try {
        // 1. Compress (if enabled and not already skipped)
        let file = item.file;
        if (compressOn) {
          updateItem(item.id, { status: "compressing" });
          file = await compressImage(item.file);
        }
        updateItem(item.id, { compressedSize: file.size });

        // 2. Upload with progress
        updateItem(item.id, { status: "uploading", progress: 0 });
        const fd = new FormData();
        fd.append("files", file);
        const res = await uploadWithProgress(
          `/api/admin/products/${productId}/gallery`,
          fd,
          (loaded, total) => updateItem(item.id, { progress: total ? Math.round((loaded / total) * 100) : 0 })
        );

        if (res.count > 0) {
          successCount++;
          updateItem(item.id, { status: "done", progress: 100 });
        } else if (res.errors?.length) {
          const err = res.errors[0] || "rejected";
          if (err.toLowerCase().includes("duplicate")) {
            dupCount++;
            updateItem(item.id, { status: "skipped", error: "Duplicate — already in gallery" });
          } else {
            updateItem(item.id, { status: "error", error: err.replace(/^.*?:\s*/, "") });
          }
        } else {
          updateItem(item.id, { status: "done", progress: 100 });
          successCount++;
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Upload failed";
        updateItem(item.id, { status: "error", error: msg });
      }
    }
    setProcessing(false);

    // Toast summary
    if (successCount > 0) {
      toast.success(`${successCount} image${successCount !== 1 ? "s" : ""} uploaded`, {
        description: "Gallery refreshed",
      });
      qc.invalidateQueries({ queryKey: ["product-gallery", productId] });
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      onUploaded(successCount);
    }
    if (dupCount > 0) {
      toast.warning(`${dupCount} duplicate${dupCount !== 1 ? "s" : ""} skipped`, {
        description: "Already exists in this gallery",
      });
    }
    const errCount = items.filter((i) => i.status === "error").length;
    if (errCount > 0) {
      toast.error(`${errCount} file${errCount !== 1 ? "s" : ""} failed to upload`);
    }
  }, [productId, qc, onUploaded, updateItem]);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (!arr.length) return;

    // Build queue with validation
    const items: UploadItem[] = [];
    let totalSize = 0;
    for (const file of arr) {
      const id = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      const mime = (file.type || "").split(";")[0].trim();
      if (!ALLOWED_TYPES.includes(mime)) {
        items.push({
          id, file, status: "skipped", progress: 0, originalSize: file.size,
          error: `Unsupported type (${mime || "unknown"})`,
        });
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        items.push({
          id, file, status: "skipped", progress: 0, originalSize: file.size,
          error: `File too large (max ${formatSize(MAX_FILE_SIZE)})`,
        });
        continue;
      }
      if (file.size < 100) {
        items.push({
          id, file, status: "skipped", progress: 0, originalSize: file.size,
          error: "File too small",
        });
        continue;
      }
      totalSize += file.size;
      items.push({
        id, file, status: "queued", progress: 0, originalSize: file.size,
      });
    }

    if (totalSize > MAX_TOTAL_SIZE) {
      toast.error("Total upload too large", {
        description: `Max ${formatSize(MAX_TOTAL_SIZE)} per batch — got ${formatSize(totalSize)}`,
      });
      return;
    }

    // Pre-flight duplicate detection (client-side hash). Skip files whose
    // SHA-256 prefix already exists in the gallery.
    setQueue(items);
    if (existingHashes.size > 0) {
      for (const item of items) {
        if (item.status !== "queued") continue;
        const hash = await computeFileHash(item.file);
        if (hash && existingHashes.has(hash)) {
          updateItem(item.id, {
            status: "skipped",
            error: "Duplicate — already in gallery",
          });
        }
      }
    }

    // Re-read latest queue state (we may have just marked some as skipped)
    setQueue((prev) => {
      void processQueue(prev, compress);
      return prev;
    });
  }, [existingHashes, compress, processQueue, updateItem]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  // Render — either the per-file upload queue (when items exist) or the
  // inviting drop zone.
  const showQueue = queue.length > 0;

  return (
    <div className="space-y-2">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); }}
        onDragEnter={(e) => { e.preventDefault(); dragCounter.current++; setDragOver(true); }}
        onDragLeave={() => {
          dragCounter.current = Math.max(0, dragCounter.current - 1);
          if (dragCounter.current === 0) setDragOver(false);
        }}
        className={cn(
          "relative rounded-xl border-2 border-dashed p-6 text-center transition-all",
          dragOver
            ? "border-emerald-500 bg-emerald-50/60 scale-[1.01]"
            : "border-border hover:border-emerald-400/60 hover:bg-emerald-50/20",
          showQueue && "p-3 text-left"
        )}
      >
        {showQueue ? (
          /* ── Per-file upload queue ── */
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1 pb-1">
              <span className="text-xs font-semibold text-foreground/80">
                {queue.length} file{queue.length !== 1 ? "s" : ""} in queue
              </span>
              {!processing && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={() => setQueue([])}
                >
                  <X className="size-3 mr-1" /> Dismiss
                </Button>
              )}
            </div>
            <div className="max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
              {queue.map((item) => (
                <UploadQueueRow key={item.id} item={item} />
              ))}
            </div>
          </div>
        ) : (
          /* ── Drop zone ── */
          <>
            {/* Drag-over pulsing overlay */}
            <AnimatePresence>
              {dragOver && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl bg-emerald-50/80 backdrop-blur-sm"
                >
                  <motion.div
                    animate={{ y: [0, -6, 0] }}
                    transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
                    className="flex size-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/40"
                  >
                    <Upload className="size-7" />
                  </motion.div>
                  <p className="mt-2 text-sm font-semibold text-emerald-700">Drop to upload</p>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div
              animate={{ scale: dragOver ? 1.02 : 1 }}
              className="flex flex-col items-center gap-1.5"
            >
              <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40">
                <Upload className="size-6" />
              </div>
              <p className="text-sm font-medium">Drag & drop images here</p>
              <p className="text-xs text-muted-foreground">
                JPG, PNG, WEBP — max {formatSize(MAX_FILE_SIZE)} each — up to {formatSize(MAX_TOTAL_SIZE)} per batch
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="size-3.5 mr-1.5" /> Upload Files
                </Button>
                {/* Compress toggle — rendered as a labelled container (not a
                    button) because the inner <Switch> renders as <button>
                    and nesting buttons is invalid HTML. Clicking the label
                    toggles the switch via the Switch's own onCheckedChange. */}
                <Label
                  htmlFor="gallery-compress-toggle"
                  className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent"
                >
                  <Sparkles className={cn("size-3.5", compress ? "text-emerald-500" : "text-muted-foreground")} />
                  Compress
                  <Switch
                    id="gallery-compress-toggle"
                    checked={compress}
                    onCheckedChange={setCompress}
                    className="scale-75"
                  />
                </Label>
              </div>
              {compress && (
                <p className="mt-1 text-[10px] text-emerald-600/80 dark:text-emerald-400/80">
                  Images will be compressed to max 1600px, JPEG 85% before upload
                </p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                data-gallery-file-input="true"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) handleFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}

function UploadQueueRow({ item }: { item: UploadItem }) {
  const pct = item.progress || 0;
  const savings = item.compressedSize && item.compressedSize < item.originalSize
    ? Math.round((1 - item.compressedSize / item.originalSize) * 100)
    : 0;

  return (
    <div className="flex items-center gap-3 rounded-md border bg-card px-3 py-2">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted overflow-hidden">
        {item.status === "done" ? (
          <CheckCircle2 className="size-5 text-emerald-500" />
        ) : item.status === "error" ? (
          <AlertCircle className="size-5 text-rose-500" />
        ) : item.status === "skipped" ? (
          <FileWarning className="size-5 text-amber-500" />
        ) : item.status === "compressing" ? (
          <Sparkles className="size-4 text-emerald-500 animate-pulse" />
        ) : (
          <Loader2 className="size-4 animate-spin text-emerald-500" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs font-medium" title={item.file.name}>{item.file.name}</p>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {item.status === "compressing" && "Compressing…"}
            {item.status === "uploading" && `${pct}%`}
            {item.status === "done" && (savings > 0 ? `−${savings}%` : "Done")}
            {item.status === "error" && "Failed"}
            {item.status === "skipped" && "Skipped"}
            {item.status === "queued" && "Queued"}
          </span>
        </div>
        {item.error ? (
          <p className="truncate text-[10px] text-rose-500" title={item.error}>{item.error}</p>
        ) : (
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              className={cn(
                "h-full",
                item.status === "done" ? "bg-emerald-500" : "bg-emerald-400"
              )}
              initial={{ width: 0 }}
              animate={{ width: `${item.status === "compressing" ? 30 : pct}%` }}
              transition={{ duration: 0.25 }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BulkActionBar — sticky on desktop, fixed bottom on mobile
// ---------------------------------------------------------------------------

function BulkActionBar({
  selectedCount,
  totalCount,
  isDeleting,
  onDelete,
  onClear,
  onSetPrimary,
  onBulkDownload,
  onSelectAll,
  allSelected,
}: {
  selectedCount: number;
  totalCount: number;
  isDeleting: boolean;
  onDelete: () => void;
  onClear: () => void;
  onSetPrimary: () => void;
  onBulkDownload: () => void;
  onSelectAll: () => void;
  allSelected: boolean;
}) {
  return (
    <div className="sticky top-0 z-30 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-300/60 bg-emerald-50/95 px-3 py-2 shadow-md shadow-emerald-900/5 backdrop-blur sm:gap-3 sm:px-4 sm:py-2.5 dark:border-emerald-800/60 dark:bg-emerald-950/90">
      <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
        {selectedCount} selected
      </span>
      <span className="hidden text-xs text-muted-foreground sm:inline">
        of {totalCount}
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-1.5 sm:gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-xs"
          onClick={onSelectAll}
        >
          {allSelected ? "Deselect All" : "Select All"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:text-emerald-300"
          onClick={onSetPrimary}
          disabled={isDeleting}
        >
          <Star className="size-3.5" /> Set Primary
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5"
          onClick={onBulkDownload}
        >
          <Download className="size-3.5" /> Download
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="h-8 gap-1.5"
          disabled={isDeleting}
          onClick={onDelete}
        >
          {isDeleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
          Delete
        </Button>
        <Button size="sm" variant="ghost" className="h-8" onClick={onClear}>
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ImageCard — single image tile with all hover/mobile actions
// ---------------------------------------------------------------------------

interface ImageCardProps {
  img: ProductImage;
  index: number;
  isSelected: boolean;
  isDuplicate: boolean;
  hasAlt: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  onToggleSelect: () => void;
  onPreview: () => void;
  onSetPrimary: () => void;
  isSettingPrimary: boolean;
  onCopyUrl: () => void;
  onDownload: () => void;
  onEditMeta: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onMobileMenu: () => void;
}

function ImageCard({
  img, index, isSelected, isDuplicate, hasAlt, isDragging, isDropTarget,
  onToggleSelect, onPreview, onSetPrimary, isSettingPrimary, onCopyUrl,
  onDownload, onEditMeta, onDelete, onMoveUp, onMoveDown,
  onDragStart, onDragEnd, onDragOver, onDrop, onMobileMenu,
}: ImageCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: Math.min(index * 0.02, 0.3) }}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(e) => { e.preventDefault(); onDragOver(); }}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
      className={cn(
        "group relative rounded-lg border-2 bg-card overflow-hidden transition-all",
        img.isPrimary && "ring-2 ring-amber-400 border-amber-400 shadow-md shadow-amber-500/20",
        isSelected && !img.isPrimary && "border-emerald-500 ring-1 ring-emerald-500/30",
        !isSelected && !img.isPrimary && "border-border hover:border-emerald-400/60",
        isDragging && "opacity-50 rotate-2 scale-95",
        isDropTarget && "ring-2 ring-emerald-500 ring-offset-1"
      )}
    >
      {/* Drop indicator line (top edge) */}
      <AnimatePresence>
        {isDropTarget && (
          <motion.div
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            exit={{ scaleY: 0 }}
            className="absolute -top-0.5 left-0 right-0 z-30 h-0.5 origin-left bg-emerald-500"
          />
        )}
      </AnimatePresence>

      {/* Primary ribbon (top-left) — prominent banner, not just a tiny badge */}
      {img.isPrimary && (
        <div className="absolute top-0 left-0 z-20">
          <div className="relative">
            {/* Ribbon tail */}
            <div className="absolute -bottom-2 left-0 h-0 w-0 border-t-8 border-l-8 border-t-amber-700/80 border-l-transparent" />
            <div className="flex items-center gap-1 bg-gradient-to-r from-amber-400 to-amber-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
              <Star className="size-3 fill-white" />
              Primary
            </div>
          </div>
        </div>
      )}

      {/* Duplicate badge */}
      {isDuplicate && (
        <Badge className={cn(
          "absolute z-20 gap-0.5 bg-rose-500 text-white text-[9px]",
          img.isPrimary ? "top-1 right-1" : "top-1.5 left-1.5"
        )}>
          <Layers className="size-2.5" /> Dup
        </Badge>
      )}

      {/* SEO verified checkmark — bottom-left, tiny */}
      {hasAlt && !img.isPrimary && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="absolute bottom-1.5 right-1.5 z-20 flex size-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                <BadgeCheck className="size-3.5" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">Has alt text (SEO ready)</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Selection checkbox (top-right, always visible) */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
        aria-label={isSelected ? "Deselect image" : "Select image"}
        aria-pressed={isSelected}
        className="absolute top-1.5 right-1.5 z-20 flex size-6 items-center justify-center rounded-md border-2 transition-all"
        style={{
          backgroundColor: isSelected ? "rgb(16 185 129)" : "rgba(255,255,255,0.92)",
          borderColor: isSelected ? "rgb(5 150 105)" : "rgba(0,0,0,0.35)",
        }}
      >
        {isSelected && (
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>

      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-muted/30">
        <img
          src={img.imagePath}
          alt={img.altText || img.originalName}
          className="size-full object-cover"
          loading="lazy"
          draggable={false}
        />

        {/* Drag handle — visible on hover (desktop) and always (mobile) */}
        <div className="absolute bottom-1.5 left-1.5 cursor-grab active:cursor-grabbing opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <div className="flex size-6 items-center justify-center rounded-md bg-black/40 text-white backdrop-blur-sm">
            <GripVertical className="size-4" />
          </div>
        </div>

        {/* Hover actions overlay (desktop only) */}
        <div className="absolute inset-0 hidden items-center justify-center gap-1 bg-black/55 opacity-0 transition-opacity group-hover:opacity-100 sm:flex">
          <CardActionBtn label="Preview" onClick={onPreview}>
            <Eye className="size-3.5" />
          </CardActionBtn>
          <CardActionBtn
            label={img.isPrimary ? "Primary" : "Set as Primary"}
            onClick={onSetPrimary}
            disabled={img.isPrimary || isSettingPrimary}
            active={img.isPrimary}
          >
            {isSettingPrimary ? <Loader2 className="size-3.5 animate-spin" /> : <Star className={cn("size-3.5", img.isPrimary && "fill-white")} />}
          </CardActionBtn>
          <CardActionBtn label="Copy URL" onClick={onCopyUrl}>
            <Copy className="size-3.5" />
          </CardActionBtn>
          <CardActionBtn label="Download" onClick={onDownload}>
            <Download className="size-3.5" />
          </CardActionBtn>
          <CardActionBtn label="Edit SEO" onClick={onEditMeta}>
            <RefreshCw className="size-3.5" />
          </CardActionBtn>
          <CardActionBtn label="Delete" onClick={onDelete} variant="danger">
            <Trash2 className="size-3.5" />
          </CardActionBtn>
        </div>
      </div>

      {/* Always-visible "Set as Primary" button (desktop, when not primary) */}
      {!img.isPrimary && (
        <div className="hidden sm:block">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-full gap-1.5 rounded-none border-t text-[11px] text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/40"
            onClick={onSetPrimary}
            disabled={isSettingPrimary}
          >
            {isSettingPrimary ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Star className="size-3" />
            )}
            Set as Primary
          </Button>
        </div>
      )}
      {img.isPrimary && (
        <div className="hidden h-7 items-center justify-center gap-1.5 border-t border-amber-200 bg-amber-50 text-[11px] font-semibold text-amber-700 sm:flex dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
          <Star className="size-3 fill-amber-500 text-amber-500" />
          Primary Image
        </div>
      )}

      {/* Mobile "more" button + move buttons */}
      <div className="flex items-center sm:hidden">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 flex-1 gap-1 rounded-none text-[11px]"
          onClick={onMoveUp}
          disabled={index === 0}
        >
          <MoveUp className="size-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 flex-1 gap-1 rounded-none border-l border-r text-[11px]"
          onClick={onMoveDown}
        >
          <MoveDown className="size-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 flex-1 gap-1 rounded-none text-[11px]"
          onClick={onMobileMenu}
        >
          <MoreVertical className="size-3" />
        </Button>
      </div>

      {/* Info */}
      <div className="p-2">
        <p className="truncate text-[10px] font-medium" title={img.originalName}>{img.originalName}</p>
        <div className="mt-0.5 flex items-center justify-between">
          <span className="text-[9px] text-muted-foreground">{formatSize(img.fileSize)}</span>
          {img.width && img.height ? (
            <span className="text-[9px] text-muted-foreground">{img.width}×{img.height}</span>
          ) : null}
        </div>
        <p className="mt-0.5 text-[8px] text-muted-foreground/70">{formatDateTime(img.createdAt)}</p>
      </div>
    </motion.div>
  );
}

// Small circular action button used inside the hover overlay.
function CardActionBtn({
  label, onClick, children, disabled, active, variant,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  active?: boolean;
  variant?: "danger";
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            disabled={disabled}
            aria-label={label}
            className={cn(
              "flex size-7 items-center justify-center rounded-full backdrop-blur-sm transition-colors",
              variant === "danger"
                ? "bg-rose-500/80 text-white hover:bg-rose-500"
                : active
                  ? "bg-amber-500 text-white"
                  : "bg-white/20 text-white hover:bg-white/35",
              disabled && "cursor-not-allowed opacity-40"
            )}
          >
            {children}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// Lightbox — zoom, prev/next, metadata sidebar, Edit SEO shortcut
// ---------------------------------------------------------------------------

function Lightbox({
  images,
  index,
  onClose,
  onNavigate,
  onEditMeta,
  onSetPrimary,
  isSettingPrimary,
}: {
  images: ProductImage[];
  index: number;
  onClose: () => void;
  onNavigate: (i: number) => void;
  onEditMeta: (img: ProductImage) => void;
  onSetPrimary: (img: ProductImage) => void;
  isSettingPrimary: boolean;
}) {
  const [zoom, setZoom] = useState(1);
  const img = images[index];

  // Reset zoom on image change.
  useEffect(() => { setZoom(1); }, [index]);

  // Keyboard nav: ← / → / Esc / + / -
  useEffect(() => {
    if (!img) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && index > 0) onNavigate(index - 1);
      else if (e.key === "ArrowRight" && index < images.length - 1) onNavigate(index + 1);
      else if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(z + 0.5, 3));
      else if (e.key === "-") setZoom((z) => Math.max(z - 0.5, 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [img, index, images.length, onClose, onNavigate]);

  if (!img) return null;

  return (
    <Dialog open={index >= 0} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px]">
          {/* Image area */}
          <div className="relative flex max-h-[80vh] items-center justify-center overflow-auto bg-black">
            {/* Prev */}
            {index > 0 && (
              <button
                onClick={() => onNavigate(index - 1)}
                aria-label="Previous image"
                className="absolute left-2 top-1/2 z-20 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70"
              >
                <ChevronLeft className="size-5" />
              </button>
            )}
            {/* Next */}
            {index < images.length - 1 && (
              <button
                onClick={() => onNavigate(index + 1)}
                aria-label="Next image"
                className="absolute right-2 top-1/2 z-20 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70"
              >
                <ChevronRight className="size-5" />
              </button>
            )}

            {/* Close */}
            <button
              onClick={onClose}
              aria-label="Close preview"
              className="absolute right-2 top-2 z-30 flex size-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
            >
              <X className="size-4" />
            </button>

            {/* Zoom controls */}
            <div className="absolute left-2 top-2 z-30 flex items-center gap-1 rounded-full bg-black/60 p-1 backdrop-blur-sm">
              <button
                onClick={() => setZoom((z) => Math.max(z - 0.5, 1))}
                disabled={zoom <= 1}
                aria-label="Zoom out"
                className="flex size-7 items-center justify-center rounded-full text-white hover:bg-white/20 disabled:opacity-30"
              >
                <ZoomOut className="size-4" />
              </button>
              <span className="px-1 text-xs font-medium text-white tabular-nums">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom((z) => Math.min(z + 0.5, 3))}
                disabled={zoom >= 3}
                aria-label="Zoom in"
                className="flex size-7 items-center justify-center rounded-full text-white hover:bg-white/20 disabled:opacity-30"
              >
                <ZoomIn className="size-4" />
              </button>
              {zoom !== 1 && (
                <button
                  onClick={() => setZoom(1)}
                  aria-label="Reset zoom"
                  className="flex size-7 items-center justify-center rounded-full text-white hover:bg-white/20"
                >
                  <RefreshCw className="size-3.5" />
                </button>
              )}
            </div>

            {/* The image */}
            <motion.img
              key={img.id}
              src={img.imagePath}
              alt={img.altText || img.originalName}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
              className="max-h-[80vh] max-w-full object-contain transition-transform duration-200"
              draggable={false}
            />

            {/* Position indicator */}
            <div className="absolute bottom-2 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
              {index + 1} / {images.length}
            </div>
          </div>

          {/* Metadata sidebar */}
          <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto border-t bg-card p-4 lg:max-h-[80vh] lg:border-l lg:border-t-0">
            <div>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold leading-tight">{img.originalName}</p>
                {img.isPrimary && (
                  <Badge className="shrink-0 gap-0.5 bg-amber-500 text-white text-[9px]">
                    <Star className="size-2.5 fill-white" /> Primary
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">{img.mimeType}</p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Meta label="File size" value={formatSize(img.fileSize)} />
              <Meta label="Dimensions" value={img.width && img.height ? `${img.width}×${img.height}` : "—"} />
              <Meta label="Uploaded" value={formatDateTime(img.createdAt)} />
              <Meta label="Order" value={`#${img.displayOrder}`} />
            </div>

            {/* Alt text preview */}
            <div className="rounded-md border bg-muted/30 p-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Alt text</p>
              <p className="mt-0.5 text-xs">{img.altText || <span className="italic text-amber-600">Missing — add for SEO</span>}</p>
            </div>

            {img.title && (
              <div className="rounded-md border bg-muted/30 p-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Title</p>
                <p className="mt-0.5 text-xs">{img.title}</p>
              </div>
            )}
            {img.caption && (
              <div className="rounded-md border bg-muted/30 p-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Caption</p>
                <p className="mt-0.5 text-xs">{img.caption}</p>
              </div>
            )}

            {/* Action buttons */}
            <div className="mt-auto flex flex-col gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => onEditMeta(img)}
              >
                <RefreshCw className="size-3.5" /> Edit SEO
              </Button>
              <Button
                size="sm"
                variant={img.isPrimary ? "secondary" : "outline"}
                className="gap-1.5"
                onClick={() => onSetPrimary(img)}
                disabled={img.isPrimary || isSettingPrimary}
              >
                {isSettingPrimary ? <Loader2 className="size-3.5 animate-spin" /> : <Star className={cn("size-3.5", img.isPrimary && "fill-amber-500 text-amber-500")} />}
                {img.isPrimary ? "Primary Image" : "Set as Primary"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-2">
      <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xs font-medium">{value}</p>
    </div>
  );
}

// ===========================================================================
// MAIN COMPONENT
// ===========================================================================

export function ProductGalleryManager({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [urlDialogOpen, setUrlDialogOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [importing, setImporting] = useState(false);
  const [previewIdx, setPreviewIdx] = useState<number>(-1);
  const [editMeta, setEditMeta] = useState<ProductImage | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number>(-1);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [mobileMenuImg, setMobileMenuImg] = useState<ProductImage | null>(null);
  const [primaryLoadingId, setPrimaryLoadingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["product-gallery", productId],
    queryFn: () => api.get<{ images: ProductImage[]; count: number }>(
      `/api/admin/products/${productId}/gallery`
    ),
    enabled: !!productId,
  });

  const images = data?.images ?? [];

  // ── Selection derivation ──
  // `selected` is the source of truth for user intent. We derive
  // `effectiveSelected` by intersecting it with the current image IDs — this
  // automatically drops stale IDs (e.g. after a delete that hasn't cleared
  // the Set yet, or if the query refetches with fewer images). Doing this as
  // a derived value (rather than an effect that calls setState) avoids
  // cascading renders and the associated lint rule.
  const validImageIds = useMemo(() => new Set(images.map((i) => i.id)), [images]);
  const effectiveSelected = useMemo(() => {
    const result = new Set<string>();
    for (const id of selected) {
      if (validImageIds.has(id)) result.add(id);
    }
    return result;
  }, [selected, validImageIds]);

  const allSelected = images.length > 0 && effectiveSelected.size === images.length;
  const someSelected = effectiveSelected.size > 0 && effectiveSelected.size < images.length;

  // ── Existing hashes for client-side duplicate detection ──
  const existingHashes = useMemo(() => {
    const set = new Set<string>();
    for (const img of images) {
      if (img.hash) set.add(img.hash);
    }
    return set;
  }, [images]);

  // ── Duplicate detection among existing images (by hash) ──
  // Images that share a hash with another image in the gallery get a small
  // "Dup" badge so the admin can clean them up.
  const duplicateIds = useMemo(() => {
    const byHash = new Map<string, ProductImage[]>();
    for (const img of images) {
      if (!img.hash) continue;
      const arr = byHash.get(img.hash) || [];
      arr.push(img);
      byHash.set(img.hash, arr);
    }
    const ids = new Set<string>();
    for (const arr of byHash.values()) {
      if (arr.length > 1) {
        for (const img of arr) ids.add(img.id);
      }
    }
    return ids;
  }, [images]);

  // ── Import URL ──
  const importMutation = useMutation({
    mutationFn: (urls: string[]) =>
      api.post<{ imported: string[]; count: number; errors: string[] }>(
        `/api/admin/products/${productId}/gallery`, { action: "import-url", urls }
      ),
    onSuccess: (r) => {
      toast.success(`${r.count} image(s) imported`);
      if (r.errors?.length) {
        // Surface each duplicate / failure as its own toast so the admin can
        // see exactly which URL failed and why.
        for (const e of r.errors.slice(0, 5)) {
          const lower = e.toLowerCase();
          if (lower.includes("duplicate")) {
            const url = e.split(":")[0];
            toast.warning(`Duplicate skipped`, {
              description: `${url} already exists in this gallery`,
            });
          } else {
            toast.error(`Import failed: ${e}`);
          }
        }
      }
      qc.invalidateQueries({ queryKey: ["product-gallery", productId] });
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Delete ──
  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => {
      const q = ids.map((i) => `ids=${encodeURIComponent(i)}`).join("&");
      return api.del<{ deleted: number }>(`/api/admin/products/${productId}/gallery?${q}`);
    },
    onSuccess: (r) => {
      const count = r?.deleted ?? 0;
      toast.success(`${count} image${count !== 1 ? "s" : ""} deleted`);
      setSelected(new Set());
      setBulkDeleteOpen(false);
      qc.invalidateQueries({ queryKey: ["product-gallery", productId] });
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setBulkDeleteOpen(false);
    },
  });

  // ── Set primary ──
  const primaryMutation = useMutation({
    mutationFn: async (imageId: string) => {
      setPrimaryLoadingId(imageId);
      return api.patch(`/api/admin/products/${productId}/gallery`, { action: "set-primary", imageId });
    },
    onSuccess: () => {
      toast.success("Primary image updated", {
        description: "Product thumbnail will refresh on the storefront",
      });
      setPrimaryLoadingId(null);
      qc.invalidateQueries({ queryKey: ["product-gallery", productId] });
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setPrimaryLoadingId(null);
    },
  });

  // ── Reorder ──
  const reorderMutation = useMutation({
    mutationFn: (newOrder: string[]) =>
      api.patch(`/api/admin/products/${productId}/gallery`, { action: "reorder", newOrder }),
    onSuccess: () => {
      toast.success("Order saved", { duration: 1800 });
      qc.invalidateQueries({ queryKey: ["product-gallery", productId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Update metadata ──
  const metaMutation = useMutation({
    mutationFn: (d: { imageId: string; altText: string; title: string; caption: string; description: string }) =>
      api.patch(`/api/admin/products/${productId}/gallery`, { action: "update-meta", ...d }),
    onSuccess: () => {
      toast.success("Metadata saved");
      setEditMeta(null);
      qc.invalidateQueries({ queryKey: ["product-gallery", productId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Handlers ──
  const handleImport = async () => {
    const urls = urlInput.split("\n").map((u) => u.trim()).filter(Boolean);
    if (!urls.length) { toast.error("Enter at least one URL"); return; }
    setImporting(true);
    try {
      await importMutation.mutateAsync(urls);
      setUrlInput("");
      setUrlDialogOpen(false);
    } finally {
      setImporting(false);
    }
  };

  const toggleSelect = useCallback((id: string) => {
    setSelected((p) => {
      const n = new Set(p);
      if (n.has(id)) { n.delete(id); } else { n.add(id); }
      return n;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(images.map((i) => i.id)));
    }
  }, [allSelected, images]);

  const handleReorder = useCallback((fromId: string, toIdx: number) => {
    const ids = images.map((i) => i.id);
    const fromIdx = ids.indexOf(fromId);
    if (fromIdx === toIdx || fromIdx === -1) return;
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, fromId);
    reorderMutation.mutate(ids);
  }, [images, reorderMutation]);

  // Mobile-friendly move up/down — used by the touch buttons on each card.
  const handleMove = useCallback((idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= images.length) return;
    const ids = images.map((i) => i.id);
    [ids[idx], ids[newIdx]] = [ids[newIdx], ids[idx]];
    reorderMutation.mutate(ids);
  }, [images, reorderMutation]);

  const copyUrl = useCallback((path: string) => {
    navigator.clipboard.writeText(`${window.location.origin}${path}`);
    toast.success("URL copied");
  }, []);

  const handleBulkDownload = useCallback(() => {
    const items = images.filter((i) => effectiveSelected.has(i.id));
    if (!items.length) return;
    // Sequential download (no JSZip available). Small delay between each so
    // the browser doesn't block them.
    items.forEach((img, i) => {
      setTimeout(() => downloadFile(img.imagePath, img.originalName), i * 250);
    });
    toast.success(`Downloading ${items.length} image${items.length !== 1 ? "s" : ""}`, {
      description: "Check your browser's download manager",
    });
  }, [images, effectiveSelected]);

  const handleBulkSetPrimary = useCallback(() => {
    // Use the first selected image (by displayOrder) as the new primary.
    const items = images
      .filter((i) => effectiveSelected.has(i.id))
      .sort((a, b) => a.displayOrder - b.displayOrder);
    if (!items.length) return;
    const first = items[0];
    if (first.isPrimary) {
      toast.info("First selected image is already primary");
      return;
    }
    primaryMutation.mutate(first.id);
  }, [images, effectiveSelected, primaryMutation]);

  // ── Empty / no-product states ──
  if (!productId) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        <ImageIcon className="size-8 mx-auto mb-2 text-muted-foreground/50" />
        Save the product first to manage images.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <StatsBar images={images} />

      {/* Upload zone */}
      <UploadZone
        productId={productId}
        onUploaded={() => { /* invalidation handled inside */ }}
        existingHashes={existingHashes}
      />

      {/* Quick action: import from URL (above grid for visibility) */}
      <div className="flex items-center justify-between gap-2">
        <Button size="sm" variant="outline" onClick={() => setUrlDialogOpen(true)}>
          <LinkIcon className="size-3.5 mr-1.5" /> Import from URL
        </Button>
      </div>

      {/* Bulk action bar */}
      {effectiveSelected.size > 0 && (
        <BulkActionBar
          selectedCount={effectiveSelected.size}
          totalCount={images.length}
          isDeleting={deleteMutation.isPending}
          onDelete={() => setBulkDeleteOpen(true)}
          onClear={() => setSelected(new Set())}
          onSetPrimary={handleBulkSetPrimary}
          onBulkDownload={handleBulkDownload}
          onSelectAll={toggleSelectAll}
          allSelected={allSelected}
        />
      )}

      {/* Gallery grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : images.length === 0 ? (
        <Card className="overflow-hidden">
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative"
            >
              <div className="absolute -inset-3 rounded-full bg-emerald-100/60 blur-xl dark:bg-emerald-950/40" />
              <div className="relative flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-600 dark:from-emerald-950/60 dark:to-teal-950/60 dark:text-emerald-400">
                <ImageOff className="size-9" />
              </div>
            </motion.div>
            <div className="space-y-1">
              <p className="text-base font-semibold">No images yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Upload product photos, packaging shots, or import from a URL.
                The first image you add will automatically become the primary image.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <Button size="sm" variant="default" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => {
                const input = document.querySelector<HTMLInputElement>('input[data-gallery-file-input="true"]');
                input?.click();
              }}>
                <Upload className="size-3.5" /> Upload First Image
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setUrlDialogOpen(true)}>
                <LinkIcon className="size-3.5" /> Import from URL
              </Button>
            </div>
            <p className="pt-2 text-[11px] text-muted-foreground/70">
              <Search className="mr-1 inline size-3" />
              Tip: Use “Search Product Images” above to find real packaging photos from trusted sources
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* Header row: Select All checkbox + count */}
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2">
            <div className="flex items-center gap-2.5">
              <Checkbox
                id="select-all-images"
                checked={allSelected ? true : (someSelected ? "indeterminate" : false)}
                onCheckedChange={toggleSelectAll}
                aria-label="Select all images"
              />
              <Label htmlFor="select-all-images" className="cursor-pointer text-sm font-medium">
                {images.length} {images.length === 1 ? "image" : "images"}
                {effectiveSelected.size > 0 && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    · {effectiveSelected.size} selected
                  </span>
                )}
                {duplicateIds.size > 0 && (
                  <span className="ml-2 text-xs font-normal text-rose-500">
                    · {duplicateIds.size} duplicate{duplicateIds.size !== 1 ? "s" : ""}
                  </span>
                )}
              </Label>
            </div>
            {effectiveSelected.size > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setSelected(new Set())}
              >
                Clear selection
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((img, idx) => {
              const isSelected = effectiveSelected.has(img.id);
              return (
                <ImageCard
                  key={img.id}
                  img={img}
                  index={idx}
                  isSelected={isSelected}
                  isDuplicate={duplicateIds.has(img.id)}
                  hasAlt={!!(img.altText && img.altText.trim())}
                  isDragging={draggedId === img.id}
                  isDropTarget={dragOverIdx === idx && draggedId !== null && draggedId !== img.id}
                  onToggleSelect={() => toggleSelect(img.id)}
                  onPreview={() => setPreviewIdx(idx)}
                  onSetPrimary={() => primaryMutation.mutate(img.id)}
                  isSettingPrimary={primaryLoadingId === img.id}
                  onCopyUrl={() => copyUrl(img.imagePath)}
                  onDownload={() => downloadFile(img.imagePath, img.originalName)}
                  onEditMeta={() => setEditMeta(img)}
                  onDelete={() => deleteMutation.mutate([img.id])}
                  onMoveUp={() => handleMove(idx, -1)}
                  onMoveDown={() => handleMove(idx, 1)}
                  onDragStart={() => { setDraggedId(img.id); setDragOverIdx(idx); }}
                  onDragEnd={() => { setDraggedId(null); setDragOverIdx(-1); }}
                  onDragOver={() => {
                    if (draggedId && draggedId !== img.id) setDragOverIdx(idx);
                  }}
                  onDrop={() => {
                    if (draggedId) {
                      handleReorder(draggedId, idx);
                      setDraggedId(null);
                      setDragOverIdx(-1);
                    }
                  }}
                  onMobileMenu={() => setMobileMenuImg(img)}
                />
              );
            })}
          </div>
        </>
      )}

      {/* URL Import Dialog */}
      <Dialog open={urlDialogOpen} onOpenChange={setUrlDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Import Images from URL</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Image URLs (one per line)</Label>
              <textarea className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono" rows={5}
                placeholder={"https://example.com/image1.jpg\nhttps://example.com/image2.png"}
                value={urlInput} onChange={(e) => setUrlInput(e.target.value)} />
              <p className="text-[10px] text-muted-foreground mt-1">Server downloads each image and stores it locally. Supported: JPG, PNG, WEBP. Duplicates are auto-detected by content hash.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUrlDialogOpen(false)}>Cancel</Button>
            <Button disabled={importing || !urlInput.trim()} onClick={handleImport} className="gap-1.5">
              {importing ? <Loader2 className="size-4 animate-spin" /> : <LinkIcon className="size-4" />} Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox (preview) */}
      {previewIdx >= 0 && previewIdx < images.length && (
        <Lightbox
          images={images}
          index={previewIdx}
          onClose={() => setPreviewIdx(-1)}
          onNavigate={setPreviewIdx}
          onEditMeta={(img) => {
            const idx = images.findIndex((i) => i.id === img.id);
            setPreviewIdx(-1);
            setEditMeta(images[idx] || img);
          }}
          onSetPrimary={(img) => primaryMutation.mutate(img.id)}
          isSettingPrimary={!!primaryLoadingId}
        />
      )}

      {/* Edit SEO Metadata */}
      <Dialog open={!!editMeta} onOpenChange={(v) => !v && setEditMeta(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Image SEO</DialogTitle>
            <DialogDescription>Optimize for search engines and accessibility.</DialogDescription>
          </DialogHeader>
          {editMeta && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <img src={editMeta.imagePath} alt="" className="size-16 rounded-lg object-cover border" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{editMeta.originalName}</p>
                  <p className="text-xs text-muted-foreground">{formatSize(editMeta.fileSize)} · {editMeta.width}×{editMeta.height}</p>
                  {editMeta.isPrimary && (
                    <Badge className="mt-1 gap-0.5 bg-amber-500 text-white text-[9px]">
                      <Star className="size-2.5 fill-white" /> Primary
                    </Badge>
                  )}
                </div>
              </div>
              {[
                { key: "altText", label: "Alt Text *", placeholder: "e.g. Dolo 500mg tablet strip front view" },
                { key: "title", label: "Title", placeholder: "Image title attribute" },
                { key: "caption", label: "Caption", placeholder: "Display caption under image" },
                { key: "description", label: "Description", placeholder: "Long-form image description" },
              ].map((field) => (
                <div key={field.key}>
                  <Label className="text-xs">{field.label}</Label>
                  <Input
                    value={(editMeta as any)[field.key] || ""}
                    onChange={(e) => setEditMeta({ ...editMeta, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                  />
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMeta(null)}>Cancel</Button>
            <Button disabled={metaMutation.isPending} onClick={() => editMeta && metaMutation.mutate({
              imageId: editMeta.id, altText: editMeta.altText || "", title: editMeta.title || "",
              caption: editMeta.caption || "", description: editMeta.description || "",
            })} className="gap-1.5">
              {metaMutation.isPending && <Loader2 className="size-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mobile action sheet (bottom) — opens when "more" tapped on mobile */}
      <Sheet open={!!mobileMenuImg} onOpenChange={(v) => !v && setMobileMenuImg(null)}>
        <SheetContent side="bottom" className="rounded-t-xl">
          <SheetHeader className="pb-2">
            <SheetTitle className="truncate text-sm">{mobileMenuImg?.originalName}</SheetTitle>
            <SheetDescription className="text-xs">
              {mobileMenuImg && formatSize(mobileMenuImg.fileSize)}
              {mobileMenuImg?.width && mobileMenuImg?.height ? ` · ${mobileMenuImg.width}×${mobileMenuImg.height}` : ""}
            </SheetDescription>
          </SheetHeader>
          {mobileMenuImg && (
            <div className="grid grid-cols-2 gap-2 pb-4 pt-2">
              <MobileActionBtn icon={<Eye className="size-4" />} label="Preview" onClick={() => {
                const idx = images.findIndex((i) => i.id === mobileMenuImg.id);
                setMobileMenuImg(null);
                if (idx >= 0) setPreviewIdx(idx);
              }} />
              <MobileActionBtn
                icon={mobileMenuImg.isPrimary ? <Star className="size-4 fill-amber-500 text-amber-500" /> : <Star className="size-4" />}
                label={mobileMenuImg.isPrimary ? "Primary" : "Set Primary"}
                disabled={mobileMenuImg.isPrimary}
                onClick={() => {
                  primaryMutation.mutate(mobileMenuImg.id);
                  setMobileMenuImg(null);
                }}
              />
              <MobileActionBtn icon={<Copy className="size-4" />} label="Copy URL" onClick={() => {
                copyUrl(mobileMenuImg.imagePath);
                setMobileMenuImg(null);
              }} />
              <MobileActionBtn icon={<Download className="size-4" />} label="Download" onClick={() => {
                downloadFile(mobileMenuImg.imagePath, mobileMenuImg.originalName);
                setMobileMenuImg(null);
              }} />
              <MobileActionBtn icon={<RefreshCw className="size-4" />} label="Edit SEO" onClick={() => {
                setEditMeta(mobileMenuImg);
                setMobileMenuImg(null);
              }} />
              <MobileActionBtn icon={<Trash2 className="size-4" />} label="Delete" variant="danger" onClick={() => {
                deleteMutation.mutate([mobileMenuImg.id]);
                setMobileMenuImg(null);
              }} />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={(v) => {
        if (!deleteMutation.isPending) setBulkDeleteOpen(v);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="size-5 text-destructive" />
              Delete {effectiveSelected.size} {effectiveSelected.size === 1 ? "image" : "images"}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  This will permanently delete{" "}
                  <strong className="text-foreground">
                    {effectiveSelected.size} {effectiveSelected.size === 1 ? "image" : "images"}
                  </strong>{" "}
                  from the product gallery. The image files will be removed from
                  the server and cannot be recovered.
                </p>
                {effectiveSelected.size > 0 && (() => {
                  const selectedImages = images.filter((i) => effectiveSelected.has(i.id));
                  const includesPrimary = selectedImages.some((i) => i.isPrimary);
                  const remainingCount = images.length - effectiveSelected.size;
                  return (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
                      {includesPrimary && (
                        <p className="flex items-center gap-1.5">
                          <Star className="size-3.5 fill-amber-500 text-amber-500" />
                          The primary image is included in this deletion.
                          {remainingCount > 0
                            ? ` Another image will be automatically promoted to primary.`
                            : ` The primary image reference will be cleared.`}
                        </p>
                      )}
                      {!includesPrimary && remainingCount > 0 && (
                        <p>{remainingCount} image{remainingCount !== 1 ? "s" : ""} will remain after deletion.</p>
                      )}
                      {!includesPrimary && remainingCount === 0 && (
                        <p>All images will be removed from this product.</p>
                      )}
                    </div>
                  );
                })()}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (effectiveSelected.size === 0) return;
                deleteMutation.mutate(Array.from(effectiveSelected));
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5"
            >
              {deleteMutation.isPending ? (
                <><Loader2 className="size-4 animate-spin" /> Deleting...</>
              ) : (
                <><Trash2 className="size-4" /> Delete {effectiveSelected.size} {effectiveSelected.size === 1 ? "Image" : "Images"}</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MobileActionBtn — large touch-friendly button for the bottom sheet
// ---------------------------------------------------------------------------

function MobileActionBtn({
  icon, label, onClick, disabled, variant,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "danger";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-lg border bg-card p-3 text-xs font-medium transition-colors active:scale-95",
        variant === "danger"
          ? "border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/40 dark:hover:bg-rose-950/30"
          : "border-border text-foreground hover:bg-emerald-50 hover:border-emerald-300 dark:hover:bg-emerald-950/30",
        disabled && "cursor-not-allowed opacity-40"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
