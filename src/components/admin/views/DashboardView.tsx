// ============================================================================
// File: src/components/admin/views/DashboardView.tsx
// Purpose: Admin dashboard — clean, minimal, professional (Shopify/Stripe
//          style). Organized into four labeled sections:
//            1. Business Overview  — headline KPIs (orders, revenue, customers,
//               products)
//            2. Sales & Orders     — pending/delivered counts + 7-day revenue
//               trend sparkline with up/down % + recent orders table
//            3. Inventory          — low-stock alerts + top products
//            4. Recent Activity    — pending prescriptions & medicine requests
//          Every stat is sourced from GET /api/admin/dashboard. Loading state
//          uses skeleton placeholders; empty states use the shared EmptyState.
//          No heavy chart library — the 7-day revenue trend is rendered with a
//          lightweight inline SVG sparkline.
// ============================================================================

"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { AnimatedNumber } from "../animated-number";
import { StatusBadge, EmptyState, ProductThumb } from "../ui";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShoppingCart,
  IndianRupee,
  Users,
  Package,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  AlertTriangle,
  FileImage,
  Pill,
  CheckCircle2,
  Clock,
  ChevronRight,
  PackageX,
  Activity,
} from "lucide-react";
import { useAdminStore } from "../admin-store";
import { formatCurrency, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Status label map — used for the recent-orders status badge fallback
// ---------------------------------------------------------------------------
const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  packed: "Packed",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

// ---------------------------------------------------------------------------
// Dashboard data type — matches the API response shape
// ---------------------------------------------------------------------------
interface DashboardData {
  todayOrdersCount: number;
  todayRevenue: number;
  totalCustomers: number;
  totalProducts: number;
  lowStockCount: number;
  lowStockItems?: Array<{
    id: string; name: string; slug: string; sku: string | null;
    stock: number; lowStockThreshold: number; sellingPrice: number;
    brand: { name: string } | null;
  }>;
  pendingPrescriptions: number;
  pendingManualRequests: number;
  ordersByStatus: Array<{ status: string; count: number }>;
  revenueSeries: Array<{ date: string; revenue: number; orders: number }>;
  recentOrders: Array<any>;
  topProducts: Array<any>;
  totalOrders?: number;
  totalRevenue?: number;
}

// ===========================================================================
// MAIN COMPONENT
// ===========================================================================
export function DashboardView() {
  const navigate = useAdminStore((s) => s.navigate);
  const setProductsStockFilter = useAdminStore((s) => s.setProductsStockFilter);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => api.get<DashboardData>("/api/admin/dashboard"),
    staleTime: 30 * 1000,
  });

  if (isLoading) return <DashboardSkeleton />;
  if (isError || !data) {
    return (
      <div className="space-y-6">
        <DashboardHeader
          refreshing={false}
          onRefresh={() => refetch()}
          lastUpdated={null}
        />
        <EmptyState
          title="Failed to load dashboard"
          description="Could not fetch dashboard data. Please try again."
          action={<Button onClick={() => refetch()}>Retry</Button>}
        />
      </div>
    );
  }

  // Helper: find count of a given status safely.
  const statusCount = (status: string) =>
    data.ordersByStatus?.find((r) => r.status === status)?.count ?? 0;

  const pendingCount = statusCount("pending") + statusCount("confirmed") + statusCount("packed");
  const deliveredCount = statusCount("delivered");

  return (
    <div className="space-y-8">
      <DashboardHeader
        refreshing={isFetching}
        onRefresh={() => refetch()}
        lastUpdated={new Date()}
      />

      {/* ─────────────────────────────────────────────────────────────────
          SECTION 1 — Business Overview
          Headline KPIs at a glance.
      ───────────────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionLabel>Business Overview</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
          <StatCard
            icon={<ShoppingCart className="size-4" />}
            label="Total Orders"
            value={data.totalOrders ?? 0}
            tint="emerald"
          />
          <StatCard
            icon={<Clock className="size-4" />}
            label="Today's Orders"
            value={data.todayOrdersCount}
            tint="teal"
          />
          <StatCard
            icon={<IndianRupee className="size-4" />}
            label="Revenue"
            value={data.totalRevenue ?? 0}
            format="currency"
            tint="emerald"
          />
          <StatCard
            icon={<Users className="size-4" />}
            label="Customers"
            value={data.totalCustomers}
            tint="amber"
          />
          <StatCard
            icon={<Package className="size-4" />}
            label="Products"
            value={data.totalProducts}
            tint="teal"
          />
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          SECTION 2 — Sales & Orders
          Pending + Delivered cards, revenue trend sparkline, recent orders.
      ───────────────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionLabel>Sales & Orders</SectionLabel>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Pending + Delivered — two small cards in one column */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <StatCard
              icon={<Clock className="size-4" />}
              label="Pending"
              value={pendingCount}
              tint="amber"
              onClick={() => navigate({ name: "orders" })}
            />
            <StatCard
              icon={<CheckCircle2 className="size-4" />}
              label="Delivered"
              value={deliveredCount}
              tint="emerald"
              onClick={() => navigate({ name: "orders" })}
            />
          </div>

          {/* Revenue trend sparkline + percentage change */}
          <Card className="lg:col-span-2 admin-card shadow-premium-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Revenue (Last 7 Days)
                  </p>
                  <p className="text-2xl font-semibold tabular-nums mt-1">
                    {formatCurrency(
                      (data.revenueSeries ?? []).reduce((s, d) => s + d.revenue, 0)
                    )}
                  </p>
                </div>
                <RevenueTrendBadge series={data.revenueSeries ?? []} />
              </div>
              <RevenueSparkline series={data.revenueSeries ?? []} />
            </CardContent>
          </Card>
        </div>

        {/* Recent orders table */}
        <Card className="admin-card shadow-premium-sm">
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-border/70 px-5 py-3">
              <div>
                <p className="text-sm font-semibold">Recent Orders</p>
                <p className="text-xs text-muted-foreground">Last 5 orders</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate({ name: "orders" })}
                className="gap-1 text-xs h-8"
              >
                View all <ChevronRight className="size-3.5" />
              </Button>
            </div>
            <RecentOrdersTable orders={data.recentOrders ?? []} navigate={navigate} />
          </CardContent>
        </Card>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          SECTION 3 — Inventory
          Low-stock count card + top products list + low-stock items.
      ───────────────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionLabel>Inventory</SectionLabel>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Low Stock stat card + low-stock items list */}
          <Card className="lg:col-span-2 admin-card shadow-premium-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                    <AlertTriangle className="size-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Low Stock Items
                    </p>
                    <p className="text-2xl font-semibold tabular-nums mt-0.5">
                      <AnimatedNumber value={data.lowStockCount} />
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setProductsStockFilter("low");
                    navigate({ name: "products" });
                  }}
                  className="gap-1 text-xs h-8"
                >
                  View all <ChevronRight className="size-3.5" />
                </Button>
              </div>
              <LowStockList items={data.lowStockItems ?? []} navigate={navigate} />
            </CardContent>
          </Card>

          {/* Top Products */}
          <Card className="admin-card shadow-premium-sm">
            <CardContent className="p-0">
              <div className="flex items-center justify-between border-b border-border/70 px-5 py-3">
                <div>
                  <p className="text-sm font-semibold">Top Products</p>
                  <p className="text-xs text-muted-foreground">By units sold</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate({ name: "products" })}
                  className="gap-1 text-xs h-8"
                >
                  View all <ChevronRight className="size-3.5" />
                </Button>
              </div>
              <TopProductsList products={data.topProducts ?? []} navigate={navigate} />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          SECTION 4 — Recent Activity
          Pending prescriptions + medicine requests needing attention.
      ───────────────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionLabel>Recent Activity</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ActivityCard
            icon={<FileImage className="size-5" />}
            label="Pending Prescriptions"
            count={data.pendingPrescriptions}
            tint="teal"
            emptyHint="No prescriptions pending"
            onClick={() => navigate({ name: "prescriptions" })}
          />
          <ActivityCard
            icon={<Pill className="size-5" />}
            label="Medicine Requests"
            count={data.pendingManualRequests}
            tint="amber"
            emptyHint="No medicine requests pending"
            onClick={() => navigate({ name: "manual-requests" })}
          />
        </div>
      </section>
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
              · Updated {timeAgo(lastUpdated)}
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

