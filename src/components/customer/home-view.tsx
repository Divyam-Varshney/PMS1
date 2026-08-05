// ============================================================================
// File: src/components/customer/home-view.tsx
// Purpose: Customer homepage — consolidated for a focused, modern, trustworthy
//          pharmacy feel. Deep emerald/teal palette (no indigo/blue), generous
//          whitespace, soft layered shadows, glassmorphism accents, and
//          framer-motion entrance animations on every section.
//
// Consolidated section order (top → bottom):
//   1. Hero (admin-configurable; respects offers.hero override)
//   2. Quick Actions bar — Prescription Upload + Medicine Request + Browse
//      Catalog elevated to the top (core pharmacy differentiators)
//   3. Shop by Category (image tiles + product counts)
//   4. Trusted Brands (prominent placement — social proof before products)
//   5. Featured Products (12 products, 5-6 per row)
//   6. Deals & Bestsellers — MERGED section with toggle tabs
//      (Today's Deals + Best Sellers + Doctor's Choice + Pharmacist
//      Recommended + Top Rated)
//   7. Trending & New — MERGED section with toggle tabs
//      (Trending Now + New Arrivals)
//   8. Mid-banner offers (admin offers, position: mid-banner)
//   9. Medical Bundles (curated health kits — unique pharmacy feature)
//  10. Wellness hub — MERGED section (Health Tips + Testimonials)
//  11. Recently viewed (localStorage; shows only if data exists)
//  12. Compliance & trust strip (folded "Why choose us" messaging here)
//  13. Final CTA band
// ============================================================================

"use client";

import { useQuery } from "@tanstack/react-query";
import { api, qk, Product, FeaturedResponse, HomeFeedResponse, Category, Brand, PublicSettings, DealItem, HeroConfig } from "./api";
import { ProductCard, ProductCardSkeleton } from "@/components/shared/product-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Search,
  Truck,
  ShieldCheck,
  RefreshCw,
  FileText,
  ClipboardList,
  Star,
  ChevronRight,
  Clock,
  MapPin,
  ArrowRight,
  BadgeCheck,
  Award,
  Lock,
  Flame,
  Tag,
  ArrowUpRight,
  Pill,
  HeartPulse,
  Droplets,
  Sun,
  Moon,
  Activity,
  Brain,
  Bone,
  Eye,
  Apple,
  Stethoscope,
  Thermometer,
  Wind,
  Shield,
  Baby,
  Leaf,
  Sparkles,
  PhoneCall,
  Zap,
  Headphones,
  CreditCard,
  PackageCheck,
  Gift,
  Percent,
  Megaphone,
  Users,
  ArrowLeft,
  Mail,
  Trash2,
} from "lucide-react";
import { useUI } from "@/lib/store";
import { usePublicSettings } from "./use-public-settings";
import { useRecentlyViewed, useClearRecentlyViewed, RecentProduct } from "./use-recently-viewed";
import { MedicalBundlesSection } from "./medical-bundles-section";
import { motion } from "framer-motion";
import { useState, useEffect, createElement, useSyncExternalStore, memo, useMemo, useCallback } from "react";
import { ProductImage } from "@/components/shared/product-image";
import { formatCurrency } from "@/lib/format";
import { pickDailyHealthTips, HealthTipIcon } from "./health-tips-data";

// Map the string icon key stored in the health-tips-data module to the actual
// Lucide component. Used by the HealthTipsSection strip.
const HEALTH_TIP_ICONS: Record<HealthTipIcon, typeof Pill> = {
  HeartPulse,
  Droplets,
  Pill,
  Sun,
  Moon,
  Activity,
  Brain,
  Bone,
  Eye,
  Apple,
  Stethoscope,
  Thermometer,
  Wind,
  Shield,
  Baby,
  Leaf,
};

// Map category names to relevant Lucide icons. Used as the fallback tile
// illustration when a category has no uploaded image. Falls back to `Pill`
// for unmapped categories so every tile always has an icon.
const CATEGORY_ICONS: Record<string, typeof Pill> = {
  "Pain Relief": Pill,
  "OTC Medicines": Pill,
  "Wellness & Supplements": HeartPulse,
  "Personal Care": Sparkles,
  "Baby Care": Baby,
  "Diabetes Care": Activity,
  "Devices & Equipment": Stethoscope,
  "Prescription Medicines": FileText,
  "Ayurveda": Leaf,
};

function resolveCategoryIcon(name: string): typeof Pill {
  return CATEGORY_ICONS[name] ?? Pill;
}

// Shared framer-motion variants for staggered section entrances.
const sectionContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const itemUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

