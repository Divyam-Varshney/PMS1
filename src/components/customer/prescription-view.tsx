// ============================================================================
// File: src/components/customer/prescription-view.tsx
// Purpose: Drag-and-drop image upload for prescriptions. Preview thumbnails,
//          notes textarea, submit. Explains privacy. Shows success state.
// Role: One of two ways customers can order without browsing the catalog.
// ============================================================================

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileText,
  X,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  ImageIcon,
  ArrowRight,
  Clock,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import { useUI } from "@/lib/store";
import { useRequireAuth } from "./use-require-auth";
import { toast } from "sonner";
import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { formatDateTime } from "@/lib/format";

// ---------------------------------------------------------------------------
// Prescription history item shape (returned by GET /api/prescriptions).
// ---------------------------------------------------------------------------
interface PrescriptionHistoryItem {
  id: string;
  status: string;
  notes: string | null;
  adminNotes: string | null;
  convertedOrderId: string | null;
  createdAt: string;
  images: string[];
  imageCount: number;
}

// ---------------------------------------------------------------------------
// Status metadata for the prescription history cards.
// ---------------------------------------------------------------------------
const STATUS_META: Record<
  string,
  { label: string; className: string }
> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-700" },
  verified: { label: "Approved", className: "bg-emerald-100 text-emerald-700" },
  converted: { label: "Converted", className: "bg-sky-100 text-sky-700" },
  rejected: { label: "Rejected", className: "bg-rose-100 text-rose-700" },
};

