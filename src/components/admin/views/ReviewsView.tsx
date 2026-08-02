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
import { Star, Check, X, Trash2, Loader2, MessageCircle, Pencil, Save, XCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";

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

  const query = useMemo(() => `?status=${status}&pageSize=50`, [status]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-reviews", status],
    queryFn: () =>
      api.get<{ items: any[]; total: number }>("/api/admin/reviews" + query),
  });

  async function changeStatus(id: string, status: string) {
    const r = await run(() => api.patch(`/api/admin/reviews/${id}`, { status }), {
      success: `Review ${status}`,
      error: "Update failed",
    });
    if (r) qc.invalidateQueries({ queryKey: ["admin-reviews"] });
  }

  async function del(id: string) {
    const r = await run(() => api.del(`/api/admin/reviews/${id}`), {
      success: "Review deleted",
      error: "Delete failed",
    });
    if (r) qc.invalidateQueries({ queryKey: ["admin-reviews"] });
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
      }
    );
    setReplyBusy(false);
    if (r) {
      qc.invalidateQueries({ queryKey: ["admin-reviews"] });
      cancelReply();
    }
  }

  async function deleteReply(id: string) {
    setReplyBusy(true);
    const r = await run(
      () => api.patch(`/api/admin/reviews/${id}`, { adminReply: null }),
      {
        success: "Reply removed",
        error: "Delete failed",
      }
    );
    setReplyBusy(false);
    if (r) {
      qc.invalidateQueries({ queryKey: ["admin-reviews"] });
      if (editingId === id) cancelReply();
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
    let ok = 0;
    let fail = 0;
    for (const id of Array.from(selected)) {
      try {
        if (action === "delete") {
          await api.del(`/api/admin/reviews/${id}`);
        } else {
          await api.patch(`/api/admin/reviews/${id}`, { status: action });
        }
        ok++;
      } catch {
        fail++;
      }
    }
    setBulkBusy(false);
    toast.success(`${ok} review(s) ${action === "delete" ? "deleted" : action}.${fail > 0 ? ` ${fail} failed.` : ""}`);
    clearSelection();
    qc.invalidateQueries({ queryKey: ["admin-reviews"] });
  }

  return (
    <div>
      <PageHeader
        title="Reviews"
        description="Moderate customer product reviews. Select multiple to bulk approve/reject. Reply to reviews to engage with customers."
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
                    <StatusBadge status={r.status} />
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
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-primary">
                        <MessageCircle className="size-3.5" />
                        {r.adminReply ? "Edit admin response" : "Write an admin response"}
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
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-primary btn-premium"
                        onClick={() => startReply(r)}
                      >
                        <MessageCircle className="size-3.5 mr-1" />
                        {r.adminReply ? "Edit Reply" : "Reply"}
                      </Button>
                    )}
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
    </div>
  );
}
