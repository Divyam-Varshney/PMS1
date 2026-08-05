// ============================================================================
// File: src/components/admin/views/DashboardView.tsx
// Purpose: Admin BI dashboard — Shopify / Stripe style. Clean, premium,
//          lightweight. Surfaces ALL business analytics from
//          GET /api/admin/dashboard/analytics (cached 60s) and AI-powered
//          insights from GET /api/admin/dashboard/ai-insights (cached 5min).
//
//          Sections (top → bottom):
//            1.  Smart Alerts Bar        — AI alert pills
//            2.  Revenue Overview        — 5 cards
//            3.  Profit Analytics        — 4 cards
//            4.  AI Business Insights    — insight cards with colored borders
//            5.  Order Analytics         — 8 status cards
//            6.  Inventory Analytics     — 6 stat cards + low-stock list
//            7.  Customer Analytics      — 5 cards
//            8.  Product Performance     — top 5 by qty
//            9.  Brand & Category        — top 5 each
//            10. Prescription & MR       — 2 cards
//            11. Delivery Analytics      — 3 cards
//            12. Payment Analytics       — method distribution
//            13. AI Sales Forecast       — 3 cards + confidence
//            14. AI Inventory Suggestions
//            15. AI Profit Suggestions
//
//          Design: rounded-xl cards, border-border/50, soft shadow, emerald
//          accent (no indigo/blue except info-border), dark-mode aware.
// ============================================================================

