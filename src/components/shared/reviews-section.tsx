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
import { Star, Loader2, BadgeCheck, MessageSquarePlus, MessageCircle } from "lucide-react";
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

export function ReviewsSection({ productId }: { productId: string }) {
  const { customer } = useCustomer();
  const navigate = useUI((s) => s.navigate);
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: qk.reviews(productId),
    queryFn: () => api<{ items: Review[] }>(`/api/reviews?productId=${productId}`),
  });
  const reviews = data?.items ?? [];

  const submit = useMutation({
    mutationFn: () =>
      api.post("/api/reviews", { productId, rating, title, body }),
    onSuccess: () => {
      toast.success("Review submitted! It will appear after admin approval.");
      qc.invalidateQueries({ queryKey: qk.reviews(productId) });
      setShowForm(false);
      setTitle("");
      setBody("");
      setRating(5);
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
    </div>
  );
}