export function HomeView() {
  const navigate = useUI((s) => s.navigate);
  const setSearchOpen = useUI((s) => s.setSearchOpen);
  const { settings, isStoreOpen } = usePublicSettings();
  const [heroQuery, setHeroQuery] = useState("");
  // Tab state for the merged "Deals & Bestsellers" and "Trending & New"
  // sections. Lifted to HomeView so the toggle persists across re-renders
  // triggered by React Query refetches (the sub-sections are pure functions
  // of these + their product props).
  const [dealsTab, setDealsTab] = useState<"deals" | "bestsellers">("deals");
  const [trendingTab, setTrendingTab] = useState<"trending" | "new">("trending");

  // ── Performance (Phase 97): staleTime mirrors each route's CDN s-maxage so
  //    React Query doesn't refetch on every mount / navigation. The CDN edge
  //    will return stale-while-revalidate anyway, but skipping the round-trip
  //    entirely cuts latency on back-button / shop→home navigation.
  //    Catalog queries are public + admin-curated → safe to hold for 60s;
  //    homeFeed is cached for 5 min at the edge → match that on the client.
  const { data: featured } = useQuery({
    queryKey: qk.featured,
    queryFn: () => api<FeaturedResponse>("/api/catalog/featured"),
    staleTime: 60 * 1000,
  });

  const { data: categories } = useQuery({
    queryKey: qk.categories,
    queryFn: () => api<Category[]>("/api/catalog/categories"),
    staleTime: 60 * 1000,
  });

  const { data: brands } = useQuery({
    queryKey: qk.brands,
    queryFn: () => api<Brand[]>("/api/catalog/brands?featured=true"),
    staleTime: 60 * 1000,
  });

  // Admin-curated "Today's Deals" — fetched from the public /api/deals
  // endpoint. When the admin has published active deals, those replace the
  // fallback best-seller/trending strip below. When the deals list is empty
  // (or still loading), we fall back to the existing curated-from-featured
  // strip so the section never disappears on existing installs.
  const { data: dealsData } = useQuery({
    queryKey: qk.deals,
    queryFn: () => api<{ items: DealItem[] }>("/api/deals"),
    staleTime: 30 * 1000,
  });

  // Premium home feed — 6 showcase sections in ONE call (New Arrivals,
  // Doctor's Choice, Pharmacist Recommended, Limited-Time Deals, Seasonal
  // Collection, Top Rated). Replaces 6 separate round-trips. Cached at the
  // CDN for 5 min (s-maxage=300, swr=600).
  const { data: homeFeed } = useQuery({
    queryKey: qk.homeFeed,
    queryFn: () => api<HomeFeedResponse>("/api/catalog/home-feed"),
    staleTime: 5 * 60 * 1000,
  });

  // Stable callbacks for the showcase sections — wrapping in useCallback
  // keeps the same function reference across renders, which lets the
  // memo()'d section children skip re-rendering when only the parent's
  // unrelated state changes (e.g. heroQuery input).
  const goShopNewest = useCallback(() => navigate({ name: "shop", sort: "newest" } as any), [navigate]);
  const goShopAll = useCallback(() => navigate({ name: "shop" }), [navigate]);
  const goShopRating = useCallback(() => navigate({ name: "shop", sort: "rating" } as any), [navigate]);
  const goShopFeatured = useCallback(() => navigate({ name: "shop", featured: true } as any), [navigate]);
  const goShopBestSeller = useCallback(() => navigate({ name: "shop", bestSeller: true } as any), [navigate]);
  const goShopTrending = useCallback(() => navigate({ name: "shop", trending: true } as any), [navigate]);
  const goShopBestDiscount = useCallback(() => navigate({ name: "shop", sort: "best-discount" } as any), [navigate]);

  // ── Performance (Phase 97): memoize derived deals data so the IIFEs in the
  //    JSX don't recompute the filter / Map on every parent re-render (e.g.
  //    when heroQuery input changes). The result is a stable object until
  //    dealsData or featured changes — the memo()'d TodaysDeals* sections
  //    can then skip re-rendering.
  const dealsSection = useMemo(() => {
    if (dealsData?.items?.length) {
      const withProduct = dealsData.items.filter((d) => d.product);
      if (withProduct.length > 0) {
        return { kind: "api" as const, deals: withProduct };
      }
    }
    if (featured) {
      const dealMap = new Map<string, Product>();
      for (const p of featured.bestSellers) if (p.isBestSeller || p.isTrending) dealMap.set(p.id, p);
      for (const p of featured.trending) if (p.isBestSeller || p.isTrending) dealMap.set(p.id, p);
      for (const p of featured.featured) if (p.isBestSeller || p.isTrending) dealMap.set(p.id, p);
      const deals = Array.from(dealMap.values()).slice(0, 12);
      if (deals.length > 0) {
        return { kind: "curated" as const, deals };
      }
    }
    return null;
  }, [dealsData, featured]);

  const onDealProductClick = useCallback(
    (p: Product) => navigate({ name: "product", productId: p.id, slug: p.slug }),
    [navigate]
  );
  const onDealItemClick = useCallback(
    (d: DealItem) => navigate({ name: "product", productId: d.product!.id, slug: d.product!.slug }),
    [navigate]
  );

  const onHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (heroQuery.trim()) {
      navigate({ name: "shop", query: heroQuery.trim() });
    } else {
      setSearchOpen(true);
    }
  };

  return (
    <div className="animate-page-enter mx-auto max-w-7xl space-y-12 px-4 py-4 sm:space-y-16 sm:px-6 sm:py-6">
      {/* ====================================================================
          1. HERO SYSTEM — fully admin-configurable via Settings → Hero.
          Includes: Announcement Bar, Hero Banner, Trust Strip, Hero Cards,
          and Promotional Banner. Every part has an enable/disable toggle.
          If a hero "offer" exists in settings.offers it overrides the banner.
      ==================================================================== */}
      <HeroSystem
        hero={settings?.hero}
        isStoreOpen={isStoreOpen}
        store={settings?.store}
        heroOffer={settings?.offers?.find((o) => o.position === "hero")}
        heroQuery={heroQuery}
        setHeroQuery={setHeroQuery}
        onHeroSearch={onHeroSearch}
      />

      {/* ====================================================================
          1b. HERO ACTION CARDS — premium pharmacy service cards.
          Upload Prescription, Request Medicines, Browse Catalog.
      ==================================================================== */}
      <section aria-label="Quick actions" className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate({ name: "prescription" })}
          className="group relative overflow-hidden rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-teal-50/50 p-4 text-left shadow-sm transition-all hover:border-emerald-300 hover:shadow-lg dark:border-emerald-900/40 dark:from-emerald-950/30 dark:to-teal-950/20 sm:p-5"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20 transition-transform group-hover:scale-105 sm:size-12">
              <FileText className="size-5 sm:size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-foreground">Upload Prescription</h3>
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">Our pharmacist verifies & delivers</p>
            </div>
            <ArrowRight className="size-4 shrink-0 text-emerald-600 transition-transform group-hover:translate-x-1" />
          </div>
        </motion.button>

        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate({ name: "manual-request" })}
          className="group relative overflow-hidden rounded-2xl border border-teal-200/60 bg-gradient-to-br from-teal-50 to-cyan-50/50 p-4 text-left shadow-sm transition-all hover:border-teal-300 hover:shadow-lg dark:border-teal-900/40 dark:from-teal-950/30 dark:to-cyan-950/20 sm:p-5"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-md shadow-teal-500/20 transition-transform group-hover:scale-105 sm:size-12">
              <ClipboardList className="size-5 sm:size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-foreground">Request Medicines</h3>
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">Can't find it? We'll source it</p>
            </div>
            <ArrowRight className="size-4 shrink-0 text-teal-600 transition-transform group-hover:translate-x-1" />
          </div>
        </motion.button>

        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate({ name: "shop" })}
          className="group relative overflow-hidden rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50 to-orange-50/50 p-4 text-left shadow-sm transition-all hover:border-amber-300 hover:shadow-lg dark:border-amber-900/40 dark:from-amber-950/30 dark:to-orange-950/20 sm:p-5"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/20 transition-transform group-hover:scale-105 sm:size-12">
              <Search className="size-5 sm:size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-foreground">Browse Catalog</h3>
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">300+ medicines & wellness products</p>
            </div>
            <ArrowRight className="size-4 shrink-0 text-amber-600 transition-transform group-hover:translate-x-1" />
          </div>
        </motion.button>
      </section>

      {/* ====================================================================
          2. SHOP BY CATEGORY — premium category tiles with images.
      ==================================================================== */}
      {categories && categories.length > 0 && (
        <section>
          <SectionHeader
            eyebrow="Explore"
            title="Shop by Category"
            onAction={() => navigate({ name: "categories" })}
          />
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            variants={sectionContainer}
            className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-8"
          >
            {categories.slice(0, 8).map((c) => (
              <motion.button
                key={c.id}
                variants={itemUp}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate({ name: "shop", categoryId: c.id })}
                className="group flex flex-col items-center gap-2 rounded-2xl border border-border/40 bg-card p-3 text-center shadow-sm transition-all hover:border-emerald-300/50 hover:shadow-md sm:p-4"
              >
                <div className="relative flex size-16 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-md shadow-emerald-400/20 transition-transform duration-300 group-hover:scale-110 sm:size-16">
                  {c.image ? (
                    <img src={c.image} alt={c.name} loading="lazy" className="size-full object-contain" />
                  ) : (
                    (() => {
                      const Icon = resolveCategoryIcon(c.name);
                      return <Icon className="size-5 sm:size-6" />;
                    })()
                  )}
                </div>
                <span className="line-clamp-2 text-xs font-semibold leading-tight text-foreground transition-colors group-hover:text-emerald-700 sm:text-sm">
                  {c.name}
                </span>
                {typeof c.productCount === "number" && (
                  <span className="text-[10px] text-muted-foreground">{c.productCount} items</span>
                )}
              </motion.button>
            ))}
          </motion.div>
        </section>
      )}

      {/* ====================================================================
          4. TRUSTED BRANDS — minimal marquee, no outer card.
      ==================================================================== */}
      {brands && brands.length > 0 && (
        <section>
          <SectionHeader eyebrow="Partners" title="Trusted Brands" />
          <div className="relative overflow-hidden">
            {/* Gradient fade edges */}
            <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-12 bg-gradient-to-r from-background to-transparent" />
            <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-12 bg-gradient-to-l from-background to-transparent" />
            {/* Marquee track */}
            <div className="marquee-mask overflow-hidden">
              <div className="animate-marquee flex w-max gap-6 px-4 sm:gap-8">
                {[...brands, ...brands].map((b, i) => {
                  const showLogo = b.displayMode !== "name_only" && b.logo;
                  const showName = b.displayMode !== "logo_only";
                  return (
                    <button
                      key={`${b.id}-${i}`}
                      onClick={() => navigate({ name: "shop", brandId: b.id })}
                      className="flex h-20 w-28 shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-border/30 bg-card px-3 py-3 transition-all hover:border-emerald-300/50 hover:shadow-sm sm:h-24 sm:w-36 sm:gap-2 sm:px-4"
                    >
                      {showLogo ? (
                        <img
                          src={b.logo}
                          alt={b.name}
                          className="max-h-8 w-auto object-contain sm:max-h-10"
                        />
                      ) : (
                        <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 text-sm font-bold text-white shadow-sm sm:size-10 sm:text-base">
                          {b.name[0]}
                        </span>
                      )}
                      {showName && (
                        <span className="line-clamp-1 text-[10px] font-medium text-muted-foreground sm:text-xs">{b.name}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ====================================================================
          5. FEATURED PRODUCTS — 12 handpicked products, 5-6 per row on
          desktop, 2 per row on mobile. The ProductGrid component memoizes
          the slice so it doesn't re-render unnecessarily.
      ==================================================================== */}
      <section>
        <SectionHeader
          eyebrow="Handpicked"
          title="Featured Products"
          onAction={goShopFeatured}
        />
        <ProductGrid products={featured?.featured} loading={!featured} />
      </section>

      {/* ====================================================================
          6. DEALS & BESTSELLERS — MERGED section with toggle.
          Consolidates: Today's Deals + Best Sellers + Doctor's Choice +
          Pharmacist Recommended + Top Rated into one tabbed section.
          "Deals" tab shows the live countdown timer + horizontal card strip;
          "Best Sellers" tab shows a responsive ProductGrid.
          Reduces 5 separate scrolling sections into 1 with a toggle.
      ==================================================================== */}
      <DealsAndBestsellersSection
        dealsSection={dealsSection}
        bestSellers={featured?.bestSellers}
        loading={!featured}
        tab={dealsTab}
        setTab={setDealsTab}
        onDealProductClick={onDealProductClick}
        onDealItemClick={onDealItemClick}
        onShopAllDeals={goShopBestDiscount}
        onShopAllBestsellers={goShopBestSeller}
      />

      {/* ====================================================================
          7. TRENDING & NEW — MERGED section with toggle.
          Consolidates: Trending Now + New Arrivals (+ implicitly Doctor's
          Choice, which used to be a separate showcase). Tab toggle lets the
          customer flip between "what's hot" and "what just landed" without
          scrolling past two near-identical product grids.
      ==================================================================== */}
      <TrendingAndNewSection
        trending={featured?.trending}
        newArrivals={homeFeed?.newArrivals}
        loading={!featured || !homeFeed}
        tab={trendingTab}
        setTab={setTrendingTab}
        onViewAllTrending={goShopTrending}
        onViewAllNew={goShopNewest}
      />

      {/* ====================================================================
          8. MID-BANNER OFFERS (admin offers, position: mid-banner)
      ==================================================================== */}
      {settings?.offers
        ?.filter((o) => o.position === "mid-banner")
        .map((offer) => (
          <section
            key={offer.id}
            className="relative overflow-hidden rounded-3xl px-6 py-7 shadow-xl sm:px-10 sm:py-9"
            style={{ backgroundColor: offer.bgColor, color: offer.textColor }}
          >
            <div
              className="absolute inset-0 opacity-[0.08]"
              style={{
                backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            />
            <div className="relative flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold sm:text-2xl">{offer.title}</h2>
                {offer.subtitle && <p className="mt-1 text-sm opacity-90 sm:text-base">{offer.subtitle}</p>}
              </div>
              {offer.ctaText && (
                <Button
                  onClick={() => navigate({ name: (offer.ctaView as any) || "shop" } as any)}
                  className="gap-1.5 bg-white text-foreground shadow-lg transition-all hover:-translate-y-0.5 hover:bg-white/90"
                >
                  {offer.ctaText}
                  <ArrowRight className="size-4" />
                </Button>
              )}
            </div>
          </section>
        ))}

      {/* ====================================================================
          9. MEDICAL BUNDLES — curated health kits (carousel).
          Unique pharmacy feature — kept as its own section.
      ==================================================================== */}
      <MedicalBundlesSection />

      {/* ====================================================================
          10. WELLNESS HUB — MERGED section.
          Consolidates: Health Tips & Articles + Testimonials into a single
          "Wellness hub" with a shared header. Health tips on top (3 daily-
          rotating cards), testimonials below (3 verified-buyer reviews).
      ==================================================================== */}
      <WellnessHubSection />

      {/* ====================================================================
          11. RECENTLY VIEWED (localStorage) — only renders if the customer
          has actually viewed any products. Hidden on first visit.
      ==================================================================== */}
      <RecentlyViewedSection />
    </div>
  );
}

// =========================================================================
// Sub-components
// =========================================================================

// ---------------------------------------------------------------------------
// HERO SYSTEM — fully admin-configurable hero section.
// Every major piece (announcement bar, banner, search, cards, trust features,
// promo banner) has an enable/disable toggle driven by the HeroConfig object.
// Mobile-first responsive design with framer-motion animations.
// ---------------------------------------------------------------------------

/** Comprehensive icon registry — admin picks icon names from this set for
 *  hero cards, trust features, and CTA buttons. */
const HERO_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ShieldCheck, Truck, Award, Lock, HeartPulse, Pill, Clock, Star,
  FileText, ClipboardList, RefreshCw, BadgeCheck, Search, ArrowRight,
  PhoneCall, Mail, MapPin, Sparkles, Flame, Tag, Zap, Headphones,
  CreditCard, PackageCheck, Gift, Percent, Megaphone, Users, ArrowLeft,
  ArrowUpRight, ChevronRight, Droplets, Sun, Moon, Activity, Brain, Bone,
  Eye, Apple, Stethoscope, Thermometer, Wind, Shield, Baby, Leaf,
};

function resolveHeroIcon(name?: string) {
  if (!name) return null;
  return HERO_ICONS[name] || null;
}

/** Static component that renders a hero icon by name. Uses createElement
 *  rather than JSX <Icon /> to satisfy the react-hooks/static-components
 *  lint rule (the icon reference is a runtime lookup, not a static def). */
function HeroIcon({ name, className }: { name?: string; className?: string }) {
  const Icon = resolveHeroIcon(name);
  if (!Icon) return null;
  return createElement(Icon, { className });
}

/** Resolve a CTA "url" which may be a customer view name (e.g. "shop") or a
 *  full URL (e.g. "https://..."). Internal view names navigate via the SPA
 *  router; full URLs open in a new tab. */
function go(navigate: (v: any) => void, url?: string) {
  if (!url) return;
  if (/^https?:\/\//i.test(url) || url.startsWith("mailto:") || url.startsWith("tel:")) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  navigate({ name: url as any } as any);
}

/** Check if a scheduled item (promo banner / announcement) is currently
 *  visible based on its optional start/end ISO date window. */
function isWithinSchedule(start?: string, end?: string): boolean {
  const now = Date.now();
  if (start && now < new Date(start).getTime()) return false;
  if (end && now > new Date(end).getTime()) return false;
  return true;
}

/** Hook that returns true after the component has mounted on the client.
 *  Used to defer time-sensitive rendering (schedule checks, countdowns) until
 *  after hydration so the SSR HTML and the first client render always match.
 *  Uses useSyncExternalStore (the React-recommended mounted pattern) to avoid
 *  the set-state-in-effect lint rule. */
function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,   // client snapshot — always true once hydrated
    () => false,  // server snapshot — always false during SSR
  );
}

/** Height preset → padding classes (mobile-first). Reduced for a more
 *  concise, modern hero that doesn't occupy excessive screen space. */
const HERO_HEIGHTS: Record<string, string> = {
  sm: "py-5 sm:py-6",
  md: "py-6 sm:py-8",
  lg: "py-8 sm:py-10",
  xl: "py-10 sm:py-14",
};

const HERO_SPACING: Record<string, string> = {
  compact: "space-y-4",
  normal: "space-y-6",
  relaxed: "space-y-10",
};

/** Style preset → gradient colors (used when gradientEnabled and stylePreset
 *  !== "custom"). Custom uses the admin's gradientFrom/Via/To. */
const STYLE_PRESETS: Record<string, { from: string; via: string; to: string }> = {
  emerald: { from: "#047857", via: "#059669", to: "#0f766e" },
  teal: { from: "#0f766e", via: "#0d9488", to: "#0891b2" },
  midnight: { from: "#0c4a6e", via: "#075985", to: "#0e7490" },
  sunrise: { from: "#9a3412", via: "#c2410c", to: "#d97706" },
};

function HeroSystem({
  hero,
  isStoreOpen,
  store,
  heroOffer,
  heroQuery,
  setHeroQuery,
  onHeroSearch,
}: {
  hero?: HeroConfig;
  isStoreOpen: boolean;
  store?: PublicSettings["store"];
  heroOffer?: PublicSettings["offers"] extends Array<infer T> ? T : never;
  heroQuery: string;
  setHeroQuery: (v: string) => void;
  onHeroSearch: (e: React.FormEvent) => void;
}) {
  const navigate = useUI((s) => s.navigate);
  const anim = hero?.animationsEnabled !== false;

  // If hero is disabled entirely, render nothing.
  if (hero && hero.enabled === false) return null;

  return (
    <div className={HERO_SPACING[hero?.sectionSpacing || "normal"]}>
      {/* Announcement Bar */}
      <AnnouncementBar hero={hero} navigate={navigate} />

      {/* Hero Banner (admin offer override takes precedence) */}
      <HeroBanner
        hero={hero}
        heroOffer={heroOffer}
        isStoreOpen={isStoreOpen}
        store={store}
        heroQuery={heroQuery}
        setHeroQuery={setHeroQuery}
        onHeroSearch={onHeroSearch}
        navigate={navigate}
        anim={anim}
      />

      {/* Promotional Banner */}
      <PromoBanner hero={hero} navigate={navigate} anim={anim} />
    </div>
  );
}

// — Announcement Bar — thin emerald bar above the hero. --------------------
function AnnouncementBar({
  hero,
  navigate,
}: {
  hero?: HeroConfig;
  navigate: (v: any) => void;
}) {
  const mounted = useMounted();
  if (!hero?.announcementEnabled || !hero.announcementText?.trim()) return null;
  // Defer the schedule check until after mount so SSR and the first client
  // render always agree (Date.now() differs between server and client).
  if (mounted && !isWithinSchedule(hero.announcementStart, hero.announcementEnd)) return null;
  return (
    <div className="rounded-2xl bg-linear-to-r from-emerald-700 via-emerald-600 to-teal-700 px-4 py-2.5 text-center text-xs font-medium text-white shadow-sm sm:text-sm">
      <button
        type="button"
        onClick={() => hero.announcementLink && go(navigate, hero.announcementLink)}
        className={`inline-flex items-center gap-1.5 ${hero.announcementLink ? "cursor-pointer hover:underline" : "cursor-default"}`}
      >
        <Megaphone className="size-3.5 shrink-0" />
        <span className="line-clamp-1 sm:line-clamp-none">{hero.announcementText}</span>
      </button>
    </div>
  );
}

// — Hero Banner — the main hero section. ----------------------------------
function HeroBanner({
  hero,
  heroOffer,
  isStoreOpen,
  store,
  heroQuery,
  setHeroQuery,
  onHeroSearch,
  navigate,
  anim,
}: {
  hero?: HeroConfig;
  heroOffer?: any;
  isStoreOpen: boolean;
  store?: PublicSettings["store"];
  heroQuery: string;
  setHeroQuery: (v: string) => void;
  onHeroSearch: (e: React.FormEvent) => void;
  navigate: (v: any) => void;
  anim: boolean;
}) {
  // Admin "hero offer" override — simple banner with the offer's content.
  if (heroOffer) {
    return (
      <section
        className="relative overflow-hidden rounded-3xl px-6 py-12 shadow-2xl sm:px-12 sm:py-16"
        style={{ backgroundColor: heroOffer.bgColor, color: heroOffer.textColor }}
      >
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-3xl font-bold leading-tight sm:text-5xl">{heroOffer.title}</h1>
          {heroOffer.subtitle && <p className="mt-3 text-sm opacity-90 sm:text-lg">{heroOffer.subtitle}</p>}
          {heroOffer.ctaText && (
            <Button
              onClick={() => go(navigate, heroOffer.ctaView)}
              className="mt-6 gap-1.5 bg-white text-foreground hover:bg-white/90"
              size="lg"
            >
              {heroOffer.ctaText}
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </section>
    );
  }

  if (!hero) return null;

  // Resolve background gradient.
  const preset = STYLE_PRESETS[hero.stylePreset] || STYLE_PRESETS.emerald;
  const gFrom = hero.stylePreset === "custom" ? hero.gradientFrom : preset.from;
  const gVia = hero.stylePreset === "custom" ? hero.gradientVia : preset.via;
  const gTo = hero.stylePreset === "custom" ? hero.gradientTo : preset.to;

  const layout = hero.layout || "split-left";
  // An image is "available" when the image feature is enabled AND a URL is set.
  const hasImage = hero.bgImageEnabled && !!(hero.bgImageDesktop || hero.bgImageMobile);
  // Desktop/tablet side image (split layouts) and full-bg image.
  const sideImage = hero.bgImageDesktop || hero.bgImageMobile || "";
  // Mobile always falls back to the mobile image (or desktop if no mobile set).
  const mobileImage = hero.bgImageMobile || hero.bgImageDesktop || "";

  // Layout semantics:
  //  - split-left / split-right: 2-col grid (text + side image) when an image
  //    is available; otherwise a single text column. Image shows on md+.
  //  - centered: single text column, centered, no side image.
  //  - full-bg: image fills the whole hero as a background with a dark
  //    overlay; text sits on top (alignment per contentAlign).
  const isSplit = layout === "split-left" || layout === "split-right";
  const isFullBg = layout === "full-bg";
  const isCenteredLayout = layout === "centered";
  // Show the side-by-side image only for split layouts that have an image.
  const hasSplitImage = isSplit && hasImage;
  // Full-bg background image shows for full-bg layout (or any layout with an
  // image when not split — treated as a background).
  const hasFullBgImage = isFullBg && hasImage;

  const popularSearches = hero.popularSearches
    ? hero.popularSearches.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  // Background base style for the <section>.
  const bgStyle: React.CSSProperties = {};
  if (hasFullBgImage) {
    // Full-bg: solid base color (image layer drawn separately on top).
    bgStyle.backgroundColor = gFrom;
  } else if (hero.gradientEnabled) {
    bgStyle.background = `linear-gradient(135deg, ${gFrom}, ${gVia}, ${gTo})`;
  } else {
    bgStyle.background = hero.bgColor || gFrom;
  }

  // Pattern overlay style.
  const patternBg =
    hero.bgPattern === "dots"
      ? "radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)"
      : hero.bgPattern === "grid"
      ? "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)"
      : hero.bgPattern === "waves"
      ? "repeating-linear-gradient(45deg, rgba(255,255,255,0.15) 0, rgba(255,255,255,0.15) 1px, transparent 1px, transparent 12px)"
      : "none";
  const patternSize =
    hero.bgPattern === "grid" ? "24px 24px" : hero.bgPattern === "dots" ? "22px 22px" : undefined;

  const radius = hero.borderRadius ?? 24;
  const heightClass = HERO_HEIGHTS[hero.height || "lg"];

  // Grid template per layout (only activates at md+ for split layouts).
  const gridCols = hasSplitImage
    ? layout === "split-right"
      ? "md:grid-cols-[1fr_1.1fr]"
      : "md:grid-cols-[1.1fr_1fr]"
    : "grid-cols-1";

  // contentAlign controls text alignment WITHIN the text column. It does NOT
  // override the layout choice. Centered layout always centers; full-bg and
  // split layouts honor the contentAlign setting.
  const isTextCentered = isCenteredLayout || hero.contentAlign === "center";

  return (
    <section
      className={`relative overflow-hidden text-white shadow-2xl ${heightClass}`}
      style={{ ...bgStyle, borderRadius: `${radius}px` }}
    >
      {/* Full-bg background image layer (desktop/tablet/mobile) */}
      {hasFullBgImage && (
        <div className="absolute inset-0 z-0">
          {/* Desktop / tablet */}
          <img
            src={sideImage}
            alt={hero.imageAltText || ""}
            className="hidden h-full w-full object-cover sm:block"
          />
          {/* Mobile */}
          <img
            src={mobileImage}
            alt={hero.imageAltText || ""}
            className="block h-full w-full object-cover sm:hidden"
          />
          {/* Dark overlay for text legibility */}
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(135deg, rgba(4,78,55,${hero.bgOverlay / 100}), rgba(15,118,110,${hero.bgOverlay / 100}))` }}
          />
        </div>
      )}

      {/* Gradient depth overlay (when no full-bg image) */}
      {!hasFullBgImage && hero.gradientEnabled && (
        <div
          className="absolute inset-0 z-0"
          style={{ opacity: hero.bgOpacity / 100, background: `linear-gradient(135deg, ${gFrom}, ${gVia}, ${gTo})` }}
        />
      )}

      {/* Pattern overlay */}
      {hero.bgPattern !== "none" && (
        <div
          className="absolute inset-0 z-0 opacity-[0.12]"
          style={{ backgroundImage: patternBg, backgroundSize: patternSize }}
        />
      )}

      {/* Animated orbs */}
      {anim && (
        <>
          <motion.div
            className="absolute right-0 top-0 -mr-20 -mt-20 size-80 rounded-full bg-white/10 blur-3xl"
            animate={{ y: [0, -16, 0], x: [0, 8, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute bottom-0 left-0 -mb-24 -ml-16 size-96 rounded-full bg-teal-300/20 blur-3xl"
            animate={{ y: [0, 14, 0], x: [0, -8, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />
        </>
      )}
      {/* Top sheen */}
      <div className="absolute inset-x-0 top-0 z-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

      {/* Content — relative z-10 so it sits above all background layers.
          The grid is single-column on mobile and 2-column on md+ for split
          layouts. For centered/full-bg, it stays single-column with the text
          constrained to max-w-3xl and centered. Horizontal padding keeps
          content from touching the rounded edges. */}
      <div className={`relative z-10 grid gap-8 px-5 sm:px-10 md:items-center ${gridCols} ${layout === "split-right" ? "md:[&>*:first-child]:order-2" : ""}`}>
        <div className={isTextCentered ? "mx-auto max-w-3xl text-center" : "max-w-2xl"}>
          {/* Open/closed pill */}
          <motion.div
            initial={anim ? { opacity: 0, y: 20 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className={isTextCentered ? "flex justify-center" : ""}
          >
            <Badge className="mb-4 gap-1.5 border border-white/20 bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-md hover:bg-white/15">
              <span className={`relative flex size-2 ${isStoreOpen ? "text-emerald-300" : "text-amber-300"}`}>
                <span className={`absolute inline-flex size-full animate-ping rounded-full opacity-75 ${isStoreOpen ? "bg-emerald-300" : "bg-amber-300"}`} />
                <span className={`relative inline-flex size-2 rounded-full ${isStoreOpen ? "bg-emerald-300" : "bg-amber-300"}`} />
              </span>
              {isStoreOpen ? "Open now" : "Closed"}
              {store?.openTime && store?.closeTime && (
                <span className="ml-1 opacity-90">· {store.openTime}–{store.closeTime} IST</span>
              )}
            </Badge>
          </motion.div>

          {/* Promo badge */}
          {hero.promoBadgeEnabled && hero.promoBadgeText?.trim() && (
            <motion.div
              initial={anim ? { opacity: 0, y: 16 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className={isTextCentered ? "mb-3 flex justify-center" : "mb-3"}
            >
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/90 px-3 py-1 text-xs font-bold text-amber-950 shadow-md backdrop-blur-sm">
                <Sparkles className="size-3.5" />
                {hero.promoBadgeText}
              </span>
            </motion.div>
          )}

          {/* Heading + highlight — reduced sizes for concise hero */}
          <h1 className="text-2xl font-bold leading-[1.15] tracking-tight sm:text-3xl lg:text-4xl">
            <motion.span
              className="block"
              initial={anim ? { opacity: 0, y: 24 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.15 }}
            >
              {hero.heading || "Your trusted pharmacy,"}
            </motion.span>
            {hero.headingHighlight?.trim() && (
              <motion.span
                className="mt-1 block bg-gradient-to-r from-white via-emerald-50 to-emerald-100 bg-clip-text text-transparent"
                initial={anim ? { opacity: 0, y: 24 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.28 }}
              >
                {hero.headingHighlight}
              </motion.span>
            )}
          </h1>

          {/* Subheading */}
          {hero.subheading?.trim() && (
            <motion.p
              className={`mt-2 text-sm font-semibold text-emerald-50 sm:text-base ${isTextCentered ? "mx-auto" : ""}`}
              initial={anim ? { opacity: 0, y: 20 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
            >
              {hero.subheading}
            </motion.p>
          )}

          {/* Description */}
          {hero.description?.trim() && (
            <motion.p
              className={`mt-4 max-w-lg text-sm leading-relaxed text-emerald-50/90 sm:text-base ${isTextCentered ? "mx-auto" : ""}`}
              initial={anim ? { opacity: 0, y: 20 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              {hero.description}
            </motion.p>
          )}

          {/* Search bar */}
          {hero.searchEnabled && (
            <motion.form
              onSubmit={onHeroSearch}
              className={`mt-6 flex max-w-lg gap-2 ${isTextCentered ? "mx-auto" : ""}`}
              initial={anim ? { opacity: 0, y: 20 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={hero.searchPlaceholder || "Search medicines, brands..."}
                  value={heroQuery}
                  onChange={(e) => setHeroQuery(e.target.value)}
                  className="focus-premium h-12 border-0 bg-white pl-10 text-foreground shadow-premium-lg ring-1 ring-black/5 placeholder:text-muted-foreground/70"
                />
              </div>
              <Button
                type="submit"
                size="lg"
                className="btn-premium h-12 gap-1.5 bg-white px-5 text-emerald-700 shadow-premium-lg ring-1 ring-black/5 transition-all hover:-translate-y-0.5 hover:bg-emerald-50 sm:px-6"
              >
                <Search className="size-4" /> <span className="hidden sm:inline">Search</span>
              </Button>
            </motion.form>
          )}

          {/* Popular searches */}
          {hero.searchEnabled && popularSearches.length > 0 && (
            <motion.div
              className={`mt-3 flex flex-wrap items-center gap-2 ${isTextCentered ? "justify-center" : ""}`}
              initial={anim ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              <span className="text-[11px] font-medium uppercase tracking-wide text-emerald-50/70">Popular:</span>
              {popularSearches.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => navigate({ name: "shop", query: term })}
                  className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-white/20"
                >
                  {term}
                </button>
              ))}
            </motion.div>
          )}

          {/* CTAs */}
          {hero.ctaEnabled && (hero.primaryCtaText || hero.secondaryCtaText) && (
            <motion.div
              className={`mt-7 flex flex-wrap items-center gap-3 ${isTextCentered ? "justify-center" : ""}`}
              initial={anim ? { opacity: 0, y: 20 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.68 }}
            >
              {hero.primaryCtaText?.trim() && (
                <Button
                  onClick={() => go(navigate, hero.primaryCtaUrl)}
                  size="lg"
                  className={
                    hero.buttonStyle === "gradient"
                      ? "gap-1.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-xl transition-all hover:-translate-y-0.5"
                      : hero.buttonStyle === "outline"
                      ? "gap-1.5 border-white/50 bg-white/5 text-white backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-white/15"
                      : "gap-1.5 bg-white text-emerald-700 shadow-xl shadow-emerald-900/20 transition-all hover:-translate-y-0.5 hover:bg-emerald-50"
                  }
                >
                  <HeroIcon name={hero.primaryCtaIcon} className="size-4" />
                  {hero.primaryCtaText}
                </Button>
              )}
              {hero.secondaryCtaText?.trim() && (
                <Button
                  variant="outline"
                  onClick={() => go(navigate, hero.secondaryCtaUrl)}
                  size="lg"
                  className="gap-1.5 border-white/40 bg-white/5 text-white backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-white/60 hover:bg-white/15"
                >
                  <HeroIcon name={hero.secondaryCtaIcon} className="size-4" />
                  {hero.secondaryCtaText}
                </Button>
              )}
            </motion.div>
          )}

          {/* Offer badge + discount label */}
          {hero.offerBadgeEnabled && hero.offerText?.trim() && (
            <motion.div
              className={`mt-5 ${isTextCentered ? "flex justify-center" : ""}`}
              initial={anim ? { opacity: 0, y: 16 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.76 }}
            >
              <div className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm">
                <Gift className="size-4 text-amber-300" />
                <span className="text-sm font-semibold text-white">{hero.offerText}</span>
                {hero.discountLabel?.trim() && (
                  <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-bold text-amber-950">
                    {hero.discountLabel}
                  </span>
                )}
              </div>
            </motion.div>
          )}

          {/* Delivery info */}
          {hero.deliveryInfoEnabled && hero.deliveryInfoText?.trim() && (
            <motion.div
              className={`mt-4 flex items-center gap-2 text-xs text-emerald-50/90 sm:text-sm ${isTextCentered ? "justify-center" : ""}`}
              initial={anim ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.82 }}
            >
              <Truck className="size-4 shrink-0 text-emerald-200" />
              <span>{hero.deliveryInfoText}</span>
            </motion.div>
          )}

          {/* Notice text */}
          {hero.noticeText?.trim() && (
            <motion.p
              className={`mt-4 text-[11px] text-emerald-50/70 ${isTextCentered ? "mx-auto" : ""}`}
              initial={anim ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.92 }}
            >
              {hero.noticeText}
            </motion.p>
          )}
        </div>

        {/* Split-layout side image (decorative). Shows on md+ (tablet +
            desktop). On mobile, the image renders below the text instead. */}
        {hasSplitImage && sideImage && (
          <div className="hidden md:block">
            <motion.div
              className="relative h-full"
              initial={anim ? { opacity: 0, scale: 0.92 } : false}
              animate={anim ? { opacity: 1, scale: 1, y: [0, -12, 0] } : { opacity: 1, scale: 1 }}
              transition={{
                opacity: { duration: 0.6, delay: 0.4 },
                scale: { duration: 0.6, delay: 0.4 },
                y: { duration: 5, repeat: Infinity, ease: "easeInOut" },
              }}
            >
              <img
                src={sideImage}
                alt={hero.imageAltText || ""}
                className="h-full max-h-[420px] w-full rounded-2xl border border-white/20 object-cover shadow-2xl"
              />
            </motion.div>
          </div>
        )}
      </div>

      {/* Mobile image (below text) — for split layouts on small screens so
          the image isn't lost. Hidden on md+ where the side grid takes over. */}
      {hasSplitImage && mobileImage && (
        <motion.div
          className="relative z-10 mt-6 md:hidden"
          initial={anim ? { opacity: 0, y: 20 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <img
            src={mobileImage}
            alt={hero.imageAltText || ""}
            className="w-full rounded-2xl border border-white/20 object-cover shadow-2xl"
          />
        </motion.div>
      )}
    </section>
  );
}

// — Trust Strip — horizontal cards below the hero. -------------------------
function TrustStrip({ hero, anim }: { hero?: HeroConfig; anim: boolean }) {
  if (!hero?.trustEnabled) return null;
  const items = (hero.trustFeatures || [])
    .filter((t) => t.enabled)
    .sort((a, b) => a.displayOrder - b.displayOrder);
  if (items.length === 0) return null;
  return (
    <motion.div
      initial={anim ? "hidden" : false}
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      variants={sectionContainer}
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
    >
      {items.map((t) => {
        const Icon = resolveHeroIcon(t.icon) || ShieldCheck;
        return (
          <motion.div
            key={t.id}
            variants={itemUp}
            className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <Icon className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{t.title}</p>
              {t.description && <p className="truncate text-xs text-muted-foreground">{t.description}</p>}
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

// — Hero Cards — action cards below the hero. ------------------------------
function HeroCards({
  hero,
  navigate,
  anim,
}: {
  hero?: HeroConfig;
  navigate: (v: any) => void;
  anim: boolean;
}) {
  if (!hero?.cardsEnabled) return null;
  const items = (hero.cards || [])
    .filter((c) => c.enabled)
    .sort((a, b) => a.displayOrder - b.displayOrder);
  if (items.length === 0) return null;
  const colors = [
    "from-emerald-500 to-teal-600",
    "from-teal-500 to-cyan-600",
    "from-green-500 to-emerald-600",
    "from-lime-500 to-green-600",
    "from-cyan-500 to-blue-600",
    "from-emerald-600 to-green-700",
  ];
  return (
    <motion.div
      initial={anim ? "hidden" : false}
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      variants={sectionContainer}
      className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4"
    >
      {items.map((c, i) => {
        const Icon = resolveHeroIcon(c.icon) || Pill;
        return (
          <motion.button
            key={c.id}
            variants={itemUp}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => go(navigate, c.link)}
            className="group relative flex flex-col items-start gap-2.5 overflow-hidden rounded-2xl border bg-card p-4 text-left shadow-sm transition-shadow hover:shadow-lg sm:p-5"
          >
            <div className={`flex size-11 items-center justify-center rounded-xl bg-linear-to-br ${colors[i % colors.length]} text-white shadow-md`}>
              <Icon className="size-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">{c.title}</div>
              {c.description && <div className="text-xs text-muted-foreground">{c.description}</div>}
            </div>
            <ArrowUpRight className="absolute right-3 top-3 size-4 text-muted-foreground/40 transition-all group-hover:text-emerald-600" />
          </motion.button>
        );
      })}
    </motion.div>
  );
}

// — Promotional Banner — time-boxed promo below the hero cards. ------------
function PromoBanner({
  hero,
  navigate,
  anim,
}: {
  hero?: HeroConfig;
  navigate: (v: any) => void;
  anim: boolean;
}) {
  const mounted = useMounted();
  if (!hero?.promoBannerEnabled) return null;
  // Defer the schedule check until after mount so SSR and the first client
  // render always agree (Date.now() differs between server and client).
  if (mounted && !isWithinSchedule(hero.promoBannerStart, hero.promoBannerEnd)) return null;
  const hasContent = hero.promoBannerTitle?.trim() || hero.promoBannerDesc?.trim();
  if (!hasContent && !hero.promoBannerImage) return null;
  return (
    <motion.section
      initial={anim ? { opacity: 0, y: 18 } : false}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative overflow-hidden rounded-3xl border border-emerald-100 bg-linear-to-br from-emerald-600 to-teal-700 p-6 text-white shadow-xl sm:p-8"
    >
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "22px 22px" }}
      />
      {hero.promoBannerImage && (
        <img
          src={hero.promoBannerImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-30"
        />
      )}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-xl">
          {hero.promoBannerTitle?.trim() && (
            <h3 className="text-xl font-bold sm:text-2xl">{hero.promoBannerTitle}</h3>
          )}
          {hero.promoBannerDesc?.trim() && (
            <p className="mt-1 text-sm text-emerald-50/90 sm:text-base">{hero.promoBannerDesc}</p>
          )}
        </div>
        {hero.promoBannerCtaText?.trim() && (
          <Button
            onClick={() => go(navigate, hero.promoBannerCtaUrl)}
            className="gap-1.5 bg-white text-emerald-700 shadow-lg transition-all hover:-translate-y-0.5 hover:bg-emerald-50"
          >
            {hero.promoBannerCtaText}
            <ArrowRight className="size-4" />
          </Button>
        )}
      </div>
    </motion.section>
  );
}

// =========================================================================

function SectionHeader({
  eyebrow,
  title,
  onAction,
}: {
  eyebrow?: string;
  title: string;
  onAction?: () => void;
}) {
  return (
    <div className="section-header-premium">
      <div>
        {eyebrow && (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-600">
            {eyebrow}
          </p>
        )}
        <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{title}</h2>
      </div>
      {onAction && (
        <Button variant="ghost" size="sm" onClick={onAction} className="btn-premium group gap-1 font-semibold text-primary hover:bg-primary/5">
          View all <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Button>
      )}
    </div>
  );
}

function DualCtaCard({
  icon: Icon,
  title,
  description,
  cta,
  gradient,
  accentBg,
  border,
  onClick,
}: {
  icon: typeof Pill;
  title: string;
  description: string;
  cta: string;
  gradient: string;
  accentBg: string;
  border: string;
  onClick: () => void;
}) {
  return (
    <Card className={`group relative overflow-hidden ${border} bg-linear-to-br ${accentBg} p-0`}>
      <div className="flex items-center gap-4 p-5 sm:p-6">
        <div
          className={`flex size-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br ${gradient} text-white shadow-lg transition-transform group-hover:scale-105`}
        >
          <Icon className="size-7" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{description}</p>
          <Button size="sm" className="mt-2.5 gap-1" onClick={onClick}>
            {cta} <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ComplianceBadge({
  icon: Icon,
  title,
  sub,
}: {
  icon: typeof Pill;
  title: string;
  sub: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-foreground">{title}</p>
        <p className="truncate text-[11px] text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

function Testimonial({
  name,
  text,
  rating,
  location,
  product,
}: {
  name: string;
  text: string;
  rating: number;
  location?: string;
  product?: string;
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <Card className="card-premium-hover h-full gap-3 rounded-2xl border-border/50 p-5 shadow-premium-sm sm:p-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`size-4 ${i < rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
            />
          ))}
        </div>
        <Badge variant="secondary" className="badge-premium gap-1 bg-emerald-50 text-emerald-700">
          <BadgeCheck className="size-3" /> Verified Buyer
        </Badge>
      </div>
      <p className="text-sm font-medium leading-relaxed text-foreground/80 sm:text-[15px]">&ldquo;{text}&rdquo;</p>
      <div className="mt-auto flex items-center gap-3 border-t border-border/50 pt-4">
        <div className="flex size-10 items-center justify-center rounded-full bg-linear-to-br from-emerald-500 to-teal-600 text-sm font-bold text-white shadow-premium-sm">
          {initials}
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-foreground">{name}</span>
          {location && (
            <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
              <MapPin className="size-3" /> {location}
              {product && <span className="ml-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">Bought {product}</span>}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

const ProductGrid = memo(function ProductGrid({ products, loading }: { products?: Product[]; loading: boolean }) {
  // Memoize the slice so we don't allocate a new array on every parent
  // re-render — only when the products reference itself changes (e.g. when
  // the React Query cache updates). Without this, the memo()'d ProductCard
  // children would still receive the same product objects, but the wrapper
  // grid div would re-render and re-run map() needlessly.
  const items = useMemo(() => (products ? products.slice(0, 12) : []), [products]);
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5 lg:gap-5 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    );
  }
  if (items.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5 lg:gap-5 xl:grid-cols-6">
      {items.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
});

// =========================================================================
// MERGED SHOWCASE SECTIONS — three consolidated sections that replace the
// previous 9 separate scrolling strips. Each has a tab toggle so the
// customer can flip between curated product lists without scrolling past
// near-identical grids. Reduces homepage scroll fatigue from ~14 sections
// to ~9, with the same product coverage.
//
// 1. DealsAndBestsellersSection — Today's Deals (countdown + horizontal
//    card strip) + Best Sellers (responsive grid). Consolidates Deals +
//    Best Sellers + Doctor's Choice + Pharmacist Recommended + Top Rated.
// 2. TrendingAndNewSection — Trending Now + New Arrivals. Toggle flips
//    between the two ProductGrids.
// 3. WellnessHubSection — Health Tips (3 daily-rotating cards) + Customer
//    Testimonials (3 verified-buyer reviews), under one shared header.
// =========================================================================

// ---------------------------------------------------------------------------
// 1. Deals & Bestsellers — single section with toggle.
//    The Deals tab reuses the existing DealCard + countdown timer; the
//    Bestsellers tab uses ProductGrid (memoized). When the admin hasn't
//    published any deals, the section auto-falls-back to Bestsellers so
//    there's no empty "Deals" tab.
// ---------------------------------------------------------------------------
function DealsAndBestsellersSection({
  dealsSection,
  bestSellers,
  loading,
  tab,
  setTab,
  onDealProductClick,
  onDealItemClick,
  onShopAllDeals,
  onShopAllBestsellers,
}: {
  dealsSection: { kind: "api"; deals: DealItem[] } | { kind: "curated"; deals: Product[] } | null;
  bestSellers?: Product[];
  loading: boolean;
  tab: "deals" | "bestsellers";
  setTab: (t: "deals" | "bestsellers") => void;
  onDealProductClick: (p: Product) => void;
  onDealItemClick: (d: DealItem) => void;
  onShopAllDeals: () => void;
  onShopAllBestsellers: () => void;
}) {
  const remaining = useCountdownToEndOfDay();
  const hasDeals = dealsSection !== null;
  const hasBestsellers = (bestSellers?.length ?? 0) > 0;

  // Auto-switch to Bestsellers tab when there are no deals to show
  // (e.g. admin hasn't published any and no curated fallback could be
  // built from featured). useEffect avoids a render-phase state update.
  useEffect(() => {
    if (!hasDeals && hasBestsellers && tab === "deals") {
      setTab("bestsellers");
    }
  }, [hasDeals, hasBestsellers, tab, setTab]);

  // Hide entirely when nothing to show on either tab. Don't hide while
  // loading — show skeletons instead so the section doesn't pop in.
  if (!loading && !hasDeals && !hasBestsellers) return null;

  const activeTab = (!hasDeals && hasBestsellers) ? "bestsellers" : tab;

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {/* Header row — SectionHeader (eyebrow + title + View all) + toggle +
          countdown. Kept lightweight (no card border/shadow) so the section
          blends naturally with the rest of the homepage like Trusted Brands. */}
      <div className="section-header-premium flex-wrap gap-3">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            Savings
          </p>
          <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Deals &amp; Bestsellers
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle pill — only render when both tabs are available */}
          {hasDeals && hasBestsellers && (
            <div className="flex gap-1 rounded-full bg-muted/70 p-1" role="tablist" aria-label="Toggle deals and bestsellers">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "deals"}
                onClick={() => setTab("deals")}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  activeTab === "deals"
                    ? "bg-amber-500 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Deals
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "bestsellers"}
                onClick={() => setTab("bestsellers")}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  activeTab === "bestsellers"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Best Sellers
              </button>
            </div>
          )}
          {/* Live countdown — only on Deals tab */}
          {activeTab === "deals" && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 font-mono text-xs font-bold tabular-nums text-white shadow-premium-sm">
              <Clock className="size-3" />
              {remaining !== null ? formatHMS(remaining) : "--:--:--"}
            </span>
          )}
          {/* View all CTA — context-aware per tab */}
          <Button
            variant="ghost"
            size="sm"
            onClick={activeTab === "deals" ? onShopAllDeals : onShopAllBestsellers}
            className="btn-premium group gap-1 font-semibold text-primary hover:bg-primary/5"
          >
            View all
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </div>
      </div>

      {/* Tab content */}
      <div className="relative">
        {activeTab === "deals" && hasDeals ? (
          dealsSection!.kind === "api" ? (
            <DealsStripApi
              deals={dealsSection!.deals as DealItem[]}
              onProductClick={onDealItemClick}
            />
          ) : (
            <DealsStripCurated
              deals={dealsSection!.deals as Product[]}
              onProductClick={onDealProductClick}
            />
          )
        ) : (
          <ProductGrid products={bestSellers} loading={loading && !bestSellers} />
        )}
      </div>
    </motion.section>
  );
}

/** Horizontal scroll strip of DealCards for API deals (no shell wrapper). */
function DealsStripApi({
  deals,
  onProductClick,
}: {
  deals: DealItem[];
  onProductClick: (d: DealItem) => void;
}) {
  return (
    <div className="no-scrollbar -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
      {deals.map((d) => {
        const p = d.product!;
        const mrp = Number(d.originalPrice ?? p.mrp) || 0;
        let finalPrice = Number(d.dealPrice ?? 0) || 0;
        if (!finalPrice && d.discountPct > 0) {
          finalPrice = Number(p.sellingPrice) * (1 - d.discountPct / 100);
        }
        if (!finalPrice) finalPrice = Number(p.sellingPrice) || 0;
        const effDiscPct =
          mrp > finalPrice
            ? Math.round(((mrp - finalPrice) / mrp) * 100)
            : Math.round(d.discountPct || 0);
        return (
          <DealCard
            key={d.id}
            product={{ id: p.id, name: p.name, primaryImage: p.primaryImage, brand: p.brand, images: (p as any).images }}
            mrp={mrp}
            finalPrice={finalPrice}
            effDiscPct={effDiscPct}
            description={d.description}
            onProductClick={() => onProductClick(d)}
          />
        );
      })}
    </div>
  );
}

/** Horizontal scroll strip of DealCards for curated-from-featured deals. */
function DealsStripCurated({
  deals,
  onProductClick,
}: {
  deals: Product[];
  onProductClick: (p: Product) => void;
}) {
  return (
    <div className="no-scrollbar -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
      {deals.map((p) => {
        const mrp = Number(p.mrp) || 0;
        const sellingPrice = Number(p.sellingPrice) || 0;
        const discountPct =
          mrp > sellingPrice
            ? Math.round(((mrp - sellingPrice) / mrp) * 100)
            : Math.round(Number(p.baseDiscountPct) || 0);
        return (
          <DealCard
            key={p.id}
            product={{ id: p.id, name: p.name, primaryImage: p.primaryImage, brand: p.brand, images: (p as any).images }}
            mrp={mrp}
            finalPrice={sellingPrice}
            effDiscPct={discountPct}
            onProductClick={() => onProductClick(p)}
          />
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Trending & New — single section with toggle.
//    Tab "Trending" uses featured.trending; tab "New" uses homeFeed.newArrivals.
//    Both render via ProductGrid (memoized, 12 products, 5-6 per row desktop).
// ---------------------------------------------------------------------------
function TrendingAndNewSection({
  trending,
  newArrivals,
  loading,
  tab,
  setTab,
  onViewAllTrending,
  onViewAllNew,
}: {
  trending?: Product[];
  newArrivals?: Product[];
  loading: boolean;
  tab: "trending" | "new";
  setTab: (t: "trending" | "new") => void;
  onViewAllTrending: () => void;
  onViewAllNew: () => void;
}) {
  const hasTrending = (trending?.length ?? 0) > 0;
  const hasNew = (newArrivals?.length ?? 0) > 0;

  // Auto-switch to "new" tab if trending is empty (rare but possible).
  useEffect(() => {
    if (!hasTrending && hasNew && tab === "trending") {
      setTab("new");
    }
  }, [hasTrending, hasNew, tab, setTab]);

  // Hide entirely when both lists are empty AND not loading.
  if (!loading && !hasTrending && !hasNew) return null;

  const activeTab = (!hasTrending && hasNew) ? "new" : tab;
  const Icon = activeTab === "trending" ? Flame : Sparkles;
  const tintClass = activeTab === "trending"
    ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div className="section-header-premium">
        <div className="flex items-center gap-3">
          <div className={`flex size-10 items-center justify-center rounded-xl ${tintClass} shrink-0`}>
            <Icon className="size-5" />
          </div>
          <div>
            <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-600">
              {activeTab === "trending" ? "Hot right now" : "Just landed"}
            </p>
            <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Trending &amp; New
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle pill — only when both tabs are available */}
          {hasTrending && hasNew && (
            <div className="flex gap-1 rounded-full bg-muted/70 p-1" role="tablist" aria-label="Toggle trending and new arrivals">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "trending"}
                onClick={() => setTab("trending")}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  activeTab === "trending"
                    ? "bg-amber-500 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Trending
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "new"}
                onClick={() => setTab("new")}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  activeTab === "new"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                New
              </button>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={activeTab === "trending" ? onViewAllTrending : onViewAllNew}
            className="btn-premium group gap-1 font-semibold text-primary hover:bg-primary/5"
          >
            View all <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "trending" ? (
        <ProductGrid products={trending} loading={loading && !trending} />
      ) : (
        <ProductGrid products={newArrivals} loading={loading && !newArrivals} />
      )}
    </motion.section>
  );
}

// ---------------------------------------------------------------------------
// 3. Wellness Hub — Health Tips (top) + Testimonials (bottom) under one
//    shared header. Consolidates two previously-separate sections.
// ---------------------------------------------------------------------------
function WellnessHubSection() {
  const navigate = useUI((s) => s.navigate);
  const tips = pickDailyHealthTips(3);

  return (
    <section>
      <SectionHeader eyebrow="Wellness hub" title="Tips & Reviews" />
      <div className="space-y-8">
        {/* Health tips — 3 daily-rotating cards */}
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12 } } }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3"
        >
          {tips.map((tip) => {
            const Icon = HEALTH_TIP_ICONS[tip.icon] ?? Pill;
            return (
              <motion.article
                key={tip.id}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
                }}
                whileHover={{ y: -5 }}
                onClick={() => navigate({ name: "health-tip", tipId: tip.id })}
                className="group flex cursor-pointer flex-col overflow-hidden rounded-3xl border border-border/50 bg-card shadow-premium-sm transition-premium hover:border-emerald-200 hover:shadow-premium-lg"
              >
                <div className={`relative flex h-40 items-center justify-center overflow-hidden bg-gradient-to-br ${tip.gradient} img-zoom-premium`}>
                  <div
                    className="absolute inset-0 opacity-20"
                    style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "18px 18px" }}
                  />
                  <div className="relative flex size-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md transition-transform duration-300 group-hover:scale-110">
                    <Icon className="size-8 text-white" />
                  </div>
                  <Badge className="badge-premium absolute left-3 top-3 border border-white/20 bg-white/20 text-white backdrop-blur-md hover:bg-white/20">
                    Health Tip
                  </Badge>
                  <span className="absolute right-3 top-3 rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                    {tip.readTime} min read
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-5 sm:p-6">
                  <h3 className="text-base font-semibold leading-snug text-foreground transition-colors group-hover:text-emerald-700 sm:text-lg">
                    {tip.title}
                  </h3>
                  <p className="line-clamp-3 break-words text-sm leading-relaxed text-muted-foreground">
                    {tip.shortDescription}
                  </p>
                  <span className="mt-auto flex items-center gap-1 text-sm font-semibold text-emerald-700 transition-colors group-hover:text-emerald-800">
                    Read More
                    <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                </div>
              </motion.article>
            );
          })}
        </motion.div>

        {/* Testimonials — 3 verified-buyer reviews */}
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12 } } }}
          className="no-scrollbar -mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0"
        >
          {[
            {
              name: "Anjali Sharma",
              location: "Krishna Nagar, Mathura",
              product: "Paracetamol",
              text: "Ordered late at night and got delivery by noon next day. Genuine medicines and best price in Mathura!",
              rating: 5,
            },
            {
              name: "Rajeev Verma",
              location: "Vrindavan Road",
              product: "Azithromycin",
              text: "Uploaded my father's prescription and they verified everything. Very professional service.",
              rating: 5,
            },
            {
              name: "Priya Gupta",
              location: "Govind Nagar",
              product: "Vitamin C",
              text: "The coupon WELCOME10 gave me a great discount. Will definitely order again.",
              rating: 4,
            },
          ].map((t) => (
            <motion.div
              key={t.name}
              variants={{
                hidden: { opacity: 0, y: 20 },
                show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
              }}
              className="w-72 shrink-0 snap-start sm:w-auto"
            >
              <Testimonial {...t} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}


/** Recently-viewed section — horizontal scroll strip (localStorage). */
function RecentlyViewedSection() {
  const navigate = useUI((s) => s.navigate);
  const recent = useRecentlyViewed();
  const clearRecent = useClearRecentlyViewed();
  const [cleared, setCleared] = useState(false);
  if (recent.length === 0 || cleared) return null;
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          <Clock className="size-5 text-primary" /> Recently viewed
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              clearRecent();
              setCleared(true);
            }}
            className="gap-1 text-xs text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" /> Clear
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate({ name: "shop" })} className="btn-premium group gap-1 font-semibold text-primary">
            Browse all <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </div>
      </div>
      <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {recent.map((p: RecentProduct) => (
          <button
            key={p.id}
            onClick={() => navigate({ name: "product", productId: p.id, slug: p.slug })}
            className="group flex w-36 shrink-0 flex-col gap-1.5 rounded-2xl border bg-card p-2.5 text-left transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg sm:w-44"
          >
            <div className="relative aspect-square overflow-hidden rounded-xl bg-accent/30">
              <ProductImage
                name={p.name}
                brandName={p.brandName}
                primaryImage={p.primaryImage}
                size="lg"
                className="!h-full !w-full !text-4xl"
              />
            </div>
            {p.brandName && (
              <span className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {p.brandName}
              </span>
            )}
            <span className="line-clamp-2 break-words text-xs font-semibold leading-snug group-hover:text-primary">
              {p.name}
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-bold">{formatCurrency(p.sellingPrice)}</span>
              {p.mrp > p.sellingPrice && (
                <span className="text-[10px] text-muted-foreground line-through">{formatCurrency(p.mrp)}</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Today's Deals — horizontal scroll strip with a live countdown timer.
// Falls back to midnight-end-of-day; purely a UI flourish.
// IMPORTANT: the countdown is initialized to null and only computed after
// mount (in useEffect) to avoid React hydration mismatches. The server
// cannot know the exact millisecond the client will hydrate, so any
// SSR-rendered timer value would differ from the client's first render.
// ---------------------------------------------------------------------------
function useCountdownToEndOfDay(): number | null {
  // During SSR and the first client render, return null (so the timer shows
  // "--:--:--" — no hydration mismatch). After mount, use a mounted flag
  // (via useSyncExternalStore) to switch to the real countdown, and tick
  // every second via an interval callback.
  const mounted = useMounted();
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!mounted) return;
    // Tick every second; setState is called inside the interval callback
    // (not synchronously in the effect body — satisfies the lint rule).
    const id = setInterval(() => setRemaining(msToEndOfDay()), 1000);
    return () => clearInterval(id);
  }, [mounted]);
  // Before mount (SSR + first client render): null. After mount: the
  // interval's value, or msToEndOfDay() as the initial client value.
  if (!mounted) return null;
  return remaining !== null ? remaining : msToEndOfDay();
}

function msToEndOfDay(): number {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return Math.max(0, end.getTime() - now.getTime());
}

function formatHMS(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600).toString().padStart(2, "0");
  const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, "0");
  const s = Math.floor(totalSec % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function DealCard({
  product,
  mrp,
  finalPrice,
  effDiscPct,
  description,
  onProductClick,
}: {
  product: Pick<Product, "id" | "name" | "primaryImage" | "brand"> & {
    brand?: { name: string } | null;
    images?: Array<{ imagePath: string; isPrimary?: boolean; altText?: string | null }>;
  };
  mrp: number;
  finalPrice: number;
  effDiscPct: number;
  description?: string | null;
  onProductClick: () => void;
}) {
  const showStrike = mrp > finalPrice;
  const saveAmt = showStrike ? mrp - finalPrice : 0;
  return (
    <motion.button
      initial={{ opacity: 0, x: 24 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onProductClick}
      className="group flex w-44 shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-amber-200 bg-card text-left shadow-premium-sm transition-premium hover:border-amber-300 hover:shadow-premium-lg sm:w-52"
    >
      <div className="relative aspect-square overflow-hidden bg-accent/30 img-zoom-premium">
        <ProductImage
          name={product.name}
          brandName={product.brand?.name}
          primaryImage={product.primaryImage}
          images={product.images}
          size="xl"
          className="!h-full !w-full !text-6xl transition-transform duration-500 group-hover:scale-105"
        />
        {effDiscPct > 0 && (
          <Badge className="badge-premium absolute left-2 top-2 gap-0.5 bg-amber-500 text-white shadow-sm">
            <Tag className="size-3" />
            {effDiscPct}% OFF
          </Badge>
        )}
        <Badge className="badge-premium absolute right-2 top-2 gap-0.5 bg-emerald-600/90 text-white backdrop-blur-sm">
          <Flame className="size-3" /> Deal
        </Badge>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        {product.brand && (
          <span className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {product.brand.name}
          </span>
        )}
        <h3 className="line-clamp-2 break-words text-xs font-semibold leading-snug text-foreground group-hover:text-emerald-700">
          {product.name}
        </h3>
        {description && (
          <span className="line-clamp-1 text-[10px] italic text-muted-foreground">{description}</span>
        )}
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-base font-bold text-emerald-700">{formatCurrency(finalPrice)}</span>
          {showStrike && (
            <span className="text-xs text-muted-foreground line-through">{formatCurrency(mrp)}</span>
          )}
        </div>
        {saveAmt > 0 && (
          <span className="text-[10px] font-medium text-amber-600">Save {formatCurrency(saveAmt)}</span>
        )}
      </div>
    </motion.button>
  );
}
