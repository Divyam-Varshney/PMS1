// ============================================================================
// File: src/components/admin/branding-panel.tsx
// Purpose: Branding management panel — upload and manage logo, favicon, app
//          icons, OG image, and other branding assets. Files are uploaded to
//          cloud storage and URLs are stored in the database.
// ============================================================================

"use client";

import { useState, useRef, useEffect } from "react";
import { api } from "./api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, Trash2, Loader2, Check, Image as ImageIcon, Eye } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BrandingAsset {
  key: string;
  label: string;
  description: string;
  recommendedSize: string;
  currentUrl?: string;
}

const ASSETS: BrandingAsset[] = [
  { key: "store.logo", label: "Website Logo", description: "Main logo shown in header and footer", recommendedSize: "512×512px" },
  { key: "store.darkLogo", label: "Dark Logo", description: "Logo for dark mode (optional)", recommendedSize: "512×512px" },
  { key: "store.lightLogo", label: "Light Logo", description: "Logo for light backgrounds (optional)", recommendedSize: "512×512px" },
  { key: "store.favicon", label: "Favicon", description: "Browser tab icon", recommendedSize: "32×32px or 64×64px" },
  { key: "store.appIcon", label: "App Icon", description: "PWA app icon", recommendedSize: "512×512px" },
  { key: "store.appleTouchIcon", label: "Apple Touch Icon", description: "iOS home screen icon", recommendedSize: "180×180px" },
  { key: "store.ogImage", label: "Open Graph Image", description: "Social media sharing image", recommendedSize: "1200×630px" },
  { key: "store.socialImage", label: "Social Sharing Image", description: "Twitter/social card image", recommendedSize: "1200×630px" },
  { key: "store.loginLogo", label: "Login Logo", description: "Logo on login pages (optional)", recommendedSize: "512×512px" },
  { key: "store.emailLogo", label: "Email Logo", description: "Logo in email templates (optional)", recommendedSize: "400×100px" },
  { key: "store.invoiceLogo", label: "Invoice Logo", description: "Logo on PDF invoices (optional)", recommendedSize: "400×100px" },
];

export function BrandingPanel() {
  const [branding, setBranding] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    fetchBranding();
  }, []);

  const fetchBranding = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ branding: Record<string, string> }>("/api/admin/branding");
      setBranding(res.branding || {});
    } catch (e: any) {
      toast.error("Failed to load branding assets");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (key: string, file: File) => {
    setUploadingKey(key);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("key", key);

      const res = await fetch("/api/admin/branding", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();

      if (data.ok) {
        setBranding((prev) => ({ ...prev, [key]: data.data.url }));
        toast.success(`${ASSETS.find((a) => a.key === key)?.label} updated`);
      } else {
        toast.error(data.error || "Upload failed");
      }
    } catch (e: any) {
      toast.error("Upload failed: " + e.message);
    } finally {
      setUploadingKey(null);
    }
  };

  const handleDelete = async (key: string) => {
    try {
      await api.del(`/api/admin/branding?key=${encodeURIComponent(key)}`);
      setBranding((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      toast.success(`${ASSETS.find((a) => a.key === key)?.label} reset to default`);
    } catch (e: any) {
      toast.error("Failed to reset: " + e.message);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-emerald-200/60 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-950/10">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              <ImageIcon className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Branding Management</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Upload and manage your pharmacy's branding assets. Files are stored in your configured cloud storage (Cloudflare R2).
                URLs are saved in the database and used across the website, emails, and invoices.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ASSETS.map((asset) => {
          const url = branding[asset.key];
          const isUploading = uploadingKey === asset.key;
          return (
            <Card key={asset.key} className="overflow-hidden rounded-xl border-border/50 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm font-semibold">{asset.label}</CardTitle>
                    <CardDescription className="mt-0.5 text-xs">{asset.description}</CardDescription>
                  </div>
                  {url && (
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-[9px]">
                      <Check className="size-2.5 mr-0.5" /> Set
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Preview */}
                <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-border/40 bg-accent/20">
                  {url ? (
                    <img
                      src={url}
                      alt={asset.label}
                      className="max-h-full max-w-full object-contain p-2"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground/50">
                      <ImageIcon className="size-8" />
                      <span className="text-[10px]">No image</span>
                    </div>
                  )}
                </div>

                {/* Recommended size */}
                <p className="text-[10px] text-muted-foreground">Recommended: {asset.recommendedSize}</p>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <input
                    ref={(el) => { fileInputRefs.current[asset.key] = el; }}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(asset.key, file);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 flex-1 gap-1.5 text-xs"
                    disabled={isUploading}
                    onClick={() => fileInputRefs.current[asset.key]?.click()}
                  >
                    {isUploading ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Upload className="size-3.5" />
                    )}
                    {url ? "Replace" : "Upload"}
                  </Button>
                  {url && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(asset.key)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
