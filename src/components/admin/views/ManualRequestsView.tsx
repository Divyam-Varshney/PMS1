// ============================================================================
// File: src/components/admin/views/ManualRequestsView.tsx
// Purpose: Manual medicine requests list + detail with verify/reject/convert.
// ============================================================================

"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, run } from "../api";
import { PageHeader, StatusBadge, TableSkeleton, EmptyState, CustomerName, CustomerContact, CustomerDetailBlock } from "../ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ClipboardList, ArrowLeft, CheckCircle2, XCircle, FileCheck2, Loader2, Pill, ChevronRight } from "lucide-react";
import { useAdminStore } from "../admin-store";
import { formatDateTime } from "@/lib/format";

export function ManualRequestsView() {
  const navigate = useAdminStore((s) => s.navigate);
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const query = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (status !== "all") p.set("status", status);
    return p.toString();
  }, [status, page]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-manual-requests", query],
    queryFn: () =>
      api.get<{ items: any[]; total: number; totalPages: number; page: number }>(
        `/api/admin/manual-requests?${query}`
      ),
  });

  return (
    <div>
      <PageHeader
        title="Manual Requests"
        description="Customer-typed medicine lists awaiting review."
        actions={
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="converted">Converted</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4"><TableSkeleton rows={6} cols={5} /></div>
          ) : !data?.items?.length ? (
            <div className="p-4">
              <EmptyState title="No manual requests" icon={<ClipboardList className="size-6" />} />
            </div>
          ) : (
            <>
              {/* Desktop: table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-center">Medicines</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((r) => (
                      <TableRow
                        key={r.id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => navigate({ name: "manual-request-detail", id: r.id })}
                      >
                        <TableCell className="font-mono text-xs">{r.id.slice(-8)}</TableCell>
                        <TableCell>
                          <CustomerName customer={r.customer} />
                          <CustomerContact customer={r.customer} />
                        </TableCell>
                        <TableCell className="text-center text-sm">{r.medicineCount}</TableCell>
                        <TableCell><StatusBadge status={r.status} /></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: card list */}
              <div className="md:hidden divide-y">
                {data.items.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => navigate({ name: "manual-request-detail", id: r.id })}
                    className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/40"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                      <ClipboardList className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate"><CustomerName customer={r.customer} /></span>
                        <StatusBadge status={r.status} />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        #{r.id.slice(-8)} · {r.medicineCount} medicine(s) · {formatDateTime(r.createdAt)}
                      </div>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </>
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

export function ManualRequestDetailView({ id }: { id: string }) {
  const back = useAdminStore((s) => s.back);
  const navigate = useAdminStore((s) => s.navigate);
  const qc = useQueryClient();
  const [adminNotes, setAdminNotes] = useState("");
  const [busy, setBusy] = useState(false);

  // Convert-to-order dialog state
  const [convertOpen, setConvertOpen] = useState(false);
  const [lineItems, setLineItems] = useState<Array<{ productId: string; qty: number; name: string; price: number }>>([]);
  const [productSearch, setProductSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [converting, setConverting] = useState(false);

  const { data: r, isLoading } = useQuery({
    queryKey: ["admin-manual-request", id],
    queryFn: () => api.get<any>(`/api/admin/manual-requests/${id}`),
  });

  if (r && adminNotes === "" && r.adminNotes) setAdminNotes(r.adminNotes);

  async function update(status: string) {
    setBusy(true);
    const res = await run(() => api.patch(`/api/admin/manual-requests/${id}`, { status, adminNotes }), {
      success: `Request ${status}`,
      error: "Update failed",
    });
    setBusy(false);
    if (res) qc.invalidateQueries({ queryKey: ["admin-manual-request", id] });
  }

  async function searchProducts(q: string) {
    setProductSearch(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await api.get<{ items: any[] }>(
        `/api/admin/products?search=${encodeURIComponent(q)}&pageSize=8`
      );
      setSearchResults(res.items || []);
    } catch { setSearchResults([]); }
    setSearching(false);
  }

  function addProduct(prod: any) {
    if (lineItems.some((li) => li.productId === prod.id)) return;
    setLineItems([...lineItems, { productId: prod.id, qty: 1, name: prod.name, price: prod.sellingPrice }]);
    setProductSearch("");
    setSearchResults([]);
  }

  function removeLineItem(productId: string) {
    setLineItems(lineItems.filter((li) => li.productId !== productId));
  }

  function setLineQty(productId: string, qty: number) {
    setLineItems(lineItems.map((li) => li.productId === productId ? { ...li, qty: Math.max(1, qty) } : li));
  }

  async function convertToOrder() {
    if (lineItems.length === 0) return;
    setConverting(true);
    const res = await run(() =>
      api.post(`/api/admin/manual-requests/${id}/convert`, {
        items: lineItems.map((li) => ({ productId: li.productId, qty: li.qty })),
      }), {
      success: "Order created from manual request",
      error: "Conversion failed",
    });
    setConverting(false);
    if (res) {
      setConvertOpen(false);
      setLineItems([]);
      qc.invalidateQueries({ queryKey: ["admin-manual-request", id] });
      qc.invalidateQueries({ queryKey: ["admin-manual-requests"] });
      navigate({ name: "order-detail", id: res.id });
    }
  }

  if (isLoading) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={back} className="mb-3"><ArrowLeft className="size-4 mr-1" /> Back</Button>
        <Card><CardContent className="pt-6 h-48 bg-muted/30 animate-pulse" /></Card>
      </div>
    );
  }
  if (!r) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={back} className="mb-3"><ArrowLeft className="size-4 mr-1" /> Back</Button>
        <EmptyState title="Request not found" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" onClick={back}><ArrowLeft className="size-4 mr-1" /> Back</Button>
        <h1 className="text-2xl font-semibold tracking-tight">Manual Request</h1>
        <StatusBadge status={r.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Requested Medicines</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {r.medicines.map((m: string, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-md border bg-muted/30">
                    <div className="size-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Pill className="size-4" />
                    </div>
                    <div className="text-sm font-medium">{m}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Customer Notes</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap min-h-[60px]">{r.notes || "—"}</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Customer</CardTitle></CardHeader>
            <CardContent className="text-sm">
              <CustomerDetailBlock
                customer={r.customer}
                extra={<div className="text-xs text-muted-foreground mt-2">Submitted: {formatDateTime(r.createdAt)}</div>}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Admin Actions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Admin Notes</Label>
                <Textarea rows={4} value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Button variant="outline" className="text-amber-600" disabled={busy || r.status === "under_review"} onClick={() => update("under_review")}>
                  <CheckCircle2 className="size-4 mr-1" /> Mark Reviewing
                </Button>
                <Button variant="outline" className="text-emerald-600" disabled={busy} onClick={() => update("verified")}>
                  <CheckCircle2 className="size-4 mr-1" /> Verify
                </Button>
                <Button variant="outline" className="text-destructive" disabled={busy} onClick={() => update("rejected")}>
                  <XCircle className="size-4 mr-1" /> Reject
                </Button>
              </div>
              {r.status === "converted" ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-center text-sm text-emerald-700">
                  <FileCheck2 className="mx-auto mb-1 size-5" />
                  Converted to an order
                  {r.convertedOrderId && (
                    <Button
                      variant="link"
                      size="sm"
                      className="mt-1 block h-auto p-0 text-emerald-700"
                      onClick={() => navigate({ name: "order-detail", id: r.convertedOrderId })}
                    >
                      View order →
                    </Button>
                  )}
                </div>
              ) : (
                <Button
                  className="w-full gap-2"
                  disabled={busy}
                  onClick={() => setConvertOpen(true)}
                >
                  <FileCheck2 className="size-4" /> Create Order from Request
                </Button>
              )}
              <p className="text-[11px] text-muted-foreground">
                Map the requested medicines to catalog products, then create an
                order with automatic pricing-engine pricing.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Convert-to-order dialog */}
      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Order from Manual Request</DialogTitle>
            <DialogDescription>
              Search and add the products the customer requested. Pricing is
              computed automatically by the discount engine.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Input
                placeholder="Search products by name, composition, SKU..."
                value={productSearch}
                onChange={(e) => searchProducts(e.target.value)}
              />
              {searchResults.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-background shadow-lg">
                  {searchResults.map((prod) => (
                    <button
                      key={prod.id}
                      onClick={() => addProduct(prod)}
                      className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{prod.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {prod.brand?.name} · Rs. {prod.sellingPrice}
                        </p>
                      </div>
                      <span className="ml-2 shrink-0 text-xs text-primary">+ Add</span>
                    </button>
                  ))}
                </div>
              )}
              {searching && <p className="mt-1 text-xs text-muted-foreground">Searching...</p>}
            </div>

            {lineItems.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                No products added yet. Search above to add the requested medicines.
              </div>
            ) : (
              <div className="space-y-2">
                {lineItems.map((li) => (
                  <div key={li.productId} className="flex items-center gap-2 rounded-md border p-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{li.name}</p>
                      <p className="text-xs text-muted-foreground">Rs. {li.price}</p>
                    </div>
                    <Input
                      type="number"
                      min={1}
                      value={li.qty}
                      onChange={(e) => setLineQty(li.productId, parseInt(e.target.value) || 1)}
                      className="h-8 w-16 text-center"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive"
                      onClick={() => removeLineItem(li.productId)}
                    >
                      <XCircle className="size-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex justify-between border-t pt-2 text-sm font-semibold">
                  <span>{lineItems.length} item(s)</span>
                  <span>Rs. {lineItems.reduce((s, li) => s + li.price * li.qty, 0).toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertOpen(false)}>Cancel</Button>
            <Button
              disabled={lineItems.length === 0 || converting}
              onClick={convertToOrder}
              className="gap-2"
            >
              {converting ? <Loader2 className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />}
              Create Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
