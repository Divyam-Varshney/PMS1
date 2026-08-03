// ============================================================================
// File: src/components/admin/views/NewsletterView.tsx
// Purpose: Admin panel → Newsletter subscribers management.
//          - List subscribers (email, name, subscribed date, active status)
//          - Search/filter
//          - Export CSV
//          - Send custom HTML email (single subscriber, HTML editor)
//          - Send bulk newsletter to ALL active subscribers (HTML editor)
// Role: Re-uses the shared admin UI primitives (PageHeader, StatusBadge, ...)
//       for consistency with the rest of the admin views.
// ============================================================================

"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, run } from "../api";
import { PageHeader, StatusBadge, TableSkeleton, EmptyState } from "../ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Mail,
  Trash2,
  Loader2,
  Download,
  Search,
  Send,
  Mailbox,
  Eye,
  Edit,
  Users,
} from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { sanitizeHtml } from "@/lib/sanitize";
import { toast } from "sonner";

interface Subscriber {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  createdAt: string;
}

interface ListResponse {
  items: Subscriber[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  activeCount: number;
}

/** Default HTML body used to pre-fill the bulk + individual HTML editors.
 *  Inline CSS only (email clients strip <style> blocks). */
const DEFAULT_NEWSLETTER_HTML = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #059669; margin: 0 0 16px 0;">Hello there,</h2>
  <p style="color: #374151; font-size: 15px; line-height: 1.65; margin: 0 0 16px 0;">
    Here's what's new at Pradeep Medical Store this week.
  </p>
  <p style="color: #374151; font-size: 15px; line-height: 1.65; margin: 0 0 16px 0;">
    Write your newsletter content here. Use inline CSS for styling — email clients don't support external stylesheets.
  </p>
  <p style="margin: 24px 0 0 0;">
    <a href="https://pradeepmedical.com" style="background-color: #059669; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; display: inline-block;">Visit our store</a>
  </p>
  <p style="color: #9ca3af; font-size: 12px; margin: 32px 0 0 0;">
    You received this email because you subscribed to our newsletter.
  </p>
</div>`;

export function NewsletterView() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [customEmailFor, setCustomEmailFor] = useState<Subscriber | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (search) p.set("search", search);
    if (activeOnly) p.set("activeOnly", "true");
    return `?${p.toString()}`;
  }, [page, search, activeOnly]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-newsletter", search, activeOnly, page],
    queryFn: () => api.get<ListResponse>("/api/admin/newsletter" + query),
    placeholderData: (prev) => prev,
  });

  // Debounced search — keep `search` state in sync with the input, but only
  // trigger a new query when the user stops typing for 350ms.
  const [searchInput, setSearchInput] = useState("");
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const onSearchChange = (v: string) => {
    setSearchInput(v);
    if (searchTimer) clearTimeout(searchTimer);
    const t = setTimeout(() => {
      setSearch(v);
      setPage(1);
    }, 350);
    setSearchTimer(t);
  };

  async function onDelete(sub: Subscriber) {
    if (!confirm(`Delete subscriber "${sub.email}"? This cannot be undone.`)) return;
    setBusyId(sub.id);
    const r = await run(() => api.del(`/api/admin/newsletter/${sub.id}`), {
      success: "Subscriber deleted",
      error: "Delete failed",
    });
    setBusyId(null);
    if (r) qc.invalidateQueries({ queryKey: ["admin-newsletter"] });
  }

  async function onToggleActive(sub: Subscriber) {
    setBusyId(sub.id);
    const r = await run(
      () => api.patch(`/api/admin/newsletter/${sub.id}`, { isActive: !sub.isActive }),
      {
        success: sub.isActive ? "Subscriber deactivated" : "Subscriber re-activated",
        error: "Update failed",
      }
    );
    setBusyId(null);
    if (r) qc.invalidateQueries({ queryKey: ["admin-newsletter"] });
  }

  function onExport() {
    // Trigger CSV download via a one-shot navigation. The endpoint streams
    // the CSV with a Content-Disposition header so the browser downloads it.
    window.location.href = "/api/admin/newsletter/export";
  }

  return (
    <div>
      <PageHeader
        title="Newsletter"
        description="Manage email subscribers collected from the customer site footer."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button className="gap-1.5" onClick={() => setBulkOpen(true)}>
              <Send className="size-4" /> Send Newsletter
            </Button>
            <Button variant="outline" className="gap-1.5" onClick={onExport}>
              <Download className="size-4" /> Export CSV
            </Button>
          </div>
        }
      />

      {/* Stat strip */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="admin-stat-card">
          <CardContent className="flex items-center gap-3 pt-5">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Mailbox className="size-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total subscribers</div>
              <div className="text-xl font-semibold tabular-nums">{data?.total ?? 0}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="admin-stat-card">
          <CardContent className="flex items-center gap-3 pt-5">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Mail className="size-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Active</div>
              <div className="text-xl font-semibold tabular-nums">{data?.activeCount ?? 0}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="admin-stat-card">
          <CardContent className="flex items-center gap-3 pt-5">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <Mail className="size-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Inactive</div>
              <div className="text-xl font-semibold tabular-nums">
                {data ? data.total - data.activeCount : 0}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search + filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by email or name…"
            className="pl-8"
          />
        </div>
        <Button
          variant={activeOnly ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setActiveOnly((v) => !v);
            setPage(1);
          }}
        >
          {activeOnly ? "Showing active only" : "Show active only"}
        </Button>
        {(search || activeOnly) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setSearchInput("");
              setActiveOnly(false);
              setPage(1);
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {isLoading ? (
        <Card className="admin-card"><CardContent className="pt-4"><TableSkeleton rows={6} cols={4} /></CardContent></Card>
      ) : !data?.items?.length ? (
        <EmptyState
          title="No subscribers"
          description="Newsletter subscribers collected from the customer site footer will appear here."
          icon={<Mail className="size-6" />}
        />
      ) : (
        <>
          <Card className="admin-card">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Subscribed</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((sub) => (
                    <TableRow key={sub.id} className={busyId === sub.id ? "opacity-60" : ""}>
                      <TableCell className="font-medium">{sub.email}</TableCell>
                      <TableCell className="text-muted-foreground">{sub.name || "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={sub.isActive ? "active" : "inactive"} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(sub.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1"
                            onClick={() => setCustomEmailFor(sub)}
                            disabled={busyId === sub.id}
                          >
                            <Mail className="size-3.5" /> Email
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onToggleActive(sub)}
                            disabled={busyId === sub.id}
                          >
                            {sub.isActive ? "Deactivate" : "Activate"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => onDelete(sub)}
                            disabled={busyId === sub.id}
                          >
                            {busyId === sub.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Trash2 className="size-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {isFetching ? "Loading…" : `Showing ${data.items.length} of ${data.total}`}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Badge variant="outline">
                Page {data.page} of {data.totalPages}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      {customEmailFor && (
        <CustomEmailDialog
          subscriber={customEmailFor}
          onClose={() => setCustomEmailFor(null)}
        />
      )}
      {bulkOpen && <BulkEmailDialog onClose={() => setBulkOpen(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom HTML email dialog — sends a one-off HTML email to a single
// subscriber using the HTML editor + preview toggle.
// ---------------------------------------------------------------------------

function CustomEmailDialog({
  subscriber,
  onClose,
}: {
  subscriber: Subscriber;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState("Newsletter — Pradeep Medical Store");
  const [htmlBody, setHtmlBody] = useState(DEFAULT_NEWSLETTER_HTML);
  const [sending, setSending] = useState(false);

  async function onSend() {
    if (!subject.trim() || !htmlBody.trim()) {
      toast.error("Subject and HTML body are required");
      return;
    }
    setSending(true);
    const r = await run(
      () =>
        api.post<{ sent: boolean; status: string; error?: string | null; logId: string }>(
          `/api/admin/newsletter`,
          {
            id: subscriber.id,
            subject: subject.trim(),
            htmlBody: htmlBody.trim(),
          }
        ),
      { success: "Email queued", error: "Failed to send email" }
    );
    setSending(false);
    if (r) {
      if (r.error && r.status === "sent") {
        toast.info(`Email logged only — ${r.error}`);
      }
      onClose();
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Send email to {subscriber.email}</DialogTitle>
          <DialogDescription>
            Compose a custom HTML email. The attempt is always logged; SMTP must
            be configured in Settings → SMTP for the email to actually leave
            the server.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="custom-subject" className="text-xs">Subject</Label>
            <Input
              id="custom-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <HtmlEditor value={htmlBody} onChange={setHtmlBody} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={onSend} disabled={sending} className="gap-1.5">
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Send email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Bulk email dialog — broadcasts a custom HTML email to ALL active
// subscribers. Server-side rate-limited (1s between sends).
// ---------------------------------------------------------------------------

function BulkEmailDialog({ onClose }: { onClose: () => void }) {
  const [subject, setSubject] = useState("Newsletter — Pradeep Medical Store");
  const [htmlBody, setHtmlBody] = useState(DEFAULT_NEWSLETTER_HTML);
  const [sending, setSending] = useState(false);

  async function onSend() {
    if (!subject.trim() || !htmlBody.trim()) {
      toast.error("Subject and HTML body are required");
      return;
    }
    if (
      !confirm(
        "Send this newsletter to ALL active subscribers? This cannot be undone."
      )
    )
      return;
    setSending(true);
    const r = await run(
      () =>
        api.post<{ sent: number; failed: number; total: number }>(
          `/api/admin/newsletter/bulk`,
          { subject: subject.trim(), htmlBody: htmlBody.trim() }
        ),
      { error: "Bulk send failed" }
    );
    setSending(false);
    if (r) {
      const failedNote = r.failed ? ` (${r.failed} failed)` : "";
      toast.success(
        `Newsletter sent — ${r.sent} of ${r.total} emails delivered${failedNote}.`
      );
      onClose();
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Send newsletter to all subscribers</DialogTitle>
          <DialogDescription>
            This will broadcast the email below to <strong>every active
            subscriber</strong>. Emails are rate-limited (1 second between
            sends) to stay under SMTP provider limits, so large lists may take
            a while.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="bulk-subject" className="text-xs">Subject</Label>
            <Input
              id="bulk-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <HtmlEditor value={htmlBody} onChange={setHtmlBody} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={onSend} disabled={sending} className="gap-1.5">
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Users className="size-4" />}
            Send to All Subscribers
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Reusable HTML editor — textarea with monospace font + a "Preview" toggle
// that renders the HTML via dangerouslySetInnerHTML. Mirrors the editor UX
// used by the NotificationTemplatesView (Admin → Templates).
// ---------------------------------------------------------------------------

function HtmlEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [preview, setPreview] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">HTML Body</Label>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 gap-1 text-xs"
          onClick={() => setPreview((p) => !p)}
        >
          {preview ? (
            <>
              <Edit className="size-3" /> Edit
            </>
          ) : (
            <>
              <Eye className="size-3" /> Preview
            </>
          )}
        </Button>
      </div>
      {preview ? (
        <div
          className="min-h-[200px] max-h-[400px] overflow-y-auto rounded-md border bg-white p-3 text-sm"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(value) }}
        />
      ) : (
        <Textarea
          rows={10}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-xs min-h-[200px] max-h-[400px] resize-y overflow-y-auto"
        />
      )}
      <p className="text-xs text-muted-foreground">
        Write your newsletter in HTML. Use inline CSS for styling.
      </p>
    </div>
  );
}