// — Section label — small uppercase header for each dashboard section —
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {children}
      </h2>
      <div className="h-px flex-1 bg-border/60" />
    </div>
  );
}

// — Stat card — bordered, soft shadow, icon + count + label —
const TINT_CLASSES: Record<string, string> = {
  emerald:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  teal: "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  cyan: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
};

function StatCard({
  icon,
  label,
  value,
  format = "number",
  tint = "emerald",
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  format?: "currency" | "number";
  tint?: keyof typeof TINT_CLASSES | string;
  onClick?: () => void;
}) {
  const formatFn =
    format === "currency"
      ? (n: number) => formatCurrency(n)
      : (n: number) => Math.round(n).toLocaleString("en-IN");
  const tintCls = TINT_CLASSES[tint] || TINT_CLASSES.emerald;
  const Wrapper: any = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        "group block w-full text-left rounded-xl border border-border/70 bg-card p-4 sm:p-5 shadow-premium-sm transition-premium",
        onClick && "hover:-translate-y-0.5 hover:shadow-premium hover:border-primary/30 cursor-pointer"
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            tintCls
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground truncate">
            {label}
          </p>
          <p className="text-xl font-semibold tabular-nums mt-0.5">
            <AnimatedNumber value={value} format={formatFn} />
          </p>
        </div>
      </div>
    </Wrapper>
  );
}

