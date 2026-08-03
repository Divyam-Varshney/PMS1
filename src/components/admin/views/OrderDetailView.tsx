// ============================================================================
// File: src/components/admin/views/OrderDetailView.tsx
// Purpose: Admin Order Detail view — clean, premium, enterprise-grade.
//          Inspired by Shopify Order Detail + Stripe Payment Detail.
//
//          Layout (single scroll, no tabs):
//            1. Header — back + order # + status + date + quick actions
//            2. Smart Status Workflow — current + allowed next statuses
//            3. Payment Management — status badge + update dropdown w/ dialog
//            4. Information Cards (2-col) — Customer / Address / Payment /
//               Pricing Summary
//            5. Products Table — image, name, qty, price, total
//            6. Timeline — vertical, simple status history
//            7. Internal Notes — add + list
//            8. Prescription Card (conditional)
//            9. Mobile — stack cards, sticky bottom action bar
//
//          Dark-mode aware, emerald accent palette (no indigo/blue).
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Printer,
  CheckCircle2,
  PackageCheck,
  Truck,
  XCircle,
  Clock,
  Trash2,
  Loader2,
  User,
  MapPin,
  CreditCard,
  FileImage,
  Receipt,
  Hash,
  CalendarClock,
  Copy,
  ExternalLink,
  Phone,
  Mail,
  StickyNote,
  RotateCw,
  Package,
  Wallet,
  Banknote,
  QrCode,
  Smartphone,
  Send,
  AlertTriangle,
  ClipboardList,
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
// Status workflow — mirrors VALID_TRANSITIONS on the server.
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

type StatusVisual = {
  label: string;
  icon: typeof CheckCircle2;
  dot: string;
  tint: string;
  tintHover: string;
};

const STATUS_VISUAL: Record<string, StatusVisual> = {
  pending: {
    label: "Pending",
    icon: Clock,
    dot: "bg-amber-500",
    tint: "bg-amber-600",
    tintHover: "hover:bg-amber-700",
  },
  confirmed: {
    label: "Confirmed",
    icon: CheckCircle2,
    dot: "bg-emerald-500",
    tint: "bg-emerald-600",
    tintHover: "hover:bg-emerald-700",
  },
  packed: {
    label: "Packed",
    icon: PackageCheck,
    dot: "bg-teal-600",
    tint: "bg-teal-600",
    tintHover: "hover:bg-teal-700",
  },
  out_for_delivery: {
    label: "Out for Delivery",
    icon: Truck,
    dot: "bg-cyan-500",
    tint: "bg-cyan-600",
    tintHover: "hover:bg-cyan-700",
  },
  delivered: {
    label: "Delivered",
    icon: PackageCheck,
    dot: "bg-emerald-500",
    tint: "bg-emerald-600",
    tintHover: "hover:bg-emerald-700",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    dot: "bg-rose-500",
    tint: "bg-rose-600",
    tintHover: "hover:bg-rose-700",
  },
  returned: {
    label: "Returned",
    icon: RotateCw,
    dot: "bg-stone-500",
    tint: "bg-stone-600",
    tintHover: "hover:bg-stone-700",
  },
};

// Payment status visual config — pending: amber, paid: emerald,
// partially_paid: cyan, failed: red, refunded: rose.
type PaymentVisual = {
  label: string;
  badge: string;
  dot: string;
};

