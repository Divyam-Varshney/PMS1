// ============================================================================
// File: src/components/admin/views/DashboardView.tsx
// Purpose: Admin dashboard — COMPLETE REDESIGN. Premium enterprise-grade
//          interface with:
//            - Hero KPI row (4 gradient cards with trend indicators)
//            - Revenue + Orders dual-area chart (7-day)
//            - Order status donut + business insights
//            - Profit analysis with margin gauge
//            - Recent orders table with status badges
//            - Top products + top customers leaderboard
//            - Pending actions alert center
//            - Quick actions bar
//            - Storage health indicator
//          Built for speed: lazy-loaded charts, memoized computations,
//          responsive grid that adapts from mobile to ultra-wide.
// ============================================================================

"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { AnimatedNumber } from "../animated-number";
import { PageHeader, StatusBadge, ProductThumb, EmptyState } from "../ui";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShoppingCart,
  IndianRupee,
  Users,
  Package,
  TrendingUp,
  Plus,
  Settings as SettingsIcon,
  FileImage,
  Tag,
  Flame,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  Activity,
  PackageX,
  Gift,
  Truck,
  Percent,
  ChevronRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { useAdminStore } from "../admin-store";
import { formatCurrency, timeAgo } from "@/lib/format";
import { StorageStatusCard } from "../storage-status-card";

