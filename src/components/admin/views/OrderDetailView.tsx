// ============================================================================
// File: src/components/admin/views/OrderDetailView.tsx
// Purpose: Premium, enterprise-grade admin Order Detail view (PMS2 redesign).
//          Inspired by Shopify Order Detail + Stripe Payment Detail.
//
//          Layout (single scroll, no tabs):
//            1. Premium Header Card        — order #, status, date, source,
//                                             quick action toolbar
//            2. Smart Status Workflow      — current status + allowed next
//                                             transitions (VALID_TRANSITIONS)
//            3. Payment Management Panel   — status badge, editable txn id,
//                                             gateway, update dropdown w/ note
//            4. Information Cards Grid      — Customer / Address / Payment /
//                                             Pricing (2-col on desktop)
//            5. Ordered Products Table     — image, name, qty, price, total,
//                                             Rx badge; mobile = cards
//            6. Order Timeline             — vertical, color-coded, staggered
//            7. Notes + Activity Log       — internal notes CRUD + activity
//                                             feed (status + payment events)
//            8. Prescription Card          — image gallery + verify/reject
//                                             (conditional)
//            9. Mobile Sticky Action Bar   — primary next-status action +
//                                             cancel/invoice shortcuts
//
//          Mobile-first, dark-mode aware, emerald accent. Touch targets ≥44px.
// ============================================================================

"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, run } from "../api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { EmptyState, ProductThumb } from "../ui";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Printer,
  CheckCircle2,
  PackageCheck,
  Truck,
  PartyPopper,
  XCircle,
  Clock,
  Trash2,
  Loader2,
  User,
  MapPin,
  CreditCard,
  FileImage,
  ClipboardList,
  Receipt,
  Hash,
  CalendarClock,
  Copy,
  ExternalLink,
  Phone,
  Mail,
  StickyNote,
  ShieldCheck,
  ShieldX,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Package,
  History,
  Wallet,
  Banknote,
  QrCode,
  Smartphone,
  MessageSquare,
  ChevronRight,
  AlertTriangle,
  CircleCheck,
  CircleDot,
  Building2,
  IdCard,
  Send,
  Activity,
} from "lucide-react";
import { useAdminStore } from "../admin-store";
import {
  formatCurrency,
  formatDateTime,
  formatDate,
  getInitials,
} from "@/lib/format";
import { PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types — mirror the API contract (GET /api/admin/orders/[id])
// ---------------------------------------------------------------------------
type OrderNote = {
  id: string;
  body: string;
  authorId: string | null;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
};

type PrescriptionData = {
  id: string;
  images: string[];
  notes: string | null;
  status: string;
  adminNotes: string | null;
  createdAt: string;
} | null;

type StatusHistoryEntry = {
  id: string;
  status: string;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
};

type OrderItem = {
  id: string;
  name: string;
  image: string | null;
  sku?: string | null;
  mrp: number;
  qty: number;
  lineTotal: number;
  appliedDiscountPct: number;
  product?: {
    id: string;
    name: string;
    stock: number;
    prescriptionRequired?: boolean;
  } | null;
};

type OrderDetail = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  paymentId: string | null;
  paymentGateway: string | null;
  paymentScreenshot: string | null;
  paymentScreenshotUploadedAt: string | null;
  paymentTxnId: string | null;
  shipName: string;
  shipPhone: string;
  shipLine1: string;
  shipLine2: string | null;
  shipCity: string;
  shipDistrict: string;
  shipState: string;
  shipPincode: string;
  shipLocality: string | null;
  itemsTotal: number;
  productDiscount: number;
  voucherDiscount: number;
  voucherCode: string | null;
  deliveryCharge: number;
  taxTotal: number;
  grandTotal: number;
  roundOff: number;
  loyaltyPointsRedeemed: number;
  loyaltyDiscount: number;
  source: string;
  prescriptionId: string | null;
  notes: string | null;
  adminNotes: string | null;
  estimatedDelivery: string | null;
  confirmedAt: string | null;
  packedAt: string | null;
  outForDeliveryAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
    isActive: boolean;
  } | null;
  items: OrderItem[];
  statusHistory: StatusHistoryEntry[];
  orderNotes: OrderNote[];
  prescription: PrescriptionData;
  customerStats: { orderCount: number; totalSpent: number } | null;
};

// ---------------------------------------------------------------------------
// Smart status workflow — mirrors VALID_TRANSITIONS on the server
// (src/app/api/admin/orders/[id]/status/route.ts). Kept in sync so the UI
// only offers transitions the API will accept.
// ---------------------------------------------------------------------------
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["packed", "out_for_delivery", "delivered", "cancelled"],
  packed: ["out_for_delivery", "delivered", "cancelled"],
  out_for_delivery: ["delivered", "cancelled"],
  delivered: ["returned"],
  returned: [],
  cancelled: [],
};

const TERMINAL_STATUSES = new Set(["cancelled", "returned"]);

// Visual config for each status — icon, label, and tint (used for badges,
// timeline dots, and the "next status" action buttons).
type StatusVisual = {
  label: string;
  icon: typeof CheckCircle2;
  dot: string; // dot color
  ring: string; // ring-2 ring-... classes for prominent badges
  tint: string; // action button background
  tintHover: string;
};

const STATUS_VISUAL: Record<string, StatusVisual> = {
  pending: {
    label: "Pending",
    icon: Clock,
    dot: "bg-amber-500",
    ring: "ring-amber-200 dark:ring-amber-900/50",
    tint: "bg-amber-600",
    tintHover: "hover:bg-amber-700",
  },
  confirmed: {
    label: "Confirmed",
    icon: CheckCircle2,
    dot: "bg-cyan-500",
    ring: "ring-cyan-200 dark:ring-cyan-900/50",
    tint: "bg-cyan-600",
    tintHover: "hover:bg-cyan-700",
  },
  packed: {
    label: "Packed",
    icon: PackageCheck,
    dot: "bg-teal-600",
    ring: "ring-teal-200 dark:ring-teal-900/50",
    tint: "bg-teal-600",
    tintHover: "hover:bg-teal-700",
  },
  out_for_delivery: {
    label: "Out for Delivery",
    icon: Truck,
    dot: "bg-orange-500",
    ring: "ring-orange-200 dark:ring-orange-900/50",
    tint: "bg-orange-600",
    tintHover: "hover:bg-orange-700",
  },
  delivered: {
    label: "Delivered",
    icon: PartyPopper,
    dot: "bg-emerald-500",
    ring: "ring-emerald-200 dark:ring-emerald-900/50",
    tint: "bg-emerald-600",
    tintHover: "hover:bg-emerald-700",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    dot: "bg-rose-500",
    ring: "ring-rose-200 dark:ring-rose-900/50",
    tint: "bg-rose-600",
    tintHover: "hover:bg-rose-700",
  },
  returned: {
    label: "Returned",
    icon: RotateCw,
    dot: "bg-stone-500",
    ring: "ring-stone-200 dark:ring-stone-700/60",
    tint: "bg-stone-600",
    tintHover: "hover:bg-stone-700",
  },
};

