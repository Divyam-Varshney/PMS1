// ============================================================================
// File: src/components/admin/views/AiMarketingView.tsx
// Purpose: AI Marketing Content Generator — generates social media posts,
//          email campaigns, and promotional content for products.
//          Supports WhatsApp, Facebook, Instagram, Twitter/X, Email, SMS.
// ============================================================================

"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
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
  Wand2, Loader2, Copy, Check, MessageCircle, Facebook, Instagram,
  Twitter, Mail, Smartphone, Sparkles,
} from "lucide-react";
import { toast } from "sonner";

interface MarketingContent {
  whatsapp?: string;
  facebook?: string;
  instagram?: string;
  twitter?: string;
  email?: { subject: string; body: string };
  sms?: string;
}

const PLATFORMS = [
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "text-emerald-600" },
  { id: "facebook", label: "Facebook", icon: Facebook, color: "text-teal-600" },
  { id: "instagram", label: "Instagram", icon: Instagram, color: "text-pink-600" },
  { id: "twitter", label: "Twitter/X", icon: Twitter, color: "text-cyan-600" },
  { id: "email", label: "Email", icon: Mail, color: "text-amber-600" },
  { id: "sms", label: "SMS", icon: Smartphone, color: "text-rose-600" },
];

const TONES = [
  { value: "promotional", label: "Promotional (sales-focused)" },
  { value: "professional", label: "Professional (informative)" },
  { value: "casual", label: "Casual (friendly)" },
  { value: "educational", label: "Educational (health tips)" },
];

export function AiMarketingView() {
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["whatsapp", "facebook", "instagram", "email"]);
  const [tone, setTone] = useState("promotional");
  const [generating, setGenerating] = useState(false);
  const [content, setContent] = useState<MarketingContent | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Fetch products for the selector
  const { data: productsData } = useQuery({
    queryKey: ["admin-products-marketing"],
    queryFn: () => api.get<{ items: any[]; total: number }>("/api/admin/products?pageSize=500"),
  });
  const products = productsData?.items ?? [];

  function togglePlatform(id: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  async function generate() {
    if (!selectedProductId) {
      toast.error("Select a product first");
      return;
    }
    setGenerating(true);
    setContent(null);
    try {
      const r = await api.post<{ content: MarketingContent; productName: string }>(
        "/api/admin/ai/generate-marketing",
        {
          productId: selectedProductId,
          platforms: selectedPlatforms,
          tone,
        }
      );
      setContent(r.content);
      toast.success(`Marketing content generated for ${r.productName}`);
    } catch (e: any) {
      toast.error(e?.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedField(null), 2000);
  }

  return (
    <div>
      <PageHeader
        title="AI Marketing"
        description="Generate social media posts, email campaigns, and promotional content for your products using AI."
      />

      {/* Configuration Card */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-amber-600" /> Generate Marketing Content
          </CardTitle>
          <CardDescription>Select a product, choose platforms and tone, then generate.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Product Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Product</Label>
            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger><SelectValue placeholder="Select a product" /></SelectTrigger>
              <SelectContent>
                {products.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Platform Toggles */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Platforms</Label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => {
                const selected = selectedPlatforms.includes(p.id);
                const Icon = p.icon;
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePlatform(p.id)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                      selected
                        ? "border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                        : "border-border text-muted-foreground hover:border-amber-300"
                    }`}
                  >
                    <Icon className={`size-3.5 ${selected ? p.color : ""}`} />
                    {p.label}
                  </button>
                );
              })}
            </div>
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
            disabled={generating || !selectedProductId || selectedPlatforms.length === 0}
            className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
          >
            {generating ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
            {generating ? "Generating..." : "Generate Marketing Content"}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {content && (
        <div className="space-y-4">
          {/* WhatsApp */}
          {content.whatsapp && (
            <ContentCard
              title="WhatsApp Message"
              icon={MessageCircle}
              color="text-emerald-600"
              text={content.whatsapp}
              onCopy={() => copyToClipboard(content.whatsapp, "whatsapp")}
              copied={copiedField === "whatsapp"}
            />
          )}

          {/* Facebook */}
          {content.facebook && (
            <ContentCard
              title="Facebook Post"
              icon={Facebook}
              color="text-teal-600"
              text={content.facebook}
              onCopy={() => copyToClipboard(content.facebook, "facebook")}
              copied={copiedField === "facebook"}
            />
          )}

          {/* Instagram */}
          {content.instagram && (
            <ContentCard
              title="Instagram Caption"
              icon={Instagram}
              color="text-pink-600"
              text={content.instagram}
              onCopy={() => copyToClipboard(content.instagram, "instagram")}
              copied={copiedField === "instagram"}
            />
          )}

          {/* Twitter */}
          {content.twitter && (
            <ContentCard
              title="Twitter/X Post"
              icon={Twitter}
              color="text-cyan-600"
              text={content.twitter}
              onCopy={() => copyToClipboard(content.twitter, "twitter")}
              copied={copiedField === "twitter"}
            />
          )}

          {/* Email */}
          {content.email && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Mail className="size-4 text-amber-600" /> Email Campaign
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(`Subject: ${content.email!.subject}\n\n${content.email!.body}`, "email")}
                    className="gap-1 text-xs"
                  >
                    {copiedField === "email" ? <Check className="size-3" /> : <Copy className="size-3" />}
                    {copiedField === "email" ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <Input value={content.email.subject} readOnly className="font-medium" />
                <Textarea value={content.email.body} readOnly rows={6} className="text-sm" />
              </CardContent>
            </Card>
          )}

          {/* SMS */}
          {content.sms && (
            <ContentCard
              title="SMS Message"
              icon={Smartphone}
              color="text-amber-600"
              text={content.sms}
              onCopy={() => copyToClipboard(content.sms, "sms")}
              copied={copiedField === "sms"}
            />
          )}
        </div>
      )}

      {/* Empty state */}
      {!content && !generating && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Sparkles className="mb-3 size-10 text-amber-400" />
            <p className="text-sm font-medium text-foreground">No marketing content generated yet</p>
            <p className="mt-1 text-xs text-muted-foreground max-w-md">
              Select a product above, choose your platforms and tone, then click "Generate Marketing Content".
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContentCard — reusable card for displaying generated text content
// ---------------------------------------------------------------------------

function ContentCard({
  title,
  icon: Icon,
  color,
  text,
  onCopy,
  copied,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  text: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Icon className={`size-4 ${color}`} /> {title}
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={onCopy} className="gap-1 text-xs">
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Textarea value={text} readOnly rows={4} className="text-sm resize-none" />
        <div className="mt-2 flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">{text.length} characters</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