const PAYMENT_VISUAL: Record<string, PaymentVisual> = {
  pending: {
    label: "Pending",
    badge: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/60",
    dot: "bg-amber-500",
  },
  paid: {
    label: "Paid",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900/60",
    dot: "bg-emerald-500",
  },
  partially_paid: {
    label: "Partially Paid",
    badge: "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-900/60",
    dot: "bg-cyan-500",
  },
  failed: {
    label: "Failed",
    badge: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900/60",
    dot: "bg-red-500",
  },
  refunded: {
    label: "Refunded",
    badge: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900/60",
    dot: "bg-rose-500",
  },
  refund_initiated: {
    label: "Refund Initiated",
    badge: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-900/60",
    dot: "bg-orange-500",
  },
  cancelled: {
    label: "Cancelled",
    badge: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700",
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
// Helper badge components
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
  const v2 = PAYMENT_VISUAL[status];
  const badgeCls = v2 ? v2.badge : "bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-800/60 dark:text-stone-300 dark:border-stone-700";
  // Use order status color (from STATUS_VISUAL dot) for text contrast mapping.
  // We map common order statuses to their corresponding payment-like colors:
  const orderStatusColor: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/60",
    confirmed: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900/60",
    packed: "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-900/60",
    out_for_delivery: "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-900/60",
    delivered: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900/60",
    cancelled: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900/60",
    returned: "bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-800/60 dark:text-stone-300 dark:border-stone-700",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        orderStatusColor[status] || badgeCls,
        sizeCls
      )}
    >
      <span className={cn("size-1.5 rounded-full", v.dot)} />
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
        "inline-flex items-center rounded-full border font-medium",
        v.badge,
        sizeCls
      )}
    >
      <span className={cn("size-1.5 rounded-full", v.dot)} />
      {v.label}
    </span>
  );
}

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

  // Sync payment + notes state with order data
  useEffect(() => {
    if (order) {
      setPaymentStatus(order.paymentStatus);
      setPaymentIdDraft(order.paymentId || "");
      setNotes(order.orderNotes ?? []);
    }
  }, [order?.paymentStatus, order?.paymentId, order?.orderNotes]);

  // -------- Handlers --------
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

  // -------- Derived data --------
  const allowedNext = order ? VALID_TRANSITIONS[order.status] ?? [] : [];
  const isTerminal = order ? TERMINAL_STATUSES.has(order.status) : false;

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

  function copyAddress() {
    navigator.clipboard.writeText(fullAddress).then(
      () => toast.success("Address copied to clipboard"),
      () => toast.error("Failed to copy address")
    );
  }

  // -------- Loading & empty states --------
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={back} className="gap-1.5">
          <ArrowLeft className="size-4" /> Back to Orders
        </Button>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardContent className="pt-6 h-64 bg-muted/30 animate-pulse rounded-xl" />
          </Card>
          <Card>
            <CardContent className="pt-6 h-64 bg-muted/30 animate-pulse rounded-xl" />
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
  const showPrescriptionCard = !!order.prescriptionId && !!order.prescription;
  // Allowed next actions, with the cancel action separated out.
  const nextActions = allowedNext.filter((s) => s !== "cancelled");
  const canCancel = allowedNext.includes("cancelled");

  return (
    <div className="space-y-5 pb-24 lg:pb-6">
      {/* ================================================================
          1. HEADER
          ================================================================ */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={back} className="gap-1.5">
          <ArrowLeft className="size-4" /> Back
        </Button>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
          {order.orderNumber}
        </h1>
        <OrderStatusBadge status={order.status} size="lg" />
        <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground ml-auto">
          <CalendarClock className="size-3.5" />
          {formatDateTime(order.createdAt)}
        </span>

        {/* Quick actions */}
        <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
          <Button variant="outline" size="sm" onClick={printInvoice} className="gap-1.5">
            <Printer className="size-4" /> <span className="hidden sm:inline">Print</span>
          </Button>
          <Button variant="outline" size="sm" onClick={downloadInvoice} className="gap-1.5">
            <Download className="size-4" /> <span className="hidden sm:inline">Invoice</span>
          </Button>
          <Button variant="outline" size="sm" onClick={contactCustomer} className="gap-1.5">
            <Phone className="size-4" /> <span className="hidden sm:inline">Contact</span>
          </Button>
          <Button variant="outline" size="sm" onClick={copyOrderId} className="gap-1.5 font-mono text-xs" title={order.id}>
            <Copy className="size-4" /> <span className="hidden sm:inline">Copy ID</span>
          </Button>
        </div>
      </div>

      {/* Source + tags row */}
      <div className="flex items-center gap-2 flex-wrap -mt-3">
        <SourceBadge source={order.source} />
        {hasRxItems && (
          <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
            <FileImage className="size-3" /> Contains Rx Items
          </span>
        )}
        {order.voucherCode && (
          <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700 dark:border-purple-900/50 dark:bg-purple-950/40 dark:text-purple-300">
            <Hash className="size-3" /> {order.voucherCode}
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Wallet className="size-3" /> {formatCurrency(order.grandTotal)}
        </span>
      </div>

      {/* ================================================================
          2. SMART STATUS WORKFLOW
          ================================================================ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="size-4 text-emerald-600" />
            Status Workflow
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!isTerminal && nextActions.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium mr-1">
                Advance:
              </span>
              {nextActions.map((nextStatus) => {
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
                      "gap-1.5 text-white",
                      v.tint,
                      v.tintHover
                    )}
                  >
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
                    Mark {v.label}
                  </Button>
                );
              })}
              {canCancel && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setCancelOpen(true)}
                  className="gap-1.5 text-rose-600 hover:text-rose-700 hover:border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                >
                  <XCircle className="size-4" /> Cancel
                </Button>
              )}
            </div>
          )}

          {isTerminal && (
            <div className={cn(
              "rounded-lg border p-3 flex items-start gap-2 text-sm",
              order.status === "cancelled"
                ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-200"
                : "bg-stone-50 dark:bg-stone-900/40 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300"
            )}>
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

          {order.estimatedDelivery && (
            <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <CalendarClock className="size-3.5" />
              ETA: {formatDate(order.estimatedDelivery)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ================================================================
          3. PAYMENT MANAGEMENT
          ================================================================ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="size-4 text-emerald-600" />
            Payment Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Method</div>
              <div className="flex items-center gap-2 text-sm font-medium">
                <PaymentMethodIcon method={order.paymentMethod} />
                {PAYMENT_METHOD_LABEL[order.paymentMethod] || order.paymentMethod}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Status</div>
              <PaymentStatusBadge status={order.paymentStatus} size="lg" />
            </div>
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Gateway</div>
              <div className="text-sm font-medium capitalize">
                {order.paymentGateway || "—"}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t space-y-3">
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
                <Label className="text-xs font-medium text-muted-foreground">New Status</Label>
                <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_STATUS_ORDER.map((s) => (
                      <SelectItem key={s} value={s}>
                        <span className="flex items-center gap-2">
                          <span className={cn("size-1.5 rounded-full", PAYMENT_VISUAL[s]?.dot)} />
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
                  <span className="text-amber-600 dark:text-amber-400">Unsaved changes</span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400">All changes saved</span>
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
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CheckCircle2 className="size-4" /> Update Payment
              </Button>
            </div>

            {order.paymentScreenshot && (
              <div className="pt-3 border-t">
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
                  className="block w-40 rounded-md border overflow-hidden hover:border-emerald-400 transition-colors"
                >
                  <img
                    src={order.paymentScreenshot}
                    alt="Payment screenshot"
                    className="w-full h-28 object-cover bg-white"
                  />
                </a>
              </div>
            )}

            {order.paymentMethod === "cod" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900/50 p-3 text-sm flex items-start gap-2">
                <Banknote className="size-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-amber-800 dark:text-amber-200">Collect on Delivery</div>
                  <div className="text-amber-700 dark:text-amber-300 mt-0.5">
                    Collect <strong>{formatCurrency(order.grandTotal)}</strong> in cash from the customer at delivery.
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ================================================================
          4. INFO CARDS GRID
          ================================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Customer */}
        <Card className="h-full">
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="size-4 text-emerald-600" /> Customer
            </CardTitle>
            {order.customer && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => navigate({ name: "customer-detail", id: order.customer!.id })}
              >
                View <ArrowRight className="size-3" />
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {order.customer ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-semibold">
                    {getInitials(order.customer.name || "U")}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{order.customer.name}</div>
                    <div className="text-xs text-muted-foreground font-mono truncate">
                      ID: {order.customer.id.slice(-8)}
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5 text-sm">
                  {order.customer.email && (
                    <a href={`mailto:${order.customer.email}`} className="flex items-center gap-2 hover:text-emerald-700 dark:hover:text-emerald-400">
                      <Mail className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{order.customer.email}</span>
                    </a>
                  )}
                  {order.customer.phone && (
                    <a href={`tel:${order.customer.phone}`} className="flex items-center gap-2 hover:text-emerald-700 dark:hover:text-emerald-400">
                      <Phone className="size-3.5 text-muted-foreground shrink-0" />
                      {order.customer.phone}
                    </a>
                  )}
                </div>
                {order.customerStats && (
                  <div className="grid grid-cols-2 gap-2 pt-3 border-t">
                    <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 p-2.5">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Orders</div>
                      <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                        {order.customerStats.orderCount}
                      </div>
                    </div>
                    <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 p-2.5">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Lifetime Spent</div>
                      <div className="text-lg font-bold text-amber-700 dark:text-amber-400">
                        {formatCurrency(order.customerStats.totalSpent)}
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-muted-foreground italic">
                Customer deleted — using shipping snapshot ({order.shipName}).
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delivery Address */}
        <Card className="h-full">
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="size-4 text-emerald-600" /> Delivery Address
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={copyAddress}>
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
              {order.shipLine2 && (<><br />{order.shipLine2}</>)}
              {order.shipLocality && (<><br />{order.shipLocality}</>)}
              <br />
              {order.shipCity}, {order.shipState} {order.shipPincode}
              <br />
              <span className="inline-flex items-center gap-1 mt-0.5">
                District: {order.shipDistrict}
              </span>
            </div>
            <a
              href={`tel:${order.shipPhone}`}
              className="inline-flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400 hover:underline pt-2 border-t mt-2"
            >
              <Phone className="size-3.5" /> {order.shipPhone}
            </a>
            {order.notes && (
              <div className="pt-2 mt-2 border-t">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">
                  Delivery Instructions
                </div>
                <div className="text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 rounded p-2 whitespace-pre-wrap">
                  {order.notes}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Info */}
        <Card className="h-full">
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
              <PaymentStatusBadge status={order.paymentStatus} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Transaction ID</span>
              <span className="font-mono text-xs">
                {order.paymentId || order.paymentTxnId || "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Gateway</span>
              <span className="font-medium capitalize">{order.paymentGateway || "—"}</span>
            </div>
          </CardContent>
        </Card>

        {/* Pricing Summary */}
        <Card className="h-full">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="size-4 text-emerald-600" /> Pricing Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium tabular-nums">{formatCurrency(order.itemsTotal)}</span>
            </div>
            {order.productDiscount > 0 && (
              <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                <span>Product Discount</span>
                <span className="font-medium tabular-nums">- {formatCurrency(order.productDiscount)}</span>
              </div>
            )}
            {order.voucherDiscount > 0 && (
              <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                <span>Voucher ({order.voucherCode})</span>
                <span className="font-medium tabular-nums">- {formatCurrency(order.voucherDiscount)}</span>
              </div>
            )}
            {order.loyaltyDiscount > 0 && (
              <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                <span>Loyalty ({order.loyaltyPointsRedeemed} pts)</span>
                <span className="font-medium tabular-nums">- {formatCurrency(order.loyaltyDiscount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Delivery</span>
              <span className="font-medium tabular-nums">
                {order.deliveryCharge === 0 ? "Free" : formatCurrency(order.deliveryCharge)}
              </span>
            </div>
            {order.taxTotal > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span className="font-medium tabular-nums">{formatCurrency(order.taxTotal)}</span>
              </div>
            )}
            {order.roundOff !== 0 && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Round-off</span>
                <span className="tabular-nums">{order.roundOff > 0 ? "+" : ""}{formatCurrency(order.roundOff)}</span>
              </div>
            )}
            <div className="pt-2 mt-2 border-t flex items-center justify-between">
              <span className="font-semibold">Grand Total</span>
              <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {formatCurrency(order.grandTotal)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ================================================================
          5. PRODUCTS TABLE
          ================================================================ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="size-4 text-emerald-600" /> Products ({order.items.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <ProductThumb image={it.image} name={it.name} size={36} />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate max-w-[260px]">{it.name}</div>
                          {it.sku && (
                            <div className="text-xs text-muted-foreground font-mono">{it.sku}</div>
                          )}
                          {it.product?.prescriptionRequired && (
                            <Badge variant="outline" className="mt-1 gap-1 text-xs text-rose-700 border-rose-200 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50">
                              <FileImage className="size-3" /> Rx
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center tabular-nums">{it.qty}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(it.mrp)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
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
              <div key={it.id} className="p-3 flex items-center gap-3">
                <ProductThumb image={it.image} name={it.name} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{it.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {it.qty} × {formatCurrency(it.mrp)}
                    {it.appliedDiscountPct > 0 && (
                      <span className="text-emerald-600"> (-{it.appliedDiscountPct}%)</span>
                    )}
                  </div>
                </div>
                <div className="text-sm font-semibold tabular-nums">
                  {formatCurrency(it.lineTotal)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ================================================================
          6. TIMELINE
          ================================================================ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="size-4 text-emerald-600" /> Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {order.statusHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No status history yet.</p>
          ) : (
            <ol className="relative border-l border-border/70 ml-2 space-y-4">
              {order.statusHistory.map((h) => {
                const v = STATUS_VISUAL[h.status] || STATUS_VISUAL.pending;
                const Icon = v.icon;
                return (
                  <li key={h.id} className="ml-4">
                    <span
                      className={cn(
                        "absolute -left-[9px] flex size-4 items-center justify-center rounded-full ring-2 ring-background",
                        v.dot
                      )}
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <Icon className="size-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium">{v.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(h.createdAt)}
                      </span>
                      {h.createdBy && (
                        <span className="text-xs text-muted-foreground">
                          · {h.createdBy === "system" ? "System" : "Admin"}
                        </span>
                      )}
                    </div>
                    {h.note && (
                      <p className="mt-1 text-xs text-muted-foreground">{h.note}</p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* ================================================================
          7. INTERNAL NOTES
          ================================================================ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <StickyNote className="size-4 text-emerald-600" /> Internal Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Textarea
              rows={2}
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add an internal note (visible only to admins)…"
              className="resize-none"
            />
            <Button
              size="sm"
              onClick={addNote}
              disabled={savingNote || !newNote.trim()}
              className="self-end gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {savingNote ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
          <div className="space-y-2">
            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No internal notes yet.</p>
            ) : (
              notes
                .slice()
                .reverse()
                .map((n) => (
                  <div key={n.id} className="flex items-start gap-2 rounded-lg border bg-muted/30 p-2.5">
                    <StickyNote className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm whitespace-pre-wrap break-words">{n.body}</p>
                      <div className="mt-1 text-xs text-muted-foreground flex items-center gap-2">
                        <span>{n.authorName || "Admin"}</span>
                        <span>·</span>
                        <span>{formatDateTime(n.createdAt)}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive hover:text-destructive"
                      onClick={() => deleteNote(n.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* ================================================================
          8. PRESCRIPTION CARD (conditional)
          ================================================================ */}
      {showPrescriptionCard && order.prescription && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileImage className="size-4 text-emerald-600" /> Prescription
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {order.prescription.images?.length ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {order.prescription.images.map((img, i) => (
                  <a
                    key={i}
                    href={img}
                    target="_blank"
                    rel="noreferrer"
                    className="block aspect-square rounded-md overflow-hidden border bg-muted/30 hover:border-emerald-400 transition-colors"
                  >
                    <img src={img} alt={`Prescription ${i + 1}`} className="size-full object-cover" />
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No images attached.</p>
            )}
            {order.prescription.notes && (
              <div className="pt-3 border-t">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">
                  Customer Notes
                </div>
                <p className="text-sm whitespace-pre-wrap">{order.prescription.notes}</p>
              </div>
            )}
            {order.prescription.adminNotes && (
              <div className="pt-3 border-t">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">
                  Admin Notes
                </div>
                <p className="text-sm whitespace-pre-wrap">{order.prescription.adminNotes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ================================================================
          9. MOBILE STICKY ACTION BAR
          ================================================================ */}
      {!isTerminal && (nextActions.length > 0 || canCancel) && (
        <>
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-md px-4 py-3 flex items-center gap-2">
            {nextActions.slice(0, 1).map((s) => {
              const v = STATUS_VISUAL[s];
              if (!v) return null;
              const Icon = v.icon;
              return (
                <Button
                  key={s}
                  size="sm"
                  disabled={busy}
                  onClick={() => changeStatus(s)}
                  className={cn("flex-1 gap-1.5 text-white", v.tint, v.tintHover)}
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
                  Mark {v.label}
                </Button>
              );
            })}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setMobileActionsOpen(true)}
              className="gap-1.5"
            >
              <Send className="size-4" /> More
            </Button>
          </div>

          <Sheet open={mobileActionsOpen} onOpenChange={setMobileActionsOpen}>
            <SheetContent side="bottom" className="rounded-t-xl">
              <SheetHeader>
                <SheetTitle>Order Actions</SheetTitle>
              </SheetHeader>
              <div className="px-4 pb-6 space-y-2">
                {nextActions.map((s) => {
                  const v = STATUS_VISUAL[s];
                  if (!v) return null;
                  const Icon = v.icon;
                  return (
                    <Button
                      key={s}
                      className="w-full justify-start gap-2"
                      variant="outline"
                      disabled={busy}
                      onClick={() => changeStatus(s)}
                    >
                      <Icon className="size-4" /> Mark {v.label}
                    </Button>
                  );
                })}
                {canCancel && (
                  <Button
                    className="w-full justify-start gap-2 text-rose-600"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setMobileActionsOpen(false);
                      setCancelOpen(true);
                    }}
                  >
                    <XCircle className="size-4" /> Cancel Order
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}

      {/* ================================================================
          Cancel Order dialog
          ================================================================ */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Order</DialogTitle>
            <DialogDescription>
              Cancelling this order will notify the customer and (if applicable) initiate a refund. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Reason (optional)</Label>
            <Textarea
              id="cancel-reason"
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Out of stock, customer request, invalid prescription…"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Keep Order</Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => {
                changeStatus("cancelled", cancelReason.trim() || undefined);
                setCancelOpen(false);
                setCancelReason("");
              }}
              className="gap-1.5"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
              Confirm Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================
          Payment update confirmation dialog
          ================================================================ */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Payment Update</DialogTitle>
            <DialogDescription>
              Review the changes before applying them. The customer may be notified based on the new status.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Current</span>
              <PaymentStatusBadge status={order.paymentStatus} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">New</span>
              <PaymentStatusBadge status={paymentStatus} />
            </div>
            {(paymentIdDraft.trim() || order.paymentId) && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Transaction ID</span>
                <span className="font-mono text-xs">{paymentIdDraft.trim() || "—"}</span>
              </div>
            )}
            <div className="space-y-1.5 pt-2">
              <Label htmlFor="pay-note">Note (optional)</Label>
              <Textarea
                id="pay-note"
                rows={2}
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                placeholder="Add a note for the activity log…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={savingPayment}
              onClick={confirmPaymentUpdate}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {savingPayment ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              Apply Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
