// ============================================================================
// File: src/components/admin/ui.tsx
// Purpose: Small shared admin UI primitives — status badges, page header,
//          loading skeletons, empty state. Reused across all admin views.
// ============================================================================

"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Inbox } from "lucide-react";
import {
  ORDER_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
} from "@/lib/constants";

// --------------------------- Page Header ---------------------------
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground truncate">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

// --------------------------- Status Badges ---------------------------
// Each style tuple pairs a light-mode class with a dark-mode contrast helper
// (`.admin-badge-*` tokens defined in globals.css). This keeps text legible in
// both themes — a previous iteration only set light `bg-*-100 text-*-800`
// classes which washed out in dark mode.
const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200 admin-badge-amber",
  confirmed: "bg-cyan-100 text-cyan-800 border-cyan-200 admin-badge-cyan",
  packed: "bg-teal-100 text-teal-800 border-teal-200 admin-badge-teal",
  out_for_delivery: "bg-orange-100 text-orange-800 border-orange-200 admin-badge-orange",
  delivered: "bg-emerald-100 text-emerald-800 border-emerald-200 admin-badge-emerald",
  cancelled: "bg-rose-100 text-rose-800 border-rose-200 admin-badge-rose",
  returned: "bg-stone-200 text-stone-800 border-stone-300 admin-badge-stone",
  paid: "bg-emerald-100 text-emerald-800 border-emerald-200 admin-badge-emerald",
  failed: "bg-rose-100 text-rose-800 border-rose-200 admin-badge-rose",
  refunded: "bg-stone-200 text-stone-800 border-stone-300 admin-badge-stone",
  active: "bg-emerald-100 text-emerald-800 border-emerald-200 admin-badge-emerald",
  inactive: "bg-stone-200 text-stone-700 border-stone-300 admin-badge-stone",
  draft: "bg-stone-200 text-stone-700 border-stone-300 admin-badge-stone",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200 admin-badge-emerald",
  rejected: "bg-rose-100 text-rose-800 border-rose-200 admin-badge-rose",
  under_review: "bg-amber-100 text-amber-800 border-amber-200 admin-badge-amber",
  verified: "bg-cyan-100 text-cyan-800 border-cyan-200 admin-badge-cyan",
  converted: "bg-emerald-100 text-emerald-800 border-emerald-200 admin-badge-emerald",
  sent: "bg-emerald-100 text-emerald-800 border-emerald-200 admin-badge-emerald",
  queued: "bg-amber-100 text-amber-800 border-amber-200 admin-badge-amber",
};

export function StatusBadge({ status, label, className }: { status: string; label?: string; className?: string }) {
  const cls = STATUS_STYLES[status] || "bg-stone-100 text-stone-700 border-stone-200 admin-badge-stone";
  return (
    <Badge variant="outline" className={cn("border gap-1 font-medium", cls, className)}>
      <span className={cn(
        "size-1.5 rounded-full",
        status === "delivered" || status === "paid" || status === "active" || status === "approved" || status === "converted" || status === "sent"
          ? "bg-emerald-500"
          : status === "cancelled" || status === "failed" || status === "rejected"
            ? "bg-rose-500"
            : status === "pending" || status === "under_review" || status === "queued"
              ? "bg-amber-500"
              : status === "confirmed" || status === "verified"
                ? "bg-cyan-500"
                : status === "packed"
                  ? "bg-teal-700"
                  : status === "out_for_delivery"
                    ? "bg-orange-500"
                    : "bg-stone-400"
      )} />
      {label || ORDER_STATUS_LABEL[status] || status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
    </Badge>
  );
}

export function PaymentBadge({ method, status }: { method: string; status?: string }) {
  return (
    <div className="flex flex-col gap-1 items-start">
      <Badge variant="outline" className="bg-muted/50">
        {PAYMENT_METHOD_LABEL[method] || method}
      </Badge>
      {status && <StatusBadge status={status} />}
    </div>
  );
}

// --------------------------- Loading / Empty ---------------------------
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border/60">
      {/* Skeleton header */}
      <div className="flex gap-3 border-b bg-muted/40 p-3">
        {Array.from({ length: cols }).map((_, j) => (
          <Skeleton key={j} className="h-4 flex-1" />
        ))}
      </div>
      {/* Skeleton rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={`flex gap-3 p-3 ${i !== rows - 1 ? "border-b border-border/40" : ""}`}
        >
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton
              key={j}
              className="h-8 flex-1"
              style={{ animationDelay: `${(i * cols + j) * 50}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="admin-empty-state empty-state-premium">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4 shadow-premium-sm ring-1 ring-primary/10">
        {icon || <Inbox className="size-6" />}
      </div>
      <p className="font-semibold text-foreground text-base">{title}</p>
      {description && <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// --------------------------- Image Placeholder ---------------------------
export function ProductThumb({
  image,
  name,
  brand,
  size = 40,
}: {
  image?: string | null;
  name: string;
  brand?: string | null;
  size?: number;
}) {
  if (image) {
    return (
      <img
        src={image}
        alt={name}
        style={{ width: size, height: size }}
        className="rounded-md object-cover border border-border bg-muted/30"
      />
    );
  }
  const initial = (brand?.[0] || name?.[0] || "P").toUpperCase();
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-md bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm border border-primary/20"
    >
      {initial}
    </div>
  );
}

// --------------------------- Customer Cell (null-safe) ---------------------------
// When a customer is deleted, their orders/prescriptions/manual-requests retain
// a snapshot of the ship* fields (for orders) but the `customer` relation becomes
// null (onDelete: SetNull). This helper renders a graceful "Customer deleted"
// placeholder instead of crashing on `customer.name` access.
export interface CustomerRef {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}

export function CustomerName({ customer, fallback }: { customer: CustomerRef | null | undefined; fallback?: string }) {
  if (!customer) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground italic">
        <span className="inline-block size-1.5 rounded-full bg-muted-foreground/50" />
        {fallback || "Customer deleted"}
      </span>
    );
  }
  return <span className="text-sm font-medium">{customer.name || "Unknown"}</span>;
}

export function CustomerContact({ customer, fallback }: { customer: CustomerRef | null | undefined; fallback?: string }) {
  if (!customer) {
    return <span className="text-xs text-muted-foreground italic">{fallback || "N/A"}</span>;
  }
  return (
    <div className="flex flex-col">
      {customer.phone && <span className="text-xs text-muted-foreground">{customer.phone}</span>}
      {customer.email && <span className="text-xs text-muted-foreground">{customer.email}</span>}
      {!customer.phone && !customer.email && <span className="text-xs text-muted-foreground">N/A</span>}
    </div>
  );
}

export function CustomerDetailBlock({ customer, extra }: { customer: CustomerRef | null | undefined; extra?: React.ReactNode }) {
  if (!customer) {
    return (
      <div className="text-sm">
        <div className="font-medium text-muted-foreground italic">Customer deleted</div>
        <div className="text-muted-foreground text-xs mt-0.5">This record's customer was removed.</div>
        {extra}
      </div>
    );
  }
  return (
    <div className="text-sm">
      <div className="font-medium">{customer.name || "Unknown"}</div>
      {customer.email && <div className="text-muted-foreground">{customer.email}</div>}
      {customer.phone && <div className="text-muted-foreground">{customer.phone}</div>}
      {extra}
    </div>
  );
}
