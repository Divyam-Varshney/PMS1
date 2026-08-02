// ============================================================================
// File: src/components/admin/views/NotificationTemplatesView.tsx
// Purpose: Notification templates — list, inline edit, create custom templates
//          with HTML/CSS support + live preview. Supports email & app push
//          notifications.
//
// Redesign (Phase 97 — templates-perf):
//   • Templates grouped by CHANNEL:
//       - Customer Email  → transactional customer emails (order/OTP/shipping)
//       - Admin Email     → internal operational alerts
//       - App Notification's → in-app push notifications (AppNotifTemplate)
//   • Premium card design: rounded-xl, shadow-premium-sm, border-border/50,
//     consistent spacing, branded channel pills, sticky action footer.
//   • Card-based loading skeleton (replaces table skeleton — matches the
//     3-col card layout, so the layout doesn't jump on data arrival).
//   • Per-channel stat cards in the summary header (counts + descriptions).
//   • Improved mobile responsiveness: stacked layout, full-width actions.
//   • Cleaner HTML editor toolbar with Format / Minify / Preview toggles.
//   • Live HTML preview pane with branded email-frame styling.
//   • App-notif templates are fetched from a separate endpoint and mapped
//     into the same row shape so the same TemplateCard can edit them;
//     saves/toggles route to the app-notifs PUT / template-toggle endpoints.
// ============================================================================

"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, run } from "../api";
import { PageHeader, EmptyState } from "../ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  FileText, Loader2, Save, Plus, Trash2, Eye, Code, Wand2,
  Mail, Send, Bell, ToggleLeft, ToggleRight,
} from "lucide-react";
import { sanitizeHtml } from "@/lib/sanitize";
import { toast } from "sonner";

// ----------------------------------------------------------------------------
// HTML helpers — simple regex-based formatters. These are intentionally
// lightweight (no DOM parser); they handle the common case of pasted HTML
// being either minified-on-one-line or overly indented.
// ----------------------------------------------------------------------------

/** Pretty-print HTML: put each block-level tag on its own line + indent. */
function formatHtml(html: string): string {
  if (!html.includes("<")) return html; // not HTML
  const out = html
    .replace(/^\s+/gm, "")
    .replace(/>\s+</g, ">\n<")
    .replace(/[ \t]{2,}/g, " ");
  const lines = out.split("\n").map((l) => l.trim()).filter(Boolean);
  let depth = 0;
  const indentStr = "  ";
  const result: string[] = [];
  for (const line of lines) {
    const isClosing = /^<\//.test(line);
    const isSelfClosed = /\/>$/.test(line) || /^<[^>]+\/>$/.test(line);
    const isOpening = /^<[^/!?][^>]*[^/]>$/.test(line) && !isSelfClosed;
    const voidMatch = /^<(br|img|hr|input|meta|link|area|base|col|embed|source|track|wbr)\b/i.test(line);
    if (isClosing) depth = Math.max(0, depth - 1);
    result.push(indentStr.repeat(depth) + line);
    if (isOpening && !isClosing && !voidMatch) depth += 1;
  }
  return result.join("\n");
}

/** Minify HTML: collapse whitespace between tags + strip leading/trailing
 *  whitespace on each line. Preserves a single space inside text runs. */
function minifyHtml(html: string): string {
  if (!html.includes("<")) return html.trim();
  return html
    .replace(/\s+/g, " ")
    .replace(/>\s+/g, ">")
    .replace(/\s+</g, "<")
    .trim();
}

/** Count the number of lines in a string (always >= 1). */
function countLines(s: string): number {
  if (!s) return 0;
  return s.split("\n").length;
}

// ----------------------------------------------------------------------------
// Category grouping — templates bucketed by CHANNEL.
//
//   customer → transactional customer emails (order/OTP/shipping)
//   admin    → internal operational alerts for staff
//   app      → in-app push notifications (AppNotifTemplate rows)
//   other    → uncategorized fallback (hidden tab — shown in summary count)
// ----------------------------------------------------------------------------

