// ============================================================================
// File: src/components/customer/account-view.tsx
// Purpose: Customer account dashboard. Profile summary, savings tracker,
//          quick stats, recent activity, buy-again, quick actions, refills.
// Role: Hub for the logged-in customer.
// ============================================================================

"use client";

import { useRequireAuth } from "./use-require-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Package,
  MapPin,
  FileText,
  Heart,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Mail,
  Phone,
  CheckCircle2,
  ShoppingBag,
  BellRing,
  User as UserIcon,
  Repeat,
  PiggyBank,
  Award,
  Truck,
  Clock,
  FileText as RxIcon,
  ClipboardList,
  AlarmClock,
  RefreshCw,
  Clock3,
} from "lucide-react";
import { useUI } from "@/lib/store";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { api, qk, UnifiedHistoryResponse } from "./api";
import { getInitials, formatDate, formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ProductImage } from "@/components/shared/product-image";
import { NotificationPreferences } from "./notification-preferences";

export function AccountView() {
  const { customer, isLoading } = useRequireAuth();
  const navigate = useUI((s) => s.navigate);
  const qc = useQueryClient();

  // Wishlist count for the stats card (declared before any early return so
  // hook order stays stable across renders).
  const { data: wishlist } = useQuery({
    queryKey: qk.wishlist,
    queryFn: () => api<{ items: { id: string }[] } | null>("/api/wishlist").catch(() => null),
    enabled: !!customer,
  });
  const wishlistCount = wishlist?.items?.length ?? 0;

  // Stock alert subscription count
  const { data: stockAlerts } = useQuery({
    queryKey: qk.stockAlerts,
    queryFn: () => api<{ items: { id: string }[] } | null>("/api/stock-subscriptions").catch(() => null),
    enabled: !!customer,
  });
  const stockAlertCount = stockAlerts?.items?.length ?? 0;

  // Active medicine reminders count (for the account dashboard stat card)
  const { data: remindersData } = useQuery({
    queryKey: qk.reminders,
    queryFn: () => api<{ items: { id: string; isActive: boolean }[] } | null>("/api/customer/reminders").catch(() => null),
    enabled: !!customer,
  });
  const activeRemindersCount = (remindersData?.items ?? []).filter((r) => r.isActive).length;

  // Prescription refill reminders — upcoming + overdue count for the dashboard card.
  const { data: refillData } = useQuery({
    queryKey: qk.refillReminders,
    queryFn: () => api<{ items: any[] } | null>("/api/customer/refill-reminders").catch(() => null),
    enabled: !!customer,
  });
  const refillItems = refillData?.items ?? [];
  const refillDueCount = refillItems.filter((r) => {
    const due = new Date(r.nextRefillDate).getTime();
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    return due - now <= sevenDays; // due within 7 days OR overdue
  }).length;

  // Snooze mutation — postpones nextRefillDate by 7 days via PATCH.
  const snoozeMutation = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/api/customer/refill-reminders/${id}`, { snoozeDays: 7 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.refillReminders });
      toast.success("Snoozed 7 days", {
        description: "We'll remind you again next week.",
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Frequently reordered products (Buy Again)
  const { data: buyAgainData } = useQuery({
    queryKey: ["customer", "frequently-reordered"],
    queryFn: () => api<{ items: any[] } | null>("/api/customer/frequently-reordered").catch(() => null),
    enabled: !!customer,
  });
  const buyAgainItems = (buyAgainData?.items ?? []).slice(0, 4);

  // Customer stats (savings, total spent, items purchased)
  const { data: stats } = useQuery({
    queryKey: ["customer", "stats"],
    queryFn: () => api<{
      totalSavings: number;
      totalSpent: number;
      totalOrders: number;
      avgOrderValue: number;
      totalItemsPurchased: number;
      loyaltyPoints: number;
      loyaltyPointsValue: number;
    } | null>("/api/customer/stats").catch(() => null),
    enabled: !!customer,
  });

  // Recent activity — last 3 items (orders / prescriptions / requests) for the
  // dashboard preview. Uses the unified history endpoint so all types show.
  const { data: recentHistory, isLoading: recentLoading } = useQuery({
    queryKey: qk.history,
    queryFn: () => api<UnifiedHistoryResponse | null>("/api/customer/history").catch(() => null),
    enabled: !!customer,
    staleTime: 30 * 1000,
  });
  const recentItems = (recentHistory?.items ?? []).slice(0, 3);

  // -- Loading state — premium skeleton dashboard.
  if (isLoading) {
    return <AccountSkeleton />;
  }

  if (!customer) {
    // useRequireAuth handles redirect in an effect
    return null;
  }

  const onLogout = async () => {
    await api.post("/api/auth/logout");
    qc.invalidateQueries({ queryKey: qk.me });
    qc.invalidateQueries({ queryKey: qk.cart });
    toast.success("Logged out");
    navigate({ name: "home" });
  };

  const me = customer;

  // Each quick-link gets a distinct color theme so the icons are visually
  // distinguishable at a glance. The palette stays in the emerald/teal/amber
  // family — no indigo or blue.
  const links = [
    {
      label: "My Orders",
      description: "View and track your past orders",
      icon: Package,
      onClick: () => navigate({ name: "orders" }),
      stat: me._count?.orders ?? 0,
      tint: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    },
    {
      label: "Addresses",
      description: "Manage your saved delivery addresses",
      icon: MapPin,
      onClick: () => navigate({ name: "addresses" }),
      stat: customer.addresses?.length ?? 0,
      tint: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
    },
    {
      label: "My Wishlist",
      description: "Your saved products, ready to reorder",
      icon: Heart,
      onClick: () => navigate({ name: "wishlist" }),
      stat: wishlistCount,
      tint: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
    },
    {
      label: "Stock Alerts",
      description: "Get notified when out-of-stock items return",
      icon: BellRing,
      onClick: () => navigate({ name: "stock-alerts" }),
      stat: stockAlertCount,
      tint: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    },
    {
      label: "Medicine Reminders",
      description: "Schedule daily medicine reminders",
      icon: AlarmClock,
      onClick: () => navigate({ name: "reminders" }),
      stat: activeRemindersCount,
      tint: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    },
    {
      label: "Profile & Settings",
      description: "Update name, phone, and account details",
      icon: UserIcon,
      onClick: () => navigate({ name: "profile" }),
      tint: "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
    },
    {
      label: "Upload Prescription",
      description: "Send a new prescription to our pharmacist",
      icon: FileText,
      onClick: () => navigate({ name: "prescription" }),
      tint: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
    },
    {
      label: "Request Medicines",
      description: "Can't find it? Type and request",
      icon: ShoppingBag,
      onClick: () => navigate({ name: "manual-request" }),
      tint: "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
    },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Section heading */}
      <div className="mb-5 flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My Account</h1>
        <p className="text-sm text-muted-foreground">
          Manage your orders, addresses, prescriptions, and reminders.
        </p>
      </div>

      {/* ── Profile summary ─────────────────────────────────────────────── */}
      <Card className="mb-4 gap-4 overflow-hidden rounded-xl border-border/50 bg-linear-to-br from-emerald-600 to-teal-700 p-5 text-primary-foreground shadow-premium sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar className="size-16 border-2 border-white/30 shadow-premium-sm">
            <AvatarFallback className="bg-white/20 text-lg font-bold text-white">
              {getInitials(customer.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h2 className="text-xl font-bold sm:text-2xl">{customer.name}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-emerald-50">
              <Mail className="size-3.5" /> {customer.email}
            </p>
            <p className="flex items-center gap-1.5 text-sm text-emerald-50">
              <Phone className="size-3.5" /> {customer.phone}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {customer.isEmailVerified ? (
            <Badge className="bg-white/20 text-white hover:bg-white/20">
              <CheckCircle2 className="size-3" /> Verified account
            </Badge>
          ) : (
            <Badge className="bg-amber-400/30 text-amber-100">Email not verified</Badge>
          )}
          {me.createdAt && (
            <Badge className="bg-white/20 text-white hover:bg-white/20">
              Member since {formatDate(me.createdAt)}
            </Badge>
          )}
        </div>
      </Card>

      {/* ── Savings Tracker — prominent card showing total money saved ──── */}
      {stats && stats.totalSavings > 0 && (
        <Card className="mb-4 overflow-hidden rounded-xl border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-4 shadow-premium-sm dark:border-emerald-800 dark:from-emerald-950/30 dark:to-teal-950/30 sm:p-5">
          <div className="flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
              <PiggyBank className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                Total Savings
              </p>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                {formatCurrency(stats.totalSavings)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Across {stats.totalOrders} orders · {stats.totalItemsPurchased} items purchased
              </p>
            </div>
            <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
              <Badge className="gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300">
                <Award className="size-3" />
                {stats.loyaltyPoints} pts
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                Worth {formatCurrency(stats.loyaltyPointsValue)}
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* ── Quick stats — color-coded to match the quick-link tiles below ── */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={Package}
          label="Orders"
          value={me._count?.orders ?? 0}
          tint="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
          onClick={() => navigate({ name: "orders" })}
        />
        <StatCard
          icon={Heart}
          label="Wishlist"
          value={wishlistCount}
          tint="bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
          onClick={() => navigate({ name: "wishlist" })}
        />
        <StatCard
          icon={BellRing}
          label="Stock Alerts"
          value={stockAlertCount}
          tint="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
          onClick={() => navigate({ name: "stock-alerts" })}
        />
        <StatCard
          icon={FileText}
          label="Prescriptions"
          value={me._count?.prescriptions ?? 0}
          tint="bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
          onClick={() => navigate({ name: "prescription" })}
        />
      </div>

      {/* ── Recent Activity — latest 3 orders/prescriptions/requests ────── */}
      <Card className="mb-4 gap-3 rounded-xl border-border/50 p-4 shadow-premium-sm sm:p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Clock className="size-5 text-primary" /> Recent Activity
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ name: "orders" })}
            className="gap-1 text-xs text-muted-foreground"
          >
            View all <ChevronRight className="size-3" />
          </Button>
        </div>

        {recentLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border border-border/50 p-2.5"
              >
                <div className="size-9 shrink-0 rounded-lg skeleton-premium" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-2/5 skeleton-premium rounded" />
                  <div className="h-3 w-3/4 skeleton-premium rounded" />
                </div>
                <div className="size-7 skeleton-premium rounded" />
              </div>
            ))}
          </div>
        ) : recentItems.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
            No recent activity yet. Your orders, prescriptions, and requests will show here.
          </p>
        ) : (
          <div className="space-y-2">
            {recentItems.map((item) => {
              const isOrder = item.type === "order";
              const isRx = item.type === "prescription";
              const iconTint = isOrder
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                : isRx
                  ? "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
              const Icon = isOrder ? Package : isRx ? RxIcon : ClipboardList;
              return (
                <motion.button
                  key={`${item.type}-${item.id}`}
                  whileHover={{ x: 2 }}
                  onClick={() =>
                    isOrder
                      ? navigate({ name: "track-order", orderId: item.id })
                      : navigate({ name: "orders" })
                  }
                  className="flex w-full items-center gap-3 rounded-lg border border-border/50 p-2.5 text-left transition-colors hover:bg-accent/50"
                >
                  <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${iconTint}`}>
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.number}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(item.date)} · {item.statusLabel}
                    </p>
                  </div>
                  {isOrder && (
                    <Badge variant="outline" className="shrink-0 gap-1 text-[10px]">
                      <Truck className="size-3" />
                      {item.status === "delivered" ? "Delivered" : "Track"}
                    </Badge>
                  )}
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </motion.button>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── Quick actions — color-coded tiles in a responsive grid ─────── */}
      <Card className="gap-1 rounded-xl border-border/50 p-2 shadow-premium-sm">
        <div className="px-2 pt-2 pb-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Quick Actions
          </h2>
        </div>
        <div className="grid gap-1 sm:grid-cols-2">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <motion.button
                key={link.label}
                whileHover={{ x: 2 }}
                onClick={link.onClick}
                className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-accent"
              >
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${link.tint}`}>
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{link.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{link.description}</p>
                </div>
                {link.stat !== undefined && link.stat > 0 && (
                  <Badge variant="secondary">{link.stat}</Badge>
                )}
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </motion.button>
            );
          })}
        </div>
      </Card>

      {/* ── Buy Again — frequently reordered products ───────────────────── */}
      {buyAgainItems.length > 0 && (
        <Card className="mt-4 gap-3 rounded-xl border-border/50 p-4 shadow-premium-sm sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Repeat className="size-5 text-primary" /> Buy Again
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ name: "orders" })}
              className="gap-1 text-xs text-muted-foreground"
            >
              View all orders <ChevronRight className="size-3" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Products you&apos;ve ordered before — tap to view details and reorder.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {buyAgainItems.map((p) => (
              <motion.button
                key={p.id}
                whileHover={{ y: -2 }}
                onClick={() => navigate({ name: "product", productId: p.id, slug: p.slug })}
                className="group flex flex-col gap-1.5 rounded-lg border border-border/50 p-2 text-left transition-colors hover:border-primary/40 hover:bg-accent/50"
              >
                <div className="relative">
                  <ProductImage
                    name={p.name}
                    brandName={p.brand?.name ?? null}
                    primaryImage={p.primaryImage}
                    size="md"
                    className="!h-16 !w-full rounded-md"
                  />
                  {p.stock <= 0 && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-md bg-foreground/40 backdrop-grayscale">
                      <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                        Out of stock
                      </span>
                    </div>
                  )}
                </div>
                <p className="line-clamp-2 break-words text-xs font-medium leading-tight">{p.name}</p>
                {p.brand && (
                  <p className="truncate text-[10px] text-muted-foreground">{p.brand.name}</p>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">
                    {formatCurrency(p.sellingPrice)}
                  </span>
                  {p.timesOrdered > 0 && (
                    <Badge variant="secondary" className="text-[9px]">
                      ×{p.timesOrdered}
                    </Badge>
                  )}
                </div>
              </motion.button>
            ))}
          </div>
        </Card>
      )}

      <Card className="mt-4 gap-2 rounded-xl border-border/50 p-4 shadow-premium-sm">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="size-5 text-emerald-600" />
          <span>Your account is protected with encrypted authentication.</span>
        </div>
      </Card>

      {/* ── App Notification Preferences ─────────────────────────────────── */}
      <div className="mt-4">
        <NotificationPreferences />
      </div>

      {/* ── Prescription Refill Reminders ───────────────────────────────── */}
      {refillItems.length > 0 && (
        <Card className="mt-4 gap-3 rounded-xl border-border/50 p-4 shadow-premium-sm sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <RefreshCw className="size-5 text-primary" /> Prescription Refills
            </h2>
            {refillDueCount > 0 && (
              <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300">
                {refillDueCount} due soon
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            We&apos;ll remind you when your prescription medicines are about to run out.
          </p>
          <div className="space-y-2">
            {refillItems.slice(0, 5).map((r) => {
              const due = new Date(r.nextRefillDate);
              const now = new Date();
              const diffMs = due.getTime() - now.getTime();
              const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
              const isOverdue = diffDays < 0;
              const isDueSoon = diffDays >= 0 && diffDays <= 7;
              const tint = isOverdue
                ? "border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/20"
                : isDueSoon
                  ? "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20"
                  : "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/10";
              const label = isOverdue
                ? "Refill now"
                : isDueSoon
                  ? `Refill in ${Math.max(0, diffDays)}d`
                  : `Refill in ${diffDays}d`;
              const labelTint = isOverdue
                ? "text-rose-700 dark:text-rose-300"
                : isDueSoon
                  ? "text-amber-700 dark:text-amber-300"
                  : "text-emerald-700 dark:text-emerald-300";
              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex items-center gap-3 rounded-lg border p-2.5 ${tint}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {r.product?.name ?? "Prescription medicine"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Last ordered {formatDate(r.lastOrdered)} · Next refill {formatDate(r.nextRefillDate)}
                    </p>
                  </div>
                  <Badge variant="outline" className={`shrink-0 text-[10px] ${labelTint}`}>
                    {label}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => snoozeMutation.mutate(r.id)}
                    disabled={snoozeMutation.isPending}
                    className="shrink-0 gap-1 text-xs"
                    title="Snooze 7 days"
                  >
                    <Clock3 className="size-3.5" /> Snooze
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      r.product &&
                      navigate({ name: "product", productId: r.product.id, slug: r.product.slug })
                    }
                    className="shrink-0 gap-1 text-xs"
                  >
                    <ShoppingBag className="size-3.5" /> Reorder
                  </Button>
                </motion.div>
              );
            })}
          </div>
        </Card>
      )}

      <Button
        onClick={onLogout}
        variant="outline"
        className="mt-4 w-full gap-2 text-destructive hover:bg-destructive/5 hover:text-destructive"
      >
        <LogOut className="size-4" /> Logout
      </Button>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Pradeep Medical Store • Licensed Pharmacy in Mathura
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card — small KPI tile with icon + value + label.
// ---------------------------------------------------------------------------
function StatCard({
  icon: Icon,
  label,
  value,
  tint,
  onClick,
}: {
  icon: typeof Package;
  label: string;
  value: number;
  tint: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-1.5 rounded-xl border border-border/50 bg-card p-4 text-left shadow-premium-sm transition-all hover:border-primary/40 hover:shadow-premium active:scale-[0.98]"
    >
      <div className={`flex size-8 items-center justify-center rounded-lg ${tint}`}>
        <Icon className="size-4" />
      </div>
      <span className="text-2xl font-bold leading-none">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// AccountSkeleton — premium shimmer skeleton shown while auth + initial
// queries resolve. Mirrors the real layout (profile → stats → recent → links)
// so the page never visually jumps on load.
// ---------------------------------------------------------------------------
export function AccountSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-5 space-y-2">
        <div className="h-7 w-32 skeleton-premium rounded" />
        <div className="h-4 w-72 skeleton-premium rounded" />
      </div>

      {/* Profile skeleton */}
      <div className="mb-4 rounded-xl border border-border/50 bg-linear-to-br from-emerald-600 to-teal-700 p-5 text-primary-foreground shadow-premium sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="size-16 rounded-full bg-white/20" />
          <div className="flex-1 space-y-2">
            <div className="h-6 w-44 rounded bg-white/20" />
            <div className="h-4 w-60 rounded bg-white/15" />
            <div className="h-4 w-48 rounded bg-white/15" />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <div className="h-6 w-28 rounded-full bg-white/15" />
          <div className="h-6 w-32 rounded-full bg-white/15" />
        </div>
      </div>

      {/* Stats grid skeleton */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-xl border border-border/50 bg-card p-4 shadow-premium-sm"
          >
            <div className="size-8 rounded-lg skeleton-premium" />
            <div className="h-7 w-12 skeleton-premium rounded" />
            <div className="h-3 w-16 skeleton-premium rounded" />
          </div>
        ))}
      </div>

      {/* Recent activity skeleton */}
      <div className="mb-4 rounded-xl border border-border/50 bg-card p-4 shadow-premium-sm sm:p-5">
        <div className="mb-3 h-5 w-40 skeleton-premium rounded" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg border border-border/50 p-2.5"
            >
              <div className="size-9 shrink-0 rounded-lg skeleton-premium" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-2/5 skeleton-premium rounded" />
                <div className="h-3 w-3/4 skeleton-premium rounded" />
              </div>
              <div className="size-7 skeleton-premium rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions skeleton */}
      <div className="rounded-xl border border-border/50 bg-card p-2 shadow-premium-sm">
        <div className="px-2 pt-3 pb-2">
          <div className="h-3.5 w-24 skeleton-premium rounded" />
        </div>
        <div className="grid gap-1 sm:grid-cols-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg p-3"
            >
              <div className="size-10 shrink-0 rounded-xl skeleton-premium" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-2/5 skeleton-premium rounded" />
                <div className="h-3 w-3/4 skeleton-premium rounded" />
              </div>
              <div className="size-4 skeleton-premium rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