// ---------------------------------------------------------------------------
// Payment status visual config — colors per the spec.
// pending: amber, paid: emerald, partially_paid: cyan, failed: red,
// refunded: rose, refund_initiated: orange, cancelled: slate
// ---------------------------------------------------------------------------
type PaymentVisual = {
  label: string;
  badge: string; // bg + text classes
  dot: string;
};

const PAYMENT_VISUAL: Record<string, PaymentVisual> = {
  pending: {
    label: "Pending",
    badge:
      "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/60",
    dot: "bg-amber-500",
  },
  paid: {
    label: "Paid",
    badge:
      "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900/60",
    dot: "bg-emerald-500",
  },
  partially_paid: {
    label: "Partially Paid",
    badge:
      "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-900/60",
    dot: "bg-cyan-500",
  },
  failed: {
    label: "Failed",
    badge:
      "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900/60",
    dot: "bg-red-500",
  },
  refunded: {
    label: "Refunded",
    badge:
      "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900/60",
    dot: "bg-rose-500",
  },
  refund_initiated: {
    label: "Refund Initiated",
    badge:
      "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-900/60",
    dot: "bg-orange-500",
  },
  cancelled: {
    label: "Cancelled",
    badge:
      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700",
    dot: "bg-slate-500",
  },
};

const PAYMENT_STATUS_ORDER = [
  "pending",
  "paid",
  "partially_paid",
  "failed",
  "refunded",
  "refund_initiated",
  "cancelled",
];

// ---------------------------------------------------------------------------
// Status badge helper components
// ---------------------------------------------------------------------------
function OrderStatusBadge({
  status,
  size = "md",
}: {
  status: string;
  size?: "sm" | "md" | "lg";
}) {
  const v = STATUS_VISUAL[status] || STATUS_VISUAL.pending;
  const Icon = v.icon;
  const sizeCls =
    size === "lg"
      ? "text-sm px-3 py-1.5 gap-1.5"
      : size === "sm"
        ? "text-[11px] px-2 py-0.5 gap-1"
        : "text-xs px-2.5 py-1 gap-1";
  const iconCls = size === "lg" ? "size-4" : "size-3";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-semibold ring-2",
        v.ring,
        sizeCls,
        status === "delivered"
          ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900/60"
          : status === "cancelled"
            ? "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900/60"
            : status === "pending"
              ? "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/60"
              : status === "confirmed"
                ? "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-900/60"
                : status === "packed"
                  ? "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-900/60"
                  : status === "out_for_delivery"
                    ? "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-900/60"
                    : "bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-800/60 dark:text-stone-300 dark:border-stone-700"
      )}
    >
      <Icon className={iconCls} />
      {v.label}
    </span>
  );
}

function PaymentStatusBadge({
  status,
  size = "md",
}: {
  status: string;
  size?: "sm" | "md" | "lg";
}) {
  const v = PAYMENT_VISUAL[status] || PAYMENT_VISUAL.pending;
  const sizeCls =
    size === "lg"
      ? "text-sm px-3 py-1.5 gap-1.5"
      : size === "sm"
        ? "text-[11px] px-2 py-0.5 gap-1"
        : "text-xs px-2.5 py-1 gap-1";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-semibold",
        v.badge,
        sizeCls
      )}
    >
      <span className={cn("size-1.5 rounded-full", v.dot)} />
      {v.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Source badge
// ---------------------------------------------------------------------------
function SourceBadge({ source }: { source: string }) {
  if (source === "prescription") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700 dark:border-teal-900/50 dark:bg-teal-950/40 dark:text-teal-300">
        <FileImage className="size-3" /> Prescription
      </span>
    );
  }
  if (source === "manual_request") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
        <ClipboardList className="size-3" /> Manual Request
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
      <Package className="size-3" /> Direct Order
    </span>
  );
}

// ---------------------------------------------------------------------------
// Payment method icon helper
// ---------------------------------------------------------------------------
function PaymentMethodIcon({ method }: { method: string }) {
  const Icon =
    method === "cod"
      ? Banknote
      : method === "qr"
        ? QrCode
        : method === "upi"
          ? Smartphone
          : method === "online" ||
              method === "razorpay" ||
              method === "cashfree"
            ? CreditCard
            : Wallet;
  return <Icon className="size-4 text-muted-foreground" />;
}