// — Revenue trend badge — up/down/neutral % vs previous period —
function RevenueTrendBadge({
  series,
}: {
  series: Array<{ date: string; revenue: number; orders: number }>;
}) {
  if (!series || series.length < 2) {
    return (
      <Badge variant="outline" className="gap-1 text-xs">
        <Minus className="size-3 text-muted-foreground" />
        No trend
      </Badge>
    );
  }

  // Compare last 3 days vs previous 3 days (more stable than 1 vs 1)
  const recent = series.slice(-3).reduce((s, d) => s + d.revenue, 0);
  const previous = series.slice(-6, -3).reduce((s, d) => s + d.revenue, 0);

  if (previous === 0) {
    return (
      <Badge variant="outline" className="gap-1 text-xs bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50">
        <Activity className="size-3" />
        Active
      </Badge>
    );
  }

  const pct = ((recent - previous) / previous) * 100;
  const isUp = pct >= 0;
  const isFlat = Math.abs(pct) < 1;

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 text-xs font-medium",
        isFlat
          ? "bg-muted text-muted-foreground border-border"
          : isUp
            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50"
            : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50"
      )}
    >
      {isFlat ? (
        <Minus className="size-3" />
      ) : isUp ? (
        <TrendingUp className="size-3" />
      ) : (
        <TrendingDown className="size-3" />
      )}
      {isFlat ? "Flat" : `${isUp ? "+" : ""}${pct.toFixed(1)}%`}
    </Badge>
  );
}

