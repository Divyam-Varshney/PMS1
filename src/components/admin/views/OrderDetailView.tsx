// ============================================================================
// File: src/components/admin/views/OrderDetailView.tsx
// Purpose: Comprehensive admin order detail. Organized into clear sections
//          with a tabbed layout:
//            - Summary     (items, quantities, prices, totals, item thumbs)
//            - Customer    (name/phone/email, address with copy + maps link,
//                          customer's lifetime order stats)
//            - Payment     (method, status, txn id, breakdown, verify actions)
//            - Shipping    (address, tracking, carrier, ETA, status advance)
//            - Prescription (image viewer + approve/reject when Rx linked)
//            - Notes       (internal OrderNote CRUD + read-only customer notes)
//            - Timeline    (visual vertical timeline of all status changes)
//
//          Top-of-page always shows: back, order #, status badge, source,
//          quick-action status buttons (Confirm / Pack / Ship / Deliver),
//          invoice + shipping-label downloads.
//
//          Mobile: card sections stack vertically; quick actions collapse
//          into a Sheet (bottom-sheet). Touch targets ≥ 44px.
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
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
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
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  StatusBadge,
  ProductThumb,
  EmptyState,
  CustomerName,
} from "../ui";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Download,
  CheckCircle2,
  PackageCheck,
  Truck,
  PartyPopper,
  XCircle,
  Clock,
  Plus,
  Trash2,
  Loader2,
  Search,
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
  Pencil,
  ShieldCheck,
  ShieldX,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Package,
  ChevronRight,
  History,
  Wallet,
  Banknote,
  QrCode,
  Smartphone,
} from "lucide-react";
import { useAdminStore } from "../admin-store";
import { formatCurrency, formatDateTime, formatDate } from "@/lib/format";
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
import { ORDER_STATUS_FLOW, PAYMENT_METHOD_LABEL, ORDER_STATUS_LABEL } from "@/lib/constants";
import { motion, AnimatePresence } from "framer-motion";

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
  customer: { id: string; name: string; email: string; phone: string; isActive: boolean } | null;
  items: any[];
  statusHistory: any[];
  orderNotes: OrderNote[];
  prescription: PrescriptionData;
  customerStats: { orderCount: number; totalSpent: number } | null;
};

