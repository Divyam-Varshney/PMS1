// ============================================================================
// File: src/components/customer/orders-view.tsx
// Purpose: Unified customer activity history — merges Orders, Prescriptions,
//          and Manual Requests into a single timeline so customers can see
//          everything that has happened in their account in one place.
//
//          Filter tabs:  All | Orders | Prescriptions | Requests
//
//          Each card shows:
//            - Type badge   (Order emerald, Prescription violet, Request amber)
//            - Number       (order number, RX-XXXXXXXX, or MR-XXXXXXXX)
//            - Date
//            - Status badge (colored by status)
//            - Admin remarks (if any) — in a muted MessageCircle box
//            - Type-specific content + actions:
//                Orders        → items preview + total + Track/Reorder/Invoice
//                Prescriptions → image count + View Details
//                Manual Reqs   → medicine preview + View Details
//
//          "View Details" for prescriptions / manual requests opens a dialog
//          with images (lightbox), status timeline, admin remarks, and
//          created/updated timestamps.
//
//          Auto-refresh: staleTime 10s + refetchInterval 30s so newly
//          converted orders / status changes appear without a manual reload.
// Role: Powers the customer "My Orders / Activity" view.
// ============================================================================

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api,
  qk,
  UnifiedHistoryItem,
  UnifiedHistoryResponse,
} from "./api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Package,
  Download,
  Truck,
  ShoppingBag,
  ArrowRight,
  Loader2,
  RotateCcw,
  MapPin,
  Clock,
  FileText,
  ChevronRight,
  Receipt,
  ClipboardList,
  MessageCircle,
  ImageIcon,
  Pill,
  X,
  CheckCircle2,
  XCircle,
  Search,
  ExternalLink,
} from "lucide-react";
import { useUI } from "@/lib/store";
import { useRequireAuth } from "./use-require-auth";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/constants";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Filter tab — selects which activity types to show.
// ---------------------------------------------------------------------------
type FilterTab = "all" | "orders" | "prescriptions" | "requests";

// Sub-segmented control for orders — splits the orders list into Active
// (in-progress) vs Past (delivered / cancelled / returned) so customers can
// quickly find what they're waiting for vs what they've already received.
type OrderSegment = "active" | "past";

const ACTIVE_ORDER_STATUSES = new Set([
  "pending",
  "confirmed",
  "packed",
  "out_for_delivery",
]);

// ---------------------------------------------------------------------------
// Type badge metadata — controls color + icon + label per activity type.
// ---------------------------------------------------------------------------
const TYPE_META: Record<
  UnifiedHistoryItem["type"],
  { label: string; className: string; icon: typeof Package }
> = {
  order: {
    label: "Order",
    className: "border-emerald-300 bg-emerald-50 text-emerald-700",
    icon: Package,
  },
  prescription: {
    label: "Prescription",
    className: "border-violet-300 bg-violet-50 text-violet-700",
    icon: FileText,
  },
  manual_request: {
    label: "Manual Request",
    className: "border-amber-300 bg-amber-50 text-amber-700",
    icon: ClipboardList,
  },
};

// ---------------------------------------------------------------------------
// Status → badge color map. Covers both order statuses and rx statuses.
// ---------------------------------------------------------------------------
const STATUS_BADGE_CLASS: Record<string, string> = {
  // Order statuses
  pending: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  confirmed: "bg-teal-100 text-teal-800 hover:bg-teal-100",
  packed: "bg-cyan-100 text-cyan-800 hover:bg-cyan-100",
  out_for_delivery: "bg-lime-100 text-lime-800 hover:bg-lime-100",
  delivered: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  cancelled: "bg-destructive/15 text-destructive hover:bg-destructive/15",
  returned: "bg-destructive/15 text-destructive hover:bg-destructive/15",
  // RX statuses (under_review shares the pending amber palette to read as "in
  // progress" — slightly lighter shade so the two are distinguishable).
  under_review: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  verified: "bg-sky-100 text-sky-800 hover:bg-sky-100",
  converted: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  rejected: "bg-rose-100 text-rose-800 hover:bg-rose-100",
};