type TemplateCategory = "customer" | "admin" | "app" | "other";

function categorize(t: any): TemplateCategory {
  // App-notif templates are tagged at fetch time (_isApp === true).
  if (t._isApp) return "app";
  const rawKey: string = t.key || "";
  const baseKey = rawKey.replace(/_email$/, "");
  if (baseKey.startsWith("admin")) return "admin";
  if (t.channel === "email") return "customer";
  return "other";
}

const CHANNEL_META: Record<
  TemplateCategory,
  {
    label: string;
    shortLabel: string;
    icon: typeof Mail;
    tint: string;
    accent: string; // soft tinted background for the stat card
    description: string;
    tabDescription: string;
  }
> = {
  customer: {
    label: "Customer Emails",
    shortLabel: "Customer",
    icon: Mail,
    tint: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    accent: "from-emerald-50 to-teal-50/50 dark:from-emerald-950/30 dark:to-teal-950/20",
    description: "Transactional emails sent to customers — order confirmations, OTPs, shipping updates.",
    tabDescription: "Order confirmations, OTPs, shipping updates sent to customers.",
  },
  admin: {
    label: "Admin Notifications",
    shortLabel: "Admin",
    icon: Send,
    tint: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    accent: "from-amber-50 to-orange-50/50 dark:from-amber-950/30 dark:to-orange-950/20",
    description: "Internal alerts for new orders, prescriptions, stock events, and system activity.",
    tabDescription: "Internal alerts for new orders, prescriptions, and stock events.",
  },
  app: {
    label: "App Notification's",
    shortLabel: "App",
    icon: Bell,
    tint: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    accent: "from-emerald-50 to-teal-50/50 dark:from-emerald-950/30 dark:to-teal-950/20",
    description: "In-app push notifications sent to customer devices via the PWA service worker.",
    tabDescription: "Push notifications delivered to customer devices through the PWA service worker.",
  },
  other: {
    label: "Other",
    shortLabel: "Other",
    icon: FileText,
    tint: "bg-muted text-muted-foreground",
    accent: "from-muted/40 to-muted/20",
    description: "Uncategorized templates.",
    tabDescription: "Uncategorized templates.",
  },
};

// Visible tab order — "other" is excluded from the tab strip but still counted.
const TAB_ORDER: TemplateCategory[] = ["customer", "admin", "app"];

// Query key shared by all template-related mutations so saves/toggles/
// deletes invalidate both the email list AND the app-notif list at once.
const EMAIL_QK = ["admin-notification-templates"] as const;
const APP_QK = ["admin-app-notif-templates"] as const;

// Shared textarea class for the HTML/text editor. Capped at max-h-[300px] so
// pasted HTML doesn't blow up the card height; resize-y lets the admin drag
// to expand; overflow-y-auto enables in-place scrolling; font-mono + text-xs
// for code readability.
const EDITOR_TEXTAREA_CLASS =
  "font-mono text-xs min-h-[120px] max-h-[300px] resize-y overflow-y-auto scrollbar-premium";

