// ============================================================================
// File: src/components/admin/branding-panel.tsx
// Purpose: Simplified branding — single master logo upload. The uploaded logo
//          is used everywhere: header, footer, admin, login, invoices, emails,
//          favicon, PWA icons, etc. No separate upload fields needed.
// ============================================================================

"use client";

import { useState, useRef, useEffect } from "react";
import { api } from "./api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Trash2, Loader2, Check, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

export function BrandingPanel() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchLogo();
  }, []);

  const fetchLogo = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ branding: Record<string, string> }>("/api/admin/branding");
      setLogoUrl(res.branding?.["store.logo"] || null);
    } catch {
      toast.error("Failed to load logo");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("key", "store.logo");
      const res = await fetch("/api/admin/branding", { method: "POST", body: fd });
      const data = await res.json();
      if (data.ok) {
        setLogoUrl(data.data.url);
        toast.success("Website logo updated — applied to all locations");
      } else {
        toast.error(data.error || "Upload failed");
      }
    } catch (e: any) {
      toast.error("Upload failed: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.del(`/api/admin/branding?key=store.logo`);
      setLogoUrl(null);
      toast.success("Logo reset to default");
    } catch (e: any) {
      toast.error("Failed to reset: " + e.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        {/* Logo preview */}
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/40 bg-accent/20">
          {logoUrl ? (
            <img src={logoUrl} alt="Store logo" className="max-h-full max-w-full object-contain p-1" />
          ) : (
            <ImageIcon className="size-8 text-muted-foreground/40" />
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">Website Logo</p>
            {logoUrl && (
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-[9px]">
                <Check className="size-2.5 mr-0.5" /> Active
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Used in header, footer, admin, login, invoices, emails, favicon & PWA.
          </p>

          <div className="mt-2 flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
                e.target.value = "";
              }}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
              {logoUrl ? "Replace" : "Upload"}
            </Button>
            {logoUrl && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
                onClick={handleDelete}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
