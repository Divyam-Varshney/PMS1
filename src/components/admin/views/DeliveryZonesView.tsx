// ============================================================================
// File: src/components/admin/views/DeliveryZonesView.tsx
// Purpose: Delivery zone management. Each zone has a name, localities
//          (preferred, case-insensitive match), optional pincodes (fallback),
//          charge, freeAbove, minOrder, estimatedHours, displayOrder, isActive.
//          Localities are matched first; pincodes only kick in when no
//          locality matches the customer's address.
//
// Phase 30.4 improvements:
//   • Two-tier responsive layout — table on desktop, premium cards on mobile
//   • Inline validation (pincode 6-digit format, numeric charges, ETA >= 0)
//   • Grouped form sections (Basic Info, Service Area, Charges & ETA, Display)
//   • AlertDialog delete confirmation (replaces native confirm())
//   • Premium empty state with emerald gradient icon + helpful CTA
//   • Helper text under every field explaining the expected format
// ============================================================================

"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, run } from "../api";
import { PageHeader, StatusBadge, TableSkeleton, EmptyState } from "../ui";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  Truck,
  Loader2,
  Info,
  MapPin,
  Hash,
  Clock,
  IndianRupee,
  Gauge,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers — split newline/comma-separated text into a clean list
// ---------------------------------------------------------------------------

