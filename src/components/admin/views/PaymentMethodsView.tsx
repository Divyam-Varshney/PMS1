// ============================================================================
// File: src/components/admin/views/PaymentMethodsView.tsx
// Purpose: Payment method management. Modular — admin can add new methods
//          (UPI, Razorpay, Cashfree, COD, QR, etc.) without code changes.
//          Active methods appear at checkout. Each row has a quick-toggle
//          switch; full add/edit happens in a dialog.
//          Special handling:
//            - QR method: shows a QR code image upload (saved to /uploads/qr/
//              and stored in PaymentMethod.config as {"qrImage":"..."}).
//            - Razorpay method: shows Key ID + Key Secret inputs (saved to
//              config as {"keyId":"...","keySecret":"..."}) plus a "Test
//              Connection" button that POSTs to /api/admin/payment-methods/razorpay-test.
// ============================================================================

"use client";

import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, run } from "../api";
import { PageHeader, TableSkeleton, EmptyState } from "../ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Pencil,
  Trash2,
  CreditCard,
  Loader2,
  Info,
  Upload,
  PlugZap,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PaymentMethod {
  id: string;
  key: string;
  label: string;
  description?: string | null;
  icon?: string | null;
  gateway?: string | null;
  config?: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RazorpayConfig {
  keyId?: string;
  keySecret?: string;
}
interface QrConfig {
  qrImage?: string;
}

const EMPTY = {
  key: "",
  label: "",
  description: "",
  icon: "",
  gateway: "",
  displayOrder: 0,
  isActive: true,
};

// ---------------------------------------------------------------------------
// Key auto-generation: "Cash on Delivery" → "cod", "UPI" → "upi",
// "Razorpay" → "razorpay", "QR Code" → "qc". Multi-word → initials joined;
// single-word → lowercased whole word. Special-cased common terms so
// "QR Code" → "qr" (more conventional than "qc").
// ---------------------------------------------------------------------------
function generateKey(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return "";
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].toLowerCase();
  // Common multi-word payment terms — use conventional short forms.
  const lower = trimmed.toLowerCase();
  if (lower.includes("qr")) return "qr";
  if (lower.includes("upi")) return "upi";
  if (lower.includes("cash") && lower.includes("delivery")) return "cod";
  if (lower.includes("net banking")) return "netbanking";
  return words.map((w) => w[0]).join("").toLowerCase();
}