// ----------------------------------------------------------------------------
// Card-based skeleton — matches the 2-col card layout so the page doesn't
// jump when data arrives. Each skeleton card mirrors the real card's
// header + body shape (icon, title, subject input, body textarea, footer).
// ----------------------------------------------------------------------------
function TemplateCardSkeleton() {
  return (
    <Card className="overflow-hidden rounded-xl border-border/50 p-0 shadow-premium-sm">
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border/50 bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-2.5 w-24" />
          </div>
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-24 w-full rounded-md" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
          <Skeleton className="h-5 w-20" />
          <div className="flex gap-2">
            <Skeleton className="size-7 rounded-md" />
            <Skeleton className="h-7 w-16 rounded-md" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function NotificationTemplatesView() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TemplateCategory>("customer");
  const { data: templates, isLoading: emailLoading } = useQuery({
    queryKey: EMAIL_QK,
    queryFn: () => api.get<any[]>("/api/admin/notifications/templates"),
  });

  // Separate query for App Notification templates (different table + endpoint).
  // The route returns `{ templates: [...] }` after envelope unwrap — extract it
  // here and map each row to the same shape as email templates so the same
  // TemplateCard can edit them. We tag each row with `_isApp: true` so
  // `categorize()` routes them into the "app" bucket and so the card knows to
  // save/toggle via the app-notifs endpoints instead of the email endpoints.
  const { data: appTemplates, isLoading: appLoading } = useQuery({
    queryKey: APP_QK,
    queryFn: async () => {
      const r = await api.get<{ templates: any[] }>("/api/admin/app-notifs/templates");
      const list = r?.templates ?? [];
      return list.map((t) => ({
        id: t.id,
        key: t.key,
        name: t.name,
        channel: "app",
        // Map app-notif fields → email-template shape used by TemplateCard.
        subject: t.title ?? "",
        body: t.fullMessage ?? t.shortDesc ?? "",
        isActive: t.isEnabled ?? true,
        variables: t.variables ?? "[]",
        // Pass-through fields the card needs for the app-notif PUT payload.
        _isApp: true,
        _raw: t,
      }));
    },
  });

  const isLoading = emailLoading || appLoading;
  const allTemplates = useMemo(
    () => [...(templates ?? []), ...(appTemplates ?? [])],
    [templates, appTemplates],
  );

  // Bucket templates into the 3 named categories (+ an "other" fallback).
  const grouped = useMemo(() => {
    const buckets: Record<TemplateCategory, any[]> = {
      customer: [], admin: [], app: [], other: [],
    };
    for (const t of allTemplates) buckets[categorize(t)].push(t);
    return buckets;
  }, [allTemplates]);

  const customerCount = grouped.customer.length;
  const adminCount = grouped.admin.length;
  const appCount = grouped.app.length;
  const otherCount = grouped.other.length;
  const totalCount = allTemplates.length;
  const activeCount = allTemplates.filter((t) => t.isActive).length;

  function renderGroup(list: any[], category: TemplateCategory) {
    const meta = CHANNEL_META[category];
    if (!list.length) {
      return (
        <EmptyState
          title={`No ${meta.label.toLowerCase()} yet`}
          description={meta.tabDescription}
          icon={<meta.icon className="size-6" />}
          action={
            <Button onClick={() => setCreateOpen(true)} className="btn-premium gap-1.5">
              <Plus className="size-4" /> New Template
            </Button>
          }
        />
      );
    }
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {list.map((t) => (
          <TemplateCard
            key={t.id}
            template={t}
            onChanged={() => {
              qc.invalidateQueries({ queryKey: EMAIL_QK });
              qc.invalidateQueries({ queryKey: APP_QK });
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notification Templates"
        description="Edit customer emails, admin alerts, and app push notifications. Create custom HTML/CSS templates with variable placeholders."
        actions={
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5 btn-premium">
            <Plus className="size-4" /> New Template
          </Button>
        }
      />

      {/* ====================================================================
          SUMMARY — premium stat strip with per-channel counts.
          Each stat is its own mini-card with icon, count, and label, so
          admins can see the template distribution at a glance.
      ==================================================================== */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <SummaryStat
          icon={Mail}
          tint="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
          accent="from-emerald-50 to-teal-50/50 dark:from-emerald-950/30 dark:to-teal-950/20"
          label="Customer"
          count={customerCount}
          onClick={() => setActiveTab("customer")}
          active={activeTab === "customer"}
        />
        <SummaryStat
          icon={Send}
          tint="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
          accent="from-amber-50 to-orange-50/50 dark:from-amber-950/30 dark:to-orange-950/20"
          label="Admin"
          count={adminCount}
          onClick={() => setActiveTab("admin")}
          active={activeTab === "admin"}
        />
        <SummaryStat
          icon={Bell}
          tint="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
          accent="from-emerald-50 to-teal-50/50 dark:from-emerald-950/30 dark:to-teal-950/20"
          label="App Notification's"
          count={appCount}
          onClick={() => setActiveTab("app")}
          active={activeTab === "app"}
        />
      </div>

      {/* Library overview strip — total + active count. */}
      <Card className="overflow-hidden rounded-xl border-border/50 shadow-premium-sm">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-premium-sm ring-1 ring-primary/10">
              <FileText className="size-5" />
            </div>
            <div>
              <div className="text-sm font-semibold leading-tight">Template Library</div>
              <div className="text-xs text-muted-foreground">
                {totalCount} template{totalCount !== 1 ? "s" : ""} · {activeCount} active
                {otherCount > 0 && ` · ${otherCount} uncategorized`}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {TAB_ORDER.map((cat) => {
              const meta = CHANNEL_META[cat];
              const count = grouped[cat].length;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveTab(cat)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-premium ${
                    activeTab === cat
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border/50 bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <meta.icon className="size-3" />
                  {meta.shortLabel}
                  <span className="rounded-full bg-muted/70 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ====================================================================
          TABS — one tab per template type. Each tab shows the templates
          grouped under that channel. Loading uses card-based skeletons.
      ==================================================================== */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <TemplateCardSkeleton key={i} />
          ))}
        </div>
      ) : !allTemplates.length ? (
        <Card className="overflow-hidden rounded-xl border-border/50 shadow-premium-sm">
          <CardContent className="pt-6">
            <EmptyState
              title="No templates yet"
              description="Create your first notification template to start sending branded emails and app notifications."
              icon={<FileText className="size-6" />}
              action={
                <Button onClick={() => setCreateOpen(true)} className="btn-premium gap-1.5">
                  <Plus className="size-4" /> New Template
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TemplateCategory)}>
          <TabsList className="mb-4 grid w-full grid-cols-3 sm:w-auto">
            {TAB_ORDER.map((cat) => {
              const meta = CHANNEL_META[cat];
              const count = grouped[cat].length;
              return (
                <TabsTrigger key={cat} value={cat} className="gap-1.5">
                  <meta.icon className="size-3.5" />
                  <span className="hidden sm:inline">{meta.shortLabel}</span>
                  <span className="sm:hidden">{meta.shortLabel}</span>
                  <span className="ml-0.5 rounded-full bg-muted/70 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                    {count}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="customer" className="mt-0">
            {renderGroup(grouped.customer, "customer")}
          </TabsContent>
          <TabsContent value="admin" className="mt-0">
            {renderGroup(grouped.admin, "admin")}
          </TabsContent>
          <TabsContent value="app" className="mt-0">
            {renderGroup(grouped.app, "app")}
          </TabsContent>
        </Tabs>
      )}

      <CreateTemplateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: EMAIL_QK });
          qc.invalidateQueries({ queryKey: APP_QK });
        }}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// SummaryStat — small clickable stat card used in the 3-up summary strip.
// Clicking it switches the active tab to that channel.
// ----------------------------------------------------------------------------
function SummaryStat({
  icon: Icon,
  tint,
  accent,
  label,
  count,
  onClick,
  active,
}: {
  icon: typeof Mail;
  tint: string;
  accent: string;
  label: string;
  count: number;
  onClick: () => void;
  active: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-xl border p-3 text-left shadow-premium-sm transition-premium sm:p-4 ${
        active
          ? "border-primary/30 ring-1 ring-primary/20"
          : "border-border/50 hover:border-primary/20 hover:shadow-premium"
      }`}
    >
      {/* Soft gradient backdrop — visible on hover/active for premium feel. */}
      <div
        className={`absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300 ${accent} ${
          active ? "opacity-100" : "group-hover:opacity-60"
        }`}
      />
      <div className="relative flex items-center gap-3">
        <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tint} shadow-premium-sm sm:size-10`}>
          <Icon className="size-4 sm:size-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xl font-bold tabular-nums leading-none sm:text-2xl">{count}</div>
          <div className="mt-1 truncate text-[11px] font-medium text-muted-foreground sm:text-xs">{label}</div>
        </div>
      </div>
    </button>
  );
}

// ----------------------------------------------------------------------------
// TemplateCard — the main editing card for a single template. Includes
// subject + body editors, variables editor, HTML format/minify helpers,
// live preview, and a sticky footer with active toggle + save/delete.
// ----------------------------------------------------------------------------
function TemplateCard({ template, onChanged }: { template: any; onChanged: () => void }) {
  const [subject, setSubject] = useState(template.subject || "");
  const [body, setBody] = useState(template.body || "");
  const [isActive, setIsActive] = useState(template.isActive);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  let initialVars: string[] = [];
  try {
    initialVars = template.variables ? JSON.parse(template.variables) : [];
  } catch (e) { console.error("[templates] error:", e); }

  const [vars, setVars] = useState<string[]>(initialVars);
  const [varsDraft, setVarsDraft] = useState("");

  function commitVarsDraft() {
    if (!varsDraft.trim()) return;
    const parts = varsDraft
      .split(/[\s,]+/)
      .map((p) => p.trim().replace(/^{{|}}$/g, ""))
      .filter(Boolean);
    if (!parts.length) {
      setVarsDraft("");
      return;
    }
    const merged = Array.from(new Set([...vars, ...parts]));
    setVars(merged);
    setVarsDraft("");
  }

  function removeVar(v: string) {
    setVars(vars.filter((x) => x !== v));
  }

  async function save() {
    setSaving(true);
    // App-notif templates use a different table + endpoint. Their "subject"
    // maps to `title` and their "body" maps to `fullMessage`. The PUT endpoint
    // also takes the row id in the body (not the URL).
    const r = template._isApp
      ? await run(
          () => api.put("/api/admin/app-notifs/templates", {
            id: template.id,
            title: subject,
            fullMessage: body,
            shortDesc: body.slice(0, 500),
          }),
          { success: "App template saved", error: "Save failed" },
        )
      : await run(
          () => api.put(`/api/admin/notifications/templates/${template.id}`, {
            subject,
            body,
            isActive,
            variables: vars,
          }),
          { success: "Template saved", error: "Save failed" }
        );
    setSaving(false);
    if (r) onChanged();
  }

  async function toggleActive(next: boolean) {
    // For app-notifs, persist the toggle immediately through the dedicated
    // toggle endpoint so the switch reflects server state in real time.
    if (template._isApp) {
      const r = await run(
        () => api.put("/api/admin/app-notifs/template-toggle", {
          id: template.id,
          isEnabled: next,
        }),
        { success: next ? "App template enabled" : "App template disabled", error: "Toggle failed" },
      );
      if (r) {
        setIsActive(next);
        onChanged();
      }
    } else {
      // For email templates, the toggle is just local state — committed on Save.
      setIsActive(next);
    }
  }

  async function del() {
    if (!confirm("Delete this template?")) return;
    const r = await run(() => api.del(`/api/admin/notifications/templates/${template.id}`), {
      success: "Template deleted", error: "Delete failed",
    });
    if (r) onChanged();
  }

  const isHtml = body.includes("<") && body.includes(">");
  const category = categorize(template);
  const meta = CHANNEL_META[category];
  const ChannelIcon = meta.icon;

  function onFormat() {
    if (!isHtml) {
      toast.info("Body doesn't look like HTML — nothing to format.");
      return;
    }
    setBody(formatHtml(body));
    toast.success("HTML formatted");
  }

  function onMinify() {
    if (!isHtml) {
      toast.info("Body doesn't look like HTML — nothing to minify.");
      return;
    }
    setBody(minifyHtml(body));
    toast.success("HTML minified");
  }

  return (
    <Card className="overflow-hidden rounded-xl border-border/50 p-0 shadow-premium-sm transition-premium hover:shadow-premium">
      {/* Header — icon + name + key on the left, channel + HTML badge on the right */}
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border/50 bg-gradient-to-br from-muted/40 to-muted/10 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${meta.tint} shadow-premium-sm`}>
            <ChannelIcon className="size-4" />
          </div>
          <div className="min-w-0">
            <CardTitle className="truncate text-sm font-semibold">{template.name}</CardTitle>
            <div className="truncate font-mono text-[11px] text-muted-foreground">{template.key}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {isHtml && (
            <Badge variant="outline" className="gap-1 border-amber-200 bg-amber-50 text-amber-700 admin-badge-amber">
              <Code className="size-3" /> HTML
            </Badge>
          )}
          <Badge variant="outline" className={`capitalize ${meta.tint}`}>
            {meta.shortLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Subject</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Body {isHtml && <span className="text-amber-600 dark:text-amber-400">(HTML detected)</span>}
            </Label>
            <div className="flex items-center gap-0.5">
              {isHtml && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 text-xs"
                    onClick={onFormat}
                    title="Pretty-print HTML (add newlines + indentation)"
                  >
                    <Wand2 className="size-3" /> Format
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 text-xs"
                    onClick={onMinify}
                    title="Remove extra whitespace from HTML"
                  >
                    <Wand2 className="size-3" /> Minify
                  </Button>
                </>
              )}
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setShowPreview(!showPreview)}>
                <Eye className="size-3" /> {showPreview ? "Edit" : "Preview"}
              </Button>
            </div>
          </div>
          {showPreview && isHtml ? (
            <div className="overflow-hidden rounded-lg border border-border/50 shadow-premium-sm">
              {/* Browser-like chrome for the preview — gives the email template
                  a real "rendered email" framing rather than a plain div. */}
              <div className="flex items-center gap-1.5 border-b border-border/50 bg-muted/40 px-3 py-1.5">
                <span className="size-2 rounded-full bg-rose-400" />
                <span className="size-2 rounded-full bg-amber-400" />
                <span className="size-2 rounded-full bg-emerald-400" />
                <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Email Preview
                </span>
              </div>
              <div
                className="min-h-[120px] max-h-[400px] overflow-y-auto bg-white p-4 text-sm scrollbar-premium dark:bg-white"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(body) }}
              />
            </div>
          ) : (
            <Textarea
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className={EDITOR_TEXTAREA_CLASS}
            />
          )}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{body.length.toLocaleString()} chars · {countLines(body)} lines</span>
            {isHtml && <span className="text-amber-600 dark:text-amber-400">HTML</span>}
          </div>
        </div>
        {/* Variables editor — admin can add/remove placeholder tokens. */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Variables</Label>
          <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border/50 bg-muted/30 p-2 min-h-[2.5rem]">
            {vars.length === 0 && (
              <span className="text-xs italic text-muted-foreground">No variables yet — add one below.</span>
            )}
            {vars.map((v) => (
              <span
                key={v}
                className="inline-flex items-center gap-1 rounded border border-border/50 bg-background px-1.5 py-0.5 font-mono text-xs shadow-premium-sm"
              >
                <code>{`{{${v}}}`}</code>
                <button
                  type="button"
                  onClick={() => removeVar(v)}
                  className="text-[10px] leading-none text-muted-foreground transition-colors hover:text-destructive"
                  title={`Remove {{${v}}}`}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={varsDraft}
              onChange={(e) => setVarsDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  commitVarsDraft();
                }
              }}
              placeholder="Add variable, e.g. orderNumber (Enter or comma to add)"
              className="h-8 font-mono text-xs"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1"
              onClick={commitVarsDraft}
              disabled={!varsDraft.trim()}
            >
              <Plus className="size-3.5" /> Add
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Use these tokens in the subject/body as <code>{`{{token}}`}</code>. Press Enter or comma to add.
          </p>
        </div>
        {/* Footer — active toggle + actions, sticky to the card bottom. */}
        <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
          <label className="flex cursor-pointer items-center gap-2">
            <Switch checked={isActive} onCheckedChange={toggleActive} />
            <span className="flex items-center gap-1 text-xs font-medium">
              {isActive
                ? <ToggleRight className="size-3.5 text-emerald-600" />
                : <ToggleLeft className="size-3.5 text-muted-foreground" />}
              {isActive ? "Active" : "Inactive"}
            </span>
          </label>
          <div className="flex items-center gap-2">
            {/* App-notif templates can't be deleted from here — their key/name
                are part of the seed contract used by sendAutoNotification. */}
            {!template._isApp && (
              <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/5" onClick={del} title="Delete template">
                <Trash2 className="size-3.5" />
              </Button>
            )}
            <Button size="sm" onClick={save} disabled={saving} className="btn-premium gap-1.5">
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              Save
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateTemplateDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!key.trim() || !name.trim() || !subject.trim() || !body.trim()) {
      toast.error("All fields are required");
      return;
    }
    setSaving(true);
    const r = await run(
      () => api.post("/api/admin/notifications/templates", {
        key: key.trim().toLowerCase().replace(/\s+/g, "_"),
        name: name.trim(),
        channel,
        subject: subject.trim(),
        body,
      }),
      { success: "Template created", error: "Create failed" }
    );
    setSaving(false);
    if (r) {
      onOpenChange(false);
      setKey(""); setName(""); setSubject(""); setBody("");
      onCreated();
    }
  }

  const isHtml = body.includes("<") && body.includes(">");

  function onFormat() {
    if (!isHtml) {
      toast.info("Body doesn't look like HTML — nothing to format.");
      return;
    }
    setBody(formatHtml(body));
    toast.success("HTML formatted");
  }

  function onMinify() {
    if (!isHtml) {
      toast.info("Body doesn't look like HTML — nothing to minify.");
      return;
    }
    setBody(minifyHtml(body));
    toast.success("HTML minified");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto scrollbar-premium">
        <DialogHeader>
          <DialogTitle>Create Custom Template</DialogTitle>
          <DialogDescription>
            Create a custom email template. Use HTML with inline CSS for premium,
            cross-client rendering. Insert variables like {`{{name}}`}, {`{{orderNumber}}`},
            {`{{otp}}`}, etc.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Template Key *</Label>
              <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g. custom_welcome" className="font-mono" />
            </div>
            <div>
              <Label className="text-xs">Template Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Welcome Email" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Channel</Label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email (supports HTML)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Subject *</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Welcome to Pradeep Medical Store" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">
                Body * {channel === "email" && <span className="text-muted-foreground">(HTML + inline CSS allowed)</span>}
              </Label>
              {isHtml && (
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" className="h-6 gap-1 text-xs" onClick={onFormat} title="Pretty-print HTML">
                    <Wand2 className="size-3" /> Format
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 gap-1 text-xs" onClick={onMinify} title="Remove extra whitespace">
                    <Wand2 className="size-3" /> Minify
                  </Button>
                </div>
              )}
            </div>
            <Textarea
              rows={10}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={channel === "email"
                ? '<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">\n  <h2 style="color: #059669;">Welcome, {{name}}!</h2>\n  <p>Thank you for registering at Pradeep Medical Store.</p>\n  <p>Your OTP is: <strong>{{otp}}</strong></p>\n</div>'
                : "Hello {{name}}, your OTP is {{otp}}. Valid for {{expiry}} minutes."
              }
              className={EDITOR_TEXTAREA_CLASS}
            />
            <div className="text-xs text-muted-foreground">
              {body.length.toLocaleString()} chars · {countLines(body)} lines
            </div>
          </div>
          {/* Live preview for email HTML */}
          {channel === "email" && body.includes("<") && (
            <div className="space-y-1.5">
              <Label className="text-xs">Live Preview</Label>
              <div
                className="min-h-[100px] max-h-[400px] overflow-y-auto rounded-md border bg-white p-3 text-sm scrollbar-premium"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(body) }}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={create} disabled={saving} className="gap-1.5 btn-premium">
            {saving && <Loader2 className="size-4 animate-spin" />}
            Create Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