// — Revenue sparkline — pure SVG, no chart library —
function RevenueSparkline({
  series,
}: {
  series: Array<{ date: string; revenue: number; orders: number }>;
}) {
  if (!series || series.length === 0) {
    return (
      <div className="flex h-[80px] items-center justify-center text-xs text-muted-foreground">
        No revenue data yet
      </div>
    );
  }

  const W = 600;
  const H = 80;
  const PAD = 4;
  const max = Math.max(...series.map((d) => d.revenue), 1);
  const min = Math.min(...series.map((d) => d.revenue), 0);
  const range = max - min || 1;

  const points = series.map((d, i) => {
    const x = PAD + (i / (series.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((d.revenue - min) / range) * (H - PAD * 2);
    return [x, y] as const;
  });

  // Smooth path using simple line segments (clean + minimal)
  const linePath = points
    .map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`))
    .join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1][0]} ${H - PAD} L ${points[0][0]} ${H - PAD} Z`;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-[80px]"
      >
        <defs>
          <linearGradient id="revSparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#revSparkGrad)" />
        <path
          d={linePath}
          fill="none"
          stroke="#10b981"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {points.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={2.5}
            fill="#10b981"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
        {series.map((d, i) => (
          <span key={i} className="tabular-nums">
            {d.date}
          </span>
        ))}
      </div>
    </div>
  );
}

// — Recent orders table — last 5 —
function RecentOrdersTable({
  orders,
  navigate,
}: {
  orders: any[];
  navigate: (v: any) => void;
}) {
  if (!orders || orders.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No recent orders
      </div>
    );
  }
  return (
    <div className="divide-y divide-border/60">
      {orders.slice(0, 5).map((order) => (
        <button
          key={order.id}
          onClick={() => navigate({ name: "order-detail", id: order.id })}
          className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-accent/40"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <ShoppingCart className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{order.orderNumber}</p>
            <p className="truncate text-xs text-muted-foreground">
              {order.customer?.name || order.shipName || "Guest"} · {timeAgo(order.createdAt)}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold tabular-nums">
              {formatCurrency(order.grandTotal)}
            </p>
            <StatusBadge status={order.status} className="mt-0.5" />
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}

// — Top products list — by units sold —
function TopProductsList({
  products,
  navigate,
}: {
  products: any[];
  navigate: (v: any) => void;
}) {
  if (!products || products.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No product sales yet
      </div>
    );
  }
  const maxQty = Math.max(...products.map((p) => p.qtySold || 0), 1);
  return (
    <div className="divide-y divide-border/60">
      {products.slice(0, 5).map((product, idx) => (
        <button
          key={product.id}
          onClick={() => navigate({ name: "product-edit", id: product.id })}
          className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-accent/40"
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
            {idx + 1}
          </span>
          <ProductThumb
            image={product.primaryImage}
            name={product.name}
            brand={product.brand?.name}
            size={32}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{product.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {product.brand?.name || "—"}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold tabular-nums">
              {product.qtySold} sold
            </p>
            <div className="mt-0.5 h-1 w-16 overflow-hidden rounded-full bg-muted ml-auto">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${((product.qtySold || 0) / maxQty) * 100}%` }}
              />
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// — Low stock items list — compact —
function LowStockList({
  items,
  navigate,
}: {
  items: Array<{
    id: string; name: string; slug: string; sku: string | null;
    stock: number; lowStockThreshold: number; sellingPrice: number;
    brand: { name: string } | null;
  }>;
  navigate: (v: any) => void;
}) {
  if (!items || items.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
        <CheckCircle2 className="size-4 mr-1.5 text-emerald-500" />
        All stock levels healthy
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {items.slice(0, 5).map((item) => (
        <button
          key={item.id}
          onClick={() => navigate({ name: "product-edit", id: item.id })}
          className="flex w-full items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-left transition-colors hover:bg-accent/40 hover:border-primary/30"
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            <PackageX className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{item.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {item.brand?.name || "—"}
              {item.sku && <span className="ml-1 font-mono">· {item.sku}</span>}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold tabular-nums text-rose-600 dark:text-rose-400">
              {item.stock} left
            </p>
            <p className="text-[10px] text-muted-foreground">
              threshold {item.lowStockThreshold}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}

// — Activity card — for prescriptions / medicine requests —
function ActivityCard({
  icon,
  label,
  count,
  tint,
  emptyHint,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  tint: keyof typeof TINT_CLASSES;
  emptyHint: string;
  onClick: () => void;
}) {
  const tintCls = TINT_CLASSES[tint] || TINT_CLASSES.emerald;
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-4 rounded-xl border border-border/70 bg-card p-5 text-left shadow-premium-sm transition-premium hover:-translate-y-0.5 hover:shadow-premium hover:border-primary/30"
    >
      <div
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-xl",
          tintCls
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {count > 0 ? (
          <p className="text-2xl font-semibold tabular-nums mt-0.5">
            <AnimatedNumber value={count} />
          </p>
        ) : (
          <p className="text-sm text-muted-foreground mt-1 italic">{emptyHint}</p>
        )}
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

// — Dashboard skeleton (loading state) —
function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-8 w-20" />
      </div>

      <section className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-40 rounded-xl lg:col-span-2" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </section>

      <section className="space-y-3">
        <Skeleton className="h-3 w-24" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-48 rounded-xl lg:col-span-2" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </section>

      <section className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      </section>
    </div>
  );
}