/** Safe JSON parse of PaymentMethod.config — never throws. */
function parseConfig<T = Record<string, unknown>>(raw?: string | null): T {
  if (!raw) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return {} as T;
  }
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function PaymentMethodsView() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-payment-methods"],
    queryFn: () => api.get<PaymentMethod[]>("/api/admin/payment-methods"),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  // Razorpay + QR-specific form state (parsed from config when editing)
  const [razorpayCreds, setRazorpayCreds] = useState<RazorpayConfig>({ keyId: "", keySecret: "" });
  const [qrImage, setQrImage] = useState<string>("");
  const [showSecret, setShowSecret] = useState(false);
  const [testingRazorpay, setTestingRazorpay] = useState(false);
  // When true, the key field auto-follows the label. Turned off when the
  // admin manually edits the key field so the override survives.
  const [autoKey, setAutoKey] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const qrFileInputRef = useRef<HTMLInputElement>(null);

  function openNew() {
    setEditing(null);
    setForm(EMPTY);
    setRazorpayCreds({ keyId: "", keySecret: "" });
    setQrImage("");
    setShowSecret(false);
    setAutoKey(true);
    setOpen(true);
  }

  function openEdit(pm: PaymentMethod) {
    setEditing(pm);
    setForm({
      key: pm.key,
      label: pm.label,
      description: pm.description || "",
      icon: pm.icon || "",
      gateway: pm.gateway || "",
      displayOrder: pm.displayOrder,
      isActive: pm.isActive,
    });
    // Load method-specific config from the JSON string.
    if (pm.key === "razorpay") {
      const cfg = parseConfig<RazorpayConfig>(pm.config);
      setRazorpayCreds({ keyId: cfg.keyId ?? "", keySecret: cfg.keySecret ?? "" });
    } else {
      setRazorpayCreds({ keyId: "", keySecret: "" });
    }
    if (pm.key === "qr") {
      const cfg = parseConfig<QrConfig>(pm.config);
      setQrImage(cfg.qrImage ?? "");
    } else {
      setQrImage("");
    }
    setShowSecret(false);
    // Existing records have an explicit key — don't auto-overwrite it.
    setAutoKey(false);
    setOpen(true);
  }

  function onLabelChange(value: string) {
    setForm((f: any) => ({
      ...f,
      label: value,
      ...(autoKey ? { key: generateKey(value) } : {}),
    }));
  }

  function onKeyChange(value: string) {
    setAutoKey(false);
    // Force lowercase + strip whitespace (keys must be lowercase identifiers).
    setForm((f: any) => ({ ...f, key: value.toLowerCase().replace(/\s+/g, "") }));
  }

  // Build the config object to send, based on the method key.
  function buildConfig(): Record<string, string> | undefined {
    if (form.key === "razorpay") {
      const cfg: Record<string, string> = {};
      if (razorpayCreds.keyId?.trim()) cfg.keyId = razorpayCreds.keyId.trim();
      if (razorpayCreds.keySecret?.trim()) cfg.keySecret = razorpayCreds.keySecret.trim();
      return Object.keys(cfg).length ? cfg : undefined;
    }
    if (form.key === "qr") {
      const cfg: Record<string, string> = {};
      if (qrImage) cfg.qrImage = qrImage;
      return Object.keys(cfg).length ? cfg : undefined;
    }
    return undefined;
  }

  async function save() {
    if (!form.label.trim()) {
      toast.error("Label is required");
      return;
    }
    if (!form.key.trim()) {
      toast.error("Key is required");
      return;
    }
    // Razorpay-specific validation — require both fields IF the admin is
    // enabling the method OR entering any value. Allows saving an empty
    // disabled Razorpay method (the seeded default).
    if (form.key === "razorpay" && form.isActive) {
      if (!razorpayCreds.keyId?.trim() || !razorpayCreds.keySecret?.trim()) {
        toast.error("Razorpay Key ID and Key Secret are required to enable this method");
        return;
      }
    }
    setSaving(true);
    const payload = {
      label: form.label.trim(),
      description: form.description.trim(),
      icon: form.icon.trim(),
      gateway: form.gateway.trim(),
      config: buildConfig(),
      displayOrder: parseInt(form.displayOrder, 10) || 0,
      isActive: form.isActive,
    };
    const r = editing
      ? await run(() => api.patch(`/api/admin/payment-methods/${editing.id}`, payload), {
          success: "Payment method updated",
          error: "Update failed",
        })
      : await run(
          () => api.post("/api/admin/payment-methods", { key: form.key.trim(), ...payload }),
          { success: "Payment method created", error: "Create failed" }
        );
    setSaving(false);
    if (r) {
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-payment-methods"] });
    }
  }

  async function del(pm: PaymentMethod) {
    if (!confirm(`Delete payment method "${pm.label}"?`)) return;
    const r = await run(() => api.del(`/api/admin/payment-methods/${pm.id}`), {
      success: "Payment method deleted",
      error: "Delete failed",
    });
    if (r) qc.invalidateQueries({ queryKey: ["admin-payment-methods"] });
  }

  async function quickToggle(pm: PaymentMethod, next: boolean) {
    setTogglingId(pm.id);
    const r = await run(
      () => api.patch(`/api/admin/payment-methods/${pm.id}`, { isActive: next }),
      { success: next ? "Method enabled" : "Method disabled", error: "Toggle failed", silent: true }
    );
    setTogglingId(null);
    if (r) {
      toast.success(next ? `${pm.label} enabled` : `${pm.label} disabled`);
      qc.invalidateQueries({ queryKey: ["admin-payment-methods"] });
    }
  }

  // --- QR image upload ------------------------------------------------------
  async function onQrImagePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editing) return;
    // Basic client-side validation — server re-validates.
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Image must be under 4MB");
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    const r = await run(
      () => api.upload<{ qrImage: string }>(`/api/admin/payment-methods/${editing.id}/qr-image`, fd),
      { success: "QR image uploaded", error: "Upload failed" }
    );
    if (r) {
      setQrImage(r.qrImage);
      qc.invalidateQueries({ queryKey: ["admin-payment-methods"] });
    }
    // Reset file input so the same file can be re-uploaded if needed.
    if (qrFileInputRef.current) qrFileInputRef.current.value = "";
  }

  // --- Razorpay test connection --------------------------------------------
  async function testRazorpay() {
    // Persist current creds first so the test endpoint can read them from DB.
    // This matches what the user sees (they expect to test what they typed).
    if (!editing) {
      toast.error("Save the payment method first, then test the connection");
      return;
    }
    if (!razorpayCreds.keyId?.trim() || !razorpayCreds.keySecret?.trim()) {
      toast.error("Enter Key ID and Key Secret before testing");
      return;
    }
    setSaving(true);
    const payload = {
      label: form.label.trim(),
      description: form.description.trim(),
      icon: form.icon.trim(),
      gateway: form.gateway.trim(),
      config: buildConfig(),
      displayOrder: parseInt(form.displayOrder, 10) || 0,
      isActive: form.isActive,
    };
    const saved = await run(
      () => api.patch(`/api/admin/payment-methods/${editing.id}`, payload),
      { error: "Save failed before test", silent: true }
    );
    setSaving(false);
    if (!saved) {
      toast.error("Could not save credentials — please fix and try again");
      return;
    }
    // Now hit the test endpoint.
    setTestingRazorpay(true);
    const r = await run(
      () => api.post<{ success: true; orderId: string }>("/api/admin/payment-methods/razorpay-test"),
      { success: "Razorpay connection OK — test order created & cancelled", error: "Razorpay test failed", silent: true }
    );
    setTestingRazorpay(false);
    if (r) {
      toast.success("Razorpay credentials are valid");
      qc.invalidateQueries({ queryKey: ["admin-payment-methods"] });
    } else {
      // run() already toasted the error message from the API.
    }
  }

  const isRazorpayForm = form.key === "razorpay";
  const isQrForm = form.key === "qr";

  return (
    <div>
      <PageHeader
        title="Payment Methods"
        description="Modular checkout payment options. Active methods appear at checkout."
        actions={
          <Button onClick={openNew}>
            <Plus className="size-4 mr-1" /> Add Method
          </Button>
        }
      />

      {/* Info box */}
      <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 flex gap-2 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100">
        <Info className="size-4 shrink-0 mt-0.5" />
        <div>
          Payment methods are <strong>modular</strong>. Add new methods (UPI, Razorpay,
          Cashfree, etc.) without code changes. <strong>Active methods appear at checkout.</strong>
          {" "}For Razorpay, enter your Key ID + Key Secret here — they are stored securely in the
          payment method&apos;s config (not in Settings).
        </div>
      </div>

      <Card className="admin-card">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4"><TableSkeleton rows={4} cols={7} /></div>
          ) : !data?.length ? (
            <div className="p-4">
              <EmptyState
                title="No payment methods"
                description="Add your first method — e.g. Cash on Delivery, UPI, Razorpay."
                icon={<CreditCard className="size-6" />}
                action={
                  <Button onClick={openNew}>
                    <Plus className="size-4 mr-1" /> Add Method
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-right">Order</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Gateway</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-center">Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((pm) => {
                    const cfg = parseConfig(pm.config);
                    const razorpayConfigured = !!(cfg.keyId && cfg.keySecret);
                    const qrConfigured = !!cfg.qrImage;
                    return (
                      <TableRow key={pm.id} className={pm.isActive ? "" : "opacity-60"}>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {pm.displayOrder}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <div className="size-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                              <CreditCard className="size-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-sm">{pm.label}</div>
                              {pm.icon && (
                                <div className="text-[11px] text-muted-foreground font-mono">
                                  icon: {pm.icon}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs bg-muted/40">
                            {pm.key}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {pm.gateway ? (
                            <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted text-foreground">
                              {pm.gateway}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs">
                          {pm.description ? (
                            <span className="line-clamp-2">{pm.description}</span>
                          ) : (
                            <span className="italic">—</span>
                          )}
                          {/* Inline configuration status badges */}
                          {pm.key === "razorpay" && (
                            <div className="mt-1">
                              {razorpayConfigured ? (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                                  <CheckCircle2 className="mr-1 size-2.5" /> Credentials set
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                                  No credentials
                                </Badge>
                              )}
                            </div>
                          )}
                          {pm.key === "qr" && (
                            <div className="mt-1">
                              {qrConfigured ? (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                                  <CheckCircle2 className="mr-1 size-2.5" /> QR uploaded
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                                  No QR image
                                </Badge>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center">
                            <Switch
                              checked={pm.isActive}
                              disabled={togglingId === pm.id}
                              onCheckedChange={(v) => quickToggle(pm, v)}
                              aria-label={`Toggle ${pm.label}`}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(pm)}>
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive disabled:opacity-30 disabled:cursor-not-allowed"
                              onClick={() => del(pm)}
                              disabled={pm.key === "qr" || pm.key === "cod"}
                              title={pm.key === "qr" || pm.key === "cod" ? "Core payment methods cannot be deleted" : "Delete"}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Payment Method" : "New Payment Method"}
            </DialogTitle>
            <DialogDescription>
              Configure how customers can pay at checkout. Active methods are shown
              on the checkout page.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Label <span className="text-destructive">*</span></Label>
                <Input
                  value={form.label}
                  onChange={(e) => onLabelChange(e.target.value)}
                  placeholder="e.g. Cash on Delivery, UPI, Razorpay"
                />
                <p className="text-[11px] text-muted-foreground">
                  Shown to customers at checkout.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Key <span className="text-destructive">*</span></Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={form.key}
                    onChange={(e) => onKeyChange(e.target.value)}
                    placeholder="cod"
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant={autoKey ? "secondary" : "outline"}
                    className="shrink-0"
                    onClick={() => {
                      const next = !autoKey;
                      setAutoKey(next);
                      if (next) {
                        setForm((f: any) => ({ ...f, key: generateKey(f.label) }));
                      }
                    }}
                    title={autoKey ? "Auto is ON — click to override" : "Override is ON — click to recapture from label"}
                  >
                    {autoKey ? "Auto" : "Manual"}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {editing
                    ? "Unique identifier. Cannot be changed after creation."
                    : "Lowercase identifier, auto-generated from label."}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Pay using UPI / cash when your order is delivered"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Icon (lucide name)</Label>
                <Input
                  value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  placeholder="Banknote, QrCode, Smartphone, CreditCard"
                  className="font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  Lucide icon name. Examples: Banknote, QrCode, Smartphone, CreditCard.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Gateway (optional)</Label>
                <Input
                  value={form.gateway}
                  onChange={(e) => setForm({ ...form, gateway: e.target.value })}
                  placeholder="razorpay, cashfree"
                  className="font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  Payment gateway identifier. Leave blank for COD / QR / manual methods.
                </p>
              </div>
            </div>

            {/* ----------------------------------------------------------------- */}
            {/* Razorpay credentials                                              */}
            {/* ----------------------------------------------------------------- */}
            {isRazorpayForm && (
              <div className="space-y-3 rounded-md border border-emerald-200 bg-emerald-50/40 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200">
                  <PlugZap className="size-4" />
                  <h3 className="text-sm font-semibold">Razorpay Credentials</h3>
                </div>
                <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                  Generate these from the Razorpay dashboard:{" "}
                  <span className="font-mono">Settings → API Keys → Generate Key</span>.
                  Stored securely in the PaymentMethod config — never sent to the browser.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-emerald-900 dark:text-emerald-200">Key ID</Label>
                    <Input
                      value={razorpayCreds.keyId ?? ""}
                      onChange={(e) =>
                        setRazorpayCreds((c) => ({ ...c, keyId: e.target.value }))
                      }
                      placeholder="rzp_test_XXXXXXXXXXXX"
                      className="font-mono bg-white"
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-emerald-900 dark:text-emerald-200">Key Secret</Label>
                    <div className="flex gap-2">
                      <Input
                        type={showSecret ? "text" : "password"}
                        value={razorpayCreds.keySecret ?? ""}
                        onChange={(e) =>
                          setRazorpayCreds((c) => ({ ...c, keySecret: e.target.value }))
                        }
                        placeholder="••••••••••••••••"
                        className="font-mono bg-white"
                        autoComplete="off"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => setShowSecret((v) => !v)}
                        title={showSecret ? "Hide secret" : "Show secret"}
                      >
                        {showSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-emerald-300 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
                    onClick={testRazorpay}
                    disabled={testingRazorpay || saving || !editing}
                  >
                    {testingRazorpay ? (
                      <Loader2 className="mr-1 size-3.5 animate-spin" />
                    ) : (
                      <PlugZap className="mr-1 size-3.5" />
                    )}
                    Test Connection
                  </Button>
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                    {editing
                      ? "Saves credentials first, then creates a Rs. 1 test order on Razorpay."
                      : "Save the method first to enable the test button."}
                  </span>
                </div>
              </div>
            )}

            {/* ----------------------------------------------------------------- */}
            {/* QR code image upload                                              */}
            {/* ----------------------------------------------------------------- */}
            {isQrForm && (
              <div className="space-y-3 rounded-md border border-teal-200 bg-teal-50/40 p-3 dark:border-teal-900/50 dark:bg-teal-950/20">
                <div className="flex items-center gap-2 text-teal-900 dark:text-teal-200">
                  <Upload className="size-4" />
                  <h3 className="text-sm font-semibold">QR Code Image</h3>
                </div>
                <p className="text-[11px] text-teal-800 dark:text-teal-300">
                  Upload your UPI / QR code image. Customers will see it on the order
                  confirmation page after placing a QR-paid order so they can scan &amp; pay.
                  The admin manually marks the order as paid once the UPI transfer is confirmed.
                </p>
                <div className="flex flex-wrap items-start gap-4">
                  {/* Preview / placeholder */}
                  <div className="flex size-32 shrink-0 items-center justify-center rounded-md border border-teal-200 bg-white object-contain p-1 dark:border-teal-800 dark:bg-white">
                    {qrImage ? (
                      <img
                        src={qrImage}
                        alt="QR code preview"
                        className="size-full object-contain"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-teal-400">
                        <Upload className="size-6" />
                        <span className="text-[10px]">No image</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      ref={qrFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={onQrImagePicked}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-teal-300 text-teal-800 hover:bg-teal-100 dark:border-teal-700 dark:text-teal-200 dark:hover:bg-teal-900/40"
                      onClick={() => qrFileInputRef.current?.click()}
                      disabled={!editing}
                    >
                      <Upload className="mr-1 size-3.5" />
                      {qrImage ? "Replace QR Image" : "Upload QR Image"}
                    </Button>
                    <p className="text-[11px] text-teal-700 dark:text-teal-300">
                      {editing
                        ? "PNG / JPG up to 4MB. Saved to /uploads/qr/."
                        : "Save the method first to enable upload."}
                    </p>
                    {qrImage && (
                      <p className="text-[10px] font-mono text-teal-600 dark:text-teal-400 break-all">{qrImage}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Display Order</Label>
                <Input
                  type="number"
                  value={form.displayOrder}
                  onChange={(e) =>
                    setForm({ ...form, displayOrder: parseInt(e.target.value, 10) || 0 })
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  Lower numbers appear first at checkout.
                </p>
              </div>
              <div className="flex items-end gap-2 pb-1.5">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                />
                <Label>Active (visible at checkout)</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="size-4 mr-1 animate-spin" />}
              {editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
