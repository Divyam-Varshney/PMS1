// ============================================================================
// File: src/components/admin/views/AppNotificationCenterView.tsx
// Purpose: Admin → App Notification Center. Two tabs:
//
//   1. Create Campaign
//      • AI generator (topic + tone → generates title / message / CTA / emoji
//        / priority). Editable form, product picker for the deepLink, live
//        phone preview, "Send to ALL customers" button.
//   2. History
//      • Campaign log with delivery stats (sent / failed / skipped per row),
//        filterable by status + category. Paginated.
//
// Permission: requires the "newsletter" permission (same as Newsletter view).
// ============================================================================

"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { api, run } from "../api";
import { PageHeader, StatusBadge, EmptyState, TableSkeleton } from "../ui";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Bell, Send, Loader2, Wand2, Smartphone, History, Users,
  CheckCircle2, XCircle, AlertCircle, Sparkles, ArrowRight,
} from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Template {
  id: string;
  key: string;
  name: string;
  title: string;
  shortDesc: string | null;
  fullMessage: string;
  icon: string | null;
  bannerImage: string | null;
  deepLink: string | null;
  variables: string | null;
  category: string;
  priority: string;
  isEnabled: boolean;
  updatedAt: string;
}

interface AnalyticsData {
  range: { days: number; from: string; to: string };
  totals: { sent: number; failed: number; skipped: number; total: number };
  byDay: Array<{ date: string; sent: number; failed: number; skipped: number }>;
  byTemplate: Array<{ templateKey: string; count: number; sent: number; failed: number }>;
  byCategory: Array<{ category: string; count: number; sent: number; failed: number }>;
  activeSubscribers: number;
  totalCustomers: number;
  enabledPreferences: number;
}

interface HistoryItem {
  id: string;
  customerId: string;
  templateKey: string | null;
  title: string;
  body: string;
  category: string;
  status: string;
  error: string | null;
  metadata: string | null;
  createdAt: string;
  customer: { id: string; name: string; email: string; phone: string } | null;
}

