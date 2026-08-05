// ============================================================================
// File: src/components/admin/views/AiMarketingView.tsx
// Purpose: AI Email Marketing — focused on email campaign generation.
//          Generates: subject, preview text, headline, promotional
//          description, CTA text, and a complete HTML email.
//          Send options: "Send to All Customers" (broadcast) and
//          "Send Test Email" (single recipient).
// ============================================================================

"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, run } from "../api";
import { PageHeader } from "../ui";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Wand2, Loader2, Copy, Check, Mail, Sparkles, Code2, Eye, Download,
  FileCode, Search, X, Plus, Send, Users, AlertCircle, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

interface MarketingContent {
  email?: { subject: string; body: string };
  previewText?: string;
  headline?: string;
  promotionalDescription?: string;
  ctaText?: string;
  campaignTitle?: string;
  campaignDescription?: string;
  suggestedEmoji?: string;
  priority?: string;
  /** Complete responsive HTML email (full <!DOCTYPE html> document, inline CSS, table-based). */
  htmlEmail?: string;
}

const TONES = [
  { value: "promotional", label: "Promotional (sales-focused)" },
  { value: "professional", label: "Professional (informative)" },
  { value: "casual", label: "Casual (friendly)" },
  { value: "educational", label: "Educational (health tips)" },
];

interface ProductListItem {
  id: string;
  name: string;
  sku?: string | null;
  primaryImage?: string | null;
  sellingPrice: number;
  mrp: number;
  stock: number;
}

