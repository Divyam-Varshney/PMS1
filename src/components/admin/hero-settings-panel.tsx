// ============================================================================
// File: src/components/admin/hero-settings-panel.tsx
// Purpose: Comprehensive admin panel for the hero section — every part of the
//          homepage hero is configurable here. The hero config is stored as a
//          single JSON blob under the `hero.config` Setting key, so the whole
//          object (including the cards and trustFeatures arrays) updates
//          atomically when saved.
//
// Sections: General, Background, Content, Buttons, Search, Hero Cards (array),
//           Trust Features (array), Promotional Banner, Announcement Bar, SEO.
// Every major sub-component has an enable/disable toggle.
// ============================================================================

"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Save,
  Loader2,
  Plus,
  Trash2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Layout,
  Image as ImageIcon,
  Type,
  MousePointerClick,
  Search as SearchIcon,
  CreditCard,
  ShieldCheck,
  Megaphone,
  Settings2,
} from "lucide-react";
import { api, run } from "./api";
import { useQueryClient } from "@tanstack/react-query";
import { DEFAULT_HERO_CONFIG } from "@/lib/constants";

// Re-declare the shape locally to avoid a circular import with the customer
// api module. This must stay in sync with HeroConfig in api.ts.
interface HeroCard {
  id: string;
  enabled: boolean;
  icon: string;
  title: string;
  description: string;
  link: string;
  displayOrder: number;
}
interface HeroTrustFeature {
  id: string;
  enabled: boolean;
  icon: string;
  title: string;
  description: string;
  displayOrder: number;
}
type HeroConfig = typeof DEFAULT_HERO_CONFIG;

/** Icon options exposed to the admin for cards / trust / CTA buttons. */
const ICON_OPTIONS = [
  "ShieldCheck", "Truck", "Award", "Lock", "HeartPulse", "Pill", "Clock", "Star",
  "FileText", "ClipboardList", "RefreshCw", "BadgeCheck", "Search", "ArrowRight",
  "PhoneCall", "Mail", "MapPin", "Sparkles", "Flame", "Tag", "Zap", "Headphones",
  "CreditCard", "PackageCheck", "Gift", "Percent", "Megaphone", "Users",
  "ArrowUpRight", "ChevronRight", "Droplets", "Sun", "Moon", "Activity", "Brain",
  "Bone", "Eye", "Apple", "Stethoscope", "Thermometer", "Wind", "Shield", "Baby",
  "Leaf",
];

/** Customer view names that CTAs / cards / links can navigate to. */
const VIEW_OPTIONS = [
  { value: "shop", label: "Shop" },
  { value: "prescription", label: "Upload Prescription" },
  { value: "manual-request", label: "Request Medicines" },
  { value: "orders", label: "My Orders" },
  { value: "categories", label: "Categories" },
  { value: "about", label: "About" },
  { value: "contact", label: "Contact" },
  { value: "auth", label: "Login / Register" },
  { value: "cart", label: "Cart" },
  { value: "wishlist", label: "Wishlist" },
];