export function PrescriptionView() {
  const navigate = useUI((s) => s.navigate);
  const { customer } = useRequireAuth();
  const qc = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch the customer's prescription history so we can show it under the
  // upload form (status, upload date, admin remarks, image thumbnails).
  const { data: history } = useQuery<{ items: PrescriptionHistoryItem[]; total: number }>({
    queryKey: ["customer", "prescriptions"],
    queryFn: () => api("/api/prescriptions"),
    enabled: !!customer,
  });

  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles).filter((f) => f.type.startsWith("image/"));
    if (arr.length === 0) {
      toast.error("Please select image files only");
      return;
    }
    setFiles((prev) => [...prev, ...arr]);
    // Generate preview URLs
    Promise.all(arr.map((f) => URL.createObjectURL(f))).then((urls) => {
      setPreviews((prev) => [...prev, ...urls]);
    });
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const uploadMutation = useMutation({
    mutationFn: () => {
      const form = new FormData();
      for (const f of files) form.append("files", f);
      if (notes.trim()) form.append("notes", notes.trim());
      return api.post("/api/prescriptions", form);
    },
    onSuccess: () => {
      toast.success("Prescription uploaded successfully");
      setSubmitted(true);
      // Revoke object URLs
      previews.forEach((url) => URL.revokeObjectURL(url));
      // Refresh the prescription history so the new entry shows up if the
      // customer navigates back to the upload form.
      qc.invalidateQueries({ queryKey: ["customer", "prescriptions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Auth gate — must run AFTER all hooks
  if (!customer) {
    // useRequireAuth handles redirect in an effect
    return null;
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const removeFile = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = () => {
    if (files.length === 0) {
      toast.error("Please upload at least one prescription image");
      return;
    }
    uploadMutation.mutate();
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-xl px-4 py-8">
        <Card className="items-center gap-3 p-6 text-center">
          <CheckCircle2 className="size-14 text-emerald-600" />
          <h2 className="text-xl font-bold">Prescription uploaded!</h2>
          <p className="text-sm text-muted-foreground">
            Once your prescription is reviewed and approved by our pharmacist, your medicines
            are typically delivered within approximately 30–60 minutes (subject to availability
            and service area).
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button onClick={() => navigate({ name: "shop" })} className="gap-2">
              Continue shopping <ArrowRight className="size-4" />
            </Button>
            <Button
              onClick={() => {
                setSubmitted(false);
                setFiles([]);
                setPreviews([]);
                setNotes("");
              }}
              variant="outline"
            >
              Upload another
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Upload Prescription</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a clear photo or scan of your doctor&apos;s prescription. We&apos;ll verify
          it and prepare your order.
        </p>
      </div>

      {/* Privacy note */}
      <Card className="mb-4 gap-2 border-emerald-200 bg-emerald-50 p-3 py-3">
        <div className="flex items-start gap-2 text-xs text-emerald-900">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-semibold">Your prescription is private & secure</p>
            <p className="mt-0.5">
              Files are stored securely and only accessible to our licensed pharmacists
              for verification. We never share your medical information with third parties.
            </p>
          </div>
        </div>
      </Card>

      {/* Dropzone */}
      <Card className="p-4">
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
            dragActive ? "border-primary bg-accent/40" : "border-input hover:border-primary/50 hover:bg-accent/20"
          }`}
        >
          <div className="mb-3 flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <Upload className="size-7" />
          </div>
          <p className="text-sm font-medium">
            Click to upload or drag and drop prescription images
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            JPG, PNG, WEBP, GIF — up to 8MB per image
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
        </div>

        {/* Previews */}
        {previews.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
            {previews.map((url, i) => (
              <motion.div
                key={url}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="group relative aspect-square overflow-hidden rounded-lg border bg-accent"
              >
                <img src={url} alt={`Prescription ${i + 1}`} className="size-full object-cover" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(i);
                  }}
                  className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-foreground/80 text-background opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Remove image"
                >
                  <X className="size-3.5" />
                </button>
                <Badge className="absolute bottom-1 left-1 bg-foreground/70 text-background">
                  <ImageIcon className="size-3" />
                </Badge>
              </motion.div>
            ))}
          </div>
        )}
      </Card>

      {/* Notes */}
      <Card className="mt-4 gap-2 p-4">
        <Label htmlFor="rx-notes" className="text-sm font-semibold">
          Notes for pharmacist <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="rx-notes"
          placeholder="e.g. Any special delivery instructions, preferred contact time, allergies, or notes for our pharmacist."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
      </Card>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button
          size="lg"
          className="flex-1 gap-2"
          onClick={onSubmit}
          disabled={files.length === 0 || uploadMutation.isPending}
        >
          {uploadMutation.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Uploading...
            </>
          ) : (
            <>
              <FileText className="size-4" /> Submit prescription ({files.length})
            </>
          )}
        </Button>
        <Button variant="outline" size="lg" onClick={() => navigate({ name: "manual-request" })}>
          Type medicines instead
        </Button>
      </div>

      {/* Prescription history — shows every prescription the customer has
          uploaded, with status, date, admin remarks, and image thumbnails. */}
      {history && history.items.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">Prescription History</h2>
            <Badge variant="secondary" className="ml-1">{history.total}</Badge>
          </div>
          <div className="space-y-3">
            {history.items.map((p) => {
              const meta = STATUS_META[p.status] ?? {
                label: p.status,
                className: "bg-muted text-muted-foreground",
              };
              return (
                <Card key={p.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      #{p.id.slice(-8).toUpperCase()}
                    </span>
                    <Badge className={meta.className}>{meta.label}</Badge>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {formatDateTime(p.createdAt)}
                    </span>
                  </div>

                  {/* Thumbnails */}
                  {p.images.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {p.images.map((img, i) => (
                        <a
                          key={i}
                          href={img}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative size-16 overflow-hidden rounded-md border bg-accent"
                        >
                          <img
                            src={img}
                            alt={`Prescription ${i + 1}`}
                            className="size-full object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Admin remarks — show when the pharmacist has reviewed. */}
                  {p.adminNotes && (
                    <div className="mt-3 flex items-start gap-2 rounded-md border border-muted bg-muted/40 p-2 text-xs">
                      <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      <div>
                        <p className="font-semibold text-foreground">Pharmacist&apos;s note</p>
                        <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{p.adminNotes}</p>
                      </div>
                    </div>
                  )}

                  {/* Customer's own notes (if any) — secondary. */}
                  {p.notes && (
                    <p className="mt-2 text-xs italic text-muted-foreground">
                      Your note: {p.notes}
                    </p>
                  )}

                  {/* If converted to an order, link to orders page. */}
                  {p.status === "converted" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 h-auto gap-1 p-0 text-primary"
                      onClick={() => navigate({ name: "orders" })}
                    >
                      View your orders <ChevronRight className="size-3.5" />
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