export function AiMarketingView() {
  // Multi-product selection state
  const [selectedProducts, setSelectedProducts] = useState<ProductListItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ProductListItem[]>([]);
  const [searching, setSearching] = useState(false);

  const [tone, setTone] = useState("promotional");
  const [generating, setGenerating] = useState(false);
  const [content, setContent] = useState<MarketingContent | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Send-target state
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  // Customer count for the broadcast confirmation dialog
  const { data: customerCount } = useQuery({
    queryKey: ["admin-marketing-customer-count"],
    queryFn: () => api.get<{ total: number }>("/api/admin/customers?pageSize=1"),
    staleTime: 60_000,
  });

  // -------- Product search --------
  async function searchProducts(q: string) {
    setProductSearch(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await api.get<{ items: ProductListItem[] }>(
        `/api/admin/products?search=${encodeURIComponent(q)}&pageSize=10`
      );
      // Exclude already-selected
      setSearchResults((res?.items ?? []).filter((p) => !selectedProducts.some((s) => s.id === p.id)));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  function addProduct(p: ProductListItem) {
    if (selectedProducts.some((s) => s.id === p.id)) return;
    setSelectedProducts((prev) => [...prev, p]);
    setProductSearch("");
    setSearchResults([]);
  }

  function removeProduct(id: string) {
    setSelectedProducts((prev) => prev.filter((p) => p.id !== id));
  }

  // -------- Generate --------
  async function generate() {
    if (selectedProducts.length === 0) {
      toast.error("Select at least one product first");
      return;
    }
    setGenerating(true);
    setContent(null);
    const r = await run(
      () =>
        api.post<{ content: MarketingContent; productName: string; productNames?: string[] }>(
          "/api/admin/ai/generate-marketing",
          {
            productIds: selectedProducts.map((p) => p.id),
            platforms: ["email"],
            tone,
          }
        ),
      { success: "Marketing email generated", error: "Generation failed", silent: true }
    );
    setGenerating(false);
    if (r) {
      setContent(r.content);
      toast.success(`Email content generated for ${r.productName}`);
    }
  }

  // -------- Copy --------
  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedField(null), 2000);
  }

  // -------- Send test email --------
  async function sendTestEmail() {
    if (!content?.htmlEmail) {
      toast.error("Generate the email first");
      return;
    }
    if (!testEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail.trim())) {
      toast.error("Enter a valid recipient email");
      return;
    }
    setSendingTest(true);
    const r = await run(
      () =>
        api.post("/api/admin/ai/marketing-test-email", {
          to: testEmail.trim(),
          subject: content.email?.subject || "Marketing Email",
          htmlBody: content.htmlEmail,
        }),
      { success: "Test email sent", error: "Failed to send test email", silent: true }
    );
    setSendingTest(false);
    if (r) toast.success(`Test email sent to ${testEmail.trim()}`);
  }

  // -------- Broadcast to all customers --------
  async function sendBroadcast() {
    if (!content?.htmlEmail) {
      toast.error("Generate the email first");
      return;
    }
    setSendingBroadcast(true);
    const r = await run(
      () =>
        api.post<{ sent: number; failed: number; total: number }>(
          "/api/admin/ai/marketing-broadcast",
          {
            subject: content.email?.subject || "Marketing Email",
            htmlBody: content.htmlEmail,
          }
        ),
      { success: "Broadcast sent", error: "Broadcast failed", silent: true }
    );
    setSendingBroadcast(false);
    if (r) {
      setBroadcastOpen(false);
      toast.success(`Broadcast complete: ${r.sent} sent, ${r.failed} failed (of ${r.total} customers)`);
    }
  }

  return (
    <div>
      <PageHeader
        title="AI Email Marketing"
        description="Generate professional email campaigns with AI. Broadcast to all customers or send a single test email."
      />

      {/* Configuration Card */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-amber-600" /> Generate Email Campaign
          </CardTitle>
          <CardDescription>
            Select one or more products, choose a tone, and the AI will generate a subject, preview text,
            headline, promotional description, CTA, and a complete HTML email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Product multi-select */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Products <span className="text-muted-foreground">({selectedProducts.length} selected)</span>
            </Label>

            {/* Search box */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={productSearch}
                onChange={(e) => searchProducts(e.target.value)}
                placeholder="Search products by name or SKU…"
                className="pl-8"
              />
              {searching && (
                <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* Search results */}
            {productSearch.trim() && searchResults.length > 0 && (
              <div className="max-h-56 overflow-y-auto rounded-lg border bg-background">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addProduct(p)}
                    className="flex w-full items-center gap-3 border-b px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-muted/50"
                  >
                    <Plus className="size-4 shrink-0 text-emerald-600" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.sku ? <span className="font-mono">{p.sku} · </span> : null}
                        Stock: {p.stock}
                      </div>
                    </div>
                    <div className="text-sm font-semibold tabular-nums">
                      ₹{p.sellingPrice}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {productSearch.trim() && !searching && searchResults.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-3">
                No products found matching &ldquo;{productSearch}&rdquo;
              </p>
            )}

            {/* Selected products */}
            {selectedProducts.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {selectedProducts.map((p) => (
                  <Badge
                    key={p.id}
                    variant="outline"
                    className="gap-1 border-emerald-200 bg-emerald-50 py-1.5 pl-2.5 pr-1 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200"
                  >
                    {p.name}
                    <button
                      type="button"
                      onClick={() => removeProduct(p.id)}
                      className="ml-1 rounded-full p-0.5 hover:bg-emerald-200 dark:hover:bg-emerald-900/60"
                      aria-label={`Remove ${p.name}`}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Tone Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Tone</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger className="w-full sm:w-80"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TONES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Generate Button */}
          <Button
            onClick={generate}
            disabled={generating || selectedProducts.length === 0}
            className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
          >
            {generating ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
            {generating ? "Generating..." : "Generate Email Campaign"}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {content && (
        <div className="space-y-4">
          {/* Email subject + preview */}
          {content.email?.subject && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Mail className="size-4 text-emerald-600" /> Email Subject & Preview
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      copyToClipboard(
                        `Subject: ${content.email!.subject}\nPreview: ${content.previewText ?? ""}`,
                        "subject"
                      )
                    }
                    className="gap-1 text-xs"
                  >
                    {copiedField === "subject" ? <Check className="size-3" /> : <Copy className="size-3" />}
                    {copiedField === "subject" ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Subject</Label>
                  <Input value={content.email.subject} readOnly className="mt-0.5 font-medium" />
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Preview Text</Label>
                  <Input
                    value={content.previewText ?? ""}
                    readOnly
                    className="mt-0.5 text-muted-foreground"
                    placeholder="(no preview text generated)"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Headline + Description + CTA */}
          {(content.headline || content.promotionalDescription || content.ctaText) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Sparkles className="size-4 text-amber-600" /> Marketing Copy
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {content.headline && (
                  <div>
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Headline</Label>
                    <Textarea value={content.headline} readOnly rows={2} className="mt-0.5 resize-none font-semibold" />
                  </div>
                )}
                {content.promotionalDescription && (
                  <div>
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Promotional Description
                    </Label>
                    <Textarea
                      value={content.promotionalDescription}
                      readOnly
                      rows={3}
                      className="mt-0.5 resize-none text-sm"
                    />
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {content.ctaText && (
                    <div className="flex items-center gap-2">
                      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">CTA Button</Label>
                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                        {content.ctaText}
                      </Badge>
                    </div>
                  )}
                  {content.email?.body && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(content.email!.body, "body")}
                      className="ml-auto gap-1 text-xs"
                    >
                      {copiedField === "body" ? <Check className="size-3" /> : <Copy className="size-3" />}
                      {copiedField === "body" ? "Copied!" : "Copy plain-text body"}
                    </Button>
                  )}
                </div>
                {content.email?.body && (
                  <Textarea value={content.email.body} readOnly rows={6} className="text-sm resize-none" />
                )}
              </CardContent>
            </Card>
          )}

          {/* HTML Email (Responsive) */}
          {content.htmlEmail && (
            <HtmlEmailCard
              html={content.htmlEmail}
              copied={copiedField === "htmlEmail"}
              onCopy={() => copyToClipboard(content.htmlEmail!, "htmlEmail")}
            />
          )}

          {/* Send options */}
          {content.htmlEmail && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Send className="size-4 text-emerald-600" /> Send Email
                </CardTitle>
                <CardDescription className="text-xs">
                  Send a test email to yourself first, then broadcast to all customers with verified emails.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Test email */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="test-email" className="text-xs font-medium">Send Test Email To</Label>
                    <Input
                      id="test-email"
                      type="email"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="max-w-md"
                    />
                  </div>
                  <Button
                    onClick={sendTestEmail}
                    disabled={sendingTest || !testEmail.trim()}
                    variant="outline"
                    className="gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                  >
                    {sendingTest ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
                    Send Test
                  </Button>
                </div>

                {/* Broadcast */}
                <div className="flex flex-col gap-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-2">
                    <Users className="size-4 shrink-0 mt-0.5 text-emerald-600" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Send to All Customers</p>
                      <p className="text-xs text-muted-foreground">
                        Broadcasts the generated HTML email to every active customer with a verified email address.
                        {customerCount?.total != null && (
                          <> Approx. <strong>{customerCount.total}</strong> customer(s) on record.</>
                        )}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setBroadcastOpen(true)}
                    disabled={sendingBroadcast}
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white sm:self-end"
                  >
                    <Users className="size-4" /> Broadcast to All
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Empty state */}
      {!content && !generating && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Sparkles className="mb-3 size-10 text-amber-400" />
            <p className="text-sm font-medium text-foreground">No email campaign generated yet</p>
            <p className="mt-1 text-xs text-muted-foreground max-w-md">
              Search and select one or more products above, choose a tone, then click
              &ldquo;Generate Email Campaign&rdquo;.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Broadcast confirmation dialog */}
      {broadcastOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border bg-background p-5 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                <AlertCircle className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold">Confirm Broadcast</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  This will send the generated email to <strong>every active customer with a verified email</strong>.
                  Sends are rate-limited (1 per second) to respect SMTP provider limits.
                  {customerCount?.total != null && (
                    <> Approx. <strong>{customerCount.total}</strong> customer(s) on record.</>
                  )}
                </p>
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                  ⚠️ Make sure you have already sent a test email and verified the rendering.
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setBroadcastOpen(false)} disabled={sendingBroadcast}>
                Cancel
              </Button>
              <Button
                onClick={sendBroadcast}
                disabled={sendingBroadcast}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {sendingBroadcast ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                {sendingBroadcast ? "Sending..." : "Confirm & Send"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// HtmlEmailCard — displays the AI-generated responsive HTML email with a
// Preview/Code toggle, copy + download actions, and size badges.
// ---------------------------------------------------------------------------

function HtmlEmailCard({
  html,
  copied,
  onCopy,
}: {
  html: string;
  copied: boolean;
  onCopy: () => void;
}) {
  const [mode, setMode] = useState<"preview" | "code">("preview");

  const charCount = html.length;
  const kb = (new Blob([html]).size / 1024).toFixed(1);

  function download() {
    try {
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `marketing-email-${Date.now()}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 0);
      toast.success("HTML file downloaded");
    } catch (e: any) {
      toast.error(e?.message || "Download failed");
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <FileCode className="size-4 text-emerald-600" /> HTML Email (Responsive)
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Preview / Code segmented control */}
            <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
              <button
                onClick={() => setMode("preview")}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  mode === "preview"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Eye className="size-3" /> Preview
              </button>
              <button
                onClick={() => setMode("code")}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  mode === "code"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Code2 className="size-3" /> Code
              </button>
            </div>
            <Button size="sm" variant="ghost" onClick={onCopy} className="gap-1 text-xs">
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
              {copied ? "Copied!" : "Copy HTML"}
            </Button>
            <Button size="sm" variant="ghost" onClick={download} className="gap-1 text-xs">
              <Download className="size-3" /> Download
            </Button>
          </div>
        </div>
        <CardDescription className="text-xs">
          Complete responsive HTML email — table-based, inline CSS, email-client compatible. Use for broadcast campaigns.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {mode === "preview" ? (
          <iframe
            title="HTML Email Preview"
            srcDoc={html}
            sandbox=""
            className="h-[520px] w-full rounded-md border border-border bg-white"
          />
        ) : (
          <Textarea
            value={html}
            readOnly
            rows={18}
            className="resize-none rounded-md border-border bg-muted/30 p-3 font-mono text-xs leading-relaxed text-foreground"
            spellCheck={false}
          />
        )}
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">{charCount.toLocaleString()} characters</Badge>
          <Badge variant="outline" className="text-[10px]">{kb} KB</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
