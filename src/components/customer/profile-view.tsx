// ============================================================================
// File: src/components/customer/profile-view.tsx
// Purpose: Edit profile (name, phone). Read-only email.
// Role: Powers the "Profile" view.
// ============================================================================

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, qk, LoyaltyInfo, LoyaltyTransaction, CustomerMe, OrderListItem } from "./api";
import { useRequireAuth } from "./use-require-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  User,
  Mail,
  Phone,
  Save,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Gift,
  ChevronDown,
  Sparkles,
  TrendingUp,
  TrendingDown,
  MinusCircle,
  Package,
  IndianRupee,
  CalendarDays,
  PiggyBank,
} from "lucide-react";
import { useUI } from "@/lib/store";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { motion } from "framer-motion";
import { NotificationPreferences } from "./notification-preferences";

export function ProfileView() {
  const { customer, isLoading } = useRequireAuth();
  const navigate = useUI((s) => s.navigate);
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (customer) {
      setName(customer.name);
      setPhone(customer.phone);
    }
  }, [customer]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put("/api/customer/profile", { name, phone }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.me });
      toast.success("Profile updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!customer) {
    // useRequireAuth handles redirect in an effect
    return null;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <ProfileHeader customer={customer} />

      <QuickStatsRow customer={customer} />

      <LoyaltyCard />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
      >
        <Card className="mb-4 gap-4 p-4 sm:p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="size-5 text-emerald-600" />
          <span>Manage your account information and preferences.</span>
        </div>

        <div>
          <Label htmlFor="p-name" className="text-xs">Full name</Label>
          <div className="relative">
            <User className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="p-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="p-email" className="text-xs">Email</Label>
          <div className="relative">
            <Mail className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="p-email"
              value={customer.email}
              disabled
              className="pl-8 bg-accent/40"
            />
          </div>
          <div className="mt-1 flex items-center gap-2">
            {customer.isEmailVerified ? (
              <Badge className="bg-emerald-100 text-emerald-700">Verified</Badge>
            ) : (
              <Badge variant="outline" className="border-amber-300 text-amber-700">
                Not verified
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">Email cannot be changed</span>
          </div>
        </div>

        <div>
          <Label htmlFor="p-phone" className="text-xs">Phone</Label>
          <div className="relative">
            <Phone className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="p-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !name || !phone}
          className="w-full gap-2"
          size="lg"
        >
          {saveMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <Save className="size-4" /> Save changes
            </>
          )}
        </Button>
        </Card>
      </motion.div>

      {/* App Notifications settings — moved here from Account page per Phase 41 */}
      <NotificationPreferences />

      <Button
        variant="outline"
        onClick={() => navigate({ name: "account" })}
        className="w-full gap-1"
      >
        <ArrowRight className="size-4 rotate-180" /> Back to account
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProfileHeader — premium card with avatar (initials in a gradient circle),
// customer name + email, a "Member since" badge with a calendar icon, and a
// verification badge if the email is verified.
// ---------------------------------------------------------------------------
function ProfileHeader({ customer }: { customer: CustomerMe }) {
  const initials = customer.name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <Card className="mb-4 overflow-hidden border-border/60 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-5">
        <div className="flex items-center gap-4">
          {/* Avatar — gradient circle with initials */}
          <div
            className="flex size-16 shrink-0 items-center justify-center rounded-full text-2xl font-bold text-white shadow-lg shadow-emerald-500/25 sm:size-20 sm:text-3xl"
            style={{
              background:
                "linear-gradient(135deg, #10b981 0%, #0d9488 100%)",
            }}
          >
            {initials || "U"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-bold sm:text-2xl">
                {customer.name}
              </h1>
              {customer.isEmailVerified && (
                <Badge className="gap-1 bg-emerald-100 text-emerald-700">
                  <ShieldCheck className="size-3" />
                  Verified
                </Badge>
              )}
            </div>
            <p className="truncate text-sm text-muted-foreground">
              {customer.email}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {customer.createdAt && (
                <Badge
                  variant="outline"
                  className="gap-1 border-violet-200 bg-violet-50 text-violet-700"
                >
                  <CalendarDays className="size-3" />
                  Member since {formatDate(customer.createdAt)}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// QuickStatsRow — at-a-glance summary of the customer's account activity,
// shown above the LoyaltyCard. Four small cards: Total Orders, Total Spent
// (excluding cancelled orders), Loyalty Points (with gift icon), and Member
// Since (account createdAt). Falls back to "—" placeholders while loading.
// ---------------------------------------------------------------------------
function QuickStatsRow({ customer }: { customer: CustomerMe }) {
  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: qk.orders,
    queryFn: () => api<OrderListItem[]>("/api/customer/orders"),
  });
  const { data: loyalty, isLoading: loyaltyLoading } = useQuery({
    queryKey: qk.loyalty,
    queryFn: () => api<LoyaltyInfo>("/api/customer/loyalty"),
  });

  // Total spent = sum of grandTotal across non-cancelled orders.
  const totalSpent = (orders ?? []).reduce(
    (sum, o) => (o.status === "cancelled" ? sum : sum + (o.grandTotal || 0)),
    0
  );
  // Total savings = product-level discount + voucher discount + loyalty
  // discount, summed across non-cancelled orders. Each is a distinct channel
  // where the customer paid less than list price.
  const totalSavings = (orders ?? []).reduce(
    (sum, o) =>
      o.status === "cancelled"
        ? sum
        : sum +
          (o.productDiscount || 0) +
          (o.voucherDiscount || 0) +
          (o.loyaltyDiscount || 0),
    0
  );
  const totalOrders = customer._count?.orders ?? orders?.length ?? 0;
  const loyaltyPoints = loyalty?.balance ?? 0;

  const stats: Array<{
    label: string;
    value: string;
    icon: typeof Package;
    tint: string;
  }> = [
    {
      label: "Total Orders",
      value: ordersLoading ? "—" : String(totalOrders),
      icon: Package,
      tint: "bg-sky-100 text-sky-700",
    },
    {
      label: "Total Spent",
      value: ordersLoading ? "—" : formatCurrency(totalSpent),
      icon: IndianRupee,
      tint: "bg-emerald-100 text-emerald-700",
    },
    {
      label: "Total Savings",
      value: ordersLoading ? "—" : formatCurrency(totalSavings),
      icon: PiggyBank,
      tint: "bg-teal-100 text-teal-700",
    },
    {
      label: "Loyalty Points",
      value: loyaltyLoading ? "—" : loyaltyPoints.toLocaleString("en-IN"),
      icon: Gift,
      tint: "bg-amber-100 text-amber-700",
    },
    {
      label: "Member Since",
      value: customer.createdAt ? formatDate(customer.createdAt) : "—",
      icon: CalendarDays,
      tint: "bg-violet-100 text-violet-700",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5"
    >
      {stats.map((s) => (
        <Card key={s.label} className="gap-1 p-3">
          <div className="flex items-center gap-2">
            <div className={`flex size-7 shrink-0 items-center justify-center rounded-md ${s.tint}`}>
              <s.icon className="size-4" />
            </div>
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {s.label}
            </span>
          </div>
          <div className="mt-1 truncate text-lg font-bold tracking-tight">
            {s.value}
          </div>
        </Card>
      ))}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// LoyaltyCard — shows the customer's current loyalty balance + a collapsible
// transaction history. Earns are green, redeems are amber, adjustments are
// grey. Emerald/amber color scheme per design spec.
// ---------------------------------------------------------------------------
function LoyaltyCard() {
  const { data, isLoading } = useQuery({
    queryKey: qk.loyalty,
    queryFn: () => api<LoyaltyInfo>("/api/customer/loyalty"),
  });
  const [historyOpen, setHistoryOpen] = useState(false);

  if (isLoading) {
    return <Skeleton className="mb-4 h-40 w-full" />;
  }

  const balance = data?.balance ?? 0;
  const transactions = data?.transactions ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.15 }}
    >
      <Card className="mb-4 gap-3 overflow-hidden border-amber-200 bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-emerald-500 text-white shadow-md shadow-amber-500/30">
              <Gift className="size-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Loyalty Points
              </p>
              <p className="text-3xl font-bold leading-none text-emerald-700">
                {balance.toLocaleString("en-IN")}
              </p>
            </div>
          </div>
          {balance > 0 && (
            <Badge className="bg-amber-100 text-amber-800">
              <Sparkles className="mr-1 size-3" /> worth {formatCurrency(balance)}
            </Badge>
          )}
        </div>

        <div className="grid gap-2 text-xs sm:grid-cols-2">
          <div className="flex items-start gap-2 rounded-lg bg-white/70 p-2.5">
            <TrendingUp className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
            <span className="text-muted-foreground">
              Earn <span className="font-medium text-foreground">3 points per Rs. 50</span>{" "}
              spent on delivered orders.
            </span>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-white/70 p-2.5">
            <Gift className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
            <span className="text-muted-foreground">
              Redeem at checkout — <span className="font-medium text-foreground">1 point = Rs. 1</span>.
            </span>
          </div>
        </div>

        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full gap-1 text-muted-foreground">
              <ChevronDown
                className={`size-4 transition-transform ${historyOpen ? "rotate-180" : ""}`}
              />
              {historyOpen ? "Hide history" : "View history"}
              {transactions.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {transactions.length}
                </Badge>
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            {transactions.length === 0 ? (
              <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                No loyalty activity yet. Place an order to start earning points!
              </p>
            ) : (
              <ul className="mt-2 max-h-72 space-y-1.5 overflow-y-auto pr-1 scrollbar-thin">
                {transactions.map((txn) => (
                  <LoyaltyTxnRow key={txn.id} txn={txn} />
                ))}
              </ul>
            )}
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </motion.div>
  );
}

function LoyaltyTxnRow({ txn }: { txn: LoyaltyTransaction }) {
  const isEarn = txn.type === "earn";
  const isRedeem = txn.type === "redeem";

  const Icon = isEarn ? TrendingUp : isRedeem ? TrendingDown : MinusCircle;
  const iconColor = isEarn
    ? "text-emerald-600 bg-emerald-50"
    : isRedeem
      ? "text-amber-600 bg-amber-50"
      : "text-muted-foreground bg-accent";
  const pointsColor = isEarn
    ? "text-emerald-700"
    : isRedeem
      ? "text-amber-700"
      : "text-muted-foreground";

  return (
    <li className="flex items-center gap-3 rounded-lg border bg-white/70 p-2.5">
      <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${iconColor}`}>
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{txn.reason}</p>
        <p className="text-xs text-muted-foreground">
          {formatDateTime(txn.createdAt)} · balance {txn.balance}
        </p>
      </div>
      <span className={`text-sm font-semibold ${pointsColor}`}>
        {txn.points > 0 ? "+" : ""}
        {txn.points}
      </span>
    </li>
  );
}