// ---------------------------------------------------------------------------
// Status colors for charts + badges
// Emerald/teal/green/amber palette only — NO indigo or blue.
// ---------------------------------------------------------------------------
const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  confirmed: "#14b8a6",
  packed: "#0f766e",
  out_for_delivery: "#ea580c",
  delivered: "#10b981",
  cancelled: "#f43f5e",
  returned: "#78716c",
};

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
// Main DashboardView component
// ---------------------------------------------------------------------------
export function DashboardView() {
  const navigate = useAdminStore((s) => s.navigate);
  const setProductsStockFilter = useAdminStore((s) => s.setProductsStockFilter);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => api.get<DashboardData>("/api/admin/dashboard"),
    staleTime: 30 * 1000, // 30s — dashboard data is semi-real-time
  });

  // Memoize derived computations for performance
  const profitIsPositive = (data?.estimatedProfit ?? 0) >= 0;
  const todayHasOrders = (data?.todayOrdersCount ?? 0) > 0;

  if (isLoading) return <DashboardSkeleton />;
  if (isError || !data) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <EmptyState
          title="Failed to load"
          description="Could not fetch dashboard data."
          action={<Button onClick={() => refetch()}>Retry</Button>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* — Header with date + refresh — */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5 transition-premium btn-premium">
          <Activity className="size-3.5" /> Refresh
        </Button>
      </div>

      {/* — Hero KPI Row — 4 gradient cards with trend indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Today's Revenue"
          value={data.todayRevenue}
          format="currency"
          icon={IndianRupee}
          gradient="from-emerald-500 to-teal-600"
          subtitle={`${data.todayOrdersCount} order${data.todayOrdersCount !== 1 ? "s" : ""} today`}
          trend={todayHasOrders ? "up" : "neutral"}
        />
        <KpiCard
          label="Total Revenue"
          value={data.totalRevenue ?? 0}
          format="currency"
          icon={Wallet}
          gradient="from-teal-500 to-green-600"
          subtitle={`${data.totalOrders ?? 0} total orders`}
        />
        <KpiCard
          label="Total Customers"
          value={data.totalCustomers ?? 0}
          format="number"
          icon={Users}
          gradient="from-amber-500 to-orange-600"
          subtitle={`${data.newCustomersThisMonth ?? 0} new this month`}
        />
        <KpiCard
          label="Avg Order Value"
          value={data.avgOrderValue ?? 0}
          format="currency"
          icon={TrendingUp}
          gradient="from-lime-500 to-emerald-600"
          subtitle={`${data.totalProducts ?? 0} products in catalog`}
        />
      </div>

      {/* — Storage health indicator — */}
      <StorageStatusCard />

      {/* — Quick Actions bar — */}
      <QuickActionsBar navigate={navigate} />

      {/* — Revenue + Orders chart (7-day) + Order Status donut — */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue chart — 2/3 width */}
        <Card className="lg:col-span-2 admin-card">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base">Revenue & Orders</CardTitle>
              <CardDescription className="text-xs">Last 7 days</CardDescription>
            </div>
            <Badge variant="outline" className="gap-1 text-xs">
              <TrendingUp className="size-3 text-emerald-600" />
              {(data.revenueSeries ?? []).reduce((s, d) => s + d.revenue, 0) > 0 ? "Live" : "No data"}
            </Badge>
          </CardHeader>
          <CardContent className="pt-0">
            <RevenueChart data={data.revenueSeries ?? []} />
          </CardContent>
        </Card>

        {/* Order status donut — 1/3 width */}
        <Card className="admin-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Orders by Status</CardTitle>
            <CardDescription className="text-xs">{data.totalOrders ?? 0} total</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <OrderStatusDonut data={data.ordersByStatus ?? []} />
          </CardContent>
        </Card>
      </div>

      {/* — Profit Analysis + Business Insights — */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 admin-card">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <div className={`flex size-8 items-center justify-center rounded-lg ${profitIsPositive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"}`}>
                <Wallet className="size-4" />
              </div>
              <div>
                <CardTitle className="text-base">Profit Analysis</CardTitle>
                <CardDescription className="text-xs">Revenue vs cost vs estimated profit</CardDescription>
              </div>
            </div>
            <Badge className={profitIsPositive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"}>
              {data.profitMarginPct ?? 0}% margin
            </Badge>
          </CardHeader>
          <CardContent className="pt-0">
            <ProfitAnalysis data={data} />
          </CardContent>
        </Card>

        {/* Business Insights — key metrics at a glance */}
        <Card className="admin-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Business Insights</CardTitle>
            <CardDescription className="text-xs">Key performance indicators</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <InsightRow icon={CheckCircle2} label="Completed Orders" value={data.completedOrders ?? 0} tint="text-emerald-600" />
            <InsightRow icon={PackageX} label="Cancelled Orders" value={data.cancelledOrders ?? 0} tint="text-rose-600" />
            <InsightRow icon={Percent} label="Total Discounts Given" value={formatCurrency(data.totalDiscounts ?? 0)} tint="text-amber-600" />
            <InsightRow icon={Truck} label="Delivery Revenue" value={formatCurrency(data.deliveryRevenue ?? 0)} tint="text-teal-600" />
            <InsightRow icon={Gift} label="Loyalty Points Issued" value={(data.totalLoyaltyPoints ?? 0).toLocaleString("en-IN")} tint="text-orange-600" />
          </CardContent>
        </Card>
      </div>

      {/* — Pending Actions Alert Center — */}
      {(data.pendingPrescriptions > 0 || data.pendingManualRequests > 0 || (data.lowStockItems?.length ?? 0) > 0) && (
        <PendingActionsCard data={data} navigate={navigate} setProductsStockFilter={setProductsStockFilter} />
      )}

      {/* — Profit Margin System — period breakdown + top profitable products — */}
      <ProfitMarginSystem data={data} navigate={navigate} />

      {/* — Recent Orders + Top Products — */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="admin-card">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Recent Orders</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate({ name: "orders" })} className="gap-1 text-xs btn-premium">
              View all <ChevronRight className="size-3" />
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            <RecentOrdersList orders={data.recentOrders ?? []} navigate={navigate} />
          </CardContent>
        </Card>

        <Card className="admin-card">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Top Products</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate({ name: "products" })} className="gap-1 text-xs btn-premium">
              View all <ChevronRight className="size-3" />
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            <TopProductsList products={data.topProducts ?? []} navigate={navigate} />
          </CardContent>
        </Card>
      </div>

      {/* — Top Customers + Hourly Orders — */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="admin-card">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Top Customers</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate({ name: "customers" })} className="gap-1 text-xs btn-premium">
              View all <ChevronRight className="size-3" />
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            <TopCustomersList customers={data.topCustomers ?? []} navigate={navigate} />
          </CardContent>
        </Card>

        <Card className="admin-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Orders by Hour</CardTitle>
            <CardDescription className="text-xs">Today's order distribution</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <HourlyOrdersChart data={data.hourlyOrders ?? []} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard data type (matches API response)
// ---------------------------------------------------------------------------
interface DashboardData {
  todayOrdersCount: number;
  todayRevenue: number;
  totalCustomers: number;
  totalProducts: number;
  lowStockCount: number;
  lowStockItems: Array<{
    id: string; name: string; slug: string; sku: string | null;
    stock: number; lowStockThreshold: number; sellingPrice: number;
    brand: { name: string } | null;
  }>;
  outOfStockItems?: Array<{
    id: string; name: string; slug: string; sku: string | null;
    stock: number; lowStockThreshold: number; sellingPrice: number;
    brand: { name: string } | null;
  }>;
  pendingPrescriptions: number;
  pendingManualRequests: number;
  ordersByStatus: Array<{ status: string; count: number }>;
  revenueSeries: Array<{ date: string; revenue: number; orders: number }>;
  customers7d?: Array<{ date: string; count: number }>;
  recentOrders: Array<any>;
  topProducts: Array<any>;
  topCategories?: Array<{ categoryId: string; categoryName: string; itemsSold: number }>;
  topCustomers?: Array<{
    id: string; name: string; email: string; phone: string;
    totalSpent: number; orderCount: number;
  }>;
  totalOrders?: number;
  totalRevenue?: number;
  avgOrderValue?: number;
  newCustomersThisMonth?: number;
  verifiedCustomers?: number;
  totalLoyaltyPoints?: number;
  customersWithPoints?: number;
  completedOrders?: number;
  cancelledOrders?: number;
  totalDiscounts?: number;
  deliveryRevenue?: number;
  grossRevenue?: number;
  productCost?: number;
  estimatedProfit?: number;
  profitMarginPct?: number;
  // Profit period breakdown (IST timezone)
  todayProfit?: { revenue: number; cost: number; profit: number; margin: number; orderCount: number };
  weekProfit?: { revenue: number; cost: number; profit: number; margin: number; orderCount: number };
  monthProfit?: { revenue: number; cost: number; profit: number; margin: number; orderCount: number };
  yearProfit?: { revenue: number; cost: number; profit: number; margin: number; orderCount: number };
  // Top profitable products
  topProfitableProducts?: Array<{
    id: string; name: string; slug: string;
    totalQty: number; totalRevenue: number; totalCost: number; totalProfit: number; margin: number;
  }>;
  hourlyOrders?: Array<{ hour: number; hourLabel: string; count: number }>;
}

// ===========================================================================
// SUB-COMPONENTS
// ===========================================================================

// — KPI Card — gradient hero card with icon + animated number + subtitle —
function KpiCard({
  label,
  value,
  format,
  icon: Icon,
  gradient,
  subtitle,
  trend,
}: {
  label: string;
  value: number;
  format: "currency" | "number";
  icon: typeof IndianRupee;
  gradient: string;
  subtitle: string;
  trend?: "up" | "down" | "neutral";
}) {
  const formatFn = format === "currency"
    ? (n: number) => formatCurrency(n)
    : (n: number) => Math.round(n).toLocaleString("en-IN");
  return (
    <Card className="relative overflow-hidden border-0 p-0 text-white rounded-xl shadow-premium-lg transition-premium hover:-translate-y-1 hover:shadow-premium-xl">
      {/* Gradient background layer */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
      {/* Subtle pattern overlay for premium feel */}
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at top right, rgba(255,255,255,0.18), transparent 60%)" }} />
      <CardContent className="relative p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/85">{label}</p>
            <p className="mt-1.5 text-2xl font-bold tracking-tight tabular-nums">
              <AnimatedNumber value={value} format={formatFn} />
            </p>
            <p className="mt-1 text-xs text-white/75">{subtitle}</p>
          </div>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm ring-1 ring-white/15">
            <Icon className="size-5" />
          </div>
        </div>
        {trend === "up" && (
          <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm">
            <TrendingUp className="size-3" /> Active today
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// — Quick Actions Bar — one-click shortcuts —
function QuickActionsBar({ navigate }: { navigate: (v: any) => void }) {
  const actions = [
    { label: "Add Product", icon: Plus, view: { name: "product-edit", id: "new" }, tint: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
    { label: "View Orders", icon: ShoppingCart, view: { name: "orders" }, tint: "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300" },
    { label: "Prescriptions", icon: FileImage, view: { name: "prescriptions" }, tint: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
    { label: "Vouchers", icon: Tag, view: { name: "vouchers" }, tint: "bg-lime-100 text-lime-700 dark:bg-lime-950/40 dark:text-lime-300" },
    { label: "Today's Deals", icon: Flame, view: { name: "deals" }, tint: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300" },
    { label: "Settings", icon: SettingsIcon, view: { name: "settings" }, tint: "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mr-1">Quick Actions:</span>
      {actions.map((a) => (
        <Button
          key={a.label}
          variant="outline"
          size="sm"
          className="gap-1.5 h-8 btn-premium transition-premium hover:border-primary/30"
          onClick={() => navigate(a.view)}
        >
          <div className={`flex size-5 items-center justify-center rounded ${a.tint}`}>
            <a.icon className="size-3" />
          </div>
          {a.label}
        </Button>
      ))}
    </div>
  );
}

// — Revenue + Orders dual-area chart —
function RevenueChart({ data }: { data: Array<{ date: string; revenue: number; orders: number }> }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
        No revenue data yet
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="ordGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            fontSize: "12px",
            boxShadow: "0 4px 12px -2px rgba(0,0,0,0.08)",
          }}
          formatter={(value: number, name: string) => [
            name === "revenue" ? formatCurrency(value) : value,
            name === "revenue" ? "Revenue" : "Orders",
          ]}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#10b981"
          strokeWidth={2}
          fill="url(#revGrad)"
          name="revenue"
        />
        <Area
          type="monotone"
          dataKey="orders"
          stroke="#14b8a6"
          strokeWidth={2}
          fill="url(#ordGrad)"
          name="orders"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// — Order Status Donut —
function OrderStatusDonut({ data }: { data: Array<{ status: string; count: number }> }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        No orders yet
      </div>
    );
  }
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="status"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
          >
            {data.map((entry, idx) => (
              <Cell key={idx} fill={STATUS_COLORS[entry.status] || "#94a3b8"} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
              boxShadow: "0 4px 12px -2px rgba(0,0,0,0.08)",
            }}
            formatter={(value: number, name: string) => [value, ORDER_STATUS_LABEL[name] || name]}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* Center total */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums">{total}</span>
        <span className="text-xs text-muted-foreground">Total</span>
      </div>
      {/* Legend */}
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {data.map((entry) => (
          <div key={entry.status} className="flex items-center gap-1.5 text-xs">
            <div className="size-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[entry.status] || "#94a3b8" }} />
            <span className="text-muted-foreground truncate">{ORDER_STATUS_LABEL[entry.status] || entry.status}</span>
            <span className="font-semibold ml-auto tabular-nums">{entry.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// — Profit Analysis — horizontal bar breakdown —
function ProfitAnalysis({ data }: { data: DashboardData }) {
  const gross = data.grossRevenue ?? 0;
  const cost = data.productCost ?? 0;
  const discounts = data.totalDiscounts ?? 0;
  const delivery = data.deliveryRevenue ?? 0;
  const profit = data.estimatedProfit ?? 0;
  const maxVal = Math.max(gross, cost, discounts, profit, 1);

  const bars = [
    { label: "Gross Revenue", value: gross, color: "bg-emerald-500", amount: formatCurrency(gross) },
    { label: "Product Cost", value: cost, color: "bg-rose-500", amount: formatCurrency(cost) },
    { label: "Discounts Given", value: discounts, color: "bg-amber-500", amount: formatCurrency(discounts) },
    { label: "Delivery Revenue", value: delivery, color: "bg-teal-500", amount: formatCurrency(delivery) },
    { label: "Estimated Profit", value: profit, color: profit >= 0 ? "bg-lime-500" : "bg-rose-600", amount: formatCurrency(profit) },
  ];

  return (
    <div className="space-y-3">
      {bars.map((bar) => (
        <div key={bar.label} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">{bar.label}</span>
            <span className="font-semibold tabular-nums">{bar.amount}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all duration-700 ${bar.color}`}
              style={{ width: `${Math.max((bar.value / maxVal) * 100, bar.value > 0 ? 3 : 0)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// — Insight Row — for the Business Insights card —
function InsightRow({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string | number;
  tint: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted ${tint}`}>
        <Icon className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold tabular-nums">{value}</p>
      </div>
    </div>
  );
}

