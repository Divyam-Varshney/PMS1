// ============================================================================
// File: src/components/admin/views/ReviewsView.tsx
// Purpose: Reviews list with approve/reject (PATCH status) + filter + bulk
//          approve/reject via checkbox selection + select-all.
//          Also supports inline admin replies: Reply / Edit Reply / Delete
//          Reply. The reply is saved via PATCH { adminReply } and shown to
//          customers on the product page below the review.
// ============================================================================

"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, run } from "../api";
import { PageHeader, StatusBadge, ProductThumb, TableSkeleton, EmptyState } from "../ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Star,
  Check,
  X,
  Trash2,
  Loader2,
  MessageCircle,
  Pencil,
  Save,
  XCircle,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  ImageIcon,
  Wand2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";

interface ReviewAnalytics {
  avgRating: number;
  totalReviews: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  withImagesCount: number;
  flaggedCount: number;
  autoApprovedCount: number;
}

export function ReviewsView() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("pending");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  // Per-review reply editor state. `editing[id]` holds the textarea value;
  // `editingId` is the id of the review whose editor is currently open.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);

  // AI moderate / AI reply state
  const [aiBusyId, setAiBusyId] = useState<string | null>(null);
  const [aiReplyBusyId, setAiReplyBusyId] = useState<string | null>(null);

  // Image gallery lightbox
  const [galleryImages, setGalleryImages] = useState<string[] | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const query = useMemo(() => `?status=${status}&pageSize=50`, [status]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-reviews", status],
    queryFn: () =>
      api.get<{ items: any[]; total: number; analytics: ReviewAnalytics }>(
        "/api/admin/reviews" + query
      ),
  });

  const analytics = data?.analytics;

  async function changeStatus(id: string, status: string) {
    const r = await run(() => api.patch(`/api/admin/reviews/${id}`, { status }), {
      success: `Review ${status}`,
      error: "Update failed",
      silent: true,
    });
    if (r) {
      qc.invalidateQueries({ queryKey: ["admin-reviews"] });
      toast.success(`Review ${status}`);
    }
  }

  async function del(id: string) {
    if (!confirm("Delete this review? This cannot be undone.")) return;
    const r = await run(() => api.del(`/api/admin/reviews/${id}`), {
      success: "Review deleted",
      error: "Delete failed",
      silent: true,
    });
    if (r) {
      qc.invalidateQueries({ queryKey: ["admin-reviews"] });
      toast.success("Review deleted");
    }
  }

  // ---- Admin reply helpers -----------------------------------------------
  function startReply(review: any) {
    setEditingId(review.id);
    setEditingText(review.adminReply ?? "");
  }

  function cancelReply() {
    setEditingId(null);
    setEditingText("");
  }

  async function saveReply(id: string) {
    const text = editingText.trim();
    if (!text) {
      toast.error("Reply cannot be empty");
      return;
    }
    setReplyBusy(true);
    const r = await run(
      () => api.patch(`/api/admin/reviews/${id}`, { adminReply: text }),
      {
        success: "Reply saved",
        error: "Save failed",
        silent: true,
      }
    );
    setReplyBusy(false);
    if (r) {
      qc.invalidateQueries({ queryKey: ["admin-reviews"] });
      cancelReply();
      toast.success("Reply saved");
    }
  }

  async function deleteReply(id: string) {
    if (!confirm("Remove this admin reply?")) return;
    setReplyBusy(true);
    const r = await run(
      () => api.patch(`/api/admin/reviews/${id}`, { adminReply: null }),
      {
        success: "Reply removed",
        error: "Delete failed",
        silent: true,
      }
    );
    setReplyBusy(false);
    if (r) {
      qc.invalidateQueries({ queryKey: ["admin-reviews"] });
      if (editingId === id) cancelReply();
      toast.success("Reply removed");
    }
  }

  // ---- AI moderate -------------------------------------------------------
  async function aiModerate(id: string) {
    setAiBusyId(id);
    const r = await run(
      () => api.post<{ aiStatus: string; aiNote: string | null }>(`/api/admin/reviews/${id}/ai-moderate`),
      { success: "AI moderation complete", error: "AI moderation failed", silent: true }
    );
    setAiBusyId(null);
    if (r) {
      qc.invalidateQueries({ queryKey: ["admin-reviews"] });
      toast.success(
        r.aiStatus === "flagged"
          ? `Flagged by AI${r.aiNote ? `: ${r.aiNote}` : ""}`
          : r.aiStatus === "auto_approved"
            ? "Auto-approved by AI"
            : "Reviewed by AI"
      );
    }
  }

  // ---- AI reply ----------------------------------------------------------
  async function aiReply(id: string) {
    setAiReplyBusyId(id);
    const r = await run(
      () => api.post<{ reply: string }>(`/api/admin/reviews/${id}/ai-reply`),
      { success: "AI reply generated", error: "AI reply failed", silent: true }
    );
    setAiReplyBusyId(null);
    if (r) {
      // Open the editor pre-filled with the AI-generated reply so the admin
      // can review and tweak before saving.
      setEditingId(id);
      setEditingText(r.reply);
      toast.success("AI reply drafted — review and save");
    }
  }

  // ---- Bulk actions ----
  const allSelected = (data?.items?.length ?? 0) > 0 && data!.items.every((r) => selected.has(r.id));
  function toggleAll() {
    if (!data?.items) return;
    const next = new Set(selected);
    if (allSelected) data.items.forEach((r) => next.delete(r.id));
    else data.items.forEach((r) => next.add(r.id));
    setSelected(next);
  }
  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }
  function clearSelection() { setSelected(new Set()); }

  async function bulkAction(action: "approved" | "rejected" | "delete") {
    if (selected.size === 0) return;
    setBulkBusy(true);
    let okCount = 0;
    let fail = 0;
    for (const id of Array.from(selected)) {
      try {
        if (action === "delete") {
          await api.del(`/api/admin/reviews/${id}`);
        } else {
          await api.patch(`/api/admin/reviews/${id}`, { status: action });
        }
        okCount++;
      } catch {
        fail++;
      }
    }
    setBulkBusy(false);
    toast.success(`${okCount} review(s) ${action === "delete" ? "deleted" : action}.${fail > 0 ? ` ${fail} failed.` : ""}`);
    clearSelection();
    qc.invalidateQueries({ queryKey: ["admin-reviews"] });
  }

  return (
    <div>
      <PageHeader
        title="Reviews"
        description="Moderate customer product reviews. AI flags spam/abuse automatically, and can draft replies for you to review."
        actions={
          <Select value={status} onValueChange={(v) => { setStatus(v); clearSelection(); }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {/* Analytics cards */}
      {analytics && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <AnalyticsCard
            label="Avg Rating"
            value={analytics.avgRating ? analytics.avgRating.toFixed(1) : "—"}
            icon={<Star className="size-4 fill-amber-400 text-amber-400" />}
            tint="amber"
          />
          <AnalyticsCard
            label="Total"
            value={String(analytics.totalReviews)}
            icon={<Star className="size-4" />}
            tint="emerald"
          />
          <AnalyticsCard
            label="Pending"
            value={String(analytics.pendingCount)}
            icon={<RefreshCw className="size-4" />}
            tint="amber"
          />
          <AnalyticsCard
            label="Approved"
            value={String(analytics.approvedCount)}
            icon={<Check className="size-4" />}
            tint="emerald"
          />
          <AnalyticsCard
            label="Rejected"
            value={String(analytics.rejectedCount)}
            icon={<X className="size-4" />}
            tint="rose"
          />
          <AnalyticsCard
            label="With Images"
            value={String(analytics.withImagesCount)}
            icon={<ImageIcon className="size-4" />}
            tint="teal"
          />
        </div>
      )}

      {/* AI status summary banner */}
      {analytics && (analytics.flaggedCount > 0 || analytics.autoApprovedCount > 0) && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border/70 bg-muted/30 p-3 text-xs">
          <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
            <ShieldCheck className="size-3.5" />
            <span><strong>{analytics.autoApprovedCount}</strong> auto-approved by AI</span>
          </div>
          {analytics.flaggedCount > 0 && (
            <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
              <ShieldAlert className="size-3.5" />
              <span><strong>{analytics.flaggedCount}</strong> flagged for human review</span>
            </div>
          )}
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 admin-bulk-bar p-3">
          <Badge variant="secondary" className="bg-primary/15 font-semibold text-primary">
            {selected.size} selected
          </Badge>
          <Button size="sm" variant="outline" className="gap-1.5 text-emerald-600 hover:bg-emerald-50 btn-premium bg-background/60 dark:text-emerald-300 dark:hover:bg-emerald-900/40" disabled={bulkBusy} onClick={() => bulkAction("approved")}>
            {bulkBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            Bulk Approve
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-amber-600 hover:bg-amber-50 btn-premium bg-background/60 dark:text-amber-300 dark:hover:bg-amber-900/40" disabled={bulkBusy} onClick={() => bulkAction("rejected")}>
            <X className="size-3.5" /> Bulk Reject
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-destructive hover:bg-destructive/5 btn-premium bg-background/60" disabled={bulkBusy} onClick={() => bulkAction("delete")}>
            <Trash2 className="size-3.5" /> Bulk Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={clearSelection} className="ml-auto">Clear</Button>
        </div>
      )}

      {isLoading ? (
        <Card className="admin-card"><CardContent className="pt-4"><TableSkeleton rows={5} cols={3} /></CardContent></Card>
      ) : !data?.items?.length ? (
        <Card className="admin-card"><CardContent className="pt-6"><EmptyState title="No reviews" description={`No ${status} reviews to show.`} icon={<Star className="size-6" />} /></CardContent></Card>
      ) : (
        <>
          {/* Select all */}
          <div className="mb-3 flex items-center gap-2">
            <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
            <span className="text-xs text-muted-foreground">
              {allSelected ? "Deselect all" : "Select all"} ({data.items.length} reviews)
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.items.map((r) => (
              <Card key={r.id} className={`admin-card ${selected.has(r.id) ? "border-primary/40 bg-primary/5" : ""}`}>
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Checkbox
                        checked={selected.has(r.id)}
                        onCheckedChange={() => toggleOne(r.id)}
                        aria-label={`Select review by ${r.authorName}`}
                      />
                      <ProductThumb image={r.product?.primaryImage} name={r.product?.name || "P"} size={40} />
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{r.product?.name || "Unknown product"}</div>
                        <div className="text-xs text-muted-foreground">{r.authorName} · {formatDateTime(r.createdAt)}</div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge status={r.status} />
                      {r.aiStatus && (
                        <Badge
                          variant="outline"
                          className={`text-[10px] gap-1 ${
                            r.aiStatus === "flagged"
                              ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
                              : r.aiStatus === "auto_approved"
                                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : "border-border text-muted-foreground"
                          }`}
                          title={r.aiNote ?? undefined}
                        >
                          {r.aiStatus === "flagged" ? (
                            <><ShieldAlert className="size-3" /> AI: Flagged</>
                          ) : r.aiStatus === "auto_approved" ? (
                            <><ShieldCheck className="size-3" /> AI: OK</>
                          ) : (
                            <><Sparkles className="size-3" /> AI: Manual</>
                          )}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`size-4 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                      />
                    ))}
                  </div>
                  {r.title && <div className="font-medium text-sm mt-2">{r.title}</div>}
                  {r.body && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{r.body}</p>}

                  {/* AI moderation note (if flagged) */}
                  {r.aiStatus === "flagged" && r.aiNote && (
                    <div className="mt-2 rounded-md border border-amber-200 bg-amber-50/70 p-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                      <span className="font-semibold">AI flag:</span> {r.aiNote}
                    </div>
                  )}

                  {/* Review image gallery (if any) */}
                  {Array.isArray(r.images) && r.images.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {r.images.map((img: string, i: number) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            setGalleryImages(r.images);
                            setGalleryIndex(i);
                          }}
                          className="relative size-16 overflow-hidden rounded-md border bg-muted/30 hover:border-emerald-400 transition-colors"
                          aria-label={`Open image ${i + 1}`}
                        >
                          <img src={img} alt={`Review image ${i + 1}`} className="size-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Admin response — shown when a reply exists AND the editor is closed. */}
                  {r.adminReply && editingId !== r.id && (
                    <div className="mt-3 rounded-md border border-emerald-100 bg-emerald-50/60 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                          <MessageCircle className="size-3.5" />
                          Admin Response
                          {r.adminReplyByName && (
                            <span className="font-normal text-emerald-700/80 dark:text-emerald-300/70">· by {r.adminReplyByName}</span>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
                            disabled={replyBusy}
                            onClick={() => startReply(r)}
                          >
                            <Pencil className="size-3 mr-1" /> Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs text-destructive hover:bg-destructive/10"
                            disabled={replyBusy}
                            onClick={() => deleteReply(r.id)}
                          >
                            <XCircle className="size-3 mr-1" /> Delete
                          </Button>
                        </div>
                      </div>
                      <p className="mt-1 text-sm text-emerald-900 whitespace-pre-wrap dark:text-emerald-100">{r.adminReply}</p>
                      {r.adminReplyAt && (
                        <p className="mt-1.5 text-[11px] text-emerald-700/70 dark:text-emerald-300/70">
                          {formatDateTime(r.adminReplyAt)}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Inline reply editor — opens when "Reply" or "Edit" is clicked. */}
                  {editingId === r.id && (
                    <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-3 dark:bg-primary/10">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                          <MessageCircle className="size-3.5" />
                          {r.adminReply ? "Edit admin response" : "Write an admin response"}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs gap-1"
                          disabled={aiReplyBusyId === r.id || replyBusy}
                          onClick={() => aiReply(r.id)}
                          title="Generate a draft with AI"
                        >
                          {aiReplyBusyId === r.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Wand2 className="size-3" />
                          )}
                          AI Draft
                        </Button>
                      </div>
                      <Textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        rows={3}
                        maxLength={1000}
                        placeholder="Thank the customer, address concerns, or share next steps…"
                        disabled={replyBusy}
                        autoFocus
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={cancelReply}
                          disabled={replyBusy}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => saveReply(r.id)}
                          disabled={replyBusy || !editingText.trim()}
                          className="gap-1.5"
                        >
                          {replyBusy ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Save className="size-3.5" />
                          )}
                          Save Reply
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-border/70">
                    {r.status !== "approved" && (
                      <Button size="sm" variant="outline" className="text-emerald-600 dark:text-emerald-300" onClick={() => changeStatus(r.id, "approved")}>
                        <Check className="size-3.5 mr-1" /> Approve
                      </Button>
                    )}
                    {r.status !== "rejected" && (
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => changeStatus(r.id, "rejected")}>
                        <X className="size-3.5 mr-1" /> Reject
                      </Button>
                    )}
                    {/* Reply / Edit reply — only shown when editor is closed. */}
                    {editingId !== r.id && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-primary btn-premium"
                          onClick={() => startReply(r)}
                        >
                          <MessageCircle className="size-3.5 mr-1" />
                          {r.adminReply ? "Edit Reply" : "Reply"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/40"
                          disabled={aiReplyBusyId === r.id || replyBusy}
                          onClick={() => aiReply(r.id)}
                          title="Generate a draft reply with AI"
                        >
                          {aiReplyBusyId === r.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Wand2 className="size-3.5" />
                          )}
                          AI Reply
                        </Button>
                      </>
                    )}
                    {/* AI moderate (re-run) */}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1 text-muted-foreground"
                      disabled={aiBusyId === r.id}
                      onClick={() => aiModerate(r.id)}
                      title="Re-run AI moderation"
                    >
                      {aiBusyId === r.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="size-3.5" />
                      )}
                      <span className="hidden sm:inline">AI Check</span>
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive ml-auto" onClick={() => del(r.id)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Image lightbox */}
      {galleryImages && galleryImages.length > 0 && (
        <Dialog open onOpenChange={(o) => !o && setGalleryImages(null)}>
          <DialogContent className="max-w-2xl p-0 overflow-hidden">
            <DialogHeader className="sr-only">
              <DialogTitle>Review image {galleryIndex + 1} of {galleryImages.length}</DialogTitle>
              <DialogDescription>Customer-uploaded review image.</DialogDescription>
            </DialogHeader>
            <div className="relative bg-black/90">
              <img
                src={galleryImages[galleryIndex]}
                alt={`Review image ${galleryIndex + 1}`}
                className="mx-auto max-h-[70vh] w-auto object-contain"
              />
              {galleryImages.length > 1 && (
                <>
                  <button
                    onClick={() => setGalleryIndex((i) => (i - 1 + galleryImages.length) % galleryImages.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-2 text-white hover:bg-white/30"
                    aria-label="Previous"
                  >
                    <X className="size-4 rotate-45" />
                  </button>
                  <button
                    onClick={() => setGalleryIndex((i) => (i + 1) % galleryImages.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-2 text-white hover:bg-white/30"
                    aria-label="Next"
                  >
                    <X className="size-4 -rotate-45" />
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
                    {galleryIndex + 1} / {galleryImages.length}
                  </div>
                </>
              )}
              <button
                onClick={() => setGalleryImages(null)}
                className="absolute right-2 top-2 rounded-full bg-white/20 p-2 text-white hover:bg-white/30"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AnalyticsCard — small stat card used in the reviews summary strip.
// ---------------------------------------------------------------------------
function AnalyticsCard({
  label,
  value,
  icon,
  tint,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tint: "emerald" | "amber" | "rose" | "teal";
}) {
  const tintMap: Record<string, string> = {
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
    teal: "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
  };
  return (
    <Card className="admin-card">
      <CardContent className="flex items-center gap-2.5 p-3">
        <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tintMap[tint]}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-lg font-semibold tabular-nums leading-tight">{value}</div>
          <div className="text-[11px] text-muted-foreground truncate">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
