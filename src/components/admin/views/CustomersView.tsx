// ============================================================================
// File: src/components/admin/views/CustomersView.tsx
// Purpose: Customers list (search + pagination) and detail (profile, addresses,
//          order history, toggle active).
// ============================================================================

"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { api, run } from "../api";
import { PageHeader, StatusBadge, TableSkeleton, EmptyState } from "../ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Search, Users, ArrowLeft, MapPin, Mail, Phone, ShieldCheck, Clock, Trash2, Loader2,
  ShoppingCart, IndianRupee, TrendingUp, Gift, FileImage, ClipboardList, Eye,
  ArrowUpRight, ArrowDownRight, History, Package, Download,
} from "lucide-react";
import { useAdminStore } from "../admin-store";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { toast } from "sonner";

export function CustomersView() {
  const navigate = useAdminStore((s) => s.navigate);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [verifiedFilter, setVerifiedFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const pageSize = 20;

  const query = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search.trim()) p.set("search", search.trim());
    if (verifiedFilter !== "all") p.set("verified", verifiedFilter);
    return p.toString();
  }, [search, page, verifiedFilter]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-customers", query],
    queryFn: () =>
      api.get<{ items: any[]; total: number; totalPages: number; page: number }>(
        `/api/admin/customers?${query}`
      ),
  });

  const allSelected = (data?.items?.length ?? 0) > 0 && data!.items.every((c) => selected.has(c.id));
  function toggleAll() {
    if (!data?.items) return;
    const next = new Set(selected);
    if (allSelected) data.items.forEach((c) => next.delete(c.id));
    else data.items.forEach((c) => next.add(c.id));
    setSelected(next);
  }
  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }
  function clearSelection() { setSelected(new Set()); }

  async function bulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected customer(s)? Orders are preserved.`)) return;
    setBulkBusy(true);
    const r = await run(() => api.post("/api/admin/customers", { ids: Array.from(selected) }), {
      success: "Customers deleted", error: "Delete failed", silent: true,
    });
    setBulkBusy(false);
    if (r) { toast.success(`${r.deleted} customer(s) deleted`); clearSelection(); qc.invalidateQueries({ queryKey: ["admin-customers"] }); }
  }

  async function deleteAllUnverified() {
    if (!confirm("Delete ALL unverified customers? Orders are preserved.")) return;
    setBulkBusy(true);
    const r = await run(() => api.post("/api/admin/customers", { action: "deleteUnverified" }), {
      success: "Unverified customers deleted", error: "Delete failed", silent: true,
    });
    setBulkBusy(false);
    if (r) { toast.success(`${r.deleted} unverified customer(s) deleted`); qc.invalidateQueries({ queryKey: ["admin-customers"] }); }
  }

  // C6: Export customers to CSV
  function exportCustomersCsv() {
    if (!data?.items || data.items.length === 0) {
      toast.info("No customers to export");
      return;
    }
    const headers = ["Name", "Email", "Phone", "Verified", "Active", "Loyalty Points", "Orders", "Total Spent", "Joined"];
    const rows = data.items.map((c: any) => [
      c.name || "",
      c.email || "",
      c.phone || "",
      c.isEmailVerified ? "Yes" : "No",
      c.isActive ? "Yes" : "No",
      c.loyaltyPoints || 0,
      c._count?.orders || 0,
      c._count?.orders || 0,
      c.createdAt ? formatDateTime(c.createdAt) : "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${data.items.length} customers`);
  }

  return (
    <div>
      <PageHeader
        title="Customers"
        description="View and manage customer accounts."
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCustomersCsv}>
            <Download className="size-4" /> Export CSV
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search name, email, phone..." value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <Select value={verifiedFilter} onValueChange={(v) => { setVerifiedFilter(v); setPage(1); }}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                <SelectItem value="true">Verified Only</SelectItem>
                <SelectItem value="false">Unverified Only</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:bg-destructive/5" disabled={bulkBusy} onClick={deleteAllUnverified}>
              <Trash2 className="size-3.5" /> Delete All Unverified
            </Button>
          </div>
        </CardContent>
      </Card>

      {selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <Badge variant="secondary" className="bg-primary/15 text-primary">{selected.size} selected</Badge>
          <Button size="sm" variant="outline" className="gap-1.5 text-destructive hover:bg-destructive/5" disabled={bulkBusy} onClick={bulkDelete}>
            {bulkBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />} Delete Selected
          </Button>
          <Button size="sm" variant="ghost" onClick={clearSelection}>Clear</Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4"><TableSkeleton rows={8} cols={5} /></div>
          ) : !data?.items?.length ? (
            <div className="p-4">
              <EmptyState title="No customers found" icon={<Users className="size-6" />} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"><Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" /></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Total Spent</TableHead>
                    <TableHead>Verified</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((c) => (
                    <TableRow key={c.id} className={selected.has(c.id) ? "bg-primary/5" : "cursor-pointer hover:bg-muted/40"}
                      onClick={() => navigate({ name: "customer-detail", id: c.id })}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleOne(c.id)} aria-label={`Select ${c.name}`} />
                      </TableCell>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>
                        <div className="text-xs text-muted-foreground">{c.email}</div>
                        <div className="text-xs text-muted-foreground">{c.phone}</div>
                      </TableCell>
                      <TableCell className="text-right text-sm">{c.ordersCount}</TableCell>
                      <TableCell className="text-right text-sm font-semibold">{formatCurrency(c.totalSpent)}</TableCell>
                      <TableCell>
                        {c.isEmailVerified
                          ? <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 gap-1"><ShieldCheck className="size-3" /> Verified</Badge>
                          : <Badge variant="secondary" className="bg-amber-100 text-amber-700">Unverified</Badge>}
                      </TableCell>
                      <TableCell><StatusBadge status={c.isActive ? "active" : "inactive"} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDateTime(c.createdAt)}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1.5"
                          onClick={() => navigate({ name: "customer-detail", id: c.id })}
                          aria-label={`View ${c.name}`}
                        >
                          <Eye className="size-3.5" /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">Page {data.page} of {data.totalPages}</div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CustomerDetailView({ id }: { id: string }) {
  const back = useAdminStore((s) => s.back);
  const navigate = useAdminStore((s) => s.navigate);
  const qc = useQueryClient();

  const { data: c, isLoading } = useQuery({
    queryKey: ["admin-customer", id],
    queryFn: () => api.get<any>(`/api/admin/customers/${id}`),
  });

  // ---- Adjust Loyalty Points dialog state ----
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjPoints, setAdjPoints] = useState("");
  const [adjReason, setAdjReason] = useState("");

  const adjustMutation = useMutation({
    mutationFn: (vars: { points: number; reason: string }) =>
      api.post<{ newBalance: number; previousBalance: number; pointsApplied: number }>(
        `/api/admin/customers/${id}/loyalty`,
        vars
      ),
    onSuccess: (data) => {
      toast.success(
        `Loyalty balance updated — now ${data.newBalance} pts (${data.pointsApplied >= 0 ? "+" : ""}${data.pointsApplied})`
      );
      setAdjustOpen(false);
      setAdjPoints("");
      setAdjReason("");
      qc.invalidateQueries({ queryKey: ["admin-customer", id] });
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Failed to adjust loyalty points");
    },
  });

  function submitAdjust() {
    const pts = parseInt(adjPoints, 10);
    if (!Number.isFinite(pts) || pts === 0) {
      toast.error("Points must be a non-zero integer.");
      return;
    }
    if (!adjReason.trim()) {
      toast.error("A reason is required for the adjustment.");
      return;
    }
    adjustMutation.mutate({ points: pts, reason: adjReason.trim() });
  }

  async function toggleActive(next: boolean) {
    const r = await run(() => api.patch(`/api/admin/customers/${id}`, { isActive: next }), {
      success: next ? "Customer activated" : "Customer deactivated",
      error: "Update failed",
    });
    if (r) qc.invalidateQueries({ queryKey: ["admin-customer", id] });
  }

  if (isLoading) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={back} className="mb-3"><ArrowLeft className="size-4 mr-1" /> Back</Button>
        <Card><CardContent className="pt-6 h-48 bg-muted/30 animate-pulse" /></Card>
      </div>
    );
  }
  if (!c) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={back} className="mb-3"><ArrowLeft className="size-4 mr-1" /> Back</Button>
        <EmptyState title="Customer not found" />
      </div>
    );
  }

  // ---- Stat cards row ----
  const stats: Array<{
    label: string;
    value: string;
    icon: typeof ShoppingCart;
    tint: string;
    sub?: string;
  }> = [
    {
      label: "Total Orders",
      value: String(c.totalOrders ?? c.ordersCount ?? 0),
      icon: ShoppingCart,
      tint: "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
      sub: `${c.nonCancelledOrders ?? 0} non-cancelled`,
    },
    {
      label: "Total Spent",
      value: formatCurrency(c.totalSpent ?? 0),
      icon: IndianRupee,
      tint: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
      sub: "excludes cancelled orders",
    },
    {
      label: "Avg Order Value",
      value: formatCurrency(c.avgOrderValue ?? 0),
      icon: TrendingUp,
      tint: "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
      sub: "across non-cancelled orders",
    },
    {
      label: "Loyalty Points",
      value: (c.loyaltyPoints ?? 0).toLocaleString("en-IN"),
      icon: Gift,
      tint: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
      sub: "1 pt = Rs. 1 at checkout",
    },
  ];

  return (
    <div>
      {/* Header — back, name, badges, loyalty, actions */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={back}><ArrowLeft className="size-4 mr-1" /> Back</Button>
          <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
          {c.isEmailVerified && (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 gap-1">
              <ShieldCheck className="size-3" /> Verified
            </Badge>
          )}
          <StatusBadge status={c.isActive ? "active" : "inactive"} />
          <span className="text-xs text-muted-foreground hidden sm:inline-flex items-center gap-1">
            <Clock className="size-3" /> Joined {formatDateTime(c.createdAt)}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => navigate({ name: "orders" })}
          >
            <History className="size-4" /> View Full Order History
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:text-amber-300 dark:hover:bg-amber-900/40"
            onClick={() => setAdjustOpen(true)}
          >
            <Gift className="size-4" /> Adjust Loyalty Points
          </Button>
          <div className="flex items-center gap-2 pl-2 border-l">
            <span className="text-sm text-muted-foreground">Active</span>
            <Switch checked={c.isActive} onCheckedChange={toggleActive} />
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <Card key={s.label} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`size-9 rounded-lg flex items-center justify-center shrink-0 ${s.tint}`}>
                  <s.icon className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{s.label}</div>
                  <div className="text-lg font-bold tracking-tight">{s.value}</div>
                  {s.sub && <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{s.sub}</div>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column — contact + addresses */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Contact</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2"><Mail className="size-4 text-muted-foreground" />{c.email}</div>
              <div className="flex items-center gap-2"><Phone className="size-4 text-muted-foreground" />{c.phone}</div>
              {c.isEmailVerified && (
                <div className="flex items-center gap-2 text-emerald-600 text-xs">
                  <ShieldCheck className="size-4" /> Email Verified
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Clock className="size-4" /> Joined {formatDateTime(c.createdAt)}
              </div>
              <div className="flex items-center gap-2 text-amber-700 text-xs dark:text-amber-300">
                <Gift className="size-4" /> {c.loyaltyPoints ?? 0} loyalty points
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Saved Addresses</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {c.addresses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No saved addresses.</p>
              ) : (
                c.addresses.map((a: any) => (
                  <div key={a.id} className="text-sm border-l-2 border-primary/30 pl-3">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3" />
                      {a.label} {a.isDefault && <span className="text-primary">(Default)</span>}
                    </div>
                    <div className="mt-1">{a.line1}{a.line2 ? `, ${a.line2}` : ""}</div>
                    <div className="text-muted-foreground text-xs">{a.city}, {a.state} - {a.pincode}</div>
                    {a.phone && <div className="text-muted-foreground text-xs">{a.phone}</div>}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column — orders, prescriptions, manual requests, loyalty history */}
        <div className="space-y-4 lg:col-span-2">
          {/* Recent Orders */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <Package className="size-4 text-muted-foreground" />
                <CardTitle className="text-base">Recent Orders</CardTitle>
                <Badge variant="outline" className="text-[10px]">{c.orders?.length ?? 0} of {c.totalOrders ?? 0}</Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate({ name: "orders" })}>View all</Button>
            </CardHeader>
            <CardContent className="p-0">
              {!c.orders || c.orders.length === 0 ? (
                <div className="p-4"><EmptyState title="No orders yet" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Payment</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {c.orders.map((o: any) => (
                        <TableRow
                          key={o.id}
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() => navigate({ name: "order-detail", id: o.id })}
                        >
                          <TableCell className="font-mono text-xs">{o.orderNumber}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</TableCell>
                          <TableCell className="text-right font-semibold text-sm">{formatCurrency(o.grandTotal)}</TableCell>
                          <TableCell><StatusBadge status={o.status} /></TableCell>
                          <TableCell><StatusBadge status={o.paymentStatus} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Prescriptions */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <FileImage className="size-4 text-muted-foreground" />
                <CardTitle className="text-base">Recent Prescriptions</CardTitle>
                <Badge variant="outline" className="text-[10px]">{c.prescriptions?.length ?? 0} of {c.prescriptionsCount ?? 0}</Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate({ name: "prescriptions" })}>View all</Button>
            </CardHeader>
            <CardContent className="p-0">
              {!c.prescriptions || c.prescriptions.length === 0 ? (
                <div className="p-4"><EmptyState title="No prescriptions yet" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Images</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {c.prescriptions.map((p: any) => (
                        <TableRow
                          key={p.id}
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() => navigate({ name: "prescription-detail", id: p.id })}
                        >
                          <TableCell className="text-xs text-muted-foreground">{formatDateTime(p.createdAt)}</TableCell>
                          <TableCell><StatusBadge status={p.status} /></TableCell>
                          <TableCell className="text-right text-sm">{p.imageCount}</TableCell>
                          <TableCell className="text-right"><Eye className="size-3.5 text-muted-foreground" /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Manual Requests */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <ClipboardList className="size-4 text-muted-foreground" />
                <CardTitle className="text-base">Recent Manual Requests</CardTitle>
                <Badge variant="outline" className="text-[10px]">{c.manualRequests?.length ?? 0} of {c.manualRequestsCount ?? 0}</Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate({ name: "manual-requests" })}>View all</Button>
            </CardHeader>
            <CardContent className="p-0">
              {!c.manualRequests || c.manualRequests.length === 0 ? (
                <div className="p-4"><EmptyState title="No manual requests yet" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Medicines</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {c.manualRequests.map((m: any) => (
                        <TableRow
                          key={m.id}
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() => navigate({ name: "manual-request-detail", id: m.id })}
                        >
                          <TableCell className="text-xs text-muted-foreground">{formatDateTime(m.createdAt)}</TableCell>
                          <TableCell><StatusBadge status={m.status} /></TableCell>
                          <TableCell className="text-right text-sm">{m.medicineCount}</TableCell>
                          <TableCell className="text-right"><Eye className="size-3.5 text-muted-foreground" /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Loyalty Transaction History */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <Gift className="size-4 text-muted-foreground" />
                <CardTitle className="text-base">Loyalty History</CardTitle>
                <Badge variant="outline" className="text-[10px]">{c.loyaltyTxns?.length ?? 0} recent</Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:text-amber-300 dark:hover:bg-amber-900/40"
                onClick={() => setAdjustOpen(true)}
              >
                <Gift className="size-3.5" /> Adjust
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {!c.loyaltyTxns || c.loyaltyTxns.length === 0 ? (
                <div className="p-4"><EmptyState title="No loyalty transactions yet" description="Points are earned when orders are delivered." /></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Points</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {c.loyaltyTxns.map((t: any) => {
                        const positive = t.points >= 0;
                        return (
                          <TableRow key={t.id}>
                            <TableCell className="text-xs text-muted-foreground">{formatDateTime(t.createdAt)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={
                                t.type === "earn" ? "bg-emerald-100 text-emerald-700" :
                                t.type === "redeem" ? "bg-amber-100 text-amber-700" :
                                "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                              }>
                                {t.type}
                              </Badge>
                            </TableCell>
                            <TableCell className={`text-right font-semibold text-sm ${positive ? "text-emerald-700" : "text-rose-700"}`}>
                              <span className="inline-flex items-center gap-0.5">
                                {positive
                                  ? <ArrowUpRight className="size-3" />
                                  : <ArrowDownRight className="size-3" />}
                                {positive ? "+" : ""}{t.points}
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-sm">{t.balance}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[280px] truncate" title={t.reason}>{t.reason}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Adjust Loyalty Points dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="size-5 text-amber-700 dark:text-amber-300" /> Adjust Loyalty Points
            </DialogTitle>
            <DialogDescription>
              Manually credit or debit {c.name}&apos;s loyalty balance. Current balance: <span className="font-semibold text-amber-700 dark:text-amber-300">{c.loyaltyPoints ?? 0}</span> pts.
              Debits that exceed the balance will zero it out (never go negative).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="adj-points">Points (use a minus sign to debit)</Label>
              <Input
                id="adj-points"
                type="number"
                inputMode="numeric"
                placeholder="e.g. 50 or -25"
                value={adjPoints}
                onChange={(e) => setAdjPoints(e.target.value)}
                disabled={adjustMutation.isPending}
              />
              <p className="text-[11px] text-muted-foreground">
                Positive numbers credit points; negative numbers debit them.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adj-reason">Reason</Label>
              <Input
                id="adj-reason"
                placeholder="e.g. Goodwill credit for delayed order"
                value={adjReason}
                onChange={(e) => setAdjReason(e.target.value)}
                disabled={adjustMutation.isPending}
                maxLength={200}
              />
              <p className="text-[11px] text-muted-foreground">Recorded in the audit trail. Max 200 characters.</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAdjustOpen(false)}
              disabled={adjustMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={submitAdjust}
              disabled={adjustMutation.isPending}
              className="gap-1.5"
            >
              {adjustMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Gift className="size-4" />
              )}
              Apply Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