"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api } from "../api";
import { AnimatedNumber } from "../animated-number";
import { EmptyState } from "../ui";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminStore } from "../admin-store";
import { cn } from "@/lib/utils";
import {
  ShoppingCart,
  IndianRupee,
  Users,
  Package,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  PackageX,
  Brain,
  Sparkles,
  Truck,
  CreditCard,
  Percent,
  Wallet,
  FileImage,
  Pill,
  Boxes,
  EyeOff,
  UserPlus,
  UserCheck,
  UserX,
  Trophy,
  Tag,
  Layers,
  ArrowRight,
  Info,
  AlertTriangle,
  XCircle,
  PackageCheck,
  BoxesIcon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// API response shapes
// ---------------------------------------------------------------------------
interface AnalyticsData {
  revenue: {
    today: number;
    yesterday: number;
    week: number;
    month: number;
    year: number;
    trend: number;
  };
  profit: {
    grossProfit: number;
    netProfit: number;
    profitMargin: number;
    avgProfitPerOrder: number;
    totalRevenue: number;
    totalCost: number;
    totalDiscount: number;
  };
  orders: {
    total: number;
    pending: number;
    confirmed: number;
    packed: number;
    out_for_delivery: number;
    delivered: number;
    cancelled: number;
    returned: number;
  };
  customers: {
    total: number;
    newToday: number;
    returning: number;
    active: number;
    inactive: number;
  };
  inventory: {
    total: number;
    active: number;
    draft: number;
    outOfStock: number;
    lowStock: number;
    hidden: number;
    newProducts: number;
    lowStockProducts: Array<{
      id: string;
      name: string;
      stock: number;
      threshold: number;
      price: number;
    }>;
  };
  topProducts: Array<{ id: string; name: string; qty: number; revenue: number; profit: number }>;
  topRevenueProducts: Array<{ id: string; name: string; revenue: number }>;
  topBrands: Array<{ id: string; name: string; revenue: number }>;
  topCategories: Array<{ id: string; name: string; revenue: number }>;
  coupons: { used: number; discountGiven: number };
  prescriptions: { pending: number; approved: number; rejected: number; completed: number };
  manualRequests: { pending: number; completed: number; unavailable: number };
  delivery: { deliveredToday: number; failedDeliveries: number; successRate: number };
  payments: Array<{ method: string; count: number; percentage: number }>;
}

type InsightType = "warning" | "success" | "info" | "danger";

interface AiInsightsData {
  insights: Array<{
    type: InsightType;
    title: string;
    message: string;
    priority: "high" | "medium" | "low";
  }>;
  alerts: Array<{
    level: "warning" | "success" | "info" | "danger";
    icon: string;
    title: string;
    message: string;
    count: number;
  }>;
  forecast: {
    tomorrow: number;
    nextWeek: number;
    nextMonth: number;
    confidence: "high" | "medium" | "low";
  };
  inventorySuggestions: Array<{
    product: string;
    stock: number;
    action: string;
    priority: string;
  }>;
  profitSuggestions: Array<{
    product: string;
    currentMargin: string;
    suggestion: string;
    priority: string;
  }>;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compact Indian Rupee formatter: ₹1,234 (no decimals, en-IN grouping). */
function inr(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (!isFinite(v)) return "₹0";
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

/** Compact number formatter: 1,234 */
function num(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (!isFinite(v)) return "0";
  return Math.round(v).toLocaleString("en-IN");
}

// ===========================================================================
// MAIN COMPONENT
// ===========================================================================
export function DashboardView() {
  const navigate = useAdminStore((s) => s.navigate);
  const setProductsStockFilter = useAdminStore((s) => s.setProductsStockFilter);

  const analyticsQuery = useQuery({
    queryKey: ["admin-dashboard-analytics"],
    queryFn: () => api.get<AnalyticsData>("/api/admin/dashboard/analytics"),
    staleTime: 60 * 1000,
  });

  const aiQuery = useQuery({
    queryKey: ["admin-dashboard-ai-insights"],
    queryFn: () => api.get<AiInsightsData>("/api/admin/dashboard/ai-insights"),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const analytics = analyticsQuery.data;
  const ai = aiQuery.data;
  const analyticsLoading = analyticsQuery.isLoading;
  const aiLoading = aiQuery.isLoading;
  const refreshing = analyticsQuery.isFetching || aiQuery.isFetching;

  // Top-level error — analytics is required; AI is optional/best-effort.
  if (analyticsQuery.isError || (!analytics && !analyticsLoading)) {
    return (
      <div className="space-y-6">
        <DashboardHeader
          refreshing={false}
          onRefresh={() => analyticsQuery.refetch()}
          lastUpdated={null}
        />
        <EmptyState
          icon={<AlertCircle className="size-6" />}
          title="Failed to load dashboard"
          description="Could not fetch analytics. Please try again."
          action={<Button onClick={() => analyticsQuery.refetch()}>Retry</Button>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <DashboardHeader
        refreshing={refreshing}
        onRefresh={() => {
          analyticsQuery.refetch();
          aiQuery.refetch();
        }}
        lastUpdated={new Date()}
      />

      {/* ─────────────────────────────────────────────────────────────────
          1. SMART ALERTS BAR
      ───────────────────────────────────────────────────────────────── */}
      {aiLoading ? (
        <Skeleton className="h-10 w-full rounded-full" />
      ) : (
        ai && ai.alerts && ai.alerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <SmartAlertsBar alerts={ai.alerts} />
          </motion.div>
        )
      )}

      {analyticsLoading || !analytics ? (
        <DashboardSkeleton />
      ) : (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.04 } },
          }}
          className="space-y-8"
        >
          {/* ─────────────────────────────────────────────────────────────
              2. REVENUE OVERVIEW
          ───────────────────────────────────────────────────────────── */}
          <Section title="Revenue Overview">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
              <StatCard
                icon={<IndianRupee className="size-4" />}
                label="Today"
                value={analytics.revenue.today}
                format="currency"
                tint="emerald"
                trend={analytics.revenue.trend}
              />
              <StatCard
                icon={<TrendingUp className="size-4" />}
                label="This Week"
                value={analytics.revenue.week}
                format="currency"
                tint="emerald"
              />
              <StatCard
                icon={<TrendingUp className="size-4" />}
                label="This Month"
                value={analytics.revenue.month}
                format="currency"
                tint="emerald"
              />
              <StatCard
                icon={<Wallet className="size-4" />}
                label="This Year"
                value={analytics.revenue.year}
                format="currency"
                tint="emerald"
              />
              <StatCard
                icon={<Clock className="size-4" />}
                label="Yesterday"
                value={analytics.revenue.yesterday}
                format="currency"
                tint="teal"
              />
            </div>
          </Section>

          {/* ─────────────────────────────────────────────────────────────
              3. PROFIT ANALYTICS
          ───────────────────────────────────────────────────────────── */}
          <Section title="Profit Analytics">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              <StatCard
                icon={<Wallet className="size-4" />}
                label="Net Profit"
                value={analytics.profit.netProfit}
                format="currency"
                tint="emerald"
              />
              <StatCard
                icon={<TrendingUp className="size-4" />}
                label="Gross Profit"
                value={analytics.profit.grossProfit}
                format="currency"
                tint="teal"
              />
              <StatCard
                icon={<Percent className="size-4" />}
                label="Profit Margin"
                value={analytics.profit.profitMargin}
                format="percent"
                tint="amber"
              />
              <StatCard
                icon={<IndianRupee className="size-4" />}
                label="Avg Profit / Order"
                value={analytics.profit.avgProfitPerOrder}
                format="currency"
                tint="emerald"
              />
            </div>
          </Section>

          {/* ─────────────────────────────────────────────────────────────
              4. AI BUSINESS INSIGHTS
          ───────────────────────────────────────────────────────────── */}
          <Section title="AI Business Insights" icon={<Brain className="size-3.5" />}>
            <AiInsightsCard ai={ai} loading={aiLoading} />
          </Section>

          {/* ─────────────────────────────────────────────────────────────
              5. ORDER ANALYTICS
          ───────────────────────────────────────────────────────────── */}
          <Section title="Order Analytics">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <StatCard icon={<ShoppingCart className="size-4" />} label="Total Orders" value={analytics.orders.total} tint="emerald" onClick={() => navigate({ name: "orders" })} />
              <StatCard icon={<Clock className="size-4" />} label="Pending" value={analytics.orders.pending} tint="amber" onClick={() => navigate({ name: "orders" })} />
              <StatCard icon={<CheckCircle2 className="size-4" />} label="Confirmed" value={analytics.orders.confirmed} tint="teal" onClick={() => navigate({ name: "orders" })} />
              <StatCard icon={<Package className="size-4" />} label="Packed" value={analytics.orders.packed} tint="teal" onClick={() => navigate({ name: "orders" })} />
              <StatCard icon={<Truck className="size-4" />} label="Out for Delivery" value={analytics.orders.out_for_delivery} tint="amber" onClick={() => navigate({ name: "orders" })} />
              <StatCard icon={<PackageCheck className="size-4" />} label="Delivered" value={analytics.orders.delivered} tint="emerald" onClick={() => navigate({ name: "orders" })} />
              <StatCard icon={<XCircle className="size-4" />} label="Cancelled" value={analytics.orders.cancelled} tint="rose" onClick={() => navigate({ name: "orders" })} />
              <StatCard icon={<AlertTriangle className="size-4" />} label="Returned" value={analytics.orders.returned} tint="rose" onClick={() => navigate({ name: "orders" })} />
            </div>
          </Section>

          {/* ─────────────────────────────────────────────────────────────
              6. INVENTORY ANALYTICS
          ───────────────────────────────────────────────────────────── */}
          <Section title="Inventory Analytics">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
              <StatCard icon={<Boxes className="size-4" />} label="Total Products" value={analytics.inventory.total} tint="emerald" onClick={() => navigate({ name: "products" })} />
              <StatCard icon={<Package className="size-4" />} label="Active" value={analytics.inventory.active} tint="emerald" onClick={() => navigate({ name: "products" })} />
              <StatCard icon={<PackageX className="size-4" />} label="Out of Stock" value={analytics.inventory.outOfStock} tint="rose" onClick={() => { setProductsStockFilter("out"); navigate({ name: "products" }); }} />
              <StatCard icon={<AlertTriangle className="size-4" />} label="Low Stock" value={analytics.inventory.lowStock} tint="amber" onClick={() => { setProductsStockFilter("low"); navigate({ name: "products" }); }} />
              <StatCard icon={<EyeOff className="size-4" />} label="Hidden" value={analytics.inventory.hidden} tint="teal" onClick={() => navigate({ name: "products" })} />
              <StatCard icon={<Sparkles className="size-4" />} label="New Products" value={analytics.inventory.newProducts} tint="emerald" onClick={() => navigate({ name: "products" })} />
            </div>

            {analytics.inventory.lowStockProducts && analytics.inventory.lowStockProducts.length > 0 && (
              <Card className="admin-card shadow-premium-sm mt-4">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="size-4 text-amber-500" />
                      <p className="text-sm font-semibold">Low Stock Products</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setProductsStockFilter("low"); navigate({ name: "products" }); }}
                      className="gap-1 text-xs h-8"
                    >
                      View all <ArrowRight className="size-3.5" />
                    </Button>
                  </div>
                  <div className="divide-y divide-border/60">
                    {analytics.inventory.lowStockProducts.slice(0, 5).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => navigate({ name: "product-edit", id: p.id })}
                        className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-accent/40"
                      >
                        <div className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-md",
                          p.stock === 0
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                        )}>
                          <PackageX className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{p.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            Threshold: {p.threshold} · {inr(p.price)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className={cn(
                            "text-sm font-semibold tabular-nums",
                            p.stock === 0
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-amber-600 dark:text-amber-400"
                          )}>
                            {p.stock} left
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </Section>

          {/* ─────────────────────────────────────────────────────────────
              7. CUSTOMER ANALYTICS
          ───────────────────────────────────────────────────────────── */}
          <Section title="Customer Analytics">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
              <StatCard icon={<Users className="size-4" />} label="Total Customers" value={analytics.customers.total} tint="emerald" onClick={() => navigate({ name: "customers" })} />
              <StatCard icon={<UserPlus className="size-4" />} label="New Today" value={analytics.customers.newToday} tint="teal" onClick={() => navigate({ name: "customers" })} />
              <StatCard icon={<UserCheck className="size-4" />} label="Returning" value={analytics.customers.returning} tint="emerald" onClick={() => navigate({ name: "customers" })} />
              <StatCard icon={<UserCheck className="size-4" />} label="Active" value={analytics.customers.active} tint="emerald" onClick={() => navigate({ name: "customers" })} />
              <StatCard icon={<UserX className="size-4" />} label="Inactive" value={analytics.customers.inactive} tint="amber" onClick={() => navigate({ name: "customers" })} />
            </div>
          </Section>

          {/* ─────────────────────────────────────────────────────────────
              8. PRODUCT PERFORMANCE
          ───────────────────────────────────────────────────────────── */}
          <Section title="Product Performance">
            <Card className="admin-card shadow-premium-sm">
              <CardContent className="p-0">
                <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Trophy className="size-4 text-emerald-500" />
                    <div>
                      <p className="text-sm font-semibold">Top Products by Quantity</p>
                      <p className="text-xs text-muted-foreground">Best sellers this period</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => navigate({ name: "products" })} className="gap-1 text-xs h-8">
                    View all <ArrowRight className="size-3.5" />
                  </Button>
                </div>
                <TopProductsTable products={analytics.topProducts} navigate={navigate} />
              </CardContent>
            </Card>
          </Section>

          {/* ─────────────────────────────────────────────────────────────
              9. BRAND & CATEGORY ANALYTICS
          ───────────────────────────────────────────────────────────── */}
          <Section title="Brand & Category Analytics">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <RankCard
                title="Top Brands"
                icon={<Tag className="size-4 text-emerald-500" />}
                items={analytics.topBrands.map((b) => ({ id: b.id, name: b.name, value: b.revenue }))}
                format="currency"
              />
              <RankCard
                title="Top Categories"
                icon={<Layers className="size-4 text-emerald-500" />}
                items={analytics.topCategories.map((c) => ({ id: c.id, name: c.name, value: c.revenue }))}
                format="currency"
              />
            </div>
          </Section>

          {/* ─────────────────────────────────────────────────────────────
              10. PRESCRIPTION & MEDICINE REQUESTS
          ───────────────────────────────────────────────────────────── */}
          <Section title="Prescription & Medicine Requests">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ActivitySummaryCard
                icon={<FileImage className="size-5" />}
                tint="teal"
                title="Prescriptions"
                stats={[
                  { label: "Pending", value: analytics.prescriptions.pending, tone: "amber" },
                  { label: "Approved", value: analytics.prescriptions.approved, tone: "emerald" },
                  { label: "Rejected", value: analytics.prescriptions.rejected, tone: "rose" },
                  { label: "Completed", value: analytics.prescriptions.completed, tone: "emerald" },
                ]}
                onClick={() => navigate({ name: "prescriptions" })}
              />
              <ActivitySummaryCard
                icon={<Pill className="size-5" />}
                tint="amber"
                title="Medicine Requests"
                stats={[
                  { label: "Pending", value: analytics.manualRequests.pending, tone: "amber" },
                  { label: "Completed", value: analytics.manualRequests.completed, tone: "emerald" },
                  { label: "Unavailable", value: analytics.manualRequests.unavailable, tone: "rose" },
                ]}
                onClick={() => navigate({ name: "manual-requests" })}
              />
            </div>
          </Section>

          {/* ─────────────────────────────────────────────────────────────
              11. DELIVERY ANALYTICS
          ───────────────────────────────────────────────────────────── */}
          <Section title="Delivery Analytics">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              <StatCard icon={<PackageCheck className="size-4" />} label="Delivered Today" value={analytics.delivery.deliveredToday} tint="emerald" />
              <StatCard icon={<XCircle className="size-4" />} label="Failed Deliveries" value={analytics.delivery.failedDeliveries} tint="rose" />
              <StatCard icon={<Truck className="size-4" />} label="Success Rate" value={analytics.delivery.successRate} format="percent" tint="emerald" />
            </div>
          </Section>

          {/* ─────────────────────────────────────────────────────────────
              12. PAYMENT ANALYTICS
          ───────────────────────────────────────────────────────────── */}
          <Section title="Payment Analytics">
            <Card className="admin-card shadow-premium-sm">
              <CardContent className="p-0">
                <div className="flex items-center gap-2 border-b border-border/60 px-5 py-3">
                  <CreditCard className="size-4 text-emerald-500" />
                  <p className="text-sm font-semibold">Payment Method Distribution</p>
                </div>
                <PaymentDistribution payments={analytics.payments} />
              </CardContent>
            </Card>
          </Section>

          {/* ─────────────────────────────────────────────────────────────
              13. AI SALES FORECAST
          ───────────────────────────────────────────────────────────── */}
          <Section title="AI Sales Forecast" icon={<Brain className="size-3.5" />}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              <ForecastCard label="Tomorrow" value={ai?.forecast?.tomorrow ?? 0} />
              <ForecastCard label="Next Week" value={ai?.forecast?.nextWeek ?? 0} />
              <ForecastCard label="Next Month" value={ai?.forecast?.nextMonth ?? 0} />
            </div>
            {ai?.forecast?.confidence && (
              <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                <Sparkles className="size-3.5 text-emerald-500" />
                <span>
                  Confidence:{" "}
                  <Badge variant="outline" className="ml-1 capitalize text-[10px]">
                    {ai.forecast.confidence}
                  </Badge>
                </span>
              </div>
            )}
          </Section>

          {/* ─────────────────────────────────────────────────────────────
              14. AI INVENTORY SUGGESTIONS
          ───────────────────────────────────────────────────────────── */}
          <Section title="AI Inventory Suggestions" icon={<Brain className="size-3.5" />}>
            <SuggestionCard
              loading={aiLoading}
              empty={!ai || !ai.inventorySuggestions || ai.inventorySuggestions.length === 0}
              emptyTitle="No restock suggestions"
              emptyDescription="All products are well-stocked."
              icon={<BoxesIcon className="size-6" />}
            >
              {ai?.inventorySuggestions?.map((s, i) => (
                <SuggestionRow
                  key={`inv-${i}`}
                  title={s.product}
                  badge={s.priority}
                  badgeTone={s.priority === "urgent" ? "rose" : "amber"}
                  description={`${s.action} · ${s.stock} in stock`}
                />
              ))}
            </SuggestionCard>
          </Section>

          {/* ─────────────────────────────────────────────────────────────
              15. AI PROFIT SUGGESTIONS
          ───────────────────────────────────────────────────────────── */}
          <Section title="AI Profit Suggestions" icon={<Brain className="size-3.5" />}>
            <SuggestionCard
              loading={aiLoading}
              empty={!ai || !ai.profitSuggestions || ai.profitSuggestions.length === 0}
              emptyTitle="No margin improvements needed"
              emptyDescription="All products have healthy profit margins."
              icon={<Percent className="size-6" />}
            >
              {ai?.profitSuggestions?.map((s, i) => (
                <SuggestionRow
                  key={`prof-${i}`}
                  title={s.product}
                  badge={`Margin ${s.currentMargin}`}
                  badgeTone="amber"
                  description={s.suggestion}
                />
              ))}
            </SuggestionCard>
          </Section>
        </motion.div>
      )}
    </div>
  );
}

// ===========================================================================
// SUB-COMPONENTS
// ===========================================================================

// — Header — title + date + refresh button —
function DashboardHeader({
  refreshing,
  onRefresh,
  lastUpdated,
}: {
  refreshing: boolean;
  onRefresh: () => void;
  lastUpdated: Date | null;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {new Date().toLocaleDateString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          {lastUpdated && (
            <span className="ml-2 text-xs text-muted-foreground/70">
              · Updated {lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={refreshing}
        className="gap-1.5 h-8"
      >
        <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
        Refresh
      </Button>
    </div>
  );
}

// — Section wrapper — uppercase label + content —
function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      variants={{
        hidden: { opacity: 0, y: 8 },
        show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
      }}
      className="space-y-3"
    >
      <div className="flex items-center gap-2">
        {icon && <span className="text-emerald-500">{icon}</span>}
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        <div className="h-px flex-1 bg-border/60" />
      </div>
      {children}
    </motion.section>
  );
}

// — Tint palette for icon backgrounds (emerald-centric, no indigo/blue) —
const TINT_CLASSES: Record<string, string> = {
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  teal: "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  cyan: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
};

// — Stat card — bordered, soft shadow, icon + value + label + optional trend —
function StatCard({
  icon,
  label,
  value,
  format = "number",
  tint = "emerald",
  trend,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  format?: "currency" | "number" | "percent";
  tint?: keyof typeof TINT_CLASSES | string;
  trend?: number;
  onClick?: () => void;
}) {
  const formatFn =
    format === "currency"
      ? (n: number) => inr(n)
      : format === "percent"
        ? (n: number) => `${Math.round(n)}%`
        : (n: number) => num(n);
  const tintCls = TINT_CLASSES[tint] || TINT_CLASSES.emerald;
  const Wrapper: any = onClick ? "button" : "div";

  // Trend badge — only show when trend is a meaningful number
  let trendBadge: React.ReactNode = null;
  if (typeof trend === "number" && isFinite(trend)) {
    const isFlat = Math.abs(trend) < 1;
    const isUp = trend >= 0;
    trendBadge = (
      <Badge
        variant="outline"
        className={cn(
          "gap-1 text-[10px] font-medium h-5 px-1.5",
          isFlat
            ? "bg-muted text-muted-foreground border-border"
            : isUp
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50"
              : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50"
        )}
      >
        {isFlat ? <Minus className="size-3" /> : isUp ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
        {isFlat ? "Flat" : `${isUp ? "+" : ""}${trend.toFixed(1)}%`}
      </Badge>
    );
  }

  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        "group block w-full text-left rounded-xl border border-border/50 bg-card p-4 sm:p-5 shadow-premium-sm transition-premium",
        onClick && "hover:-translate-y-0.5 hover:shadow-premium hover:border-primary/30 cursor-pointer"
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", tintCls)}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground truncate">
            {label}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xl font-semibold tabular-nums">
              <AnimatedNumber value={value} format={formatFn} />
            </p>
            {trendBadge}
          </div>
        </div>
      </div>
    </Wrapper>
  );
}

// — Smart Alerts Bar — horizontal row of pills —
const ALERT_TONE: Record<string, { cls: string; dot: string }> = {
  danger: {
    cls: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50",
    dot: "bg-rose-500",
  },
  warning: {
    cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50",
    dot: "bg-amber-500",
  },
  success: {
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50",
    dot: "bg-emerald-500",
  },
  info: {
    cls: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900/50",
    dot: "bg-teal-500",
  },
};

function SmartAlertsBar({
  alerts,
}: {
  alerts: Array<{
    level: "warning" | "success" | "info" | "danger";
    icon: string;
    title: string;
    message: string;
    count: number;
  }>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {alerts.map((a, i) => {
        const tone = ALERT_TONE[a.level] || ALERT_TONE.info;
        return (
          <div
            key={i}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs",
              tone.cls
            )}
          >
            <span className="text-sm leading-none">{a.icon}</span>
            <span className="font-semibold">{a.title}</span>
            <span className="opacity-80 hidden sm:inline">· {a.message}</span>
            {a.count > 0 && (
              <span className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-white/60 dark:bg-black/20 px-1.5 text-[10px] font-bold tabular-nums">
                {a.count}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// — AI Insights Card — list of insights with colored left borders —
const INSIGHT_BORDER: Record<InsightType, string> = {
  success: "border-l-emerald-500",
  warning: "border-l-amber-500",
  danger: "border-l-rose-500",
  info: "border-l-sky-500",
};

const INSIGHT_ICON: Record<InsightType, { icon: React.ReactNode; cls: string }> = {
  success: {
    icon: <CheckCircle2 className="size-4" />,
    cls: "text-emerald-500",
  },
  warning: {
    icon: <AlertTriangle className="size-4" />,
    cls: "text-amber-500",
  },
  danger: {
    icon: <XCircle className="size-4" />,
    cls: "text-rose-500",
  },
  info: {
    icon: <Info className="size-4" />,
    cls: "text-sky-500",
  },
};

const PRIORITY_BADGE: Record<string, string> = {
  high: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  low: "bg-muted text-muted-foreground",
};

function AiInsightsCard({
  ai,
  loading,
}: {
  ai: AiInsightsData | undefined;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card className="admin-card shadow-premium-sm">
        <CardContent className="p-5 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!ai || !ai.insights || ai.insights.length === 0) {
    return (
      <Card className="admin-card shadow-premium-sm">
        <CardContent className="p-5">
          <EmptyState
            icon={<Brain className="size-6" />}
            title="No AI insights available"
            description={ai?.error || "AI insights will appear here once data is processed."}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="admin-card shadow-premium-sm">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="size-4 text-emerald-500" />
          <p className="text-sm font-semibold">AI-Generated Business Insights</p>
          <Badge variant="outline" className="ml-auto text-[10px] text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:border-emerald-900/50">
            Powered by AI
          </Badge>
        </div>
        <div className="space-y-2.5">
          {ai.insights.map((ins, i) => {
            const meta = INSIGHT_ICON[ins.type] || INSIGHT_ICON.info;
            const border = INSIGHT_BORDER[ins.type] || INSIGHT_BORDER.info;
            return (
              <div
                key={i}
                className={cn(
                  "flex gap-3 rounded-lg border border-border/50 border-l-4 bg-muted/20 p-3",
                  border
                )}
              >
                <div className={cn("mt-0.5 shrink-0", meta.cls)}>{meta.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold">{ins.title}</p>
                    {ins.priority && (
                      <span className={cn(
                        "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        PRIORITY_BADGE[ins.priority] || PRIORITY_BADGE.low
                      )}>
                        {ins.priority}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{ins.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// — Top Products Table — name + qty + revenue + profit —
function TopProductsTable({
  products,
  navigate,
}: {
  products: AnalyticsData["topProducts"];
  navigate: (v: any) => void;
}) {
  if (!products || products.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        <InboxEmpty />
      </div>
    );
  }
  const maxQty = Math.max(...products.map((p) => p.qty || 0), 1);
  return (
    <div className="divide-y divide-border/60">
      {products.slice(0, 5).map((product, idx) => (
        <button
          key={product.id}
          onClick={() => navigate({ name: "product-edit", id: product.id })}
          className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-accent/40"
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            {idx + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{product.name}</p>
            <div className="mt-1 h-1.5 w-full max-w-[180px] overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${((product.qty || 0) / maxQty) * 100}%` }}
              />
            </div>
          </div>
          <div className="shrink-0 grid grid-cols-3 gap-4 text-right">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Qty</p>
              <p className="text-sm font-semibold tabular-nums">{product.qty}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Revenue</p>
              <p className="text-sm font-semibold tabular-nums">{inr(product.revenue)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Profit</p>
              <p className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{inr(product.profit)}</p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// — Empty inbox message (inline) —
function InboxEmpty() {
  return <span className="italic">No product sales yet</span>;
}

// — Rank Card — generic top-N list with name + value + bar —
function RankCard({
  title,
  icon,
  items,
  format,
}: {
  title: string;
  icon: React.ReactNode;
  items: Array<{ id: string; name: string; value: number }>;
  format: "currency" | "number";
}) {
  const max = Math.max(...items.map((i) => i.value || 0), 1);
  return (
    <Card className="admin-card shadow-premium-sm">
      <CardContent className="p-0">
        <div className="flex items-center gap-2 border-b border-border/60 px-5 py-3">
          {icon}
          <p className="text-sm font-semibold">{title}</p>
          <span className="ml-auto text-xs text-muted-foreground">By revenue</span>
        </div>
        {items.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground italic">
            No data yet
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {items.slice(0, 5).map((item, idx) => (
              <div key={item.id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <div className="mt-1 h-1 w-full max-w-[160px] overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${((item.value || 0) / max) * 100}%` }}
                    />
                  </div>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums">
                  {format === "currency" ? inr(item.value) : num(item.value)}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// — Activity Summary Card — for prescriptions / medicine requests —
function ActivitySummaryCard({
  icon,
  tint,
  title,
  stats,
  onClick,
}: {
  icon: React.ReactNode;
  tint: keyof typeof TINT_CLASSES;
  title: string;
  stats: Array<{ label: string; value: number; tone: "emerald" | "amber" | "rose" }>;
  onClick: () => void;
}) {
  const tintCls = TINT_CLASSES[tint] || TINT_CLASSES.emerald;
  const toneDot: Record<string, string> = {
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
  };
  return (
    <button
      onClick={onClick}
      className="group flex flex-col w-full text-left rounded-xl border border-border/50 bg-card p-5 shadow-premium-sm transition-premium hover:-translate-y-0.5 hover:shadow-premium hover:border-primary/30"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", tintCls)}>
          {icon}
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="text-sm font-semibold mt-0.5">Status breakdown</p>
        </div>
        <ArrowRight className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-border/40 bg-muted/20 p-3">
            <div className="flex items-center gap-1.5">
              <span className={cn("size-1.5 rounded-full", toneDot[s.tone])} />
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
            </div>
            <p className="text-lg font-semibold tabular-nums mt-1">
              <AnimatedNumber value={s.value} />
            </p>
          </div>
        ))}
      </div>
    </button>
  );
}

// — Payment Distribution — list with progress bars —
function PaymentDistribution({
  payments,
}: {
  payments: AnalyticsData["payments"];
}) {
  if (!payments || payments.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground italic">
        No payment data yet
      </div>
    );
  }
  const max = Math.max(...payments.map((p) => p.count || 0), 1);
  return (
    <div className="divide-y divide-border/60">
      {payments.map((p) => (
        <div key={p.method} className="flex items-center gap-3 px-5 py-3">
          <CreditCard className="size-4 shrink-0 text-emerald-500" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-medium capitalize">{(p.method || "unknown").replace(/_/g, " ")}</p>
              <p className="text-sm font-semibold tabular-nums">{p.percentage}%</p>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${(p.count / max) * 100}%` }}
              />
            </div>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{p.count} orders</span>
        </div>
      ))}
    </div>
  );
}

// — Forecast Card — single forecast metric —
function ForecastCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="admin-card shadow-premium-sm">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <TrendingUp className="size-4" />
          </div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
        </div>
        <p className="text-2xl font-semibold tabular-nums">
          <AnimatedNumber value={value} format={(n) => inr(n)} />
        </p>
        <p className="text-xs text-muted-foreground mt-1">Forecasted revenue</p>
      </CardContent>
    </Card>
  );
}

// — Suggestion Card — generic wrapper for AI suggestion lists —
function SuggestionCard({
  loading,
  empty,
  emptyTitle,
  emptyDescription,
  icon,
  children,
}: {
  loading: boolean;
  empty: boolean;
  emptyTitle: string;
  emptyDescription: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  if (loading) {
    return (
      <Card className="admin-card shadow-premium-sm">
        <CardContent className="p-5 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }
  if (empty) {
    return (
      <Card className="admin-card shadow-premium-sm">
        <CardContent className="p-5">
          <EmptyState icon={icon} title={emptyTitle} description={emptyDescription} />
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="admin-card shadow-premium-sm">
      <CardContent className="p-5 space-y-2.5">{children}</CardContent>
    </Card>
  );
}

// — Suggestion Row — single inventory/profit suggestion —
function SuggestionRow({
  title,
  description,
  badge,
  badgeTone,
}: {
  title: string;
  description: string;
  badge: string;
  badgeTone: "rose" | "amber" | "emerald";
}) {
  const toneCls: Record<string, string> = {
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  };
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/20 p-3">
      <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", toneCls[badgeTone])}>
        <Sparkles className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold truncate">{title}</p>
          <span className={cn(
            "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide capitalize",
            toneCls[badgeTone]
          )}>
            {badge}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}

// — Dashboard skeleton (loading state) —
function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Alerts bar */}
      <Skeleton className="h-10 w-full rounded-full" />

      {/* Revenue Overview */}
      <section className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </section>

      {/* Profit Analytics */}
      <section className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </section>

      {/* AI Insights */}
      <section className="space-y-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-64 rounded-xl" />
      </section>

      {/* Order Analytics */}
      <section className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </section>

      {/* Inventory */}
      <section className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </section>

      {/* Customers */}
      <section className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </section>

      {/* Products */}
      <section className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-72 rounded-xl" />
      </section>

      {/* Brand & Category */}
      <section className="space-y-3">
        <Skeleton className="h-3 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </section>

      {/* Prescription & MR */}
      <section className="space-y-3">
        <Skeleton className="h-3 w-56" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </section>

      {/* Delivery */}
      <section className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </section>

      {/* Payments */}
      <section className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-64 rounded-xl" />
      </section>

      {/* Forecast */}
      <section className="space-y-3">
        <Skeleton className="h-3 w-40" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </section>

      {/* AI Suggestions */}
      <section className="space-y-3">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-56 rounded-xl" />
      </section>
      <section className="space-y-3">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-56 rounded-xl" />
      </section>
    </div>
  );
}