// ===========================================================================
// MAIN COMPONENT
// ===========================================================================
export function OrderDetailView({ id }: { id: string }) {
  const back = useAdminStore((s) => s.back);
  const navigate = useAdminStore((s) => s.navigate);
  const qc = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ["admin-order", id],
    queryFn: () => api.get<OrderDetail>(`/api/admin/orders/${id}`),
  });

  // -------- Local UI state --------
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  // Payment management
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [paymentIdDraft, setPaymentIdDraft] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);

  // Notes
  const [notes, setNotes] = useState<OrderNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Mobile action sheet
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);

  // Keep payment + notes state in sync with order data
  useEffect(() => {
    if (order) {
      setPaymentStatus(order.paymentStatus);
      setPaymentIdDraft(order.paymentId || "");
      setNotes(order.orderNotes ?? []);
    }
  }, [order?.paymentStatus, order?.paymentId, order?.orderNotes]);

  // -------- Action handlers --------
  async function changeStatus(status: string, reason?: string, note?: string) {
    setBusy(true);
    const r = await run(
      () => api.patch(`/api/admin/orders/${id}/status`, { status, reason, note }),
      { success: `Order marked as ${STATUS_VISUAL[status]?.label || status}`, error: "Status update failed" }
    );
    setBusy(false);
    if (r) {
      qc.invalidateQueries({ queryKey: ["admin-order", id] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["admin-orders-stats"] });
      setMobileActionsOpen(false);
    }
  }

  async function downloadInvoice() {
    try {
      const buf = await api.raw(`/api/admin/orders/${id}/invoice`);
      const blob = new Blob([buf], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${order?.orderNumber || "invoice"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Invoice downloaded");
    } catch (e: any) {
      toast.error(e?.message || "Failed to download invoice");
    }
  }

  function printInvoice() {
    // Reuse the invoice endpoint — open in a new tab where the browser's
    // built-in PDF viewer exposes its print button. Cleaner than re-rendering
    // the order into a print stylesheet.
    window.open(`/api/admin/orders/${id}/invoice`, "_blank", "noopener");
  }

  function contactCustomer() {
    if (order?.customer?.phone) {
      window.location.href = `tel:${order.customer.phone}`;
    } else if (order?.shipPhone) {
      window.location.href = `tel:${order.shipPhone}`;
    } else {
      toast.error("No phone number on this order");
    }
  }

  function copyOrderId() {
    if (!order) return;
    navigator.clipboard.writeText(order.id).then(
      () => toast.success("Order ID copied"),
      () => toast.error("Failed to copy")
    );
  }

  // -------- Payment update --------
  async function confirmPaymentUpdate() {
    if (!order) return;
    if (paymentStatus === order.paymentStatus && paymentIdDraft === (order.paymentId || "")) {
      toast.info("No changes to save");
      setPaymentDialogOpen(false);
      return;
    }
    setSavingPayment(true);
    const r = await run(
      () =>
        api.patch(`/api/admin/orders/${id}/payment`, {
          paymentStatus,
          paymentId: paymentIdDraft.trim() || undefined,
          note: paymentNote.trim() || undefined,
        }),
      {
        success: "Payment status updated",
        error: "Failed to update payment",
        silent: true,
      }
    );
    setSavingPayment(false);
    if (r) {
      setPaymentDialogOpen(false);
      setPaymentNote("");
      qc.invalidateQueries({ queryKey: ["admin-order", id] });
      toast.success("Payment status updated");
    }
  }

  // -------- Notes CRUD --------
  async function addNote() {
    if (!newNote.trim()) return;
    setSavingNote(true);
    const r = await run(
      () => api.post<OrderNote>(`/api/admin/orders/${id}/notes`, { body: newNote.trim() }),
      { success: "Note added", error: "Failed to add note", silent: true }
    );
    setSavingNote(false);
    if (r) {
      setNotes((prev) => [...prev, r]);
      setNewNote("");
      qc.invalidateQueries({ queryKey: ["admin-order", id] });
      toast.success("Note added");
    }
  }

  async function deleteNote(noteId: string) {
    if (!confirm("Delete this note? This cannot be undone.")) return;
    const r = await run(() => api.del(`/api/admin/orders/${id}/notes/${noteId}`), {
      success: "Note deleted",
      error: "Failed to delete note",
      silent: true,
    });
    if (r) {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      qc.invalidateQueries({ queryKey: ["admin-order", id] });
      toast.success("Note deleted");
    }
  }

  // -------- Prescription verify --------
  async function verifyPrescription(action: "approve" | "reject", reason?: string) {
    setBusy(true);
    const r = await run(
      () => api.post(`/api/admin/orders/${id}/prescription-verify`, { action, reason }),
      {
        success:
          action === "approve"
            ? "Prescription approved — customer notified"
            : "Prescription rejected — order cancelled, customer notified",
        error: "Verification failed",
      }
    );
    setBusy(false);
    if (r) {
      qc.invalidateQueries({ queryKey: ["admin-order", id] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["admin-orders-stats"] });
    }
  }

  // -------- Derived data --------
  const allowedNext = order ? VALID_TRANSITIONS[order.status] ?? [] : [];
  const isTerminal = order ? TERMINAL_STATUSES.has(order.status) : false;

  const mapsQuery = useMemo(() => {
    if (!order) return "";
    return encodeURIComponent(
      [
        order.shipLine1,
        order.shipLine2,
        order.shipLocality,
        order.shipCity,
        order.shipState,
        order.shipPincode,
      ]
        .filter(Boolean)
        .join(", ")
    );
  }, [order]);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  const fullAddress = useMemo(() => {
    if (!order) return "";
    return [
      order.shipName,
      order.shipLine1,
      order.shipLine2,
      order.shipLocality,
      `${order.shipCity}, ${order.shipState} ${order.shipPincode}`,
      `Phone: ${order.shipPhone}`,
    ]
      .filter(Boolean)
      .join("\n");
  }, [order]);

  function copyAddress() {
    navigator.clipboard.writeText(fullAddress).then(
      () => toast.success("Address copied to clipboard"),
      () => toast.error("Failed to copy address")
    );
  }

  // Activity feed — combines status history + notes into one chronological list.
  // Status history entries with notes that look like "Payment status: X → Y"
  // are tagged as payment events so we can show them with a distinct icon.
  type ActivityItem = {
    id: string;
    kind: "status" | "payment" | "note";
    title: string;
    description?: string | null;
    timestamp: string;
    actor?: string | null;
  };
  const activityFeed: ActivityItem[] = useMemo(() => {
    if (!order) return [];
    const items: ActivityItem[] = [];

    for (const h of order.statusHistory) {
      const isPaymentEvent =
        h.note?.startsWith("Payment status:") || h.note?.includes("Payment status:");
      items.push({
        id: h.id,
        kind: isPaymentEvent ? "payment" : "status",
        title: isPaymentEvent
          ? "Payment status changed"
          : `Order ${STATUS_VISUAL[h.status]?.label || h.status.replace(/_/g, " ")}`,
        description: h.note,
        timestamp: h.createdAt,
        actor: h.createdBy === "system" ? "System" : "Admin",
      });
    }

    for (const n of order.orderNotes) {
      items.push({
        id: `note-${n.id}`,
        kind: "note",
        title: "Internal note added",
        description: n.body,
        timestamp: n.createdAt,
        actor: n.authorName || "Admin",
      });
    }

    // Sort newest first.
    return items.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [order]);

  // -------- Loading & empty states --------
  if (isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonHeader />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardContent className="pt-6 h-64 skeleton-premium rounded-xl" />
          </Card>
          <Card>
            <CardContent className="pt-6 h-64 skeleton-premium rounded-xl" />
          </Card>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={back} className="gap-1.5">
          <ArrowLeft className="size-4" /> Back to Orders
        </Button>
        <EmptyState
          title="Order not found"
          description="This order may have been deleted, or the ID is invalid."
          icon={<Package className="size-6" />}
          action={
            <Button onClick={() => navigate({ name: "orders" })} variant="outline">
              View all orders
            </Button>
          }
        />
      </div>
    );
  }

  const hasRxItems = order.items.some((it) => it.product?.prescriptionRequired);

  return (
    <div className="space-y-5 pb-24 lg:pb-6">
      {/* ================================================================
          1. PREMIUM HEADER CARD
          ================================================================ */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <Card className="overflow-hidden border-emerald-200/60 dark:border-emerald-900/40 shadow-premium">
          <CardContent className="p-0">
            {/* Top row: back + meta */}
            <div className="flex items-center gap-2 px-4 sm:px-6 pt-4 pb-3 border-b border-border/60 bg-gradient-to-r from-emerald-50/50 to-transparent dark:from-emerald-950/20">
              <Button
                variant="ghost"
                size="sm"
                onClick={back}
                className="gap-1.5 -ml-1 min-h-[40px]"
              >
                <ArrowLeft className="size-4" /> Back to Orders
              </Button>
              <div className="ml-auto hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarClock className="size-3.5" />
                Placed {formatDateTime(order.createdAt)}
              </div>
            </div>

            {/* Main row: order number + status + quick actions */}
            <div className="px-4 sm:px-6 py-4 flex flex-col lg:flex-row lg:items-start gap-4 lg:gap-6">
              <div className="flex-1 min-w-0 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground truncate">
                    {order.orderNumber}
                  </h1>
                  <OrderStatusBadge status={order.status} size="lg" />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <SourceBadge source={order.source} />
                  {hasRxItems && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                      <FileImage className="size-3" /> Contains Rx Items
                    </span>
                  )}
                  {order.voucherCode && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700 dark:border-purple-900/50 dark:bg-purple-950/40 dark:text-purple-300">
                      <Hash className="size-3" /> Voucher: {order.voucherCode}
                    </span>
                  )}
                  <span className="sm:hidden inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarClock className="size-3.5" />
                    {formatDate(order.createdAt)}
                  </span>
                </div>

                {/* Quick action toolbar */}
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={printInvoice}
                    className="gap-1.5 min-h-[40px]"
                  >
                    <Printer className="size-4" /> Print
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadInvoice}
                    className="gap-1.5 min-h-[40px]"
                  >
                    <Download className="size-4" /> Invoice
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={contactCustomer}
                    className="gap-1.5 min-h-[40px]"
                  >
                    <Phone className="size-4" /> Contact
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyOrderId}
                    className="gap-1.5 min-h-[40px] font-mono text-xs"
                    title={order.id}
                  >
                    <Copy className="size-4" /> Copy ID
                  </Button>
                </div>
              </div>

              {/* Grand total summary block (desktop) */}
              <div className="hidden lg:block w-56 shrink-0 rounded-xl border border-emerald-200/60 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/40 p-4">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                  Grand Total
                </div>
                <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                  {formatCurrency(order.grandTotal)}
                </div>
                <div className="mt-2 pt-2 border-t border-emerald-200/40 dark:border-emerald-900/40">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                    Payment
                  </div>
                  <div className="mt-1">
                    <PaymentStatusBadge status={order.paymentStatus} size="sm" />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ================================================================
          2. SMART STATUS WORKFLOW PANEL
          ================================================================ */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.05 }}
      >
        <Card className="shadow-premium-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base flex items-center gap-2">
                <CircleDot className="size-4 text-emerald-600" />
                Status Workflow
              </CardTitle>
              {order.estimatedDelivery && (
                <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <CalendarClock className="size-3.5" />
                  ETA: {formatDate(order.estimatedDelivery)}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current status row */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                Current
              </span>
              <OrderStatusBadge status={order.status} size="lg" />
              {isTerminal && (
                <span className="text-xs text-muted-foreground italic">
                  (terminal — no further transitions)
                </span>
              )}
            </div>

            {/* Allowed next statuses */}
            {!isTerminal && allowedNext.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  Advance to
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {allowedNext
                    .filter((s) => s !== "cancelled")
                    .map((nextStatus) => {
                      const v = STATUS_VISUAL[nextStatus];
                      if (!v) return null;
                      const Icon = v.icon;
                      return (
                        <Button
                          key={nextStatus}
                          size="sm"
                          disabled={busy}
                          onClick={() => changeStatus(nextStatus)}
                          className={cn(
                            "gap-1.5 min-h-[44px] text-white shadow-premium-sm",
                            v.tint,
                            v.tintHover
                          )}
                        >
                          {busy ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Icon className="size-4" />
                          )}
                          Mark {v.label}
                        </Button>
                      );
                    })}

                  {allowedNext.includes("cancelled") && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setCancelOpen(true)}
                      className="gap-1.5 min-h-[44px] text-rose-600 hover:text-rose-700 hover:border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    >
                      <XCircle className="size-4" /> Cancel Order
                    </Button>
                  )}
                </div>
              </div>
            )}

            {isTerminal && (
              <div
                className={cn(
                  "rounded-lg border p-3 flex items-start gap-2 text-sm",
                  order.status === "cancelled"
                    ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-200"
                    : "bg-stone-50 dark:bg-stone-900/40 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300"
                )}
              >
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <div>
                  This order is in a terminal state (<strong>{order.status}</strong>).
                  No further status transitions are allowed.
                  {order.cancelledAt && (
                    <div className="text-xs mt-1 opacity-80">
                      Cancelled at {formatDateTime(order.cancelledAt)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ================================================================
          3. PAYMENT MANAGEMENT PANEL
          ================================================================ */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.1 }}
      >
        <Card className="shadow-premium-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="size-4 text-emerald-600" />
              Payment Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Method */}
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                  Method
                </div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <PaymentMethodIcon method={order.paymentMethod} />
                  {PAYMENT_METHOD_LABEL[order.paymentMethod] || order.paymentMethod}
                </div>
              </div>

              {/* Current status (prominent) */}
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                  Current Status
                </div>
                <PaymentStatusBadge status={order.paymentStatus} size="lg" />
              </div>

              {/* Gateway */}
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                  Gateway
                </div>
                <div className="text-sm font-medium capitalize">
                  {order.paymentGateway || "—"}
                </div>
              </div>
            </div>

            {/* Payment ID + action row */}
            <div className="mt-4 pt-4 border-t border-border/60 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Hash className="size-3" /> Transaction ID
                  </Label>
                  <Input
                    value={paymentIdDraft}
                    onChange={(e) => setPaymentIdDraft(e.target.value)}
                    placeholder="e.g. pay_NX7k2bQwAbC123"
                    className="font-mono text-sm h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    New Status
                  </Label>
                  <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_STATUS_ORDER.map((s) => (
                        <SelectItem key={s} value={s}>
                          <span className="flex items-center gap-2">
                            <span
                              className={cn(
                                "size-1.5 rounded-full",
                                PAYMENT_VISUAL[s]?.dot
                              )}
                            />
                            {PAYMENT_VISUAL[s]?.label || s}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-xs text-muted-foreground">
                  {paymentStatus !== order.paymentStatus ||
                  paymentIdDraft !== (order.paymentId || "") ? (
                    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <CircleDot className="size-3" /> Unsaved changes
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <CircleCheck className="size-3" /> All changes saved
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={() => setPaymentDialogOpen(true)}
                  disabled={
                    savingPayment ||
                    (paymentStatus === order.paymentStatus &&
                      paymentIdDraft === (order.paymentId || ""))
                  }
                  className="gap-1.5 min-h-[40px] bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <CheckCircle2 className="size-4" />
                  Update Payment
                </Button>
              </div>

              {/* Payment screenshot (if any) */}
              {order.paymentScreenshot && (
                <div className="pt-3 border-t border-border/60">
                  <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <Receipt className="size-3.5" /> Payment Proof
                    {order.paymentScreenshotUploadedAt && (
                      <span className="text-muted-foreground/70">
                        · {formatDateTime(order.paymentScreenshotUploadedAt)}
                      </span>
                    )}
                  </div>
                  <a
                    href={order.paymentScreenshot}
                    target="_blank"
                    rel="noreferrer"
                    className="block w-40 rounded-md border overflow-hidden hover:border-emerald-400 transition-premium"
                  >
                    <img
                      src={order.paymentScreenshot}
                      alt="Payment screenshot"
                      className="w-full h-28 object-cover bg-white"
                    />
                  </a>
                </div>
              )}

              {/* COD callout */}
              {order.paymentMethod === "cod" && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900/50 p-3 text-sm flex items-start gap-2">
                  <Banknote className="size-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-amber-800 dark:text-amber-200">
                      Collect on Delivery
                    </div>
                    <div className="text-amber-700 dark:text-amber-300 mt-0.5">
                      Collect{" "}
                      <strong>{formatCurrency(order.grandTotal)}</strong> in cash
                      from the customer at delivery.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ================================================================
          4. INFORMATION CARDS GRID (Customer / Address / Payment / Pricing)
          ================================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Customer Information */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.15 }}
        >
          <Card className="h-full shadow-premium-sm">
            <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="size-4 text-emerald-600" /> Customer
              </CardTitle>
              {order.customer && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() =>
                    navigate({ name: "customer-detail", id: order.customer!.id })
                  }
                >
                  View Profile <ArrowRight className="size-3" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {order.customer ? (
                <>
                  <button
                    className="flex items-center gap-3 w-full text-left -mx-1 px-1 py-1 rounded hover:bg-muted/40 transition-premium"
                    onClick={() =>
                      navigate({ name: "customer-detail", id: order.customer!.id })
                    }
                  >
                    <div className="size-11 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-bold shadow-premium-sm">
                      {getInitials(order.customer.name || "U")}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">
                        {order.customer.name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate font-mono">
                        ID: {order.customer.id.slice(-8)}
                      </div>
                    </div>
                  </button>

                  <div className="space-y-1.5 text-sm">
                    {order.customer.email && (
                      <a
                        href={`mailto:${order.customer.email}`}
                        className="flex items-center gap-2 text-sm hover:text-emerald-700 dark:hover:text-emerald-400 transition-premium"
                      >
                        <Mail className="size-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{order.customer.email}</span>
                      </a>
                    )}
                    {order.customer.phone && (
                      <a
                        href={`tel:${order.customer.phone}`}
                        className="flex items-center gap-2 text-sm hover:text-emerald-700 dark:hover:text-emerald-400 transition-premium"
                      >
                        <Phone className="size-3.5 text-muted-foreground shrink-0" />
                        {order.customer.phone}
                      </a>
                    )}
                  </div>

                  {order.customerStats && (
                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border/60">
                      <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 p-2.5">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                          Previous Orders
                        </div>
                        <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                          {order.customerStats.orderCount}
                        </div>
                      </div>
                      <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 p-2.5">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                          Lifetime Spent
                        </div>
                        <div className="text-lg font-bold text-amber-700 dark:text-amber-400">
                          {formatCurrency(order.customerStats.totalSpent)}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-muted-foreground italic flex items-center gap-2 py-2">
                  <User className="size-4" /> Customer deleted — using shipping
                  snapshot.
                </div>
              )}

              {/* Shipping snapshot name fallback */}
              {!order.customer && (
                <div className="text-sm font-medium pt-1">{order.shipName}</div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Delivery Address */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.2 }}
        >
          <Card className="h-full shadow-premium-sm">
            <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="size-4 text-emerald-600" /> Delivery Address
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={copyAddress}
                >
                  <Copy className="size-3" /> Copy
                </Button>
                <a href={mapsUrl} target="_blank" rel="noreferrer">
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                    <ExternalLink className="size-3" /> Maps
                  </Button>
                </a>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="font-semibold">{order.shipName}</div>
              <div className="text-muted-foreground leading-relaxed">
                {order.shipLine1}
                {order.shipLine2 && (
                  <>
                    <br />
                    {order.shipLine2}
                  </>
                )}
                {order.shipLocality && (
                  <>
                    <br />
                    {order.shipLocality}
                  </>
                )}
                <br />
                {order.shipCity}, {order.shipState} {order.shipPincode}
                <br />
                <span className="inline-flex items-center gap-1 mt-0.5">
                  <Building2 className="size-3" /> District: {order.shipDistrict}
                </span>
              </div>
              <a
                href={`tel:${order.shipPhone}`}
                className="inline-flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400 hover:underline pt-2 border-t border-border/60 mt-2"
              >
                <Phone className="size-3.5" /> {order.shipPhone}
              </a>
              {order.notes && (
                <div className="pt-2 mt-2 border-t border-border/60">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1 flex items-center gap-1">
                    <ClipboardList className="size-3" /> Delivery Instructions
                  </div>
                  <div className="text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 rounded p-2 whitespace-pre-wrap">
                    {order.notes}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Payment Information */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.25 }}
        >
          <Card className="h-full shadow-premium-sm">
            <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="size-4 text-emerald-600" /> Payment Info
              </CardTitle>
              <PaymentMethodIcon method={order.paymentMethod} />
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Method</span>
                <span className="font-medium">
                  {PAYMENT_METHOD_LABEL[order.paymentMethod] || order.paymentMethod}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <PaymentStatusBadge status={order.paymentStatus} size="sm" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground inline-flex items-center gap-1 shrink-0">
                  <Hash className="size-3.5" /> Transaction ID
                </span>
                <span className="font-mono font-medium text-xs truncate">
                  {order.paymentId || "—"}
                </span>
              </div>
              {order.paymentTxnId && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground inline-flex items-center gap-1 shrink-0">
                    <IdCard className="size-3.5" /> Customer Txn
                  </span>
                  <span className="font-mono font-medium text-xs truncate">
                    {order.paymentTxnId}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Gateway</span>
                <span className="font-medium capitalize">
                  {order.paymentGateway || "—"}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Pricing Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.3 }}
        >
          <Card className="h-full shadow-premium-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="size-4 text-emerald-600" /> Pricing Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <PriceRow
                label="Subtotal (MRP × Qty)"
                value={formatCurrency(order.itemsTotal)}
              />
              {order.productDiscount > 0 && (
                <PriceRow
                  label="Product Discount"
                  value={`- ${formatCurrency(order.productDiscount)}`}
                  accent="emerald"
                />
              )}
              {order.voucherDiscount > 0 && (
                <PriceRow
                  label={`Voucher${order.voucherCode ? ` (${order.voucherCode})` : ""}`}
                  value={`- ${formatCurrency(order.voucherDiscount)}`}
                  accent="emerald"
                />
              )}
              {order.loyaltyDiscount > 0 && (
                <PriceRow
                  label={`Loyalty (${order.loyaltyPointsRedeemed} pts)`}
                  value={`- ${formatCurrency(order.loyaltyDiscount)}`}
                  accent="amber"
                />
              )}
              <PriceRow
                label="Delivery Charge"
                value={
                  order.deliveryCharge === 0
                    ? "FREE"
                    : formatCurrency(order.deliveryCharge)
                }
                accent={order.deliveryCharge === 0 ? "emerald" : undefined}
              />
              {order.taxTotal > 0 && (
                <PriceRow label="Tax" value={formatCurrency(order.taxTotal)} />
              )}
              {order.roundOff !== 0 && (
                <PriceRow
                  label="Round Off"
                  value={`${order.roundOff > 0 ? "+" : ""}${formatCurrency(order.roundOff)}`}
                />
              )}
              <div className="border-t pt-2 mt-2 flex items-center justify-between">
                <span className="text-base font-semibold">Grand Total</span>
                <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(order.grandTotal)}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ================================================================
          5. ORDERED PRODUCTS TABLE
          ================================================================ */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.35 }}
      >
        <Card className="shadow-premium-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="size-4 text-emerald-600" />
              Ordered Products
              <Badge className="ml-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                {order.items.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Line Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((it) => (
                    <TableRow key={it.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <ProductThumb image={it.image} name={it.name} size={44} />
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate max-w-[260px]">
                              {it.name}
                            </div>
                            {it.sku && (
                              <div className="text-xs text-muted-foreground font-mono">
                                {it.sku}
                              </div>
                            )}
                            {it.product?.prescriptionRequired && (
                              <span className="inline-flex items-center gap-0.5 text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                                <FileImage className="size-2.5" /> Rx Required
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatCurrency(it.mrp)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded-md bg-muted/60 font-medium">
                          {it.qty}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold">
                        {formatCurrency(it.lineTotal)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y">
              {order.items.map((it) => (
                <div key={it.id} className="p-3 flex items-start gap-3">
                  <ProductThumb image={it.image} name={it.name} size={44} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{it.name}</div>
                    {it.sku && (
                      <div className="text-xs text-muted-foreground font-mono truncate">
                        {it.sku}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{formatCurrency(it.mrp)} / unit</span>
                      <span>× {it.qty}</span>
                      {it.product?.prescriptionRequired && (
                        <span className="inline-flex items-center gap-0.5 text-rose-600 dark:text-rose-400">
                          <FileImage className="size-2.5" /> Rx
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm font-semibold shrink-0">
                    {formatCurrency(it.lineTotal)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ================================================================
          6. TIMELINE  +  7. NOTES + ACTIVITY LOG (side-by-side on desktop)
          ================================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Order Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.4 }}
        >
          <Card className="h-full shadow-premium-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="size-4 text-emerald-600" /> Order Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OrderTimeline
                statusHistory={order.statusHistory}
                currentStatus={order.status}
              />
            </CardContent>
          </Card>
        </motion.div>

        {/* Internal Notes */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.45 }}
        >
          <Card className="h-full shadow-premium-sm">
            <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base flex items-center gap-2">
                <StickyNote className="size-4 text-emerald-600" /> Internal Notes
                <Badge className="ml-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                  {notes.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Add note */}
              <div className="flex gap-2">
                <Textarea
                  placeholder="Add an internal note (visible only to admins)..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  rows={2}
                  className="text-sm resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && newNote.trim()) {
                      e.preventDefault();
                      addNote();
                    }
                  }}
                />
                <Button
                  size="sm"
                  className="gap-1.5 shrink-0 self-end min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={!newNote.trim() || savingNote}
                  onClick={addNote}
                >
                  {savingNote ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  <span className="hidden sm:inline">Add</span>
                </Button>
              </div>

              {/* Notes list */}
              <div className="space-y-2 max-h-[420px] overflow-y-auto scrollbar-premium pr-1">
                {notes.length === 0 ? (
                  <div className="text-sm text-muted-foreground italic text-center py-8">
                    No internal notes yet.
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {[...notes].reverse().map((note) => (
                      <motion.div
                        key={note.id}
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        className="rounded-lg border bg-emerald-50/40 dark:bg-emerald-950/20 p-2.5"
                      >
                        <div className="text-sm whitespace-pre-wrap break-words">
                          {note.body}
                        </div>
                        <div className="flex items-center justify-between mt-1.5 text-[10px] text-muted-foreground">
                          <span>
                            {note.authorName || "Admin"} ·{" "}
                            {formatDateTime(note.createdAt)}
                            {new Date(note.updatedAt).getTime() -
                              new Date(note.createdAt).getTime() >
                              1000 && (
                              <span className="italic"> (edited)</span>
                            )}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 text-rose-600 hover:text-rose-700"
                            onClick={() => deleteNote(note.id)}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Activity Log (full width) */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.5 }}
      >
        <Card className="shadow-premium-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="size-4 text-emerald-600" /> Activity Log
              <Badge className="ml-1 bg-muted text-muted-foreground">
                {activityFeed.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityLog items={activityFeed} />
          </CardContent>
        </Card>
      </motion.div>

      {/* ================================================================
          8. PRESCRIPTION CARD (conditional)
          ================================================================ */}
      {order.prescription && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.55 }}
        >
          <PrescriptionCard
            prescription={order.prescription}
            orderStatus={order.status}
            busy={busy}
            onApprove={() => verifyPrescription("approve")}
            onReject={(reason) => verifyPrescription("reject", reason)}
          />
        </motion.div>
      )}

      {/* ================================================================
          DIALOGS
          ================================================================ */}

      {/* Cancel order dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="size-5 text-rose-600" />
              Cancel this order?
            </DialogTitle>
            <DialogDescription>
              The customer will be notified with the reason provided. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason for cancellation *</Label>
            <Textarea
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Out of stock, customer request, invalid prescription..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Keep Order
            </Button>
            <Button
              variant="destructive"
              disabled={busy || !cancelReason.trim()}
              onClick={() => {
                changeStatus("cancelled", cancelReason.trim());
                setCancelOpen(false);
                setCancelReason("");
              }}
              className="gap-1.5"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <XCircle className="size-4" />
              )}
              Cancel Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment update confirmation dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="size-5 text-emerald-600" />
              Confirm Payment Update
            </DialogTitle>
            <DialogDescription>
              Review the changes below. The customer may be notified by email
              depending on the new status.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
              <span className="text-muted-foreground">From</span>
              <PaymentStatusBadge status={order.paymentStatus} size="md" />
              <ArrowRight className="size-4 text-muted-foreground" />
              <PaymentStatusBadge status={paymentStatus} size="md" />
            </div>
            {paymentIdDraft.trim() !== (order.paymentId || "") && (
              <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
                <span className="text-muted-foreground">Transaction ID</span>
                <span className="font-mono text-xs font-medium truncate max-w-[60%]">
                  {paymentIdDraft.trim() || "—"}
                </span>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Optional note (added to timeline)</Label>
              <Textarea
                rows={2}
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                placeholder="e.g. Verified via Razorpay dashboard, customer confirmed via call..."
                className="text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={savingPayment}
              onClick={confirmPaymentUpdate}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {savingPayment ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Confirm Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================
          9. MOBILE STICKY ACTION BAR
          ================================================================ */}
      {!isTerminal && allowedNext.length > 0 && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur border-t shadow-premium-lg">
          <div className="flex items-center gap-2 p-3">
            {(() => {
              // Primary action = first non-cancel allowed status
              const primary = allowedNext.find((s) => s !== "cancelled");
              if (!primary) return null;
              const v = STATUS_VISUAL[primary];
              if (!v) return null;
              const Icon = v.icon;
              return (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => changeStatus(primary)}
                  className={cn(
                    "flex-1 gap-1.5 min-h-[44px] text-white",
                    v.tint,
                    v.tintHover
                  )}
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Icon className="size-4" />
                  )}
                  {v.label}
                </Button>
              );
            })()}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setMobileActionsOpen(true)}
              className="min-h-[44px] px-3"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Mobile actions sheet */}
      <Sheet open={mobileActionsOpen} onOpenChange={setMobileActionsOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <CircleDot className="size-4 text-emerald-600" />
              Order Actions
            </SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6 space-y-2">
            {!isTerminal &&
              allowedNext.map((s) => {
                if (s === "cancelled") return null;
                const v = STATUS_VISUAL[s];
                if (!v) return null;
                const Icon = v.icon;
                return (
                  <Button
                    key={s}
                    disabled={busy}
                    onClick={() => changeStatus(s)}
                    className={cn(
                      "w-full gap-2 min-h-[48px] text-white justify-start",
                      v.tint,
                      v.tintHover
                    )}
                  >
                    <Icon className="size-4" /> Mark {v.label}
                  </Button>
                );
              })}
            <Button
              variant="outline"
              onClick={downloadInvoice}
              className="w-full gap-2 min-h-[48px] justify-start"
            >
              <Download className="size-4" /> Download Invoice
            </Button>
            <Button
              variant="outline"
              onClick={printInvoice}
              className="w-full gap-2 min-h-[48px] justify-start"
            >
              <Printer className="size-4" /> Print Invoice
            </Button>
            <Button
              variant="outline"
              onClick={contactCustomer}
              className="w-full gap-2 min-h-[48px] justify-start"
            >
              <Phone className="size-4" /> Contact Customer
            </Button>
            {!isTerminal && allowedNext.includes("cancelled") && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setMobileActionsOpen(false);
                  setCancelOpen(true);
                }}
                className="w-full gap-2 min-h-[48px] justify-start text-rose-600 hover:text-rose-700 hover:border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30"
              >
                <XCircle className="size-4" /> Cancel Order
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ===========================================================================
// SUB-COMPONENTS
// ===========================================================================

function SkeletonHeader() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="h-12 skeleton-premium" />
        <div className="p-6 space-y-3">
          <div className="h-8 w-1/3 skeleton-premium rounded" />
          <div className="h-4 w-1/2 skeleton-premium rounded" />
          <div className="flex gap-2 mt-4">
            <div className="h-9 w-24 skeleton-premium rounded" />
            <div className="h-9 w-24 skeleton-premium rounded" />
            <div className="h-9 w-24 skeleton-premium rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PriceRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "emerald" | "amber";
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground truncate">{label}</span>
      <span
        className={cn(
          "font-medium shrink-0",
          accent === "emerald"
            ? "text-emerald-600 dark:text-emerald-400"
            : accent === "amber"
              ? "text-amber-600 dark:text-amber-400"
              : "text-foreground"
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Order Timeline — premium vertical timeline with framer-motion stagger
// ---------------------------------------------------------------------------
function OrderTimeline({
  statusHistory,
  currentStatus,
}: {
  statusHistory: StatusHistoryEntry[];
  currentStatus: string;
}) {
  if (!statusHistory || statusHistory.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic text-center py-6">
        No status events recorded yet.
      </div>
    );
  }

  // Newest first.
  const events = [...statusHistory].reverse();

  return (
    <div className="relative">
      {/* Vertical connector line */}
      <div className="absolute left-[14px] top-3 bottom-3 w-0.5 bg-gradient-to-b from-emerald-300 via-border to-border dark:from-emerald-800" />
      <div className="space-y-5">
        {events.map((h, i) => {
          const v = STATUS_VISUAL[h.status] || STATUS_VISUAL.pending;
          const Icon = v.icon;
          const isLatest = i === 0;
          const isCurrent = h.status === currentStatus && isLatest;
          return (
            <motion.div
              key={h.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3 }}
              className="flex items-start gap-3 relative"
            >
              {/* Status icon dot */}
              <div
                className={cn(
                  "size-7 rounded-full flex items-center justify-center shrink-0 z-10 ring-4 ring-background",
                  v.dot
                )}
              >
                <Icon className="size-3.5 text-white" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold">{v.label}</span>
                  {isCurrent && (
                    <Badge className="bg-amber-100 text-amber-700 text-[9px] dark:bg-amber-950/50 dark:text-amber-300">
                      Current
                    </Badge>
                  )}
                  {isLatest && !isCurrent && (
                    <Badge className="bg-emerald-100 text-emerald-700 text-[9px] dark:bg-emerald-950/50 dark:text-emerald-300">
                      Latest
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {formatDateTime(h.createdAt)}
                </div>
                {h.note && (
                  <div className="text-xs text-foreground mt-1 bg-muted/40 dark:bg-muted/20 rounded px-2 py-1 border border-border/40">
                    {h.note}
                  </div>
                )}
                {h.createdBy && (
                  <div className="text-[10px] text-muted-foreground/70 mt-1 inline-flex items-center gap-1">
                    <User className="size-2.5" />
                    by {h.createdBy === "system" ? "System" : "Admin"}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity Log — chronological feed of all actions
// ---------------------------------------------------------------------------
type ActivityItem = {
  id: string;
  kind: "status" | "payment" | "note";
  title: string;
  description?: string | null;
  timestamp: string;
  actor?: string | null;
};

function ActivityLog({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic text-center py-6">
        No activity yet.
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[480px] overflow-y-auto scrollbar-premium pr-1">
      {items.map((item, i) => {
        const Icon =
          item.kind === "payment"
            ? Wallet
            : item.kind === "note"
              ? MessageSquare
              : STATUS_VISUAL[
                  // Try to resolve the status icon by reverse-mapping the title
                  // back to a status key. Fall back to Activity.
                  Object.keys(STATUS_VISUAL).find(
                    (k) =>
                      STATUS_VISUAL[k].label.toLowerCase() ===
                      item.title.replace("Order ", "").toLowerCase()
                  ) || ""
                ]?.icon || Activity;
        const tint =
          item.kind === "payment"
            ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300"
            : item.kind === "note"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
              : "bg-muted text-muted-foreground";
        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.3) }}
            className="flex items-start gap-3"
          >
            <div
              className={cn(
                "size-8 rounded-full flex items-center justify-center shrink-0",
                tint
              )}
            >
              <Icon className="size-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{item.title}</span>
                <span className="text-[10px] text-muted-foreground">
                  {formatDateTime(item.timestamp)}
                </span>
              </div>
              {item.description && (
                <div className="text-xs text-muted-foreground mt-0.5 bg-muted/30 dark:bg-muted/20 rounded px-2 py-1 border border-border/30 break-words">
                  {item.description}
                </div>
              )}
              {item.actor && (
                <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                  by {item.actor}
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Prescription Card — image gallery + verify/reject
// ---------------------------------------------------------------------------
function PrescriptionCard({
  prescription,
  orderStatus,
  busy,
  onApprove,
  onReject,
}: {
  prescription: NonNullable<PrescriptionData>;
  orderStatus: string;
  busy: boolean;
  onApprove: () => void;
  onReject: (reason: string) => void;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const images = prescription.images ?? [];

  const isVerified = prescription.status === "verified";
  const isRejected = prescription.status === "rejected";
  const isCancelled = orderStatus === "cancelled";
  const canAct = !isVerified && !isRejected && !isCancelled;

  if (images.length === 0) {
    return (
      <Card className="shadow-premium-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileImage className="size-4 text-teal-600 dark:text-teal-400" />
            Prescription
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground italic text-center py-6">
            No prescription images attached.
          </div>
        </CardContent>
      </Card>
    );
  }

  function downloadImage(url: string) {
    const a = document.createElement("a");
    a.href = url;
    a.download = `prescription-${prescription.id.slice(-6)}.jpg`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <Card className="shadow-premium-sm border-teal-200/60 dark:border-teal-900/40">
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <FileImage className="size-4 text-teal-600 dark:text-teal-400" />
            Prescription Verification
          </CardTitle>
          <div className="text-xs text-muted-foreground mt-1">
            Uploaded {formatDateTime(prescription.createdAt)}
          </div>
        </div>
        {/* Prescription status badge */}
        <Badge
          className={cn(
            "border",
            isVerified
              ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900/60"
              : isRejected
                ? "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900/60"
                : "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/60"
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full mr-1",
              isVerified
                ? "bg-emerald-500"
                : isRejected
                  ? "bg-rose-500"
                  : "bg-amber-500"
            )}
          />
          <span className="capitalize">
            {prescription.status.replace(/_/g, " ")}
          </span>
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Image viewer */}
        <div className="rounded-lg border bg-muted/30 overflow-hidden relative">
          <div className="flex items-center justify-center min-h-[280px] sm:min-h-[400px] max-h-[500px] p-4 overflow-hidden">
            <img
              src={images[activeIdx]}
              alt={`Prescription ${activeIdx + 1}`}
              className="max-h-[460px] object-contain bg-white transition-transform"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
              }}
            />
          </div>

          {/* Viewer controls */}
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-background/90 backdrop-blur rounded-lg border p-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
              disabled={zoom <= 1}
              title="Zoom out"
            >
              <ZoomOut className="size-3.5" />
            </Button>
            <span className="text-xs font-medium px-1">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setZoom((z) => Math.min(3, z + 0.5))}
              disabled={zoom >= 3}
              title="Zoom in"
            >
              <ZoomIn className="size-3.5" />
            </Button>
            <div className="w-px h-4 bg-border mx-0.5" />
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              title="Rotate 90°"
            >
              <RotateCw className="size-3.5" />
            </Button>
            <div className="w-px h-4 bg-border mx-0.5" />
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => downloadImage(images[activeIdx])}
              title="Download"
            >
              <Download className="size-3.5" />
            </Button>
          </div>

          {/* Multi-image pagination */}
          {images.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-background/90 backdrop-blur rounded-full border p-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={() => {
                  setActiveIdx((i) => (i - 1 + images.length) % images.length);
                  setZoom(1);
                  setRotation(0);
                }}
              >
                <ChevronRight className="size-3.5 rotate-180" />
              </Button>
              <span className="text-xs font-medium px-2">
                {activeIdx + 1} / {images.length}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={() => {
                  setActiveIdx((i) => (i + 1) % images.length);
                  setZoom(1);
                  setRotation(0);
                }}
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Thumbnail strip */}
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-premium pb-1">
            {images.map((url, i) => (
              <button
                key={i}
                onClick={() => {
                  setActiveIdx(i);
                  setZoom(1);
                  setRotation(0);
                }}
                className={cn(
                  "shrink-0 size-16 rounded-md overflow-hidden border-2 transition-premium",
                  i === activeIdx
                    ? "border-emerald-500"
                    : "border-transparent hover:border-emerald-300"
                )}
              >
                <img
                  src={url}
                  alt={`Thumb ${i + 1}`}
                  className="size-full object-cover"
                />
              </button>
            ))}
          </div>
        )}

        {/* Customer notes from prescription */}
        {prescription.notes && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3">
            <div className="text-xs font-semibold text-amber-900 dark:text-amber-200 mb-1 flex items-center gap-1">
              <ClipboardList className="size-3.5" /> Customer Notes
            </div>
            <div className="text-sm text-amber-800 dark:text-amber-300 whitespace-pre-wrap">
              {prescription.notes}
            </div>
          </div>
        )}

        {/* Status banners */}
        {isVerified && (
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 p-3 flex items-center gap-2">
            <ShieldCheck className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                Prescription Approved
              </div>
              <div className="text-xs text-emerald-700 dark:text-emerald-300">
                This prescription has been verified by a pharmacist.
              </div>
            </div>
          </div>
        )}
        {isRejected && (
          <div className="rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 p-3 flex items-center gap-2">
            <ShieldX className="size-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <div>
              <div className="text-sm font-semibold text-rose-800 dark:text-rose-200">
                Prescription Rejected
              </div>
              <div className="text-xs text-rose-700 dark:text-rose-300">
                {prescription.adminNotes || "No reason provided."}
              </div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {canAct && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 gap-2 min-h-[44px]"
              disabled={busy}
              onClick={onApprove}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShieldCheck className="size-4" />
              )}
              Approve
            </Button>
            <Button
              variant="destructive"
              className="gap-2 min-h-[44px]"
              disabled={busy}
              onClick={() => setRejectOpen(true)}
            >
              <ShieldX className="size-4" /> Reject
            </Button>
          </div>
        )}
        {isCancelled && !isRejected && (
          <div className="rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 p-3 text-sm text-rose-800 dark:text-rose-200">
            Order was cancelled — prescription verification is no longer actionable.
          </div>
        )}
      </CardContent>

      {/* Reject prescription dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldX className="size-5 text-rose-600" />
              Reject Prescription?
            </DialogTitle>
            <DialogDescription>
              The order will be cancelled and the customer will be notified with
              the reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason for rejection *</Label>
            <Textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Prescription is illegible, medication not matching, expired..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Keep Order
            </Button>
            <Button
              variant="destructive"
              disabled={busy || !rejectReason.trim()}
              onClick={() => {
                onReject(rejectReason.trim());
                setRejectOpen(false);
                setRejectReason("");
              }}
              className="gap-1.5"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShieldX className="size-4" />
              )}
              Reject & Cancel Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
