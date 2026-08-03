// ============================================================================
// File: src/components/shared/reviews-section.tsx
// Purpose: Customer-facing reviews list + "write a review" form for a single
//          product. Fetches approved reviews via /api/reviews, lets logged-in
//          customers submit a rating + title + body (goes to admin approval).
//          Shows a "Verified Buyer" badge when the reviewer has a delivered
//          order containing this product.
// Role: Reusable block mounted in the ProductView reviews tab.
// ============================================================================

"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star, Loader2, BadgeCheck, MessageSquarePlus, MessageCircle, ImagePlus, X } from "lucide-react";
import { api, qk, Review } from "@/components/customer/api";
import { useCustomer } from "@/components/customer/use-customer";
import { useUI } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MAX_IMAGES = 6;

export function ReviewsSection({ productId }: { productId: string }) {
  const { customer } = useCustomer();
  const navigate = useUI((s) => s.navigate);
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  // Customer-uploaded review images. Stored as { url, file } pairs while
  // uploading, then just { url } after a successful upload. URLs are sent
  // to POST /api/reviews as the `images` array.
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Lightbox for viewing customer-uploaded images on existing reviews.
  const [lightbox, setLightbox] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: qk.reviews(productId),
    queryFn: () => api<{ items: Review[] }>(`/api/reviews?productId=${productId}`),
  });
  const reviews = data?.items ?? [];

  const submit = useMutation({
    mutationFn: () =>
      api.post("/api/reviews", { productId, rating, title, body, images: uploadedImages }),
    onSuccess: () => {
      toast.success("Review submitted! It will appear after admin approval.");
      qc.invalidateQueries({ queryKey: qk.reviews(productId) });
      setShowForm(false);
      setTitle("");
      setBody("");
      setRating(5);
      setUploadedImages([]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ---- Image upload handler -----------------------------------------------
  // Uploads selected files to /api/reviews/upload (multipart) and appends the
  // returned URLs to `uploadedImages`. Enforces the MAX_IMAGES limit.
  async function handleImageUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const remaining = MAX_IMAGES - uploadedImages.length;
    if (remaining <= 0) {
      toast.error(`You can upload at most ${MAX_IMAGES} images per review`);
      return;
    }
    const slice = Array.from(files).slice(0, remaining);
    if (slice.length < Array.from(files).length) {
      toast.info(`Only the first ${slice.length} image(s) were uploaded (max ${MAX_IMAGES} per review).`);
    }
    setUploadingImage(true);
    try {
      const fd = new FormData();
      for (const f of slice) fd.append("files", f);
      const r = await api.post<{ urls: string[] }>("/api/reviews/upload", fd);
      if (r?.urls?.length) {
        setUploadedImages((prev) => [...prev, ...r.urls].slice(0, MAX_IMAGES));
        toast.success(`${r.urls.length} image(s) added`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to upload images");
    } finally {
      setUploadingImage(false);
    }
  }

  function removeUploadedImage(url: string) {
    setUploadedImages((prev) => prev.filter((u) => u !== url));
  }

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : 0;

  return (
    <div className="space-y-4">
      {/* Summary + write button */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-accent/30 p-3">
        <div className="flex items-center gap-3">
          <div className="flex size-12 flex-col items-center justify-center rounded-lg bg-background">
            <span className="text-lg font-bold leading-none">
              {avgRating.toFixed(1)}
            </span>
            <div className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    "size-2.5",
                    i < Math.round(avgRating)
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted-foreground/40"
                  )}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold">
              {reviews.length} review{reviews.length !== 1 ? "s" : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              {reviews.length > 0
                ? "Based on verified customer feedback"
                : "No reviews yet"}
            </p>
          </div>
        </div>
        {customer ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowForm((s) => !s)}
            className="gap-2"
          >
            <MessageSquarePlus className="size-4" />
            {showForm ? "Cancel" : "Write a review"}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ name: "auth", mode: "login" })}
            className="gap-2"
          >
            <MessageSquarePlus className="size-4" /> Login to review
          </Button>
        )}
      </div>

      {/* Write form */}
      {showForm && customer && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate();
          }}
          className="space-y-3 rounded-lg border bg-card p-4"
        >
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Your rating
            </label>
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setRating(i + 1)}
                  onMouseEnter={() => setHoverRating(i + 1)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-0.5"
                  aria-label={`Rate ${i + 1} star${i + 1 > 1 ? "s" : ""}`}
                >
                  <Star
                    className={cn(
                      "size-6 transition-colors",
                      i < (hoverRating || rating)
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground/40 hover:text-amber-300"
                    )}
                  />
                </button>
              ))}
            </div>
          </div>
          <Input
            placeholder="Review title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
          />
          <Textarea
            placeholder="Share your experience with this medicine..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={1000}
          />

          {/* Image upload */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-muted-foreground">
                Add photos (optional, up to {MAX_IMAGES})
              </label>
              <span className="text-[11px] text-muted-foreground">
                {uploadedImages.length}/{MAX_IMAGES}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {uploadedImages.map((url) => (
                <div
                  key={url}
                  className="relative size-16 overflow-hidden rounded-md border bg-muted/30"
                >
                  <img src={url} alt="Review upload" className="size-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeUploadedImage(url)}
                    className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                    aria-label="Remove image"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              {uploadedImages.length < MAX_IMAGES && (
                <label
                  className="flex size-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed text-muted-foreground transition-colors hover:border-emerald-400 hover:text-emerald-600"
                  title="Upload images"
                >
                  {uploadingImage ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ImagePlus className="size-4" />
                  )}
                  <span className="text-[10px]">Upload</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      handleImageUpload(e.target.files);
                      // Reset the input so selecting the same file again still fires onChange.
                      e.target.value = "";
                    }}
                    disabled={uploadingImage}
                  />
                </label>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submit.isPending}
              className="gap-2"
            >
              {submit.isPending && <Loader2 className="size-4 animate-spin" />}
              Submit review
            </Button>
          </div>
        </form>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <Star className="mx-auto mb-2 size-8 text-muted-foreground/40" />
          <p className="text-sm font-medium">No reviews yet</p>
          <p className="text-xs text-muted-foreground">
            Be the first to share your experience with this product.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {r.authorName?.[0]?.toUpperCase() ?? "A"}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{r.authorName}</p>
                    {r.verifiedBuyer && (
                      <Badge
                        variant="secondary"
                        className="gap-1 bg-emerald-50 text-emerald-700"
                      >
                        <BadgeCheck className="size-3" /> Verified Buyer
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "size-3",
                        i < r.rating
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground/40"
                      )}
                    />
                  ))}
                </div>
              </div>
              {r.title && (
                <p className="mt-2 text-sm font-medium">{r.title}</p>
              )}
              {r.body && (
                <p className="mt-0.5 text-sm text-muted-foreground">{r.body}</p>
              )}

              {/* Customer-uploaded review images (clickable lightbox) */}
              {Array.isArray((r as any).images) && (r as any).images.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {(r as any).images.map((img: string, i: number) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setLightbox(img)}
                      className="relative size-16 overflow-hidden rounded-md border bg-muted/30 hover:border-emerald-400 transition-colors"
                      aria-label={`View image ${i + 1}`}
                    >
                      <img src={img} alt={`Review photo ${i + 1}`} className="size-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              <p className="mt-1.5 text-[11px] text-muted-foreground/70">
                {formatDate(r.createdAt)}
              </p>

              {/* Admin reply — shown when the pharmacy has responded. */}
              {r.adminReply && (
                <div className="mt-3 rounded-md border border-emerald-100 bg-emerald-50/60 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                    <MessageCircle className="size-3.5" />
                    Response from Pradeep Medical Store
                  </div>
                  <p className="mt-1 text-sm text-emerald-900 whitespace-pre-wrap">
                    {r.adminReply}
                  </p>
                  {r.adminReplyAt && (
                    <p className="mt-1.5 text-[11px] text-emerald-700/70">
                      {formatDate(r.adminReplyAt)}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Image lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white hover:bg-white/30"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
          <img
            src={lightbox}
            alt="Review image"
            className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