function splitList(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Validate a single Indian PIN code (6 digits, first non-zero). */
function isValidPincode(pin: string): boolean {
  return /^[1-9]\d{5}$/.test(pin);
}

/** Validate the entire raw pincodes string (one per line/comma). Returns the
 *  list of invalid entries (empty list = all valid). */
function validatePincodes(raw: string): string[] {
  const codes = splitList(raw);
  return codes.filter((c) => !isValidPincode(c));
}

// ---------------------------------------------------------------------------
// Form / view types
// ---------------------------------------------------------------------------

interface DeliveryZone {
  id: string;
  name: string;
  localities: string;
  pincodes: string;
  charge: number;
  freeAbove?: number | null;
  minOrder: number;
  estimatedHours: number;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

const EMPTY = {
  name: "",
  localities: "",
  pincodes: "",
  charge: 0,
  freeAbove: "" as string | number,
  minOrder: 0,
  estimatedHours: 24,
  displayOrder: 0,
  isActive: true,
};

interface FormErrors {
  name?: string;
  localities?: string;
  pincodes?: string;
  charge?: string;
  freeAbove?: string;
  minOrder?: string;
  estimatedHours?: string;
}

export function DeliveryZonesView() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-delivery-zones"],
    queryFn: () => api.get<DeliveryZone[]>("/api/admin/delivery-zones"),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DeliveryZone | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeliveryZone | null>(null);
  const [deleting, setDeleting] = useState(false);

  function openNew() {
    setEditing(null);
    setForm(EMPTY);
    setErrors({});
    setTouched({});
    setOpen(true);
  }
  function openEdit(z: DeliveryZone) {
    setEditing(z);
    setForm({
      name: z.name,
      localities: z.localities || "",
      pincodes: z.pincodes || "",
      charge: z.charge,
      freeAbove: z.freeAbove != null ? z.freeAbove : "",
      minOrder: z.minOrder,
      estimatedHours: z.estimatedHours,
      displayOrder: z.displayOrder,
      isActive: z.isActive,
    });
    setErrors({});
    setTouched({});
    setOpen(true);
  }

  // -------------------------------------------------------------------
  // Inline validation — runs on every form change so the user sees
  // errors as they type (after the field is touched).
  // -------------------------------------------------------------------
  function validateField(field: keyof FormErrors, value: any): string | undefined {
    switch (field) {
      case "name":
        if (!String(value || "").trim()) return "Zone name is required";
        if (String(value).trim().length < 2) return "Name must be at least 2 characters";
        return undefined;
      case "localities": {
        const locs = splitList(String(value || ""));
        if (locs.length === 0 && !String(form.pincodes || "").trim()) {
          return "Add at least one locality or one pincode";
        }
        return undefined;
      }
      case "pincodes": {
        const invalid = validatePincodes(String(value || ""));
        if (invalid.length > 0) {
          return `Invalid PIN code(s): ${invalid.join(", ")}. Indian PINs are 6 digits (first digit 1-9).`;
        }
        return undefined;
      }
      case "charge":
        if (isNaN(Number(value)) || Number(value) < 0) return "Charge must be a non-negative number";
        return undefined;
      case "freeAbove":
        if (value !== "" && (isNaN(Number(value)) || Number(value) < 0)) {
          return "Free-above must be a non-negative number (or blank)";
        }
        return undefined;
      case "minOrder":
        if (isNaN(Number(value)) || Number(value) < 0) return "Min order must be a non-negative number";
        return undefined;
      case "estimatedHours":
        if (!Number.isInteger(Number(value)) || Number(value) < 0) {
          return "ETA must be a whole number of hours (0 or more)";
        }
        return undefined;
    }
    return undefined;
  }

  function validateAll(): FormErrors {
    const errs: FormErrors = {};
    const nameErr = validateField("name", form.name);
    if (nameErr) errs.name = nameErr;
    const locErr = validateField("localities", form.localities);
    if (locErr) errs.localities = locErr;
    const pinErr = validateField("pincodes", form.pincodes);
    if (pinErr) errs.pincodes = pinErr;
    const chargeErr = validateField("charge", form.charge);
    if (chargeErr) errs.charge = chargeErr;
    const freeAboveErr = validateField("freeAbove", form.freeAbove);
    if (freeAboveErr) errs.freeAbove = freeAboveErr;
    const minOrderErr = validateField("minOrder", form.minOrder);
    if (minOrderErr) errs.minOrder = minOrderErr;
    const etaErr = validateField("estimatedHours", form.estimatedHours);
    if (etaErr) errs.estimatedHours = etaErr;
    return errs;
  }

  function updateField<K extends keyof typeof form>(field: K, value: any) {
    setForm({ ...form, [field]: value });
    if (touched[field as string]) {
      const err = validateField(field as keyof FormErrors, value);
      setErrors({ ...errors, [field]: err });
    }
  }

  function markTouched(field: string) {
    setTouched({ ...touched, [field]: true });
    const err = validateField(field as keyof FormErrors, form[field]);
    setErrors({ ...errors, [field]: err });
  }

  async function save() {
    const errs = validateAll();
    setErrors(errs);
    setTouched({
      name: true,
      localities: true,
      pincodes: true,
      charge: true,
      freeAbove: true,
      minOrder: true,
      estimatedHours: true,
    });
    if (Object.keys(errs).length > 0) {
      toast.error("Please fix the errors in the form before saving");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      localities: form.localities,
      pincodes: form.pincodes,
      charge: Number(form.charge) || 0,
      freeAbove: form.freeAbove === "" ? null : Number(form.freeAbove),
      minOrder: Number(form.minOrder) || 0,
      estimatedHours: parseInt(form.estimatedHours, 10) || 24,
      displayOrder: parseInt(form.displayOrder, 10) || 0,
      isActive: form.isActive,
    };
    const r = editing
      ? await run(() => api.put(`/api/admin/delivery-zones/${editing.id}`, payload), {
          success: "Zone updated",
          error: "Update failed",
        })
      : await run(() => api.post("/api/admin/delivery-zones", payload), {
          success: "Zone created",
          error: "Create failed",
        });
    setSaving(false);
    if (r) {
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-delivery-zones"] });
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const r = await run(() => api.del(`/api/admin/delivery-zones/${deleteTarget.id}`), {
      success: `Zone "${deleteTarget.name}" deleted`,
      error: "Delete failed",
    });
    setDeleting(false);
    if (r) {
      qc.invalidateQueries({ queryKey: ["admin-delivery-zones"] });
      setDeleteTarget(null);
    }
  }

  // Sorted by displayOrder (then name) for display
  const sortedZones = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => {
      if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
      return a.name.localeCompare(b.name);
    });
  }, [data]);

  const activeCount = sortedZones.filter((z) => z.isActive).length;

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  return (
    <div>
      <PageHeader
        title="Delivery Zones"
        description="Locality-based delivery charges. PIN codes are an optional fallback when no locality matches."
        actions={
          <Button onClick={openNew} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="size-4 mr-1" /> Add Zone
          </Button>
        }
      />

      {/* Summary stats */}
      {sortedZones.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Card className="rounded-xl border-border/50 shadow-premium-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <Truck className="size-5" />
              </div>
              <div>
                <div className="text-xl font-bold text-foreground">{sortedZones.length}</div>
                <div className="text-xs text-muted-foreground">Total Zones</div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-border/50 shadow-premium-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-10 items-center justify-center rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
                <CheckCircle2 className="size-5" />
              </div>
              <div>
                <div className="text-xl font-bold text-foreground">{activeCount}</div>
                <div className="text-xs text-muted-foreground">Active</div>
              </div>
            </CardContent>
          </Card>
          <Card className="col-span-2 rounded-xl border-border/50 shadow-premium-sm sm:col-span-1">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                <XCircle className="size-5" />
              </div>
              <div>
                <div className="text-xl font-bold text-foreground">{sortedZones.length - activeCount}</div>
                <div className="text-xs text-muted-foreground">Inactive</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="rounded-xl border-border/50 shadow-premium-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4"><TableSkeleton rows={4} cols={7} /></div>
          ) : !sortedZones.length ? (
            <div className="p-6">
              <EmptyState
                title="No delivery zones yet"
                description="Create your first delivery zone — e.g. Mathura City, Vrindavan — with locality names and a delivery charge. PIN codes are an optional fallback."
                icon={<Truck className="size-6" />}
                action={
                  <Button onClick={openNew} className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="size-4 mr-1" /> Add Your First Zone
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              {/* Desktop: table view (md+ breakpoint) */}
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-[180px]">Zone</TableHead>
                      <TableHead>Localities</TableHead>
                      <TableHead className="text-right">Charge</TableHead>
                      <TableHead className="text-right">Free Above</TableHead>
                      <TableHead className="text-right">Min Order</TableHead>
                      <TableHead className="text-right">ETA</TableHead>
                      <TableHead className="text-right">Order</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[90px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedZones.map((z) => {
                      const locs = splitList(z.localities);
                      const codes = splitList(z.pincodes);
                      return (
                        <TableRow key={z.id} className="hover:bg-muted/30">
                          <TableCell className="font-medium text-foreground">
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                "flex size-7 items-center justify-center rounded-lg",
                                z.isActive
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : "bg-stone-100 text-stone-500 dark:bg-stone-900/40 dark:text-stone-400"
                              )}>
                                <MapPin className="size-3.5" />
                              </div>
                              {z.name}
                            </div>
                          </TableCell>
                          <TableCell>
                            {locs.length === 0 ? (
                              <span className="text-xs text-muted-foreground italic">
                                No localities · {codes.length} PIN{codes.length !== 1 ? "s" : ""}
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {locs.slice(0, 4).map((l: string) => (
                                  <span
                                    key={l}
                                    className="text-xs px-1.5 py-0.5 rounded bg-muted text-foreground"
                                  >
                                    {l}
                                  </span>
                                ))}
                                {locs.length > 4 && (
                                  <span className="text-xs text-muted-foreground">
                                    +{locs.length - 4} more
                                  </span>
                                )}
                                {codes.length > 0 && (
                                  <span className="text-xs text-muted-foreground italic">
                                    (+{codes.length} PIN)
                                  </span>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-sm font-semibold text-foreground">
                            {formatCurrency(z.charge)}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {z.freeAbove != null ? (
                              <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(z.freeAbove)}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {z.minOrder > 0 ? formatCurrency(z.minOrder) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">{z.estimatedHours}h</TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">{z.displayOrder}</TableCell>
                          <TableCell>
                            <StatusBadge status={z.isActive ? "active" : "inactive"} />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(z)} title="Edit">
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget(z)}
                                title="Delete"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: card view (below md breakpoint) */}
              <div className="divide-y divide-border/40 md:hidden">
                {sortedZones.map((z) => {
                  const locs = splitList(z.localities);
                  const codes = splitList(z.pincodes);
                  return (
                    <div key={z.id} className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "flex size-9 items-center justify-center rounded-lg",
                            z.isActive
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "bg-stone-100 text-stone-500 dark:bg-stone-900/40 dark:text-stone-400"
                          )}>
                            <MapPin className="size-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-foreground">{z.name}</div>
                            <div className="text-xs text-muted-foreground">Order #{z.displayOrder} · ETA {z.estimatedHours}h</div>
                          </div>
                        </div>
                        <StatusBadge status={z.isActive ? "active" : "inactive"} />
                      </div>

                      {/* Localities chips */}
                      {locs.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {locs.slice(0, 6).map((l: string) => (
                            <span key={l} className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-foreground">{l}</span>
                          ))}
                          {locs.length > 6 && (
                            <span className="text-[11px] text-muted-foreground">+{locs.length - 6} more</span>
                          )}
                          {codes.length > 0 && (
                            <span className="text-[11px] text-muted-foreground italic">(+{codes.length} PIN)</span>
                          )}
                        </div>
                      )}
                      {locs.length === 0 && codes.length > 0 && (
                        <div className="mt-3 text-xs text-muted-foreground italic">
                          {codes.length} PIN code{codes.length !== 1 ? "s" : ""}: {codes.slice(0, 3).join(", ")}{codes.length > 3 ? "…" : ""}
                        </div>
                      )}

                      {/* Charges grid */}
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded-lg border border-border/40 bg-muted/20 p-2">
                          <div className="text-muted-foreground">Charge</div>
                          <div className="font-semibold text-foreground">{formatCurrency(z.charge)}</div>
                        </div>
                        <div className="rounded-lg border border-border/40 bg-muted/20 p-2">
                          <div className="text-muted-foreground">Free Above</div>
                          <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {z.freeAbove != null ? formatCurrency(z.freeAbove) : "—"}
                          </div>
                        </div>
                        <div className="rounded-lg border border-border/40 bg-muted/20 p-2">
                          <div className="text-muted-foreground">Min Order</div>
                          <div className="font-semibold text-foreground">
                            {z.minOrder > 0 ? formatCurrency(z.minOrder) : "—"}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="mt-3 flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(z)}>
                          <Pencil className="size-3.5 mr-1" /> Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteTarget(z)}
                        >
                          <Trash2 className="size-3.5 mr-1" /> Delete
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* CREATE / EDIT DIALOG                                              */}
      {/* ----------------------------------------------------------------- */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <Truck className="size-4" />
              </div>
              {editing ? "Edit Delivery Zone" : "New Delivery Zone"}
            </DialogTitle>
            <DialogDescription>
              Localities are matched first (case-insensitive). If no locality matches, the system falls back to PIN code matching.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* -- Section: Basic Info -- */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                <MapPin className="size-3.5" /> Basic Info
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="zone-name">Zone Name <span className="text-destructive">*</span></Label>
                <Input
                  id="zone-name"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  onBlur={() => markTouched("name")}
                  placeholder='e.g. "Mathura City", "Vrindavan"'
                  className={cn(errors.name && "border-destructive focus-visible:ring-destructive")}
                  aria-invalid={!!errors.name}
                />
                {errors.name ? (
                  <p className="text-[11px] text-destructive flex items-center gap-1">
                    <AlertCircle className="size-3" /> {errors.name}
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">A recognisable name for this delivery area.</p>
                )}
              </div>
            </div>

            {/* -- Section: Service Area -- */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                <MapPin className="size-3.5" /> Service Area
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="zone-localities">Localities <span className="text-destructive">*</span></Label>
                <Textarea
                  id="zone-localities"
                  rows={4}
                  value={form.localities}
                  onChange={(e) => updateField("localities", e.target.value)}
                  onBlur={() => markTouched("localities")}
                  placeholder={"Krishna Nagar\nHoli Gate\nMaholi Road\nChhata"}
                  className={cn(errors.localities && "border-destructive focus-visible:ring-destructive")}
                  aria-invalid={!!errors.localities}
                />
                {errors.localities ? (
                  <p className="text-[11px] text-destructive flex items-center gap-1">
                    <AlertCircle className="size-3" /> {errors.localities}
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Preferred match. List neighbourhoods / areas served by this zone — one per line or comma-separated.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="zone-pincodes">PIN codes (optional fallback)</Label>
                <Textarea
                  id="zone-pincodes"
                  rows={3}
                  value={form.pincodes}
                  onChange={(e) => updateField("pincodes", e.target.value)}
                  onBlur={() => markTouched("pincodes")}
                  placeholder={"281001\n281002\n281003"}
                  className={cn(errors.pincodes && "border-destructive focus-visible:ring-destructive")}
                  aria-invalid={!!errors.pincodes}
                />
                {errors.pincodes ? (
                  <p className="text-[11px] text-destructive flex items-center gap-1">
                    <AlertCircle className="size-3" /> {errors.pincodes}
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Used only when no locality matches. Indian PIN codes are 6 digits (e.g. 281001).
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-xs text-teal-900 flex gap-2 dark:border-teal-900/50 dark:bg-teal-950/30 dark:text-teal-100">
                <Info className="size-4 shrink-0 mt-0.5" />
                <div>
                  <strong>How matching works:</strong> the customer&apos;s address is searched for locality names
                  first (case-insensitive substring match). If none match, the customer&apos;s PIN code is compared
                  to the PIN codes above. The first matching active zone (by display order) wins.
                </div>
              </div>
            </div>

            {/* -- Section: Charges & ETA -- */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                <IndianRupee className="size-3.5" /> Charges &amp; ETA
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor="zone-charge">Charge (Rs.) <span className="text-destructive">*</span></Label>
                  <Input
                    id="zone-charge"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.charge}
                    onChange={(e) => updateField("charge", parseFloat(e.target.value) || 0)}
                    onBlur={() => markTouched("charge")}
                    className={cn(errors.charge && "border-destructive focus-visible:ring-destructive")}
                    aria-invalid={!!errors.charge}
                  />
                  {errors.charge && <p className="text-[11px] text-destructive">{errors.charge}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="zone-free">Free Above (Rs.)</Label>
                  <Input
                    id="zone-free"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.freeAbove}
                    onChange={(e) => updateField("freeAbove", e.target.value)}
                    onBlur={() => markTouched("freeAbove")}
                    placeholder="blank = never"
                    className={cn(errors.freeAbove && "border-destructive focus-visible:ring-destructive")}
                    aria-invalid={!!errors.freeAbove}
                  />
                  {errors.freeAbove ? (
                    <p className="text-[11px] text-destructive">{errors.freeAbove}</p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">Orders at or above this get free delivery.</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="zone-min">Min Order (Rs.)</Label>
                  <Input
                    id="zone-min"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.minOrder}
                    onChange={(e) => updateField("minOrder", parseFloat(e.target.value) || 0)}
                    onBlur={() => markTouched("minOrder")}
                    className={cn(errors.minOrder && "border-destructive focus-visible:ring-destructive")}
                    aria-invalid={!!errors.minOrder}
                  />
                  {errors.minOrder && <p className="text-[11px] text-destructive">{errors.minOrder}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="zone-eta">ETA (hours)</Label>
                  <Input
                    id="zone-eta"
                    type="number"
                    min="0"
                    step="1"
                    value={form.estimatedHours}
                    onChange={(e) => updateField("estimatedHours", e.target.value)}
                    onBlur={() => markTouched("estimatedHours")}
                    className={cn(errors.estimatedHours && "border-destructive focus-visible:ring-destructive")}
                    aria-invalid={!!errors.estimatedHours}
                  />
                  {errors.estimatedHours && <p className="text-[11px] text-destructive">{errors.estimatedHours}</p>}
                </div>
              </div>
            </div>

            {/* -- Section: Display -- */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                <Gauge className="size-3.5" /> Display &amp; Status
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="zone-order">Display Order</Label>
                  <Input
                    id="zone-order"
                    type="number"
                    min="0"
                    value={form.displayOrder}
                    onChange={(e) => updateField("displayOrder", e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">Lower numbers appear first; first match wins.</p>
                </div>
                <div className="flex items-end gap-2 pb-1.5">
                  <Switch
                    id="zone-active"
                    checked={form.isActive}
                    onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                  />
                  <Label htmlFor="zone-active" className="cursor-pointer">Active</Label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving && <Loader2 className="size-4 mr-1 animate-spin" />}
              {editing ? "Update Zone" : "Create Zone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ----------------------------------------------------------------- */}
      {/* DELETE CONFIRMATION                                               */}
      {/* ----------------------------------------------------------------- */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <Trash2 className="size-4" />
              </div>
              Delete Delivery Zone
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong className="text-foreground">{deleteTarget?.name}</strong>?
              This action cannot be undone. Customers in this area will not be able to place new orders
              until you create a replacement zone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="size-4 mr-1 animate-spin" />}
              Delete Zone
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
