// ============================================================================
// File: src/components/customer/stock-alerts-view.tsx
// Purpose: "My Stock Alerts" — lists all products the customer has subscribed
//          to for back-in-stock notifications. Shows subscription status
//          (active / notified) and lets the customer cancel a subscription.
// Role: Account-area management view for restock alerts.
// ============================================================================

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, BellRing, Check, Trash2, Package, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProductImage } from "@/components/shared/product-image";
import { useUI } from "@/lib/store";
import { api, qk } from "./api";
import { useRequireAuth } from "./use-require-auth";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface StockAlert {
  id: string;
  status: string; // active | notified | cancelled
  createdAt: string;
  notifiedAt: string | null;
  product: {
    id: string;
    name: string;
    slug: string;
    primaryImage: string | null;
    stock: number;
    sellingPrice: number;
    mrp: number;
    brand: { name: string } | null;
  };
}

export function StockAlertsView() {
  const { customer, isLoading } = useRequireAuth();
  const navigate = useUI((s) => s.navigate);
  const back = useUI((s) => s.back);
  const qc = useQueryClient();

  const { data, isLoading: alertsLoading } = useQuery({
    queryKey: qk.stockAlerts,
    queryFn: () => api<{ items: StockAlert[] }>("/api/stock-subscriptions"),
    enabled: !!customer,
  });

  const cancelMutation = useMutation({
    mutationFn: (productId: string) => api.del(`/api/stock-subscriptions?productId=${productId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.stockAlerts });
      toast.success("Stock alert cancelled");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || alertsLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <div className="mb-4 h-8 w-48 animate-pulse rounded bg-accent" />
        {[1, 2, 3].map((i) => (
          <Card key={i} className="mb-3 h-24 animate-pulse bg-accent" />
        ))}
      </div>
    );
  }

  if (!customer) return null;

  const alerts = data?.items ?? [];
  const activeCount = alerts.filter((a) => a.status === "active").length;
  const notifiedCount = alerts.filter((a) => a.status === "notified").length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={back} aria-label="Go back">
          <ArrowLeft className="size-5" />
        </Button>
        <div className="flex-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <BellRing className="size-6 text-primary" /> My Stock Alerts
          </h1>
          <p className="text-sm text-muted-foreground">
            Products you&apos;ll be notified about when they&apos;re back in stock.
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <Card className="flex items-center gap-3 p-4">
          <div className="flex size-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <Bell className="size-5" />
          </div>
          <div>
            <p className="text-2xl font-bold">{activeCount}</p>
            <p className="text-xs text-muted-foreground">Active alerts</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <Check className="size-5" />
          </div>
          <div>
            <p className="text-2xl font-bold">{notifiedCount}</p>
            <p className="text-xs text-muted-foreground">Back in stock</p>
          </div>
        </Card>
      </div>

      {/* Alerts list */}
      {alerts.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-accent">
            <Bell className="size-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold">No stock alerts yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              When a product is out of stock, click &quot;Notify me when available&quot;
              to get an email when it returns.
            </p>
          </div>
          <Button onClick={() => navigate({ name: "shop" })} className="mt-2">
            <Package className="size-4" /> Browse products
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert, idx) => {
            const isNotified = alert.status === "notified";
            const inStockNow = alert.product.stock > 0;
            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
              >
                <Card className="flex items-center gap-4 p-3 sm:p-4">
                  <button
                    onClick={() => navigate({ name: "product", productId: alert.product.id, slug: alert.product.slug })}
                    className="shrink-0"
                    aria-label={`View ${alert.product.name}`}
                  >
                    <ProductImage
                      name={alert.product.name}
                      brandName={alert.product.brand?.name ?? null}
                      primaryImage={alert.product.primaryImage}
                      className="size-16 rounded-lg border object-cover sm:size-20"
                    />
                  </button>
                  <div className="min-w-0 flex-1">
                    <button
                      onClick={() => navigate({ name: "product", productId: alert.product.id, slug: alert.product.slug })}
                      className="block truncate text-left font-semibold hover:text-primary"
                    >
                      {alert.product.name}
                    </button>
                    {alert.product.brand && (
                      <p className="truncate text-xs text-muted-foreground">{alert.product.brand.name}</p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {formatCurrency(alert.product.sellingPrice)}
                      </span>
                      {alert.product.mrp > alert.product.sellingPrice && (
                        <span className="text-xs text-muted-foreground line-through">
                          {formatCurrency(alert.product.mrp)}
                        </span>
                      )}
                      {isNotified ? (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300">
                          <Check className="size-3" /> Back in stock
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300">
                          <Bell className="size-3" /> Watching
                        </Badge>
                      )}
                      {inStockNow && !isNotified && (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300">
                          In stock now
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Subscribed on {formatDate(alert.createdAt)}
                      {alert.notifiedAt && ` · Notified on ${formatDate(alert.notifiedAt)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    {inStockNow && (
                      <Button
                        size="sm"
                        onClick={() => navigate({ name: "product", productId: alert.product.id, slug: alert.product.slug })}
                      >
                        Buy now
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => cancelMutation.mutate(alert.product.id)}
                      disabled={cancelMutation.isPending}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Cancel this stock alert"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