export function OrderDetailView({ id }: { id: string }) {
  const back = useAdminStore((s) => s.back);
  const navigate = useAdminStore((s) => s.navigate);
  const qc = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ["admin-order", id],
    queryFn: () => api.get<OrderDetail>(`/api/admin/orders/${id}`),
  });

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [qty, setQty] = useState(1);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [busy, setBusy] = useState(false);
  const [shipOpen, setShipOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [activeTab, setActiveTab] = useState("summary");

  // Local notes state — mirrors order.orderNotes but is updated optimistically
  // when the admin adds/edits/deletes a note. The TanStack query is also
  // invalidated so a refetch reconciles any drift.
  const [notes, setNotes] = useState<OrderNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Keep payment status + notes in sync with order data.
  useEffect(() => {
    if (order) {
      setPaymentStatus(order.paymentStatus);
      setNotes(order.orderNotes ?? []);
    }
  }, [order?.paymentStatus, order?.orderNotes]);

  // Default to the Prescription tab if the order has an unverified Rx
  // (draws the admin's attention to the verification flow on first open).
  useEffect(() => {
    if (order?.prescription && order.prescription.status === "pending") {
      setActiveTab("prescription");
    }
  }, [order?.prescription?.status]);

  // --------------------- Status changes ---------------------
  async function changeStatus(status: string, reason?: string, note?: string) {
    setBusy(true);
    const r = await run(
      () => api.patch(`/api/admin/orders/${id}/status`, { status, reason, note }),
      { success: `Order marked as ${ORDER_STATUS_LABEL[status]}`, error: "Status update failed" }
    );
    setBusy(false);
    if (r) {
      qc.invalidateQueries({ queryKey: ["admin-order", id] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["admin-orders-stats"] });
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

  async function downloadShippingLabel() {
    try {
      const buf = await api.raw(`/api/admin/orders/${id}/shipping-label`);
      const blob = new Blob([buf], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `shipping-label-${order?.orderNumber || "order"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Shipping label downloaded");
    } catch (e: any) {
      toast.error(e?.message || "Failed to download shipping label");
    }
  }

  // --------------------- Note CRUD ---------------------
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

  async function saveEditNote(noteId: string) {
    if (!editingBody.trim()) return;
    setSavingNote(true);
    const r = await run(
      () =>
        api.patch<OrderNote>(`/api/admin/orders/${id}/notes/${noteId}`, {
          body: editingBody.trim(),
        }),
      { success: "Note updated", error: "Failed to update note", silent: true }
    );
    setSavingNote(false);
    if (r) {
      setNotes((prev) => prev.map((n) => (n.id === noteId ? r : n)));
      setEditingNoteId(null);
      setEditingBody("");
      qc.invalidateQueries({ queryKey: ["admin-order", id] });
      toast.success("Note updated");
    }
  }

  async function deleteNote(noteId: string) {
    if (!confirm("Delete this note? This cannot be undone.")) return;
    const r = await run(
      () => api.del(`/api/admin/orders/${id}/notes/${noteId}`),
      { success: "Note deleted", error: "Failed to delete note", silent: true }
    );
    if (r) {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      qc.invalidateQueries({ queryKey: ["admin-order", id] });
      toast.success("Note deleted");
    }
  }

  // --------------------- Add product (existing flow) ---------------------
  async function searchProducts() {
    if (!search.trim()) return;
    setSearching(true);
    try {
      const res = await api.get<{ items: any[] }>(
        `/api/admin/products?search=${encodeURIComponent(search)}&pageSize=10`
      );
      setSearchResults(res.items);
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  }

  async function addProduct(productId: string) {
    setBusy(true);
    const r = await run(() => api.post(`/api/admin/orders/${id}/items`, { productId, qty }), {
      success: "Product added",
      error: "Add failed",
    });
    setBusy(false);
    if (r) {
      setAddOpen(false);
      setSearch("");
      setSearchResults([]);
      setQty(1);
      qc.invalidateQueries({ queryKey: ["admin-order", id] });
    }
  }

  async function updateItemQty(itemId: string, newQty: number) {
    if (newQty < 1) return;
    const r = await run(
      () => api.patch(`/api/admin/orders/${id}/item/${itemId}`, { qty: newQty }),
      { error: "Update failed", silent: true }
    );
    if (r) qc.invalidateQueries({ queryKey: ["admin-order", id] });
  }

  async function removeItem(itemId: string) {
    const r = await run(() => api.del(`/api/admin/orders/${id}/item/${itemId}`), {
      success: "Item removed",
      error: "Remove failed",
    });
    if (r) qc.invalidateQueries({ queryKey: ["admin-order", id] });
  }

  // --------------------- Payment status update ---------------------
  const [savingPayment, setSavingPayment] = useState(false);
  async function updatePayment() {
    if (!order) return;
    setSavingPayment(true);
    const r = await run(
      () => api.patch(`/api/admin/orders/${id}/payment`, { paymentStatus }),
      { success: "Payment status updated", error: "Failed to update payment", silent: true }
    );
    setSavingPayment(false);
    if (r) qc.invalidateQueries({ queryKey: ["admin-order", id] });
  }

  // --------------------- Prescription verify ---------------------
  async function verifyPrescription(action: "approve" | "reject", reason?: string) {
    setBusy(true);
    const r = await run(
      () =>
        api.post(`/api/admin/orders/${id}/prescription-verify`, {
          action,
          reason,
        }),
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

  // --------------------- Shipping info ---------------------
  // The shipping API packs trackingNumber + carrier into a [shipping]
  // header line at the top of adminNotes (see shipping/route.ts). Parse
  // it back out so we can pre-fill the edit form.
  const shippingInfo = useMemo(() => {
    if (!order?.adminNotes) return { trackingNumber: "", carrier: "" };
    const m = order.adminNotes.match(/^\[shipping\](.*)$/m);
    if (!m) return { trackingNumber: "", carrier: "" };
    try {
      const parsed = JSON.parse(m[1]);
      return {
        trackingNumber: parsed.trackingNumber || "",
        carrier: parsed.carrier || "",
      };
    } catch {
      return { trackingNumber: "", carrier: "" };
    }
  }, [order?.adminNotes]);

  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState("");
  const [estimatedDelivery, setEstimatedDelivery] = useState("");
  useEffect(() => {
    setTrackingNumber(shippingInfo.trackingNumber);
    setCarrier(shippingInfo.carrier);
    setEstimatedDelivery(order?.estimatedDelivery ? order.estimatedDelivery.slice(0, 10) : "");
  }, [shippingInfo.trackingNumber, shippingInfo.carrier, order?.estimatedDelivery]);

  async function saveShipping() {
    setBusy(true);
    const r = await run(
      () =>
        api.patch(`/api/admin/orders/${id}/shipping`, {
          trackingNumber: trackingNumber || null,
          carrier: carrier || null,
          estimatedDelivery: estimatedDelivery || null,
        }),
      { success: "Shipping details updated", error: "Failed to update shipping" }
    );
    setBusy(false);
    if (r) {
      setShipOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-order", id] });
    }
  }

  // --------------------- Render helpers ---------------------
  if (isLoading) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={back} className="mb-3">
          <ArrowLeft className="size-4 mr-1" /> Back
        </Button>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2"><CardContent className="pt-6 h-48 bg-muted/30 animate-pulse" /></Card>
          <Card><CardContent className="pt-6 h-48 bg-muted/30 animate-pulse" /></Card>
        </div>
      </div>
    );
  }
  if (!order) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={back} className="mb-3">
          <ArrowLeft className="size-4 mr-1" /> Back
        </Button>
        <EmptyState title="Order not found" />
      </div>
    );
  }

  const isCancelled = order.status === "cancelled";
  const isDelivered = order.status === "delivered";
  const canAdvance = !isCancelled && !isDelivered;
  const currentIdx = ORDER_STATUS_FLOW.indexOf(order.status);
  const nextStatus =
    canAdvance && currentIdx >= 0 && currentIdx < ORDER_STATUS_FLOW.length - 1
      ? ORDER_STATUS_FLOW[currentIdx + 1]
      : null;

  const NEXT_BUTTONS: Record<string, { label: string; icon: any; tint: string }> = {
    confirmed: { label: "Mark Confirmed", icon: CheckCircle2, tint: "bg-cyan-600 hover:bg-cyan-700" },
    packed: { label: "Mark Packed", icon: PackageCheck, tint: "bg-teal-700 hover:bg-teal-800" },
    out_for_delivery: { label: "Mark Shipped", icon: Truck, tint: "bg-orange-600 hover:bg-orange-700" },
    delivered: { label: "Mark Delivered", icon: PartyPopper, tint: "bg-emerald-600 hover:bg-emerald-700" },
  };

  // Build the maps URL from the shipping address (Google Maps search).
  const mapsQuery = encodeURIComponent(
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
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  const fullAddress = [
    order.shipName,
    order.shipLine1,
    order.shipLine2,
    order.shipLocality,
    `${order.shipCity}, ${order.shipState} ${order.shipPincode}`,
    `Phone: ${order.shipPhone}`,
  ]
    .filter(Boolean)
    .join("\n");

  function copyAddress() {
    navigator.clipboard.writeText(fullAddress).then(
      () => toast.success("Address copied to clipboard"),
      () => toast.error("Failed to copy address")
    );
  }

  const hasRxItems = order.items.some((it: any) => it.product?.prescriptionRequired);

  return (
    <div>
      {/* ----------------------- Header ----------------------- */}
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <Button variant="ghost" size="sm" onClick={back}>
            <ArrowLeft className="size-4 mr-1" /> Back
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight truncate">
            {order.orderNumber}
          </h1>
          <StatusBadge status={order.status} />
          {order.source === "prescription" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700 dark:border-teal-900/50 dark:bg-teal-950/40 dark:text-teal-300">
              <FileImage className="size-3" /> Prescription Order
            </span>
          )}
          {order.source === "manual_request" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
              <ClipboardList className="size-3" /> Manual Request
            </span>
          )}
          {hasRxItems && (
            <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700">
              <FileImage className="size-3" /> Contains Rx Items
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={downloadInvoice} className="gap-1.5">
            <Download className="size-4" /> Invoice
          </Button>
          <Button variant="outline" size="sm" onClick={downloadShippingLabel} className="gap-1.5">
            <Truck className="size-4" /> Label
          </Button>
        </div>
      </div>

      {/* ----------------------- Quick status actions (always visible) ----------------------- */}
      <Card className="mb-4 border-emerald-200/60">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 mr-auto">
              <span className="text-sm text-muted-foreground">Current status:</span>
              <StatusBadge status={order.status} />
              {order.estimatedDelivery && (
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1 ml-2">
                  <CalendarClock className="size-3.5" /> ETA: {formatDate(order.estimatedDelivery)}
                </span>
              )}
            </div>
            {canAdvance && nextStatus && NEXT_BUTTONS[nextStatus] && (() => {
              const NextBtn = NEXT_BUTTONS[nextStatus];
              const Icon = NextBtn.icon;
              return (
                <Button
                  className={`text-white ${NextBtn.tint} min-h-[44px]`}
                  disabled={busy}
                  onClick={() => {
                    // When marking as shipped, prompt for tracking number.
                    if (nextStatus === "out_for_delivery") {
                      setShipOpen(true);
                    } else {
                      changeStatus(nextStatus);
                    }
                  }}
                >
                  {busy ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Icon className="size-4 mr-1.5" />}
                  {NextBtn.label}
                </Button>
              );
            })()}
            {!isCancelled && (
              <Button
                variant="outline"
                size="sm"
                className="text-rose-600 hover:text-rose-700 hover:border-rose-300 min-h-[44px]"
                disabled={busy || isDelivered}
                onClick={() => setCancelOpen(true)}
              >
                <XCircle className="size-4 mr-1.5" /> Cancel
              </Button>
            )}
            {isDelivered && (
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px]"
                disabled={busy}
                onClick={() => changeStatus("returned")}
              >
                <RotateCw className="size-4 mr-1.5" /> Mark Returned
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ----------------------- Tabs ----------------------- */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto pb-1">
          <TabsList className="inline-flex w-auto min-w-full sm:w-full">
            <TabsTrigger value="summary" className="gap-1.5"><Package className="size-3.5" /> Summary</TabsTrigger>
            <TabsTrigger value="customer" className="gap-1.5"><User className="size-3.5" /> Customer</TabsTrigger>
            <TabsTrigger value="payment" className="gap-1.5"><CreditCard className="size-3.5" /> Payment</TabsTrigger>
            <TabsTrigger value="shipping" className="gap-1.5"><Truck className="size-3.5" /> Shipping</TabsTrigger>
            {order.prescription && (
              <TabsTrigger value="prescription" className="gap-1.5">
                <FileImage className="size-3.5" /> Rx
                {order.prescription.status === "pending" && (
                  <span className="size-1.5 rounded-full bg-amber-500" />
                )}
              </TabsTrigger>
            )}
            <TabsTrigger value="notes" className="gap-1.5">
              <StickyNote className="size-3.5" /> Notes
              {notes.length > 0 && (
                <Badge className="ml-1 h-4 px-1 text-[10px] bg-emerald-100 text-emerald-700">
                  {notes.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-1.5"><History className="size-3.5" /> Timeline</TabsTrigger>
          </TabsList>
        </div>

        {/* ----------------------- SUMMARY TAB ----------------------- */}
        <TabsContent value="summary" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              {/* Order Items */}
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">Order Items ({order.items.length})</CardTitle>
                  {canAdvance && (
                    <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                      <Plus className="size-4 mr-1" /> Add Product
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">MRP</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Disc%</TableHead>
                          <TableHead className="text-right">Line Total</TableHead>
                          {canAdvance && <TableHead></TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {order.items.map((it: any) => (
                          <TableRow key={it.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <ProductThumb image={it.image} name={it.name} size={40} />
                                <div className="min-w-0">
                                  <div className="text-sm font-medium truncate max-w-[200px]">{it.name}</div>
                                  {it.sku && (
                                    <div className="text-xs text-muted-foreground font-mono">{it.sku}</div>
                                  )}
                                  {it.product && (
                                    <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                                      <span>Stock: {it.product.stock}</span>
                                      {it.product.prescriptionRequired && (
                                        <span className="inline-flex items-center gap-0.5 text-rose-600">
                                          <FileImage className="size-2.5" /> Rx
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-sm">{formatCurrency(it.mrp)}</TableCell>
                            <TableCell className="text-right">
                              {canAdvance ? (
                                <Input
                                  type="number"
                                  min={1}
                                  value={it.qty}
                                  onChange={(e) => updateItemQty(it.id, parseInt(e.target.value) || 1)}
                                  className="w-16 h-8 ml-auto text-right"
                                />
                              ) : (
                                <span className="text-sm">{it.qty}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {it.appliedDiscountPct > 0 ? `${it.appliedDiscountPct.toFixed(1)}%` : "—"}
                            </TableCell>
                            <TableCell className="text-right text-sm font-semibold">
                              {formatCurrency(it.lineTotal)}
                            </TableCell>
                            {canAdvance && (
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-rose-600 hover:text-rose-700"
                                  onClick={() => removeItem(it.id)}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Totals Breakdown */}
              <Card>
                <CardHeader><CardTitle className="text-base">Price Breakdown</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <TotalRow label="Items Total (MRP × Qty)" value={formatCurrency(order.itemsTotal)} />
                    <TotalRow
                      label="Product Discount"
                      value={`- ${formatCurrency(order.productDiscount)}`}
                      accent={order.productDiscount > 0 ? "emerald" : undefined}
                    />
                    <TotalRow
                      label={`Voucher${order.voucherCode ? ` (${order.voucherCode})` : ""}`}
                      value={`- ${formatCurrency(order.voucherDiscount)}`}
                      accent={order.voucherDiscount > 0 ? "emerald" : undefined}
                    />
                    <TotalRow
                      label="Delivery Charge"
                      value={order.deliveryCharge === 0 ? "FREE" : formatCurrency(order.deliveryCharge)}
                      accent={order.deliveryCharge === 0 ? "emerald" : undefined}
                    />
                    {order.taxTotal > 0 && (
                      <TotalRow label="Tax" value={formatCurrency(order.taxTotal)} />
                    )}
                    {order.roundOff !== 0 && (
                      <TotalRow
                        label="Round Off"
                        value={`${order.roundOff > 0 ? "+" : ""}${formatCurrency(order.roundOff)}`}
                      />
                    )}
                    {order.loyaltyPointsRedeemed > 0 && (
                      <TotalRow
                        label={`Loyalty discount (${order.loyaltyPointsRedeemed} pts)`}
                        value={`- ${formatCurrency(order.loyaltyDiscount)}`}
                        accent="amber"
                      />
                    )}
                  </div>
                  <div className="border-t mt-3 pt-3 flex items-center justify-between">
                    <span className="text-base font-semibold">Grand Total</span>
                    <span className="text-xl font-bold text-emerald-600">
                      {formatCurrency(order.grandTotal)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right column: meta info */}
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Order Meta</CardTitle></CardHeader>
                <CardContent className="text-xs text-muted-foreground space-y-1.5">
                  <MetaRow label="Source" value={order.source} />
                  <MetaRow label="Created" value={formatDateTime(order.createdAt)} />
                  {order.confirmedAt && <MetaRow label="Confirmed" value={formatDateTime(order.confirmedAt)} />}
                  {order.packedAt && <MetaRow label="Packed" value={formatDateTime(order.packedAt)} />}
                  {order.outForDeliveryAt && <MetaRow label="Out for Delivery" value={formatDateTime(order.outForDeliveryAt)} />}
                  {order.deliveredAt && <MetaRow label="Delivered" value={formatDateTime(order.deliveredAt)} />}
                  {order.cancelledAt && <MetaRow label="Cancelled" value={formatDateTime(order.cancelledAt)} />}
                  {order.updatedAt && <MetaRow label="Last Updated" value={formatDateTime(order.updatedAt)} />}
                  {order.notes && (
                    <div className="pt-2 border-t">
                      <div className="text-xs font-semibold text-foreground mb-1">Customer Notes</div>
                      <div className="text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 rounded p-2 whitespace-pre-wrap">
                        {order.notes}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ----------------------- CUSTOMER TAB ----------------------- */}
        <TabsContent value="customer" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Customer Information</CardTitle>
                <User className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-3">
                <button
                  className={`text-left w-full -mx-2 px-2 py-1.5 rounded ${
                    order.customer ? "hover:bg-muted/40 cursor-pointer" : "cursor-default"
                  }`}
                  onClick={
                    order.customer
                      ? () => navigate({ name: "customer-detail", id: order.customer!.id })
                      : undefined
                  }
                >
                  <CustomerName customer={order.customer} fallback={order.shipName} />
                </button>

                {order.customer?.phone && (
                  <a
                    href={`tel:${order.customer.phone}`}
                    className="flex items-center gap-2 text-sm hover:text-emerald-700 hover:underline"
                  >
                    <Phone className="size-3.5 text-muted-foreground" />
                    {order.customer.phone}
                  </a>
                )}
                {!order.customer?.phone && order.shipPhone && (
                  <a
                    href={`tel:${order.shipPhone}`}
                    className="flex items-center gap-2 text-sm hover:text-emerald-700 hover:underline"
                  >
                    <Phone className="size-3.5 text-muted-foreground" />
                    {order.shipPhone}
                  </a>
                )}

                {order.customer?.email && (
                  <a
                    href={`mailto:${order.customer.email}`}
                    className="flex items-center gap-2 text-sm hover:text-emerald-700 hover:underline truncate"
                  >
                    <Mail className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{order.customer.email}</span>
                  </a>
                )}

                {/* Customer stats */}
                {order.customerStats && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                    <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 p-2.5">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        Previous Orders
                      </div>
                      <div className="text-lg font-bold text-emerald-700">
                        {order.customerStats.orderCount}
                      </div>
                    </div>
                    <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 p-2.5">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        Lifetime Spent
                      </div>
                      <div className="text-lg font-bold text-amber-700">
                        {formatCurrency(order.customerStats.totalSpent)}
                      </div>
                    </div>
                  </div>
                )}

                {order.customer && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 mt-2"
                    onClick={() => navigate({ name: "customer-detail", id: order.customer!.id })}
                  >
                    <User className="size-4" /> View Customer Profile
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Shipping Address</CardTitle>
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
              <CardContent className="text-sm space-y-1">
                <div className="font-medium">{order.shipName}</div>
                <div className="text-muted-foreground">
                  {order.shipLine1}
                  {order.shipLine2 && <><br />{order.shipLine2}</>}
                  {order.shipLocality && <><br />{order.shipLocality}</>}
                  <br />{order.shipCity}, {order.shipState} {order.shipPincode}
                  <br />District: {order.shipDistrict}
                </div>
                <a
                  href={`tel:${order.shipPhone}`}
                  className="inline-flex items-center gap-1.5 text-sm text-emerald-700 hover:underline mt-2"
                >
                  <Phone className="size-3.5" /> {order.shipPhone}
                </a>
                <div className="pt-2 mt-2 border-t">
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-emerald-700 hover:underline"
                  >
                    <MapPin className="size-3.5" /> Open in Google Maps
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ----------------------- PAYMENT TAB ----------------------- */}
        <TabsContent value="payment" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Payment Details</CardTitle>
                <PaymentMethodIcon method={order.paymentMethod} />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Method</span>
                  <span className="font-medium">
                    {PAYMENT_METHOD_LABEL[order.paymentMethod] || order.paymentMethod}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge status={order.paymentStatus} />
                </div>
                {order.paymentId && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground inline-flex items-center gap-1">
                      <Hash className="size-3.5" /> Transaction ID
                    </span>
                    <span className="font-mono font-medium">{order.paymentId}</span>
                  </div>
                )}
                {order.paymentGateway && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Gateway</span>
                    <span className="font-medium capitalize">{order.paymentGateway}</span>
                  </div>
                )}
                {order.paymentTxnId && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground inline-flex items-center gap-1">
                      <Hash className="size-3.5" /> Customer Txn ID
                    </span>
                    <span className="font-mono font-medium">{order.paymentTxnId}</span>
                  </div>
                )}

                {/* COD callout */}
                {order.paymentMethod === "cod" && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">
                    <div className="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-200">
                      <Banknote className="size-4" /> Collect on Delivery
                    </div>
                    <div className="text-amber-700 dark:text-amber-300 mt-1">
                      Collect <span className="font-bold">{formatCurrency(order.grandTotal)}</span> in cash from the customer at delivery.
                    </div>
                  </div>
                )}

                {/* Payment status editor */}
                <div className="pt-3 border-t space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Update payment status
                  </Label>
                  <div className="flex gap-2">
                    <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="refunded">Refunded</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="gap-1.5 shrink-0"
                      disabled={savingPayment || paymentStatus === order.paymentStatus}
                      onClick={updatePayment}
                    >
                      {savingPayment ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                      Save
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Screenshot / Verification */}
            {order.paymentScreenshot ? (
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">Payment Verification</CardTitle>
                  <Receipt className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="overflow-hidden rounded-md border bg-muted/30">
                    <img
                      src={order.paymentScreenshot}
                      alt="Payment screenshot"
                      className="max-h-72 w-full object-contain bg-white"
                    />
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground inline-flex items-center gap-1">
                        <CalendarClock className="size-3.5" /> Uploaded
                      </span>
                      <span className="font-medium">
                        {order.paymentScreenshotUploadedAt
                          ? formatDateTime(order.paymentScreenshotUploadedAt)
                          : "—"}
                      </span>
                    </div>
                    {order.paymentTxnId && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground inline-flex items-center gap-1">
                          <Hash className="size-3.5" /> Transaction ID
                        </span>
                        <span className="font-mono font-medium">{order.paymentTxnId}</span>
                      </div>
                    )}
                  </div>
                  {order.paymentStatus !== "paid" && (
                    <Button
                      size="sm"
                      className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
                      disabled={savingPayment}
                      onClick={async () => {
                        setSavingPayment(true);
                        const r = await run(
                          () => api.patch(`/api/admin/orders/${id}/payment`, { paymentStatus: "paid" }),
                          { success: "Payment marked as paid", error: "Failed to update payment" }
                        );
                        setSavingPayment(false);
                        if (r) {
                          setPaymentStatus("paid");
                          qc.invalidateQueries({ queryKey: ["admin-order", id] });
                        }
                      }}
                    >
                      {savingPayment ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                      Mark as Paid
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">Amount Breakdown</CardTitle>
                  <Wallet className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Items Total</span>
                    <span>{formatCurrency(order.itemsTotal)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span>Product Discount</span>
                    <span>- {formatCurrency(order.productDiscount)}</span>
                  </div>
                  {order.voucherDiscount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Voucher ({order.voucherCode})</span>
                      <span>- {formatCurrency(order.voucherDiscount)}</span>
                    </div>
                  )}
                  {order.loyaltyDiscount > 0 && (
                    <div className="flex justify-between text-amber-700">
                      <span>Loyalty ({order.loyaltyPointsRedeemed} pts)</span>
                      <span>- {formatCurrency(order.loyaltyDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Delivery</span>
                    <span>{order.deliveryCharge === 0 ? "FREE" : formatCurrency(order.deliveryCharge)}</span>
                  </div>
                  {order.taxTotal > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax</span>
                      <span>{formatCurrency(order.taxTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2 mt-2 font-bold text-base">
                    <span>Grand Total</span>
                    <span className="text-emerald-600">{formatCurrency(order.grandTotal)}</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ----------------------- SHIPPING TAB ----------------------- */}
        <TabsContent value="shipping" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Shipping & Fulfillment</CardTitle>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setShipOpen(true)}>
                  <Pencil className="size-3" /> Edit
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Fulfillment Status</span>
                  <StatusBadge status={order.status} />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground inline-flex items-center gap-1.5">
                    <Truck className="size-3.5" /> Carrier
                  </span>
                  <span className="font-medium">
                    {shippingInfo.carrier || "Not specified"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground inline-flex items-center gap-1.5">
                    <Hash className="size-3.5" /> Tracking Number
                  </span>
                  {shippingInfo.trackingNumber ? (
                    <span className="font-mono font-medium text-xs">
                      {shippingInfo.trackingNumber}
                    </span>
                  ) : (
                    <span className="text-muted-foreground italic">Not set</span>
                  )}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground inline-flex items-center gap-1.5">
                    <CalendarClock className="size-3.5" /> Estimated Delivery
                  </span>
                  <span className="font-medium">
                    {order.estimatedDelivery ? formatDate(order.estimatedDelivery) : "Not set"}
                  </span>
                </div>

                {/* Shipping status flow visualization */}
                <div className="pt-3 border-t">
                  <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                    Shipping Flow
                  </div>
                  <div className="flex items-center gap-1">
                    {[
                      { key: "pending", label: "Placed", icon: Clock },
                      { key: "confirmed", label: "Confirmed", icon: CheckCircle2 },
                      { key: "packed", label: "Packed", icon: PackageCheck },
                      { key: "out_for_delivery", label: "Shipped", icon: Truck },
                      { key: "delivered", label: "Delivered", icon: PartyPopper },
                    ].map((step, i) => {
                      const idx = ORDER_STATUS_FLOW.indexOf(step.key);
                      const currentIdxFlow = ORDER_STATUS_FLOW.indexOf(order.status);
                      const isDone = currentIdxFlow >= idx && currentIdxFlow >= 0;
                      const isCurrent = order.status === step.key;
                      const Icon = step.icon;
                      return (
                        <div key={step.key} className="flex items-center flex-1">
                          <div
                            className={`flex flex-col items-center gap-1 flex-1 ${
                              isCurrent ? "scale-110" : ""
                            }`}
                          >
                            <div
                              className={`size-8 rounded-full flex items-center justify-center ${
                                isCurrent
                                  ? "bg-emerald-600 text-white ring-4 ring-emerald-100"
                                  : isDone
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-muted text-muted-foreground"
                              }`}
                            >
                              <Icon className="size-4" />
                            </div>
                            <div
                              className={`text-[10px] text-center ${
                                isCurrent
                                  ? "font-bold text-emerald-700"
                                  : isDone
                                    ? "text-emerald-700"
                                    : "text-muted-foreground"
                              }`}
                            >
                              {step.label}
                            </div>
                          </div>
                          {i < 4 && (
                            <div
                              className={`h-0.5 flex-1 -mt-4 ${
                                currentIdxFlow > idx ? "bg-emerald-400" : "bg-muted"
                              }`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Quick action buttons */}
                {canAdvance && nextStatus && (
                  <div className="pt-3 border-t space-y-2">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Quick Actions
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(NEXT_BUTTONS).map(([key, btn]) => {
                        const Icon = btn.icon;
                        const isNext = key === nextStatus;
                        return (
                          <Button
                            key={key}
                            size="sm"
                            variant={isNext ? "default" : "outline"}
                            className={`gap-1.5 min-h-[40px] ${
                              isNext ? `text-white ${btn.tint}` : ""
                            }`}
                            disabled={busy || !isNext}
                            onClick={() => {
                              if (key === "out_for_delivery") {
                                setShipOpen(true);
                              } else {
                                changeStatus(key);
                              }
                            }}
                          >
                            <Icon className="size-3.5" />
                            {btn.label}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Delivery Address</CardTitle>
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
              <CardContent className="text-sm space-y-1">
                <div className="font-medium">{order.shipName}</div>
                <div className="text-muted-foreground">
                  {order.shipLine1}
                  {order.shipLine2 && <><br />{order.shipLine2}</>}
                  {order.shipLocality && <><br />{order.shipLocality}</>}
                  <br />{order.shipCity}, {order.shipState} {order.shipPincode}
                </div>
                <a
                  href={`tel:${order.shipPhone}`}
                  className="inline-flex items-center gap-1.5 text-sm text-emerald-700 hover:underline mt-2"
                >
                  <Phone className="size-3.5" /> {order.shipPhone}
                </a>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ----------------------- PRESCRIPTION TAB ----------------------- */}
        {order.prescription && (
          <TabsContent value="prescription" className="mt-4">
            <PrescriptionSection
              prescription={order.prescription}
              orderStatus={order.status}
              busy={busy}
              onApprove={() => verifyPrescription("approve")}
              onReject={(reason) => {
                setRejectReason(reason);
                verifyPrescription("reject", reason);
              }}
            />
          </TabsContent>
        )}

        {/* ----------------------- NOTES TAB ----------------------- */}
        <TabsContent value="notes" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Internal Notes ({notes.length})</CardTitle>
                <StickyNote className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Add an internal note (visible only to admins)..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="h-9"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newNote.trim()) addNote();
                    }}
                  />
                  <Button
                    size="sm"
                    className="gap-1.5 shrink-0"
                    disabled={!newNote.trim() || savingNote}
                    onClick={addNote}
                  >
                    {savingNote ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                    Add
                  </Button>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {notes.length === 0 ? (
                    <div className="text-sm text-muted-foreground italic text-center py-6">
                      No internal notes yet.
                    </div>
                  ) : (
                    <AnimatePresence initial={false}>
                      {notes.map((note) => (
                        <motion.div
                          key={note.id}
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, height: 0 }}
                          className="rounded-lg border bg-emerald-50/40 dark:bg-emerald-950/20 p-2.5"
                        >
                          {editingNoteId === note.id ? (
                            <div className="space-y-2">
                              <Textarea
                                value={editingBody}
                                onChange={(e) => setEditingBody(e.target.value)}
                                rows={2}
                                className="text-sm"
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="h-7 gap-1"
                                  disabled={savingNote || !editingBody.trim()}
                                  onClick={() => saveEditNote(note.id)}
                                >
                                  {savingNote ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7"
                                  onClick={() => {
                                    setEditingNoteId(null);
                                    setEditingBody("");
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="text-sm whitespace-pre-wrap">{note.body}</div>
                              <div className="flex items-center justify-between mt-1.5 text-[10px] text-muted-foreground">
                                <span>
                                  {note.authorName || "Admin"} · {formatDateTime(note.createdAt)}
                                  {new Date(note.updatedAt).getTime() - new Date(note.createdAt).getTime() > 1000 && (
                                    <span className="italic"> (edited)</span>
                                  )}
                                </span>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-6"
                                    onClick={() => {
                                      setEditingNoteId(note.id);
                                      setEditingBody(note.body);
                                    }}
                                  >
                                    <Pencil className="size-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-6 text-rose-600 hover:text-rose-700"
                                    onClick={() => deleteNote(note.id)}
                                  >
                                    <Trash2 className="size-3" />
                                  </Button>
                                </div>
                              </div>
                            </>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Customer Notes</CardTitle>
                <ClipboardList className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {order.notes ? (
                  <div className="text-sm bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 rounded-lg p-3 whitespace-pre-wrap">
                    {order.notes}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground italic text-center py-6">
                    No customer notes were attached to this order.
                  </div>
                )}

                {/* Legacy admin notes (from before OrderNote existed) — shown read-only */}
                {order.adminNotes && (() => {
                  // Strip the [shipping] header line — it's metadata, not
                  // a real note. Show the rest as legacy notes.
                  const cleaned = order.adminNotes.replace(/^\[shipping\].*\n?/, "");
                  if (!cleaned.trim()) return null;
                  return (
                    <div className="mt-3 pt-3 border-t">
                      <div className="text-xs font-semibold text-muted-foreground mb-1">
                        Legacy Admin Notes
                      </div>
                      <div className="text-xs bg-muted/30 rounded p-2 whitespace-pre-wrap">
                        {cleaned}
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ----------------------- TIMELINE TAB ----------------------- */}
        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Order Timeline</CardTitle></CardHeader>
            <CardContent>
              <OrderTimeline statusHistory={order.statusHistory} currentStatus={order.status} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ----------------------- Dialogs ----------------------- */}

      {/* Cancel dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel this order?</DialogTitle>
            <DialogDescription>The customer will be notified with the reason provided.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Out of stock, customer request, invalid prescription..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Keep Order</Button>
            <Button
              variant="destructive"
              disabled={busy || !cancelReason.trim()}
              onClick={() => {
                changeStatus("cancelled", cancelReason);
                setCancelOpen(false);
              }}
            >
              Cancel Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add product dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Product to Order</DialogTitle>
            <DialogDescription>Search and add a product. Totals will be recomputed.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchProducts()}
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Qty:</Label>
              <Input type="number" min={1} value={qty} onChange={(e) => setQty(parseInt(e.target.value) || 1)} className="w-20" />
            </div>
            <div className="max-h-64 overflow-y-auto border rounded-md divide-y">
              {searching ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin inline mr-2" />Searching...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {search ? "No results" : "Type a name and press Enter"}
                </div>
              ) : (
                searchResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addProduct(p.id)}
                    className="w-full flex items-center gap-3 p-2 text-left hover:bg-muted/40"
                  >
                    <ProductThumb image={p.primaryImage} name={p.name} brand={p.brand?.name} size={36} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.brand?.name} · Stock: {p.stock}</div>
                    </div>
                    <div className="text-sm font-semibold">{formatCurrency(p.sellingPrice)}</div>
                  </button>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shipping edit dialog */}
      <Dialog open={shipOpen} onOpenChange={setShipOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Shipping Details</DialogTitle>
            <DialogDescription>
              Tracking info helps the customer track their delivery. Saving
              will also advance the order to "Shipped" if it isn't already.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Carrier / Delivery Partner</Label>
              <Input
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                placeholder="e.g. Delhivery, Blue Dart, DTDC..."
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Tracking Number / AWB</Label>
              <Input
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="e.g. AWB1234567890"
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <Label className="text-xs">Estimated Delivery Date</Label>
              <Input
                type="date"
                value={estimatedDelivery}
                onChange={(e) => setEstimatedDelivery(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShipOpen(false)}>Cancel</Button>
            <Button
              disabled={busy}
              onClick={async () => {
                await saveShipping();
                // If the order is currently "packed" or earlier, also advance
                // to "out_for_delivery" so the shipping flow reflects the
                // tracking-number entry.
                if (
                  order.status === "pending" ||
                  order.status === "confirmed" ||
                  order.status === "packed"
                ) {
                  await changeStatus("out_for_delivery");
                }
              }}
              className="gap-1.5"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Truck className="size-4" />}
              Save & Mark Shipped
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject prescription dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Prescription?</DialogTitle>
            <DialogDescription>
              The order will be cancelled and the customer will be notified with the reason.
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
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Keep Order</Button>
            <Button
              variant="destructive"
              disabled={busy || !rejectReason.trim()}
              onClick={() => {
                verifyPrescription("reject", rejectReason);
                setRejectOpen(false);
              }}
            >
              Reject & Cancel Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function TotalRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "emerald" | "amber";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          accent === "emerald"
            ? "text-emerald-600 font-medium"
            : accent === "amber"
              ? "text-amber-600 font-medium"
              : ""
        }
      >
        {value}
      </span>
    </div>
  );
}

function PaymentMethodIcon({ method }: { method: string }) {
  const Icon =
    method === "cod" ? Banknote :
    method === "qr" ? QrCode :
    method === "upi" ? Smartphone :
    method === "online" || method === "razorpay" || method === "cashfree" ? CreditCard :
    Wallet;
  return <Icon className="size-4 text-muted-foreground" />;
}

// ----------------------- Timeline -----------------------
function OrderTimeline({
  statusHistory,
  currentStatus,
}: {
  statusHistory: any[];
  currentStatus: string;
}) {
  if (!statusHistory || statusHistory.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic text-center py-6">
        No status events recorded yet.
      </div>
    );
  }

  // Show newest first.
  const events = [...statusHistory].reverse();

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-3.5 top-2 bottom-2 w-0.5 bg-border" />
      <div className="space-y-4">
        {events.map((h, i) => {
          const color =
            h.status === "delivered" ? "bg-emerald-500" :
            h.status === "cancelled" ? "bg-rose-500" :
            h.status === "returned" ? "bg-orange-500" :
            h.status === "pending" ? "bg-amber-500" :
            h.status === "out_for_delivery" ? "bg-orange-500" :
            h.status === "packed" ? "bg-teal-700" :
            h.status === "confirmed" ? "bg-cyan-500" :
            "bg-emerald-500";
          const Icon =
            h.status === "delivered" ? PartyPopper :
            h.status === "cancelled" ? XCircle :
            h.status === "pending" ? Clock :
            h.status === "out_for_delivery" ? Truck :
            h.status === "packed" ? PackageCheck :
            h.status === "confirmed" ? CheckCircle2 :
            h.status === "returned" ? RotateCw :
            CheckCircle2;
          return (
            <motion.div
              key={h.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-start gap-3 relative"
            >
              <div
                className={`size-7 rounded-full ${color} flex items-center justify-center shrink-0 z-10 ring-4 ring-background`}
              >
                <Icon className="size-3.5 text-white" />
              </div>
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium capitalize">
                    {h.status.replace(/_/g, " ")}
                  </span>
                  {i === 0 && (
                    <Badge className="bg-emerald-100 text-emerald-700 text-[9px]">Latest</Badge>
                  )}
                  {h.status === currentStatus && i === 0 && (
                    <Badge className="bg-amber-100 text-amber-700 text-[9px]">Current</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{formatDateTime(h.createdAt)}</div>
                {h.note && (
                  <div className="text-xs text-foreground mt-0.5 bg-muted/30 rounded px-2 py-1">
                    {h.note}
                  </div>
                )}
                {h.createdBy && (
                  <div className="text-[10px] text-muted-foreground/70 mt-0.5">
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

// ----------------------- Prescription Section -----------------------
function PrescriptionSection({
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
  const images = prescription.images ?? [];

  if (images.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Prescription</CardTitle></CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground italic text-center py-6">
            No prescription images attached.
          </div>
        </CardContent>
      </Card>
    );
  }

  const isVerified = prescription.status === "verified";
  const isRejected = prescription.status === "rejected";
  const isCancelled = orderStatus === "cancelled";

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
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Prescription Verification</CardTitle>
          <div className="text-xs text-muted-foreground mt-0.5">
            Uploaded {formatDateTime(prescription.createdAt)} · Status:{" "}
            <span className="font-medium capitalize">{prescription.status.replace(/_/g, " ")}</span>
          </div>
        </div>
        <FileImage className="size-5 text-teal-600 dark:text-teal-400" />
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Image viewer */}
        <div className="rounded-lg border bg-muted/30 overflow-hidden relative">
          <div className="flex items-center justify-center min-h-[300px] max-h-[500px] p-4 overflow-hidden">
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
            <span className="text-xs font-medium px-1">{Math.round(zoom * 100)}%</span>
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
          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.map((url, i) => (
              <button
                key={i}
                onClick={() => {
                  setActiveIdx(i);
                  setZoom(1);
                  setRotation(0);
                }}
                className={`shrink-0 size-16 rounded-md overflow-hidden border-2 ${
                  i === activeIdx ? "border-emerald-500" : "border-transparent hover:border-emerald-300"
                }`}
              >
                <img src={url} alt={`Thumb ${i + 1}`} className="size-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* Customer notes from prescription */}
        {prescription.notes && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3">
            <div className="text-xs font-semibold text-amber-900 dark:text-amber-200 mb-1">
              Customer Notes
            </div>
            <div className="text-sm text-amber-800 dark:text-amber-300 whitespace-pre-wrap">
              {prescription.notes}
            </div>
          </div>
        )}

        {/* Status banners */}
        {isVerified && (
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 p-3 flex items-center gap-2">
            <ShieldCheck className="size-5 text-emerald-600" />
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
          <div className="rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 p-3 flex items-center gap-2">
            <ShieldX className="size-5 text-rose-600" />
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
        {!isVerified && !isRejected && !isCancelled && (
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 gap-2 min-h-[44px]"
              disabled={busy}
              onClick={onApprove}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
              Approve Prescription
            </Button>
            <Button
              variant="destructive"
              className="gap-2 min-h-[44px]"
              disabled={busy}
              onClick={() => {
                const reason = prompt("Reason for rejection (required):");
                if (reason && reason.trim()) {
                  onReject(reason.trim());
                }
              }}
            >
              <ShieldX className="size-4" />
              Reject Prescription
            </Button>
          </div>
        )}
        {isCancelled && !isRejected && (
          <div className="rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 p-3 text-sm text-rose-800 dark:text-rose-200">
            Order was cancelled — prescription verification is no longer actionable.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
