// ============================================================================
// File: src/components/customer/addresses-view.tsx
// Purpose: List saved addresses with edit/delete, add new form, set default.
//          Premium card styling (rounded-xl, border-border/50, shadow-premium-sm).
//          Delete uses an AlertDialog confirmation modal (no accidental deletes).
//          Skeleton cards use the skeleton-premium shimmer class.
// Role: Powers the "Addresses" view.
// ============================================================================

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, qk, Address } from "./api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { EmptyState } from "@/components/shared/empty-state";
import {
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Home,
  Briefcase,
  Loader2,
  ArrowRight,
  Star,
  Phone,
  MapPinned,
} from "lucide-react";
import { useUI } from "@/lib/store";
import { useRequireAuth } from "./use-require-auth";
import { useCustomer } from "./use-customer";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function AddressesView() {
  const { customer, isLoading: custLoading } = useRequireAuth();
  const navigate = useUI((s) => s.navigate);
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Delete-confirmation state — holds the address the user is about to delete.
  // Null means the dialog is closed. Replaces the previous "delete on click"
  // behavior so accidental clicks never destroy an address.
  const [deleteTarget, setDeleteTarget] = useState<Address | null>(null);

  const { data: addresses, isLoading } = useQuery({
    queryKey: qk.addresses,
    queryFn: () => api<Address[]>("/api/customer/addresses"),
    enabled: !!customer,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/api/customer/addresses/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.addresses });
      qc.invalidateQueries({ queryKey: qk.me });
      toast.success("Address deleted");
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) =>
      api.put(`/api/customer/addresses/${id}`, { isDefault: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.addresses });
      toast.success("Default address updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // -- Loading state — premium skeleton address cards.
  if (custLoading || isLoading) {
    return <AddressesSkeleton />;
  }

  if (!customer) {
    // useRequireAuth handles redirect in an effect
    return null;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Saved Addresses
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage delivery addresses — set a default for faster checkout.
          </p>
        </div>
        <Button
          onClick={() => {
            setShowForm((v) => !v);
            setEditingId(null);
          }}
          className="gap-2 shadow-premium-sm"
        >
          <Plus className="size-4" /> Add new
        </Button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <AddressForm
              onSaved={() => {
                setShowForm(false);
                qc.invalidateQueries({ queryKey: qk.addresses });
              }}
              onCancel={() => setShowForm(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Empty state ──────────────────────────────────────────────── */}
      {!addresses || addresses.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No saved addresses"
          description="Add a delivery address to make checkout faster. We'll pre-fill your details and calculate accurate delivery charges based on your locality."
          action={
            !showForm ? (
              <Button
                onClick={() => setShowForm(true)}
                className="gap-2 shadow-premium-sm"
              >
                <Plus className="size-4" /> Add address
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          {addresses.map((addr) => {
            if (editingId === addr.id) {
              return (
                <AddressForm
                  key={addr.id}
                  address={addr}
                  onSaved={() => {
                    setEditingId(null);
                    qc.invalidateQueries({ queryKey: qk.addresses });
                  }}
                  onCancel={() => setEditingId(null)}
                />
              );
            }
            return (
              <AddressCard
                key={addr.id}
                address={addr}
                onEdit={() => setEditingId(addr.id)}
                onDelete={() => setDeleteTarget(addr)}
                onSetDefault={() => setDefaultMutation.mutate(addr.id)}
                settingDefault={
                  setDefaultMutation.isPending &&
                  setDefaultMutation.variables === addr.id
                }
              />
            );
          })}
        </div>
      )}

      <Button
        variant="outline"
        onClick={() => navigate({ name: "account" })}
        className="mt-6 w-full gap-2 sm:w-auto"
      >
        <ArrowRight className="size-4 rotate-180" /> Back to account
      </Button>

      {/* ── Delete confirmation dialog ──────────────────────────────── */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="size-5 text-destructive" />
              Delete this address?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  This will permanently remove your{" "}
                  <span className="font-medium text-foreground">
                    {deleteTarget.label}
                  </span>{" "}
                  address
                  {deleteTarget.line1 && (
                    <>
                      {" "}
                      (
                      <span className="text-foreground">
                        {deleteTarget.line1}
                        {deleteTarget.locality ? `, ${deleteTarget.locality}` : ""}
                      </span>
                      )
                    </>
                  )}
                  . This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
              disabled={deleteMutation.isPending}
              className="gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Delete address
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddressCard — premium address card with icon, label, name, phone, full
// address, and edit / set-default / delete actions.
// ---------------------------------------------------------------------------
function AddressCard({
  address,
  onEdit,
  onDelete,
  onSetDefault,
  settingDefault,
}: {
  address: Address;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  settingDefault: boolean;
}) {
  // Pick the icon based on the label — work/office → Briefcase, else Home.
  const labelLower = address.label.toLowerCase();
  const Icon =
    labelLower === "work" || labelLower === "office" ? Briefcase : Home;
  // Pick a label-based tint so multiple saved addresses are visually distinct
  // at a glance. Emerald for Home, teal for Work, neutral for others.
  const tint =
    labelLower === "work" || labelLower === "office"
      ? "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300"
      : labelLower === "home"
        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
        : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";

  return (
    <Card
      className={`relative gap-3 overflow-hidden rounded-xl border-border/50 p-4 shadow-premium-sm transition-all hover:shadow-premium sm:p-5 ${
        address.isDefault ? "border-emerald-300 dark:border-emerald-800" : ""
      }`}
    >
      {/* Default ribbon — only on the default address */}
      {address.isDefault && (
        <div className="absolute right-0 top-0 flex items-center gap-1 rounded-bl-lg bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          <Star className="size-2.5" /> Default
        </div>
      )}

      {/* Label + icon */}
      <div className="flex items-center gap-3">
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tint}`}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{address.label}</p>
          {address.locality && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPinned className="size-3" /> {address.locality}
            </p>
          )}
        </div>
      </div>

      {/* Full address block */}
      <div className="space-y-0.5 text-sm">
        <p className="font-medium leading-snug">{address.line1}</p>
        {address.line2 && (
          <p className="text-muted-foreground">{address.line2}</p>
        )}
        <p className="text-muted-foreground">
          {address.city}, {address.district}, {address.state} -{" "}
          <span className="font-medium text-foreground">{address.pincode}</span>
        </p>
      </div>

      {/* Phone — emphasized so the customer can verify delivery contact */}
      {address.phone && (
        <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-accent/30 px-3 py-1.5 text-xs">
          <Phone className="size-3.5 text-primary" />
          <span className="font-medium tabular-nums">{address.phone}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 border-t border-border/50 pt-3">
        <Button
          size="sm"
          variant="outline"
          onClick={onEdit}
          className="gap-1.5"
        >
          <Pencil className="size-3.5" /> Edit
        </Button>
        {!address.isDefault && (
          <Button
            size="sm"
            variant="outline"
            onClick={onSetDefault}
            disabled={settingDefault}
            className="gap-1.5"
          >
            {settingDefault ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
            Set default
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          className="gap-1.5 text-destructive hover:bg-destructive/5 hover:text-destructive"
        >
          <Trash2 className="size-3.5" /> Delete
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// AddressesSkeleton — premium shimmer skeleton shown while the addresses
// query resolves. Renders 3 cards matching the actual grid layout.
// ---------------------------------------------------------------------------
export function AddressesSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Header skeleton */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <div className="h-7 w-44 skeleton-premium rounded" />
          <div className="h-4 w-64 skeleton-premium rounded" />
        </div>
        <div className="h-9 w-28 skeleton-premium rounded-md" />
      </div>

      {/* Address cards skeleton */}
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-border/50 p-4 shadow-premium-sm sm:p-5"
          >
            {/* Label row */}
            <div className="mb-3 flex items-center gap-3">
              <div className="size-10 shrink-0 rounded-xl skeleton-premium" />
              <div className="space-y-1.5">
                <div className="h-3.5 w-20 skeleton-premium rounded" />
                <div className="h-3 w-28 skeleton-premium rounded" />
              </div>
            </div>
            {/* Address lines */}
            <div className="space-y-1.5">
              <div className="h-3.5 w-3/4 skeleton-premium rounded" />
              <div className="h-3 w-1/2 skeleton-premium rounded" />
              <div className="h-3 w-2/3 skeleton-premium rounded" />
            </div>
            {/* Phone chip */}
            <div className="mt-3 h-7 w-40 skeleton-premium rounded-lg" />
            {/* Actions */}
            <div className="mt-3 flex gap-2 border-t border-border/50 pt-3">
              <div className="h-7 w-16 skeleton-premium rounded-md" />
              <div className="h-7 w-24 skeleton-premium rounded-md" />
              <div className="h-7 w-16 skeleton-premium rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AddressForm({
  address,
  onSaved,
  onCancel,
}: {
  address?: Address;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { customer } = useCustomer();
  const [label, setLabel] = useState(address?.label ?? "Home");
  const [line1, setLine1] = useState(address?.line1 ?? "");
  const [line2, setLine2] = useState(address?.line2 ?? "");
  const [city, setCity] = useState(address?.city ?? "Mathura");
  // District is no longer editable — always defaulted to "Mathura" on save.
  const [state, setState] = useState(address?.state ?? "Uttar Pradesh");
  const [pincode, setPincode] = useState(address?.pincode ?? "");
  const [locality, setLocality] = useState(address?.locality ?? "");
  const [phone, setPhone] = useState(address?.phone ?? "");
  const [isDefault, setIsDefault] = useState(address?.isDefault ?? false);
  const [saving, setSaving] = useState(false);

  // Pre-fill the phone field with the customer's registered mobile number —
  // saves them typing on the first address. Only runs when the form has no
  // existing phone (e.g. when adding a new address). For edit mode, the
  // existing address phone takes precedence and is preserved.
  useEffect(() => {
    if (customer?.phone && !phone) setPhone(customer.phone);
  }, [customer?.phone, phone]);

  // Fetch the list of localities from active delivery zones — powers the
  // Locality / Area dropdown. Delivery charges depend on this value.
  const { data: localitiesData } = useQuery({
    queryKey: ["customer", "delivery-localities"],
    queryFn: () => api<{ localities: string[] }>("/api/delivery/localities"),
  });
  const localities = localitiesData?.localities ?? [];

  const onSave = async () => {
    if (!line1 || !pincode) {
      toast.error("Address line and pincode are required");
      return;
    }
    if (!phone.trim()) {
      toast.error("Mobile number is required");
      return;
    }
    if (!locality) {
      toast.error("Please select your area / locality");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        label,
        line1,
        line2: line2 || undefined,
        city,
        district: "Mathura",
        state,
        pincode,
        locality,
        phone: phone.trim(),
        isDefault,
      };
      if (address) {
        await api.put(`/api/customer/addresses/${address.id}`, payload);
        toast.success("Address updated");
      } else {
        await api.post("/api/customer/addresses", payload);
        toast.success("Address added");
      }
      onSaved();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save address");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="gap-3 rounded-xl border-border/50 p-4 shadow-premium-sm sm:p-5">
      <div className="flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <MapPin className="size-4" />
        </div>
        <h3 className="text-sm font-semibold">
          {address ? "Edit address" : "New address"}
        </h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="af-label" className="text-xs">Label</Label>
          <Input id="af-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Home / Work / Office" />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="af-line1" className="text-xs">Address line 1 *</Label>
          <Textarea id="af-line1" value={line1} onChange={(e) => setLine1(e.target.value)} placeholder="House no, street, area" rows={2} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="af-line2" className="text-xs">Address line 2</Label>
          <Input id="af-line2" value={line2} onChange={(e) => setLine2(e.target.value)} placeholder="Landmark, etc." />
        </div>
        <div>
          <Label htmlFor="af-city" className="text-xs">City</Label>
          <Input id="af-city" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="af-pincode" className="text-xs">Pincode *</Label>
          <Input id="af-pincode" value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="281001" />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="af-locality" className="text-xs">Locality / Area *</Label>
          <Select value={locality} onValueChange={setLocality}>
            <SelectTrigger id="af-locality">
              <SelectValue placeholder="Select your area" />
            </SelectTrigger>
            <SelectContent>
              {localities.length === 0 ? (
                <SelectItem value="__none__" disabled>No areas configured</SelectItem>
              ) : (
                localities.map((loc) => (
                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Required — used to calculate accurate delivery charges</p>
        </div>
        <div>
          <Label htmlFor="af-state" className="text-xs">State</Label>
          <Input id="af-state" value={state} onChange={(e) => setState(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="af-phone" className="text-xs flex items-center gap-1">
            <Phone className="size-3" /> Mobile Number *
          </Label>
          <Input id="af-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98XXXXXXXX" required />
        </div>
        <div className="sm:col-span-2 flex items-center gap-2">
          <input
            type="checkbox"
            id="af-default"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="size-4 rounded border-input"
          />
          <Label htmlFor="af-default" className="text-sm cursor-pointer">Make this my default address</Label>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onSave} disabled={saving} size="sm" className="gap-1.5">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          {address ? "Update" : "Save"} address
        </Button>
        <Button onClick={onCancel} variant="outline" size="sm" className="gap-1.5">
          <X className="size-4" /> Cancel
        </Button>
      </div>
    </Card>
  );
}