export function OrdersView() {
  const { customer, isLoading: custLoading } = useRequireAuth();
  const navigate = useUI((s) => s.navigate);
  const setCartOpen = useUI((s) => s.setCartOpen);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterTab>("all");
  // Secondary segmented control for orders — only visible when filter === "orders".
  // Defaults to "active" so the customer lands on what they're waiting for.
  const [orderSegment, setOrderSegment] = useState<OrderSegment>("active");
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  // Detail dialog state — holds the prescription or manual request being viewed.
  const [detailItem, setDetailItem] = useState<
    | Extract<UnifiedHistoryItem, { type: "prescription" }>
    | Extract<UnifiedHistoryItem, { type: "manual_request" }>
    | null
  >(null);
  // Lightbox image URL — when set, shows a full-screen image viewer for a
  // prescription image.
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // ---- Unified history query. Auto-refreshes on a 30s interval so newly
  //      converted orders / status changes appear without a manual reload.
  //      staleTime of 10s prevents redundant refetches within that window.
  const { data: history, isLoading } = useQuery<UnifiedHistoryResponse>({
    queryKey: qk.history,
    queryFn: () => api<UnifiedHistoryResponse>("/api/customer/history"),
    enabled: !!customer,
    staleTime: 10 * 1000,
    refetchInterval: 30 * 1000, // 30s (was 10s — reduced for memory)
  });

  // ---- Reorder mutation — reuses the existing /api/orders/[id]/reorder
  //      endpoint. Identical to the previous OrdersView behavior.
  const reorderMutation = useMutation({
    mutationFn: (orderId: string) =>
      api.post<{ added: number; skipped: string[]; totalItems: number }>(
        `/api/orders/${orderId}/reorder`
      ),
    onMutate: (orderId) => setReorderingId(orderId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: qk.cart });
      if (data.added > 0 && data.skipped.length === 0) {
        toast.success(`Added ${data.added} item(s) to your cart`, {
          action: { label: "View cart", onClick: () => setCartOpen(true) },
        });
      } else if (data.added > 0 && data.skipped.length > 0) {
        toast.success(
          `Added ${data.added} item(s). ${data.skipped.length} unavailable.`,
          {
            description: `Unavailable: ${data.skipped.slice(0, 2).join(", ")}${data.skipped.length > 2 ? "…" : ""}`,
            action: { label: "View cart", onClick: () => setCartOpen(true) },
          }
        );
      } else {
        toast.error("None of the items are available to reorder");
      }
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setReorderingId(null),
  });

  // ---- Filter by active tab + optional order-segment sub-filter.
  //      When the type filter is "orders", a secondary segmented control
  //      ("Active Orders" / "Past Orders") further splits the list by status.
  const visibleItems = useMemo(() => {
    if (!history?.items) return [];
    let list = history.items;
    if (filter === "orders") list = list.filter((i) => i.type === "order");
    else if (filter === "prescriptions")
      list = list.filter((i) => i.type === "prescription");
    else if (filter === "requests")
      list = list.filter((i) => i.type === "manual_request");

    // Apply the Active / Past sub-segment only when the user is on the
    // "orders" tab — keeps the segmented control's behavior predictable.
    if (filter === "orders") {
      list = list.filter((i) => {
        if (i.type !== "order") return true;
        const isActive = ACTIVE_ORDER_STATUSES.has(i.status);
        return orderSegment === "active" ? isActive : !isActive;
      });
    }
    return list;
  }, [history, filter, orderSegment]);

  // ---- Counts for the segmented control badges + header subtitle.
  const orderCounts = useMemo(() => {
    const orders = (history?.items ?? []).filter((i) => i.type === "order");
    return {
      active: orders.filter((o) => ACTIVE_ORDER_STATUSES.has(o.status)).length,
      past: orders.filter((o) => !ACTIVE_ORDER_STATUSES.has(o.status)).length,
    };
  }, [history]);

  // ---- Loading state — premium skeleton cards.
  if (custLoading || isLoading) {
    return <OrdersSkeleton />;
  }

  if (!customer) {
    // useRequireAuth handles redirect in an effect
    return null;
  }

  // ---- Empty state — if the customer has no activity at all.
  if (!history || history.items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <EmptyState
          icon={Package}
          title="No activity yet"
          description="When you place an order, upload a prescription, or request a medicine, it will appear here."
          action={
            <Button onClick={() => navigate({ name: "shop" })} className="gap-2">
              Start shopping <ArrowRight className="size-4" />
            </Button>
          }
        />
      </div>
    );
  }

  // ---- Empty state — when on the Orders tab and the selected segment is empty
  //      (e.g. no active orders but the customer has past orders, or vice versa).
  if (filter === "orders" && visibleItems.length === 0) {
    const isEmptyActive = orderSegment === "active";
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <OrdersHeader
          total={history.items.length}
          ordersCount={orderCounts.active + orderCounts.past}
          prescriptionsCount={
            history.items.filter((i) => i.type === "prescription").length
          }
          requestsCount={
            history.items.filter((i) => i.type === "manual_request").length
          }
        />
        <Tabs
          value={filter}
          onValueChange={(v) => setFilter(v as FilterTab)}
          className="mb-3"
        >
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="orders">
              Orders ({orderCounts.active + orderCounts.past})
            </TabsTrigger>
            <TabsTrigger value="prescriptions">Prescriptions</TabsTrigger>
            <TabsTrigger value="requests">Requests</TabsTrigger>
          </TabsList>
        </Tabs>
        <OrderSegmentedControl
          value={orderSegment}
          onChange={setOrderSegment}
          activeCount={orderCounts.active}
          pastCount={orderCounts.past}
        />
        <EmptyState
          icon={isEmptyActive ? Truck : Package}
          title={isEmptyActive ? "No active orders" : "No past orders"}
          description={
            isEmptyActive
              ? "You have no orders in progress. Browse the catalog and place a new order to see it tracked here in real time."
              : "You haven't completed any orders yet. Once an order is delivered or cancelled, it will appear in this list."
          }
          action={
            isEmptyActive ? (
              <Button onClick={() => navigate({ name: "shop" })} className="gap-2">
                Start shopping <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => setOrderSegment("active")}
                className="gap-2"
              >
                View active orders <Truck className="size-4" />
              </Button>
            )
          }
          className="py-12"
        />
      </div>
    );
  }

  const onDownloadInvoice = async (orderId: string, orderNumber: string) => {
    try {
      const buf = await api.raw(`/api/invoice/${orderId}`);
      const blob = new Blob([buf], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${orderNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to download invoice";
      toast.error(msg);
    }
  };

  // ---- Count breakdown for the header subtitle.
  const counts = {
    orders: history.items.filter((i) => i.type === "order").length,
    prescriptions: history.items.filter((i) => i.type === "prescription").length,
    requests: history.items.filter((i) => i.type === "manual_request").length,
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <OrdersHeader
        total={history.items.length}
        ordersCount={counts.orders}
        prescriptionsCount={counts.prescriptions}
        requestsCount={counts.requests}
      />

      {/* Filter tabs */}
      <Tabs
        value={filter}
        onValueChange={(v) => setFilter(v as FilterTab)}
        className="mb-3"
      >
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="orders">
            Orders ({counts.orders})
          </TabsTrigger>
          <TabsTrigger value="prescriptions">Prescriptions</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Active / Past segmented control — only visible on the Orders tab. */}
      {filter === "orders" && (
        <OrderSegmentedControl
          value={orderSegment}
          onChange={setOrderSegment}
          activeCount={orderCounts.active}
          pastCount={orderCounts.past}
          className="mb-4"
        />
      )}

      {visibleItems.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nothing in this view"
          description="Try a different filter to see more activity."
          className="py-10"
        />
      ) : (
        <div className="space-y-3">
          {visibleItems.map((item, idx) => (
            <motion.div
              key={`${item.type}-${item.id}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(idx * 0.04, 0.3) }}
            >
              <ActivityCard
                item={item}
                onViewDetails={(it) => setDetailItem(it)}
                onReorder={(orderId) => reorderMutation.mutate(orderId)}
                onDownloadInvoice={onDownloadInvoice}
                onTrack={(orderId) =>
                  navigate({ name: "track-order", orderId })
                }
                reorderingId={reorderingId}
              />
            </motion.div>
          ))}
        </div>
      )}

      <Button
        variant="outline"
        onClick={() => navigate({ name: "shop" })}
        className="mt-6 w-full gap-2"
      >
        <ShoppingBag className="size-4" /> Continue shopping
      </Button>

      <div className="mt-4 flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
        <Receipt className="size-3" /> Tip: Use{" "}
        <Badge variant="outline" className="px-1 py-0 text-[10px]">
          Track
        </Badge>{" "}
        to see live order progress.
      </div>

      {/* ---- Detail dialog for prescriptions / manual requests ---- */}
      <DetailDialog
        item={detailItem}
        onClose={() => setDetailItem(null)}
        onOpenLightbox={setLightboxSrc}
      />

      {/* ---- Lightbox for prescription images ---- */}
      <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity card — renders the appropriate layout for each activity type.
// ---------------------------------------------------------------------------
function ActivityCard({
  item,
  onViewDetails,
  onReorder,
  onDownloadInvoice,
  onTrack,
  reorderingId,
}: {
  item: UnifiedHistoryItem;
  onViewDetails: (
    item:
      | Extract<UnifiedHistoryItem, { type: "prescription" }>
      | Extract<UnifiedHistoryItem, { type: "manual_request" }>
  ) => void;
  onReorder: (orderId: string) => void;
  onDownloadInvoice: (orderId: string, orderNumber: string) => void;
  onTrack: (orderId: string) => void;
  reorderingId: string | null;
}) {
  const typeMeta = TYPE_META[item.type];
  const TypeIcon = typeMeta.icon;

  return (
    <Card className="gap-0 overflow-hidden rounded-xl border-border/50 p-0 shadow-premium-sm">
      {/* ---- Header: type badge + number + date + status ---- */}
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/50 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={`gap-1 ${typeMeta.className}`}>
              <TypeIcon className="size-3" /> {typeMeta.label}
            </Badge>
            <p className="truncate font-mono text-sm font-semibold">{item.number}</p>
            <StatusBadge status={item.status} label={item.statusLabel} />
          </div>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" /> {formatDate(item.date)}
          </p>
        </div>
      </div>

      {/* ---- Body: type-specific content ---- */}
      <div className="p-4">
        {item.type === "order" ? (
          <OrderBody item={item} />
        ) : item.type === "prescription" ? (
          <PrescriptionBody item={item} />
        ) : (
          <ManualRequestBody item={item} />
        )}
      </div>

      {/* ---- Admin remarks (prescriptions / manual requests only) ---- */}
      {item.type !== "order" && item.adminRemarks && (
        <div className="mx-4 mb-3 flex items-start gap-2 rounded-md border border-muted bg-muted/40 p-2 text-xs">
          <MessageCircle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-semibold text-foreground">Pharmacist&apos;s note</p>
            <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">
              {item.adminRemarks}
            </p>
          </div>
        </div>
      )}

      {/* ---- Action buttons ---- */}
      <ActivityActions
        item={item}
        onViewDetails={onViewDetails}
        onReorder={onReorder}
        onDownloadInvoice={onDownloadInvoice}
        onTrack={onTrack}
        reorderingId={reorderingId}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Order body — items preview + grand total + payment + delivery meta.
// ---------------------------------------------------------------------------
function OrderBody({ item }: { item: Extract<UnifiedHistoryItem, { type: "order" }> }) {
  const d = item.details;
  const previewItems = d.items.slice(0, 3);
  const extraItems = d.itemsCount - previewItems.length;
  const isActive = ACTIVE_ORDER_STATUSES.has(item.status);
  const hasDeliveryCharge = typeof d.deliveryCharge === "number" && d.deliveryCharge > 0;
  const showEta =
    isActive &&
    d.estimatedDelivery &&
    item.status !== "delivered" &&
    item.status !== "cancelled";

  return (
    <>
      {previewItems.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Items
          </p>
          <p className="text-sm text-foreground">
            {previewItems.map((it) => it.name).join(", ")}
            {extraItems > 0 && (
              <span className="ml-1 text-muted-foreground"> +{extraItems} more</span>
            )}
          </p>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {d.shipLocality && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5 text-primary" />
            <span className="font-medium text-foreground">{d.shipLocality}</span>
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Truck className="size-3.5 text-muted-foreground" />
          <span className="uppercase tracking-wide">
            {PAYMENT_METHOD_LABEL[d.paymentMethod] ?? d.paymentMethod}
          </span>
        </span>
        <PaymentStatusBadge status={d.paymentStatus} />
        {showEta && (
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5 text-primary" />
            ETA {formatDateTime(d.estimatedDelivery!)}
          </span>
        )}
        {hasDeliveryCharge ? (
          <span className="inline-flex items-center gap-1">
            <Truck className="size-3.5" />
            Delivery {formatCurrency(d.deliveryCharge)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-emerald-700">
            <Truck className="size-3.5" /> Free delivery
          </span>
        )}
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Grand Total
          </p>
          <p className="text-xl font-bold text-primary">
            {formatCurrency(d.grandTotal)}
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {d.itemsCount} {d.itemsCount === 1 ? "item" : "items"}
        </span>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Prescription body — image count + thumbnails + customer notes (if any).
// ---------------------------------------------------------------------------
function PrescriptionBody({
  item,
}: {
  item: Extract<UnifiedHistoryItem, { type: "prescription" }>;
}) {
  const d = item.details;
  return (
    <>
      <div className="mb-2 flex items-center gap-2 text-sm">
        <ImageIcon className="size-4 text-violet-600" />
        <span className="font-medium">{d.imageCount}</span>
        <span className="text-muted-foreground">
          {d.imageCount === 1 ? "image" : "images"} uploaded
        </span>
      </div>

      {d.images.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {d.images.slice(0, 4).map((img, i) => (
            <div
              key={i}
              className="relative size-16 overflow-hidden rounded-md border bg-accent"
            >
              <img
                src={img}
                alt={`Prescription ${i + 1}`}
                className="size-full object-cover"
              />
            </div>
          ))}
          {d.images.length > 4 && (
            <div className="flex size-16 items-center justify-center rounded-md border bg-accent text-xs font-medium text-muted-foreground">
              +{d.images.length - 4}
            </div>
          )}
        </div>
      )}

      {d.notes && (
        <p className="text-xs italic text-muted-foreground">Your note: {d.notes}</p>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Manual request body — requested medicines list preview + customer notes.
// ---------------------------------------------------------------------------
function ManualRequestBody({
  item,
}: {
  item: Extract<UnifiedHistoryItem, { type: "manual_request" }>;
}) {
  const d = item.details;
  const preview = d.medicines.slice(0, 4);
  const extra = d.medicines.length - preview.length;
  return (
    <>
      <div className="mb-2 flex items-center gap-2 text-sm">
        <Pill className="size-4 text-amber-600" />
        <span className="font-medium">{d.medicines.length}</span>
        <span className="text-muted-foreground">
          {d.medicines.length === 1 ? "medicine" : "medicines"} requested
        </span>
      </div>

      {preview.length > 0 && (
        <ul className="mb-2 space-y-0.5 text-sm">
          {preview.map((line, i) => (
            <li key={i} className="font-mono text-xs">
              {line}
            </li>
          ))}
          {extra > 0 && (
            <li className="text-xs italic text-muted-foreground">+{extra} more</li>
          )}
        </ul>
      )}

      {d.notes && (
        <p className="text-xs italic text-muted-foreground">Your note: {d.notes}</p>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Activity actions — per-type action button row.
// ---------------------------------------------------------------------------
function ActivityActions({
  item,
  onViewDetails,
  onReorder,
  onDownloadInvoice,
  onTrack,
  reorderingId,
}: {
  item: UnifiedHistoryItem;
  onViewDetails: (
    item:
      | Extract<UnifiedHistoryItem, { type: "prescription" }>
      | Extract<UnifiedHistoryItem, { type: "manual_request" }>
  ) => void;
  onReorder: (orderId: string) => void;
  onDownloadInvoice: (orderId: string, orderNumber: string) => void;
  onTrack: (orderId: string) => void;
  reorderingId: string | null;
}) {
  if (item.type === "order") {
    return (
      <div className="grid grid-cols-3 gap-2 border-t border-border/50 bg-accent/20 p-3">
        <Button
          size="sm"
          onClick={() => onTrack(item.id)}
          className="gap-1"
        >
          <Truck className="size-4" /> Track
          <ChevronRight className="size-3.5" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onReorder(item.id)}
          disabled={reorderingId === item.id}
          className="gap-1"
        >
          {reorderingId === item.id ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RotateCcw className="size-4" />
          )}
          Reorder
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onDownloadInvoice(item.id, item.number)}
          className="gap-1"
        >
          <Download className="size-4" /> Invoice
        </Button>
      </div>
    );
  }

  // Prescriptions + manual requests: single "View Details" button.
  return (
    <div className="border-t border-border/50 bg-accent/20 p-3">
      <Button
        size="sm"
        variant="outline"
        className="w-full gap-2"
        onClick={() => onViewDetails(item)}
      >
        <Search className="size-4" /> View Details
        <ChevronRight className="size-3.5" />
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status badge — colored by raw status string.
// ---------------------------------------------------------------------------
function StatusBadge({ status, label }: { status: string; label: string }) {
  const cls = STATUS_BADGE_CLASS[status] ?? "";
  return (
    <Badge className={`text-[10px] ${cls}`} variant="secondary">
      {label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Payment status badge — colored by payment status string.
// ---------------------------------------------------------------------------
function PaymentStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "border-emerald-300 text-emerald-700",
    pending: "border-amber-300 text-amber-700",
    failed: "border-destructive/40 text-destructive",
    refunded: "border-destructive/40 text-destructive",
    refund_initiated: "border-amber-300 text-amber-700",
    partially_paid: "border-cyan-300 text-cyan-700",
    cancelled: "border-stone-300 text-stone-600",
  };
  return (
    <Badge variant="outline" className={`text-[10px] ${map[status] ?? ""}`}>
      {PAYMENT_STATUS_LABEL[status] || status?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Detail dialog — opens when "View Details" is clicked on a prescription or
// manual request. Shows images (lightbox), status timeline, admin remarks,
// and timestamps.
// ---------------------------------------------------------------------------
function DetailDialog({
  item,
  onClose,
  onOpenLightbox,
}: {
  item:
    | Extract<UnifiedHistoryItem, { type: "prescription" }>
    | Extract<UnifiedHistoryItem, { type: "manual_request" }>
    | null;
  onClose: () => void;
  onOpenLightbox: (src: string) => void;
}) {
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {item && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={TYPE_META[item.type].className}
                >
                  {TYPE_META[item.type].label}
                </Badge>
                <span className="font-mono text-sm">{item.number}</span>
                <StatusBadge status={item.status} label={item.statusLabel} />
              </DialogTitle>
              <DialogDescription>
                Submitted {formatDateTime(item.date)} · Last updated{" "}
                {formatDateTime(item.details.updatedAt)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* ---- Prescription: image gallery ---- */}
              {item.type === "prescription" && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Uploaded Images ({item.details.imageCount})
                  </p>
                  {item.details.images.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No images attached.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {item.details.images.map((img, i) => (
                        <button
                          key={i}
                          onClick={() => onOpenLightbox(img)}
                          className="group relative aspect-square overflow-hidden rounded-md border bg-accent"
                        >
                          <img
                            src={img}
                            alt={`Prescription ${i + 1}`}
                            className="size-full object-cover transition group-hover:scale-105"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30">
                            <ExternalLink className="size-4 text-white opacity-0 group-hover:opacity-100" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ---- Manual request: medicine list ---- */}
              {item.type === "manual_request" && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Requested Medicines ({item.details.medicines.length})
                  </p>
                  {item.details.medicines.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No medicines listed.</p>
                  ) : (
                    <ul className="space-y-1 rounded-md border bg-accent/30 p-3">
                      {item.details.medicines.map((line, i) => (
                        <li key={i} className="font-mono text-sm">
                          {line}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* ---- Customer's own note (if any) ---- */}
              {item.details.notes && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Your Note
                  </p>
                  <p className="rounded-md border bg-accent/30 p-3 text-sm italic text-muted-foreground">
                    {item.details.notes}
                  </p>
                </div>
              )}

              {/* ---- Admin remarks (if any) ---- */}
              {item.adminRemarks && (
                <div className="flex items-start gap-2 rounded-md border border-muted bg-muted/40 p-3 text-sm">
                  <MessageCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="font-semibold text-foreground">Pharmacist&apos;s note</p>
                    <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">
                      {item.adminRemarks}
                    </p>
                  </div>
                </div>
              )}

              {/* ---- Status timeline ---- */}
              <StatusTimeline
                status={item.status}
                createdAt={item.date}
                updatedAt={item.details.updatedAt}
                convertedOrderId={item.details.convertedOrderId ?? null}
              />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Status timeline — visual progression of the prescription / manual request
// lifecycle. Each step shows a status icon, label, and whether it's done /
// current / pending. Stages: Submitted → Under Review → Approved/Rejected →
// Order Created → Completed. We compute the reached stage from `status`.
// ---------------------------------------------------------------------------
type Stage =
  | { key: "submitted"; label: string; done: boolean; current: boolean; icon: typeof CheckCircle2 }
  | { key: "under_review"; label: string; done: boolean; current: boolean; icon: typeof Clock }
  | { key: "verified"; label: string; done: boolean; current: boolean; icon: typeof CheckCircle2 }
  | { key: "converted"; label: string; done: boolean; current: boolean; icon: typeof CheckCircle2 }
  | { key: "rejected"; label: string; done: boolean; current: boolean; icon: typeof XCircle };

function StatusTimeline({
  status,
  createdAt,
  updatedAt,
  convertedOrderId,
}: {
  status: string;
  createdAt: string;
  updatedAt: string;
  convertedOrderId: string | null;
}) {
  // Determine which stages are "done" / "current" based on `status`.
  // Order: pending → under_review → verified → converted
  // Alt:   pending → under_review → rejected (rejected is terminal)
  const stages: Stage[] = [
    {
      key: "submitted",
      label: "Submitted",
      done: true,
      current: status === "pending",
      icon: CheckCircle2,
    },
    {
      key: "under_review",
      label: "Under Review",
      done:
        status === "under_review" ||
        status === "verified" ||
        status === "converted" ||
        status === "rejected",
      current: status === "under_review",
      icon: Clock,
    },
    {
      key: "verified",
      label: "Approved",
      done: status === "verified" || status === "converted",
      current: status === "verified",
      icon: CheckCircle2,
    },
    {
      key: "converted",
      label: "Order Created",
      done: status === "converted",
      current: status === "converted",
      icon: CheckCircle2,
    },
  ];

  // If rejected, show a terminal "Rejected" stage instead of verified/converted.
  const isRejected = status === "rejected";

  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Status Timeline
      </p>
      <ol className="relative border-l border-muted pl-4">
        {/* Submitted stage — always present */}
        <TimelineStage
          stage={stages[0]}
          timestamp={createdAt}
          timestampLabel="Submitted"
        />
        {/* Under review stage — skip if rejected without going through review */}
        <TimelineStage
          stage={stages[1]}
          timestamp={stages[1].done ? updatedAt : null}
          timestampLabel="Marked Under Review"
        />
        {isRejected ? (
          <TimelineStage
            stage={{
              key: "rejected",
              label: "Rejected",
              done: true,
              current: true,
              icon: XCircle,
            }}
            timestamp={updatedAt}
            timestampLabel="Rejected"
            tone="danger"
          />
        ) : (
          <>
            <TimelineStage
              stage={stages[2]}
              timestamp={stages[2].done ? updatedAt : null}
              timestampLabel="Approved"
            />
            <TimelineStage
              stage={stages[3]}
              timestamp={stages[3].done ? updatedAt : null}
              timestampLabel="Order Created"
              isLast
              convertedOrderId={convertedOrderId}
            />
          </>
        )}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single timeline stage row — icon, label, timestamp, optional "View order"
// link for the converted stage.
// ---------------------------------------------------------------------------
function TimelineStage({
  stage,
  timestamp,
  timestampLabel,
  tone = "default",
  isLast = false,
  convertedOrderId,
}: {
  stage: Stage;
  timestamp: string | null;
  timestampLabel: string;
  tone?: "default" | "danger";
  isLast?: boolean;
  convertedOrderId?: string | null;
}) {
  const navigate = useUI((s) => s.navigate);
  const Icon = stage.icon;

  // Color logic:
  //   done && !current → emerald (completed)
  //   current          → amber (in progress) or rose (rejected)
  //   !done            → muted (pending)
  let iconColor = "text-muted-foreground";
  let iconBg = "bg-muted";
  if (tone === "danger" && stage.current) {
    iconColor = "text-rose-700";
    iconBg = "bg-rose-100";
  } else if (stage.done && !stage.current) {
    iconColor = "text-emerald-700";
    iconBg = "bg-emerald-100";
  } else if (stage.current) {
    iconColor = "text-amber-700";
    iconBg = "bg-amber-100";
  }

  return (
    <li className={`relative ${isLast ? "" : "mb-4"}`}>
      {/* Icon — positioned over the left border */}
      <span
        className={`absolute -left-[1.65rem] flex size-6 items-center justify-center rounded-full ${iconBg}`}
      >
        <Icon className={`size-3.5 ${iconColor}`} />
      </span>
      <p className={`text-sm font-medium ${stage.current ? "text-foreground" : stage.done ? "text-foreground" : "text-muted-foreground"}`}>
        {stage.label}
      </p>
      {timestamp && (
        <p className="text-xs text-muted-foreground">
          {timestampLabel} · {formatDateTime(timestamp)}
        </p>
      )}
      {!timestamp && !stage.done && (
        <p className="text-xs italic text-muted-foreground">Pending</p>
      )}
      {/* "View order" link for the converted stage */}
      {stage.key === "converted" && stage.done && convertedOrderId && (
        <Button
          variant="link"
          size="sm"
          className="mt-1 h-auto gap-1 p-0 text-primary"
          onClick={() =>
            navigate({ name: "track-order", orderId: convertedOrderId })
          }
        >
          Track order <ChevronRight className="size-3" />
        </Button>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Lightbox — full-screen image viewer for prescription images.
// ---------------------------------------------------------------------------
function Lightbox({
  src,
  onClose,
}: {
  src: string | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!src} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl border-none bg-black/90 p-0 sm:max-w-4xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Prescription image</DialogTitle>
          <DialogDescription>Full-screen view</DialogDescription>
        </DialogHeader>
        {src && (
          <div className="relative flex max-h-[90vh] items-center justify-center">
            <img
              src={src}
              alt="Prescription"
              className="max-h-[85vh] w-auto object-contain"
            />
            <button
              onClick={onClose}
              className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// OrdersHeader — title + counts subtitle + auto-refresh badge. Extracted so
// it can be reused on the main view and the "no active/past orders" empty
// state so the header never visually jumps between them.
// ---------------------------------------------------------------------------
function OrdersHeader({
  total,
  ordersCount,
  prescriptionsCount,
  requestsCount,
}: {
  total: number;
  ordersCount: number;
  prescriptionsCount: number;
  requestsCount: number;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My Activity</h1>
        <p className="text-sm text-muted-foreground">
          {total} total · {ordersCount} orders · {prescriptionsCount} prescriptions ·{" "}
          {requestsCount} requests
        </p>
      </div>
      <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground">
        <Clock className="size-3" /> Auto-refreshes every 30s
      </Badge>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OrderSegmentedControl — premium segmented toggle for Active / Past orders.
// Uses a sliding pill background (emerald for Active, muted slate for Past)
// so the active segment is immediately obvious. Each segment also shows a
// count badge so the customer knows how many items each side contains.
// ---------------------------------------------------------------------------
function OrderSegmentedControl({
  value,
  onChange,
  activeCount,
  pastCount,
  className = "",
}: {
  value: OrderSegment;
  onChange: (v: OrderSegment) => void;
  activeCount: number;
  pastCount: number;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label="Filter orders by status"
      className={`inline-flex w-full rounded-xl border border-border/50 bg-card p-1 shadow-premium-sm sm:w-auto ${className}`}
    >
      <button
        role="tab"
        aria-selected={value === "active"}
        onClick={() => onChange("active")}
        className={`relative flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all sm:flex-none ${
          value === "active"
            ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-premium-sm"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        }`}
      >
        <Truck className="size-4" />
        Active Orders
        <span
          className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${
            value === "active"
              ? "bg-white/20 text-white"
              : "bg-accent text-muted-foreground"
          }`}
        >
          {activeCount}
        </span>
      </button>
      <button
        role="tab"
        aria-selected={value === "past"}
        onClick={() => onChange("past")}
        className={`relative flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all sm:flex-none ${
          value === "past"
            ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-premium-sm"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        }`}
      >
        <Package className="size-4" />
        Past Orders
        <span
          className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${
            value === "past"
              ? "bg-white/20 text-white"
              : "bg-accent text-muted-foreground"
          }`}
        >
          {pastCount}
        </span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OrdersSkeleton — premium shimmer loading state shown while the unified
// history query resolves. Mirrors the actual ActivityCard layout (header bar
// + body lines + 3-button action row) so the page never visually jumps.
// ---------------------------------------------------------------------------
export function OrdersSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      {/* Header skeleton */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <div className="h-7 w-40 skeleton-premium rounded" />
          <div className="h-4 w-72 skeleton-premium rounded" />
        </div>
        <div className="h-5 w-36 skeleton-premium rounded-full" />
      </div>

      {/* Tabs skeleton */}
      <div className="mb-3 flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-9 flex-1 skeleton-premium rounded-lg"
          />
        ))}
      </div>

      {/* Activity cards skeleton */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="overflow-hidden rounded-xl border border-border/50 shadow-premium-sm"
          >
            {/* Header */}
            <div className="flex flex-wrap items-center gap-2 border-b border-border/50 p-4">
              <div className="h-5 w-20 skeleton-premium rounded-full" />
              <div className="h-4 w-32 skeleton-premium rounded" />
              <div className="h-5 w-16 skeleton-premium rounded-full" />
            </div>
            {/* Body */}
            <div className="space-y-2 p-4">
              <div className="h-3 w-20 skeleton-premium rounded" />
              <div className="h-4 w-3/4 skeleton-premium rounded" />
              <div className="flex gap-3 pt-1">
                <div className="h-3 w-24 skeleton-premium rounded" />
                <div className="h-3 w-20 skeleton-premium rounded" />
                <div className="h-3 w-16 skeleton-premium rounded" />
              </div>
              <div className="flex items-end justify-between pt-2">
                <div className="space-y-1.5">
                  <div className="h-3 w-16 skeleton-premium rounded" />
                  <div className="h-6 w-24 skeleton-premium rounded" />
                </div>
                <div className="h-4 w-12 skeleton-premium rounded" />
              </div>
            </div>
            {/* Action row */}
            <div className="grid grid-cols-3 gap-2 border-t border-border/50 bg-accent/20 p-3">
              <div className="h-8 skeleton-premium rounded-md" />
              <div className="h-8 skeleton-premium rounded-md" />
              <div className="h-8 skeleton-premium rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