interface HistoryResponse {
  items: HistoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface GeneratedDraft {
  title: string;
  message: string;
  ctaText: string;
  emoji: string;
  priority: "normal" | "high";
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function AppNotificationCenterView() {
  const [tab, setTab] = useState<"campaign" | "history">("campaign");

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="App Notification Center"
        description="Send Web Push notifications to all customers. Transactional templates fire automatically on order + payment events."
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as "campaign" | "history")}>
        <TabsList>
          <TabsTrigger value="campaign" className="gap-2">
            <Bell className="size-4" /> Create Campaign
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="size-4" /> History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaign" className="mt-4">
          <CampaignTab />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campaign tab — AI generator + compose + send to ALL
// ---------------------------------------------------------------------------

function CampaignTab() {
  const qc = useQueryClient();

  // Form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [emoji, setEmoji] = useState("💊");
  const [ctaText, setCtaText] = useState("Shop Now");
  const [deepLink, setDeepLink] = useState("/");
  const [priority, setPriority] = useState<"normal" | "high">("normal");
  const [bannerImage, setBannerImage] = useState("");

  // AI generator inputs
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<"professional" | "friendly" | "urgent" | "celebratory" | "informative">("friendly");

  // Mutations
  const generateMutation = useMutation({
    mutationFn: (input: { topic: string; tone: string }) =>
      api.post<GeneratedDraft>("/api/admin/app-notifs/generate", input),
    onSuccess: (draft) => {
      // Prepend emoji to title for display, but keep them separate so the
      // admin can edit. The final title sent is `${emoji} ${title}`.
      setTitle(draft.title);
      setBody(draft.message);
      setCtaText(draft.ctaText);
      setEmoji(draft.emoji);
      setPriority(draft.priority);
      toast.success("AI draft generated! Review and edit before sending.");
    },
    onError: (e: any) => {
      toast.error(`AI generation failed: ${e?.message || "unknown error"}`);
    },
  });

  const broadcastMutation = useMutation({
    mutationFn: (payload: {
      title: string;
      body: string;
      icon?: string;
      image?: string;
      deepLink?: string;
      priority?: "normal" | "high";
      tag?: string;
    }) => api.post<{
      totalCustomers: number;
      targeted: number;
      skipped: number;
      sent: number;
      failed: number;
      pruned: number;
      durationMs: number;
    }>("/api/admin/app-notifs/broadcast", payload),
    onSuccess: (res) => {
      toast.success(
        `Broadcast complete — ${res.sent} delivered, ${res.skipped} skipped, ${res.failed} failed (${(res.durationMs / 1000).toFixed(1)}s)`
      );
      qc.invalidateQueries({ queryKey: ["admin", "app-notifs", "history"] });
      qc.invalidateQueries({ queryKey: ["admin", "app-notifs", "analytics"] });
    },
    onError: (e: any) => {
      toast.error(`Broadcast failed: ${e?.message || "unknown error"}`);
    },
  });

  const finalTitle = useMemo(() => {
    const t = title.trim();
    if (!t) return "";
    if (emoji && !t.startsWith(emoji)) return `${emoji} ${t}`;
    return t;
  }, [title, emoji]);

  const canSend = title.trim().length > 0 && body.trim().length > 0 && !broadcastMutation.isPending;

  const handleSend = () => {
    if (!canSend) return;
    broadcastMutation.mutate({
      title: finalTitle,
      body: body.trim(),
      deepLink: deepLink || "/",
      priority,
      image: bannerImage || undefined,
      tag: "pms-campaign",
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      {/* ── Left: Compose form ──────────────────────────────────────────── */}
      <div className="space-y-4">
        {/* AI Generator card */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-5 text-emerald-600" />
              AI Content Generator
            </CardTitle>
            <CardDescription className="text-xs">
              Describe what you want to announce. The AI drafts a title, message, CTA, emoji, and priority.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="topic" className="text-xs">Topic / Announcement</Label>
              <Input
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Flat 20% off on all ayurvedic medicines this week"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tone</Label>
                <Select value={tone} onValueChange={(v) => setTone(v as typeof tone)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="celebratory">Celebratory</SelectItem>
                    <SelectItem value="informative">Informative</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() => {
                    if (!topic.trim()) {
                      toast.error("Please enter a topic first");
                      return;
                    }
                    generateMutation.mutate({ topic: topic.trim(), tone });
                  }}
                  disabled={generateMutation.isPending || !topic.trim()}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {generateMutation.isPending ? (
                    <><Loader2 className="size-4 mr-1.5 animate-spin" /> Generating...</>
                  ) : (
                    <><Wand2 className="size-4 mr-1.5" /> Generate Draft</>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Compose card */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Compose Notification</CardTitle>
            <CardDescription className="text-xs">
              Edit the AI draft or write your own. This will be sent to ALL active customers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-[80px_1fr] gap-3">
              <div>
                <Label htmlFor="emoji" className="text-xs">Emoji</Label>
                <Input
                  id="emoji"
                  value={emoji}
                  onChange={(e) => setEmoji(e.target.value.slice(0, 4))}
                  className="mt-1 text-center text-lg"
                  maxLength={4}
                />
              </div>
              <div>
                <Label htmlFor="title" className="text-xs">Title <span className="text-muted-foreground">({title.length}/60)</span></Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, 60))}
                  placeholder="e.g. 20% off Ayurvedic medicines!"
                  className="mt-1"
                  maxLength={60}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="body" className="text-xs">Message <span className="text-muted-foreground">({body.length}/200)</span></Label>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, 200))}
                placeholder="Write your notification message..."
                className="mt-1 resize-none"
                rows={3}
                maxLength={200}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cta" className="text-xs">CTA Label (for preview)</Label>
                <Input
                  id="cta"
                  value={ctaText}
                  onChange={(e) => setCtaText(e.target.value.slice(0, 30))}
                  className="mt-1"
                  maxLength={30}
                />
              </div>
              <div>
                <Label htmlFor="link" className="text-xs">Deep Link (click target)</Label>
                <Input
                  id="link"
                  value={deepLink}
                  onChange={(e) => setDeepLink(e.target.value)}
                  placeholder="/shop or /deals"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as "normal" | "high")}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High (persistent)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="banner" className="text-xs">Banner Image URL (optional)</Label>
                <Input
                  id="banner"
                  value={bannerImage}
                  onChange={(e) => setBannerImage(e.target.value)}
                  placeholder="https://..."
                  className="mt-1"
                />
              </div>
            </div>

            {/* Send button */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-border/60">
              <p className="text-xs text-muted-foreground">
                Sends to <strong>ALL active customers</strong> with notifications enabled. Skips those who opted out.
              </p>
              <Button
                onClick={handleSend}
                disabled={!canSend}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
              >
                {broadcastMutation.isPending ? (
                  <><Loader2 className="size-4 mr-1.5 animate-spin" /> Sending...</>
                ) : (
                  <><Send className="size-4 mr-1.5" /> Send to All Customers</>
                )}
              </Button>
            </div>
            {broadcastMutation.data && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-900/40 dark:text-emerald-200">
                <p className="font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="size-4" /> Last broadcast result
                </p>
                <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Stat label="Delivered" value={broadcastMutation.data.sent} color="emerald" />
                  <Stat label="Skipped" value={broadcastMutation.data.skipped} color="amber" />
                  <Stat label="Failed" value={broadcastMutation.data.failed} color="rose" />
                  <Stat label="Duration" value={`${(broadcastMutation.data.durationMs / 1000).toFixed(1)}s`} color="stone" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Right: Phone preview ────────────────────────────────────────── */}
      <div className="space-y-4">
        <PhonePreview
          title={finalTitle || "Your notification title"}
          body={body || "Your notification message will appear here. Keep it short and actionable."}
          ctaText={ctaText}
          bannerImage={bannerImage}
          priority={priority}
        />

        {/* Quick stats */}
        <AnalyticsMini />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phone preview — looks like an Android notification shade
// ---------------------------------------------------------------------------

function PhonePreview({
  title, body, ctaText, bannerImage, priority,
}: {
  title: string;
  body: string;
  ctaText: string;
  bannerImage: string;
  priority: "normal" | "high";
}) {
  return (
    <Card className="border-border/60 overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Smartphone className="size-4 text-emerald-600" /> Live Preview
        </CardTitle>
        <CardDescription className="text-xs">
          How the notification will appear on the customer's device.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mx-auto max-w-[300px] rounded-3xl border-4 border-stone-800 dark:border-stone-700 bg-stone-900 p-2 shadow-lg">
          {/* Status bar */}
          <div className="flex items-center justify-between px-3 py-1 text-[10px] text-stone-400">
            <span>9:41</span>
            <span className="flex items-center gap-1">
              <span className="size-1 rounded-full bg-emerald-400" />
              <span>PMS</span>
            </span>
          </div>
          {/* Notification */}
          <div className="rounded-2xl bg-stone-800 p-3 mt-1 shadow">
            <div className="flex items-start gap-2">
              <div className="size-8 shrink-0 rounded-lg bg-emerald-600 flex items-center justify-center text-white text-sm font-bold">
                💊
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-white truncate">PMS Pharmacy</p>
                  <span className="text-[10px] text-stone-400 shrink-0">now</span>
                </div>
                <p className="text-xs font-medium text-white mt-0.5 line-clamp-2">{title}</p>
                <p className="text-[11px] text-stone-300 mt-0.5 line-clamp-3">{body}</p>
                {bannerImage && (
                  <div className="mt-2 overflow-hidden rounded-lg">
                    <img
                      src={bannerImage}
                      alt="Banner"
                      className="w-full h-24 object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  </div>
                )}
                {ctaText && (
                  <div className="mt-2 flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                    {ctaText} <ArrowRight className="size-3" />
                  </div>
                )}
              </div>
            </div>
            {priority === "high" && (
              <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-400">
                <AlertCircle className="size-3" /> High priority — persistent
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Mini analytics card (right column of campaign tab)
// ---------------------------------------------------------------------------

function AnalyticsMini() {
  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["admin", "app-notifs", "analytics"],
    queryFn: () => api.get<AnalyticsData>("/api/admin/app-notifs/analytics?days=30"),
    staleTime: 60_000,
  });

  if (isLoading) return <Skeleton className="h-40 rounded-lg" />;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Reach (last 30 days)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Subscribers" value={data?.activeSubscribers ?? 0} color="emerald" />
          <Stat label="Total Customers" value={data?.totalCustomers ?? 0} color="stone" />
          <Stat label="Opted In" value={data?.enabledPreferences ?? 0} color="emerald" />
        </div>
        <div className="rounded-lg border border-border/60 p-3">
          <p className="text-xs text-muted-foreground mb-2">Delivery (30d)</p>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Sent" value={data?.totals.sent ?? 0} color="emerald" />
            <Stat label="Failed" value={data?.totals.failed ?? 0} color="rose" />
            <Stat label="Skipped" value={data?.totals.skipped ?? 0} color="amber" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Stat tile (used in multiple places)
// ---------------------------------------------------------------------------

function Stat({
  label, value, color,
}: {
  label: string;
  value: number | string;
  color: "emerald" | "rose" | "amber" | "stone";
}) {
  const colors: Record<string, string> = {
    emerald: "text-emerald-700 dark:text-emerald-300",
    rose: "text-rose-700 dark:text-rose-300",
    amber: "text-amber-700 dark:text-amber-300",
    stone: "text-stone-700 dark:text-stone-300",
  };
  return (
    <div className="rounded-lg bg-muted/40 px-2 py-1.5 text-center">
      <p className={`text-base font-bold ${colors[color]}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// History tab — campaign log with delivery stats
// ---------------------------------------------------------------------------

function HistoryTab() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  const { data, isLoading } = useQuery<HistoryResponse>({
    queryKey: ["admin", "app-notifs", "history", page, statusFilter, categoryFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "30" });
      if (statusFilter) params.set("status", statusFilter);
      if (categoryFilter) params.set("category", categoryFilter);
      return api.get<HistoryResponse>(`/api/admin/app-notifs/history?${params.toString()}`);
    },
    staleTime: 30_000,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-base">Notification History</CardTitle>
            <CardDescription className="text-xs mt-1">
              {total} total notification{total === 1 ? "" : "s"} — transactional + campaign.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="skipped">Skipped</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="transactional">Transactional</SelectItem>
                <SelectItem value="campaign">Campaign</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <TableSkeleton rows={6} cols={4} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Bell className="size-5" />}
            title="No notifications yet"
            description="Once you send a campaign or customers receive transactional pushes, they'll appear here."
          />
        ) : (
          <div className="max-h-[600px] overflow-y-auto rounded-lg border border-border/60">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur z-10">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium text-xs text-muted-foreground">Notification</th>
                  <th className="px-3 py-2 font-medium text-xs text-muted-foreground">Customer</th>
                  <th className="px-3 py-2 font-medium text-xs text-muted-foreground">Type</th>
                  <th className="px-3 py-2 font-medium text-xs text-muted-foreground">Status</th>
                  <th className="px-3 py-2 font-medium text-xs text-muted-foreground text-right">When</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-border/40 hover:bg-muted/30">
                    <td className="px-3 py-2 min-w-0">
                      <p className="font-medium text-foreground line-clamp-1">{item.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{item.body}</p>
                      {item.error && (
                        <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5 line-clamp-1">⚠ {item.error}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 min-w-0">
                      {item.customer ? (
                        <div className="text-xs">
                          <p className="font-medium truncate">{item.customer.name}</p>
                          <p className="text-muted-foreground truncate">{item.customer.email}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Customer deleted</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="text-xs">
                        {item.templateKey ? item.templateKey.replace(/_/g, " ") : item.category}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(item.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