function uid() {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function HeroSettingsPanel({
  value,
  onChange,
}: {
  value: any; // HeroConfig object from form["hero.config"]
  onChange: (v: any) => void; // wraps set("hero.config", v)
}) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  // Merge with defaults so missing fields don't crash the form.
  const cfg: HeroConfig = { ...DEFAULT_HERO_CONFIG, ...(value || {}) };

  /** Shallow-merge a patch into the config and propagate up. */
  function update(patch: Partial<HeroConfig>) {
    onChange({ ...cfg, ...patch });
  }

  async function save() {
    setSaving(true);
    const r = await run(() => api.put("/api/admin/settings", { settings: { "hero.config": cfg } }), {
      success: "Hero settings saved",
      error: "Save failed",
    });
    if (r) qc.invalidateQueries({ queryKey: ["admin-settings"] });
    setSaving(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-primary" /> Hero Section
        </CardTitle>
        <CardDescription>
          The big banner at the top of the home page. Fully configurable — every part can be
          toggled on or off. Changes apply to the live homepage after saving.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Master enable + save */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
          <ToggleInline
            label="Hero section enabled"
            description="Turn the entire hero off (homepage will start with categories)"
            checked={cfg.enabled}
            onChange={(v) => update({ enabled: v })}
          />
          <Button onClick={save} disabled={saving} size="sm">
            {saving ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Save className="size-4 mr-1" />}
            {saving ? "Saving..." : "Save Hero"}
          </Button>
        </div>

        <Accordion type="multiple" defaultValue={["general"]} className="w-full">
          {/* — General — */}
          <AccordionItem value="general">
            <AccordionTrigger className="text-sm font-semibold">
              <span className="flex items-center gap-2"><Layout className="size-4" /> General</span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <FieldS label="Layout">
                  <Select value={cfg.layout} onValueChange={(v) => update({ layout: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="split-left">Split (text left, image right)</SelectItem>
                      <SelectItem value="split-right">Split (image left, text right)</SelectItem>
                      <SelectItem value="centered">Centered (full width)</SelectItem>
                      <SelectItem value="full-bg">Full background</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldS>
                <FieldS label="Style preset">
                  <Select value={cfg.stylePreset} onValueChange={(v) => update({ stylePreset: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="emerald">Emerald (default)</SelectItem>
                      <SelectItem value="teal">Teal</SelectItem>
                      <SelectItem value="midnight">Midnight</SelectItem>
                      <SelectItem value="sunrise">Sunrise</SelectItem>
                      <SelectItem value="custom">Custom (set colors below)</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldS>
                <FieldS label="Height">
                  <Select value={cfg.height} onValueChange={(v) => update({ height: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sm">Small</SelectItem>
                      <SelectItem value="md">Medium</SelectItem>
                      <SelectItem value="lg">Large</SelectItem>
                      <SelectItem value="xl">Extra large</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldS>
                <FieldS label="Content alignment">
                  <Select value={cfg.contentAlign} onValueChange={(v) => update({ contentAlign: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldS>
                <FieldS label="Section spacing">
                  <Select value={cfg.sectionSpacing} onValueChange={(v) => update({ sectionSpacing: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="compact">Compact</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="relaxed">Relaxed</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldS>
                <FieldS label={`Border radius (${cfg.borderRadius}px)`}>
                  <Input type="range" min={0} max={32} value={cfg.borderRadius} onChange={(e) => update({ borderRadius: Number(e.target.value) })} />
                </FieldS>
                <FieldS label={`Background overlay (${cfg.bgOverlay}%)`}>
                  <Input type="range" min={0} max={90} value={cfg.bgOverlay} onChange={(e) => update({ bgOverlay: Number(e.target.value) })} />
                </FieldS>
                <FieldS label={`Background opacity (${cfg.bgOpacity}%)`}>
                  <Input type="range" min={0} max={100} value={cfg.bgOpacity} onChange={(e) => update({ bgOpacity: Number(e.target.value) })} />
                </FieldS>
              </div>
              <ToggleInline label="Animations" description="Enable framer-motion entrance + floating animations" checked={cfg.animationsEnabled} onChange={(v) => update({ animationsEnabled: v })} />
            </AccordionContent>
          </AccordionItem>

          {/* — Background — */}
          <AccordionItem value="background">
            <AccordionTrigger className="text-sm font-semibold">
              <span className="flex items-center gap-2"><ImageIcon className="size-4" /> Background</span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3">
              <ToggleInline label="Background image" description="Upload/use an image as the hero background" checked={cfg.bgImageEnabled} onChange={(v) => update({ bgImageEnabled: v })} />
              {cfg.bgImageEnabled && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <FieldS label="Desktop image URL">
                    <Input value={cfg.bgImageDesktop} onChange={(e) => update({ bgImageDesktop: e.target.value })} placeholder="https://..." />
                  </FieldS>
                  <FieldS label="Tablet image URL (optional)">
                    <Input value={cfg.bgImageTablet} onChange={(e) => update({ bgImageTablet: e.target.value })} placeholder="https://..." />
                  </FieldS>
                  <FieldS label="Mobile image URL (optional)">
                    <Input value={cfg.bgImageMobile} onChange={(e) => update({ bgImageMobile: e.target.value })} placeholder="https://..." />
                  </FieldS>
                </div>
              )}
              <ToggleInline label="Gradient background" description="Use a gradient color background (ignored when image is enabled)" checked={cfg.gradientEnabled} onChange={(v) => update({ gradientEnabled: v })} />
              {cfg.gradientEnabled && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <FieldS label="Gradient from"><ColorInput value={cfg.gradientFrom} onChange={(v) => update({ gradientFrom: v })} /></FieldS>
                  <FieldS label="Gradient via"><ColorInput value={cfg.gradientVia} onChange={(v) => update({ gradientVia: v })} /></FieldS>
                  <FieldS label="Gradient to"><ColorInput value={cfg.gradientTo} onChange={(v) => update({ gradientTo: v })} /></FieldS>
                </div>
              )}
              {!cfg.gradientEnabled && !cfg.bgImageEnabled && (
                <FieldS label="Background color"><ColorInput value={cfg.bgColor} onChange={(v) => update({ bgColor: v })} /></FieldS>
              )}
              <FieldS label="Background pattern">
                <Select value={cfg.bgPattern} onValueChange={(v) => update({ bgPattern: v as any })}>
                  <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="dots">Dots</SelectItem>
                    <SelectItem value="grid">Grid</SelectItem>
                    <SelectItem value="waves">Waves</SelectItem>
                  </SelectContent>
                </Select>
              </FieldS>
              <ToggleInline label="Video background (future-ready)" description="Reserved for a future video background feature" checked={cfg.videoBgEnabled} onChange={(v) => update({ videoBgEnabled: v })} />
              {cfg.videoBgEnabled && (
                <FieldS label="Video URL (future)"><Input value={cfg.videoBgUrl} onChange={(e) => update({ videoBgUrl: e.target.value })} placeholder="https://..." /></FieldS>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* — Content — */}
          <AccordionItem value="content">
            <AccordionTrigger className="text-sm font-semibold">
              <span className="flex items-center gap-2"><Type className="size-4" /> Content</span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FieldS label="Main heading"><Input value={cfg.heading} onChange={(e) => update({ heading: e.target.value })} placeholder="Your trusted pharmacy," /></FieldS>
                <FieldS label="Heading highlight (lighter color)"><Input value={cfg.headingHighlight} onChange={(e) => update({ headingHighlight: e.target.value })} placeholder="delivered to your door." /></FieldS>
              </div>
              <FieldS label="Sub heading (bold, below heading)"><Input value={cfg.subheading} onChange={(e) => update({ subheading: e.target.value })} placeholder="Optional sub-heading" /></FieldS>
              <FieldS label="Description"><Textarea rows={2} value={cfg.description} onChange={(e) => update({ description: e.target.value })} placeholder="Order genuine medicines online..." /></FieldS>
              <ToggleInline label="Promotional badge" checked={cfg.promoBadgeEnabled} onChange={(v) => update({ promoBadgeEnabled: v })} />
              {cfg.promoBadgeEnabled && (
                <FieldS label="Promo badge text"><Input value={cfg.promoBadgeText} onChange={(e) => update({ promoBadgeText: e.target.value })} placeholder="New Customer Offer" /></FieldS>
              )}
              <ToggleInline label="Offer badge" checked={cfg.offerBadgeEnabled} onChange={(v) => update({ offerBadgeEnabled: v })} />
              {cfg.offerBadgeEnabled && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FieldS label="Offer text"><Input value={cfg.offerText} onChange={(e) => update({ offerText: e.target.value })} placeholder="Flat ₹100 off on your first order" /></FieldS>
                  <FieldS label="Discount label / code"><Input value={cfg.discountLabel} onChange={(e) => update({ discountLabel: e.target.value })} placeholder="Use code WELCOME100" /></FieldS>
                </div>
              )}
              <ToggleInline label="Delivery information" checked={cfg.deliveryInfoEnabled} onChange={(v) => update({ deliveryInfoEnabled: v })} />
              {cfg.deliveryInfoEnabled && (
                <FieldS label="Delivery info text"><Input value={cfg.deliveryInfoText} onChange={(e) => update({ deliveryInfoText: e.target.value })} placeholder="Free delivery on orders above ₹499" /></FieldS>
              )}
              <FieldS label="Small notice text"><Input value={cfg.noticeText} onChange={(e) => update({ noticeText: e.target.value })} placeholder="Licensed pharmacy · Verified by pharmacists" /></FieldS>
            </AccordionContent>
          </AccordionItem>

          {/* — Buttons — */}
          <AccordionItem value="buttons">
            <AccordionTrigger className="text-sm font-semibold">
              <span className="flex items-center gap-2"><MousePointerClick className="size-4" /> Buttons (CTAs)</span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3">
              <ToggleInline label="CTA buttons" checked={cfg.ctaEnabled} onChange={(v) => update({ ctaEnabled: v })} />
              {cfg.ctaEnabled && (
                <>
                  <FieldS label="Button style">
                    <Select value={cfg.buttonStyle} onValueChange={(v) => update({ buttonStyle: v as any })}>
                      <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solid">Solid white</SelectItem>
                        <SelectItem value="outline">Outline</SelectItem>
                        <SelectItem value="gradient">Amber gradient</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldS>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <FieldS label="Primary button text"><Input value={cfg.primaryCtaText} onChange={(e) => update({ primaryCtaText: e.target.value })} placeholder="Shop Now" /></FieldS>
                    <FieldS label="Primary button link">
                      <Select value={cfg.primaryCtaUrl} onValueChange={(v) => update({ primaryCtaUrl: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {VIEW_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FieldS>
                    <FieldS label="Primary button icon">
                      <Select value={cfg.primaryCtaIcon} onValueChange={(v) => update({ primaryCtaIcon: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ICON_OPTIONS.map((ic) => <SelectItem key={ic} value={ic}>{ic}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FieldS>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <FieldS label="Secondary button text"><Input value={cfg.secondaryCtaText} onChange={(e) => update({ secondaryCtaText: e.target.value })} placeholder="Upload Prescription" /></FieldS>
                    <FieldS label="Secondary button link">
                      <Select value={cfg.secondaryCtaUrl} onValueChange={(v) => update({ secondaryCtaUrl: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {VIEW_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FieldS>
                    <FieldS label="Secondary button icon">
                      <Select value={cfg.secondaryCtaIcon} onValueChange={(v) => update({ secondaryCtaIcon: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ICON_OPTIONS.map((ic) => <SelectItem key={ic} value={ic}>{ic}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FieldS>
                  </div>
                </>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* — Search — */}
          <AccordionItem value="search">
            <AccordionTrigger className="text-sm font-semibold">
              <span className="flex items-center gap-2"><SearchIcon className="size-4" /> Search</span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3">
              <ToggleInline label="Search bar" checked={cfg.searchEnabled} onChange={(v) => update({ searchEnabled: v })} />
              {cfg.searchEnabled && (
                <>
                  <FieldS label="Search placeholder"><Input value={cfg.searchPlaceholder} onChange={(e) => update({ searchPlaceholder: e.target.value })} placeholder="Search medicines, brands..." /></FieldS>
                  <FieldS label="Popular search tags (comma-separated)"><Input value={cfg.popularSearches} onChange={(e) => update({ popularSearches: e.target.value })} placeholder="Paracetamol, Vitamin C, Diabetes" /></FieldS>
                </>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* — Hero Cards — */}
          <AccordionItem value="cards">
            <AccordionTrigger className="text-sm font-semibold">
              <span className="flex items-center gap-2"><CreditCard className="size-4" /> Hero Cards ({cfg.cards?.length || 0})</span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3">
              <ToggleInline label="Hero cards section" checked={cfg.cardsEnabled} onChange={(v) => update({ cardsEnabled: v })} />
              {cfg.cardsEnabled && (
                <ArrayEditor
                  items={cfg.cards || []}
                  onChange={(cards) => update({ cards })}
                  fields={["title", "description", "link", "icon"]}
                  fieldLabels={{ title: "Title", description: "Description", link: "Link", icon: "Icon" }}
                  fieldTypes={{ link: "select-view", icon: "select-icon" }}
                  iconOptions={ICON_OPTIONS}
                  viewOptions={VIEW_OPTIONS}
                />
              )}
            </AccordionContent>
          </AccordionItem>

          {/* — Trust Features — */}
          <AccordionItem value="trust">
            <AccordionTrigger className="text-sm font-semibold">
              <span className="flex items-center gap-2"><ShieldCheck className="size-4" /> Trust Features ({cfg.trustFeatures?.length || 0})</span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3">
              <ToggleInline label="Trust features section" checked={cfg.trustEnabled} onChange={(v) => update({ trustEnabled: v })} />
              {cfg.trustEnabled && (
                <ArrayEditor
                  items={cfg.trustFeatures || []}
                  onChange={(trustFeatures) => update({ trustFeatures })}
                  fields={["title", "description", "icon"]}
                  fieldLabels={{ title: "Title", description: "Description", icon: "Icon" }}
                  fieldTypes={{ icon: "select-icon" }}
                  iconOptions={ICON_OPTIONS}
                  viewOptions={VIEW_OPTIONS}
                />
              )}
            </AccordionContent>
          </AccordionItem>

          {/* — Promotional Banner — */}
          <AccordionItem value="promo">
            <AccordionTrigger className="text-sm font-semibold">
              <span className="flex items-center gap-2"><Megaphone className="size-4" /> Promotional Banner</span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3">
              <ToggleInline label="Promotional banner" description="A time-boxed promo banner below the hero cards" checked={cfg.promoBannerEnabled} onChange={(v) => update({ promoBannerEnabled: v })} />
              {cfg.promoBannerEnabled && (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FieldS label="Title"><Input value={cfg.promoBannerTitle} onChange={(e) => update({ promoBannerTitle: e.target.value })} /></FieldS>
                    <FieldS label="CTA text"><Input value={cfg.promoBannerCtaText} onChange={(e) => update({ promoBannerCtaText: e.target.value })} /></FieldS>
                  </div>
                  <FieldS label="Description"><Textarea rows={2} value={cfg.promoBannerDesc} onChange={(e) => update({ promoBannerDesc: e.target.value })} /></FieldS>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <FieldS label="Image URL (optional)"><Input value={cfg.promoBannerImage} onChange={(e) => update({ promoBannerImage: e.target.value })} placeholder="https://..." /></FieldS>
                    <FieldS label="CTA link">
                      <Select value={cfg.promoBannerCtaUrl} onValueChange={(v) => update({ promoBannerCtaUrl: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {VIEW_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FieldS>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FieldS label="Start date (optional)"><Input type="datetime-local" value={cfg.promoBannerStart?.slice(0, 16) || ""} onChange={(e) => update({ promoBannerStart: e.target.value })} /></FieldS>
                    <FieldS label="End date (optional)"><Input type="datetime-local" value={cfg.promoBannerEnd?.slice(0, 16) || ""} onChange={(e) => update({ promoBannerEnd: e.target.value })} /></FieldS>
                  </div>
                </>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* — Announcement Bar — */}
          <AccordionItem value="announcement">
            <AccordionTrigger className="text-sm font-semibold">
              <span className="flex items-center gap-2"><Megaphone className="size-4" /> Announcement Bar</span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3">
              <ToggleInline label="Announcement bar" description="Thin bar above the hero" checked={cfg.announcementEnabled} onChange={(v) => update({ announcementEnabled: v })} />
              {cfg.announcementEnabled && (
                <>
                  <FieldS label="Announcement text"><Input value={cfg.announcementText} onChange={(e) => update({ announcementText: e.target.value })} placeholder="🚚 Free delivery on orders above ₹499" /></FieldS>
                  <FieldS label="Link (optional — clicking the bar navigates here)">
                    <Select value={cfg.announcementLink || "__none__"} onValueChange={(v) => update({ announcementLink: v === "__none__" ? "" : v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No link</SelectItem>
                        {VIEW_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FieldS>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FieldS label="Start date (optional)"><Input type="datetime-local" value={cfg.announcementStart?.slice(0, 16) || ""} onChange={(e) => update({ announcementStart: e.target.value })} /></FieldS>
                    <FieldS label="End date (optional)"><Input type="datetime-local" value={cfg.announcementEnd?.slice(0, 16) || ""} onChange={(e) => update({ announcementEnd: e.target.value })} /></FieldS>
                  </div>
                </>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* — SEO — */}
          <AccordionItem value="seo">
            <AccordionTrigger className="text-sm font-semibold">
              <span className="flex items-center gap-2"><Settings2 className="size-4" /> SEO</span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3">
              <FieldS label="SEO heading (h1 text for search engines)"><Input value={cfg.seoHeading} onChange={(e) => update({ seoHeading: e.target.value })} /></FieldS>
              <FieldS label="SEO keywords (comma-separated)"><Input value={cfg.seoKeywords} onChange={(e) => update({ seoKeywords: e.target.value })} /></FieldS>
              <FieldS label="SEO description"><Textarea rows={2} value={cfg.seoDescription} onChange={(e) => update({ seoDescription: e.target.value })} /></FieldS>
              <FieldS label="Image alt text"><Input value={cfg.imageAltText} onChange={(e) => update({ imageAltText: e.target.value })} /></FieldS>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Bottom save bar */}
        <div className="mt-4 border-t pt-4 flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Save className="size-4 mr-1" />}
            {saving ? "Saving..." : "Save Hero Settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Reusable sub-components
// ---------------------------------------------------------------------------

function FieldS({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}

function ToggleInline({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 p-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {description && <div className="text-xs text-muted-foreground">{description}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="size-9 shrink-0 cursor-pointer rounded border"
        aria-label="Color picker"
      />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="#047857" />
    </div>
  );
}

/** Generic array editor for hero cards / trust features. Supports add,
 *  delete, reorder (up/down), enable toggle, and configurable fields. */
function ArrayEditor({
  items,
  onChange,
  fields,
  fieldLabels,
  fieldTypes = {},
  iconOptions = [],
  viewOptions = [],
}: {
  items: Array<{ id: string; enabled: boolean; displayOrder: number; [k: string]: any }>;
  onChange: (items: any[]) => void;
  fields: string[];
  fieldLabels: Record<string, string>;
  fieldTypes?: Record<string, string>; // "select-icon" | "select-view"
  iconOptions?: string[];
  viewOptions?: Array<{ value: string; label: string }>;
}) {
  function add() {
    const newItem = {
      id: uid(),
      enabled: true,
      displayOrder: items.length + 1,
      ...Object.fromEntries(fields.map((f) => [f, ""])),
    };
    onChange([...items, newItem]);
  }
  function updateItem(id: string, patch: Record<string, any>) {
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }
  function remove(id: string) {
    onChange(items.filter((it) => it.id !== id));
  }
  function move(id: string, dir: -1 | 1) {
    const idx = items.findIndex((it) => it.id === id);
    if (idx === -1) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= items.length) return;
    const copy = [...items];
    [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
    // re-assign displayOrder
    copy.forEach((it, i) => (it.displayOrder = i + 1));
    onChange(copy);
  }

  const sorted = [...items].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="space-y-2">
      {sorted.map((it, i) => (
        <div key={it.id} className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <GripVertical className="size-4 text-muted-foreground" />
              <Badge variant="secondary" className="text-[10px]">#{i + 1}</Badge>
              <Switch checked={it.enabled} onCheckedChange={(v) => updateItem(it.id, { enabled: v })} />
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="size-7" onClick={() => move(it.id, -1)} disabled={i === 0}>
                <ArrowUp className="size-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="size-7" onClick={() => move(it.id, 1)} disabled={i === sorted.length - 1}>
                <ArrowDown className="size-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="size-7 text-destructive" onClick={() => remove(it.id)}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {fields.map((f) => (
              <FieldS key={f} label={fieldLabels[f] || f}>
                {fieldTypes[f] === "select-icon" ? (
                  <Select value={it[f] || ""} onValueChange={(v) => updateItem(it.id, { [f]: v })}>
                    <SelectTrigger><SelectValue placeholder="Select icon" /></SelectTrigger>
                    <SelectContent>
                      {iconOptions.map((ic) => <SelectItem key={ic} value={ic}>{ic}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : fieldTypes[f] === "select-view" ? (
                  <Select value={it[f] || ""} onValueChange={(v) => updateItem(it.id, { [f]: v })}>
                    <SelectTrigger><SelectValue placeholder="Select link" /></SelectTrigger>
                    <SelectContent>
                      {viewOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={it[f] || ""} onChange={(e) => updateItem(it.id, { [f]: e.target.value })} />
                )}
              </FieldS>
            ))}
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add} className="gap-1.5">
        <Plus className="size-4" /> Add item
      </Button>
    </div>
  );
}