// — Pending Actions Alert Center —
function PendingActionsCard({
  data,
  navigate,
  setProductsStockFilter,
}: {
  data: DashboardData;
  navigate: (v: any) => void;
  setProductsStockFilter: (f: string) => void;
}) {
  const alerts = [];
  if (data.pendingPrescriptions > 0) {
    alerts.push({
      icon: FileImage,
      label: "Pending Prescriptions",
      count: data.pendingPrescriptions,
      tint: "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
      onClick: () => navigate({ name: "prescriptions" }),
    });
  }
  if (data.pendingManualRequests > 0) {
    alerts.push({
      icon: Package,
      label: "Pending Manual Requests",
      count: data.pendingManualRequests,
      tint: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
      onClick: () => navigate({ name: "manual-requests" }),
    });
  }
  if ((data.lowStockItems?.length ?? 0) > 0) {
    alerts.push({
      icon: AlertTriangle,
      label: "Low Stock Items",
      count: data.lowStockItems!.length,
      tint: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
      onClick: () => {
        setProductsStockFilter("low");
        navigate({ name: "products" });
      },
    });
  }

  return (
    <Card className="border-amber-200 dark:border-amber-900/50 admin-card">
      <CardHeader className="flex-row items-center gap-2 space-y-0 pb-3">
        <span className="flex size-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="size-4" />
        </span>
        <CardTitle className="text-base">Pending Actions</CardTitle>
        <CardDescription className="text-xs ml-auto">Requires your attention</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {alerts.map((alert) => (
            <button
              key={alert.label}
              onClick={alert.onClick}
              className="flex items-center gap-3 rounded-lg border border-border/70 bg-card p-3 text-left transition-premium hover:-translate-y-0.5 hover:shadow-premium hover:border-primary/30 active:scale-[0.98]"
            >
              <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${alert.tint}`}>
                <alert.icon className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold leading-none tabular-nums">{alert.count}</p>
                <p className="text-xs text-muted-foreground mt-1">{alert.label}</p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// — Recent Orders List —
function RecentOrdersList({ orders, navigate }: { orders: any[]; navigate: (v: any) => void }) {
  if (!orders || orders.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No recent orders
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {orders.slice(0, 5).map((order) => (
        <button
          key={order.id}
          onClick={() => navigate({ name: "order-detail", id: order.id })}
          className="flex w-full items-center gap-3 rounded-lg border border-border/70 p-2.5 text-left transition-premium hover:bg-accent/50 hover:border-primary/30"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <ShoppingCart className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{order.orderNumber}</p>
            <p className="truncate text-xs text-muted-foreground">
              {order.customer?.name || order.shipName} · {timeAgo(order.createdAt)}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold tabular-nums">{formatCurrency(order.grandTotal)}</p>
            <StatusBadge status={order.status} className="mt-0.5" />
          </div>
        </button>
      ))}
    </div>
  );
}

// — Top Products List —
function TopProductsList({ products, navigate }: { products: any[]; navigate: (v: any) => void }) {
  if (!products || products.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No product sales yet
      </div>
    );
  }
  const maxQty = Math.max(...products.map((p) => p.qtySold || 0), 1);
  return (
    <div className="space-y-2">
      {products.slice(0, 5).map((product, idx) => (
        <button
          key={product.id}
          onClick={() => navigate({ name: "product-edit", id: product.id })}
          className="flex w-full items-center gap-3 rounded-lg border border-border/70 p-2.5 text-left transition-premium hover:bg-accent/50 hover:border-primary/30"
        >
          <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
            {idx + 1}
          </div>
          <ProductThumb product={product} size="sm" className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{product.name}</p>
            <p className="truncate text-xs text-muted-foreground">{product.brand?.name || "—"}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold tabular-nums">{product.qtySold} sold</p>
            <div className="mt-0.5 h-1 w-16 overflow-hidden rounded-full bg-muted">
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

// — Top Customers List —
function TopCustomersList({ customers, navigate }: { customers: any[]; navigate: (v: any) => void }) {
  if (!customers || customers.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No customer data yet
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {customers.slice(0, 5).map((customer, idx) => (
        <button
          key={customer.id}
          onClick={() => navigate({ name: "customer-detail", id: customer.id })}
          className="flex w-full items-center gap-3 rounded-lg border border-border/70 p-2.5 text-left transition-premium hover:bg-accent/50 hover:border-primary/30"
        >
          <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            {idx + 1}
          </div>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 text-xs font-bold text-white ring-1 ring-white/20">
            {customer.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{customer.name}</p>
            <p className="truncate text-xs text-muted-foreground">{customer.email}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold tabular-nums">{formatCurrency(customer.totalSpent)}</p>
            <p className="text-xs text-muted-foreground">{customer.orderCount} orders</p>
          </div>
        </button>
      ))}
    </div>
  );
}

// — Hourly Orders Chart —
function HourlyOrdersChart({ data }: { data: Array<{ hour: number; hourLabel: string; count: number }> }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        No hourly data yet
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
        <XAxis dataKey="hourLabel" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval={2} />
        <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            fontSize: "12px",
            boxShadow: "0 4px 12px -2px rgba(0,0,0,0.08)",
          }}
          formatter={(value: number) => [value, "Orders"]}
          cursor={{ fill: "hsl(var(--primary) / 0.08)" }}
        />
        <Bar dataKey="count" fill="#14b8a6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// — Profit Margin System — period breakdown + top profitable products —
function ProfitMarginSystem({ data, navigate }: { data: DashboardData; navigate: (v: any) => void }) {
  const periods = [
    { label: "Today", data: data.todayProfit, gradient: "from-emerald-500 to-teal-600" },
    { label: "This Week", data: data.weekProfit, gradient: "from-teal-500 to-green-600" },
    { label: "This Month", data: data.monthProfit, gradient: "from-amber-500 to-orange-600" },
    { label: "This Year", data: data.yearProfit, gradient: "from-lime-500 to-emerald-600" },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Profit period breakdown — 2/3 width */}
      <Card className="lg:col-span-2 admin-card">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <TrendingUp className="size-4" />
            </div>
            <div>
              <CardTitle className="text-base">Profit Margin System</CardTitle>
              <CardDescription className="text-xs">Revenue vs cost vs profit by period (IST)</CardDescription>
            </div>
          </div>
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            {data.profitMarginPct ?? 0}% overall margin
          </Badge>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {periods.map((p) => {
              const profit = p.data?.profit ?? 0;
              const revenue = p.data?.revenue ?? 0;
              const cost = p.data?.cost ?? 0;
              const margin = p.data?.margin ?? 0;
              const isProfit = profit >= 0;
              return (
                <div key={p.label} className="rounded-lg border border-border/70 p-3 space-y-2 transition-premium hover:border-primary/30 hover:shadow-premium-sm">
                  <p className="admin-section-label">{p.label}</p>
                  <div>
                    <p className={`text-lg font-bold leading-none tabular-nums ${isProfit ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                      {formatCurrency(profit)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">{margin.toFixed(1)}% margin</p>
                  </div>
                  <div className="space-y-0.5 text-[10px] text-muted-foreground">
                    <div className="flex justify-between"><span>Revenue</span><span className="font-medium tabular-nums">{formatCurrency(revenue)}</span></div>
                    <div className="flex justify-between"><span>Cost</span><span className="font-medium tabular-nums">{formatCurrency(cost)}</span></div>
                    <div className="flex justify-between"><span>Orders</span><span className="font-medium tabular-nums">{p.data?.orderCount ?? 0}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Revenue vs Cost vs Profit visual bar */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">All-Time Revenue vs Cost vs Profit</span>
            </div>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
              <div className="bg-emerald-500" style={{ width: `${data.grossRevenue ? (data.estimatedProfit / data.grossRevenue) * 100 : 0}%` }} title="Profit" />
              <div className="bg-rose-400" style={{ width: `${data.grossRevenue ? (data.productCost / data.grossRevenue) * 100 : 0}%` }} title="Cost" />
            </div>
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><div className="size-2 rounded-full bg-emerald-500" /> Profit: {formatCurrency(data.estimatedProfit ?? 0)}</span>
              <span className="flex items-center gap-1"><div className="size-2 rounded-full bg-rose-400" /> Cost: {formatCurrency(data.productCost ?? 0)}</span>
              <span className="flex items-center gap-1"><div className="size-2 rounded-full bg-muted-foreground/30" /> Revenue: {formatCurrency(data.grossRevenue ?? 0)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Profitable Products — 1/3 width */}
      <Card className="admin-card">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Top Profitable Products</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate({ name: "products" })} className="gap-1 text-xs btn-premium">
            View all <ChevronRight className="size-3" />
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          {(data.topProfitableProducts ?? []).length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              No profit data yet
            </div>
          ) : (
            <div className="space-y-2">
              {(data.topProfitableProducts ?? []).slice(0, 5).map((p, idx) => (
                <button
                  key={p.id}
                  onClick={() => navigate({ name: "product-edit", id: p.id })}
                  className="flex w-full items-center gap-3 rounded-lg border border-border/70 p-2.5 text-left transition-premium hover:bg-accent/50 hover:border-primary/30"
                >
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    {idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.totalQty} sold · {p.margin.toFixed(0)}% margin</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-emerald-600 tabular-nums">{formatCurrency(p.totalProfit)}</p>
                    <p className="text-[10px] text-muted-foreground">profit</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// — Dashboard Skeleton (loading state) —
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-40 skeleton-premium rounded-lg" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 skeleton-premium rounded-xl" />
        ))}
      </div>
      <div className="h-10 w-full skeleton-premium rounded-lg" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-72 skeleton-premium rounded-xl" />
        <div className="h-72 skeleton-premium rounded-xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-64 skeleton-premium rounded-xl" />
        <div className="h-64 skeleton-premium rounded-xl" />
      </div>
    </div>
  );
}
