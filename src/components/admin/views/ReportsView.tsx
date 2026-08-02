// ============================================================================
// File: src/components/admin/views/ReportsView.tsx
// Purpose: Sales & product reports. Date range picker, summary cards, top
//          products table, low stock table.
// ============================================================================

"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { PageHeader, ProductThumb, TableSkeleton, EmptyState } from "../ui";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  IndianRupee,
  ShoppingCart,
  TrendingUp,
  Percent,
  Truck,
  AlertTriangle,
  Download,
  Info,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function monthStartStr() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export function ReportsView() {
  const [from, setFrom] = useState(monthStartStr());
  const [to, setTo] = useState(todayStr());

  const query = useMemo(() => `?from=${from}&to=${to}`, [from, to]);

  const { data: sales, isLoading } = useQuery({
    queryKey: ["admin-reports-sales", query],
    queryFn: () => api.get<any>(`/api/admin/reports/sales${query}`),
  });
  const { data: products } = useQuery({
    queryKey: ["admin-reports-products", query],
    queryFn: () => api.get<any>(`/api/admin/reports/products${query}`),
  });

  function exportCsv() {
    if (!sales) return;
    const rows: string[] = [];
    rows.push("From," + from);
    rows.push("To," + to);
    rows.push("");
    rows.push("Summary");
    rows.push("Metric,Value");
    rows.push(`Total Orders,${sales.totalOrders}`);
    rows.push(`Total Revenue,${sales.totalRevenue.toFixed(2)}`);
    rows.push(`Total Items,${sales.totalItems.toFixed(2)}`);
    rows.push(`Total Discounts,${sales.totalDiscounts.toFixed(2)}`);
    rows.push(`Total Delivery,${sales.totalDelivery.toFixed(2)}`);
    rows.push(`Avg Order Value,${sales.avgOrderValue.toFixed(2)}`);
    rows.push("");
    rows.push("By Payment Method");
    rows.push("Method,Count,Revenue");
    for (const [k, v] of Object.entries<any>(sales.byPaymentMethod || {})) {
      rows.push(`${k},${v.count},${v.revenue.toFixed(2)}`);
    }
    rows.push("");
    rows.push("Top Products");
    rows.push("Product,SKU,Brand,Qty Sold,Revenue");
    for (const p of products?.topProducts || []) {
      rows.push(`"${p.name}",${p.sku || ""},${p.brand?.name || ""},${p.qtySold},${p.revenue.toFixed(2)}`);
    }

    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pms-report-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report exported");
  }

  function exportRestockCsv() {
    if (!products?.lowStock?.length) return;
    const rows: string[] = [];
    rows.push("Product,SKU,Brand,Current Stock,Threshold,30-Day Sold,Suggested Restock,Velocity,Price");
    for (const p of products.lowStock) {
      rows.push(
        `"${p.name}",${p.sku || ""},${p.brand?.name || ""},${p.stock},${p.lowStockThreshold},${p.sold30d},${p.suggestedRestock},${p.velocityStatus},${Number(p.sellingPrice).toFixed(2)}`
      );
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `restock-suggestions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Restock list exported");
  }

  const summaryCards = sales
    ? [
        { label: "Total Orders", value: String(sales.totalOrders), icon: ShoppingCart, tint: "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300" },
        { label: "Total Revenue", value: formatCurrency(sales.totalRevenue), icon: IndianRupee, tint: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
        { label: "Avg Order Value", value: formatCurrency(sales.avgOrderValue), icon: TrendingUp, tint: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
        { label: "Total Discounts", value: formatCurrency(sales.totalDiscounts), icon: Percent, tint: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300" },
        { label: "Delivery Revenue", value: formatCurrency(sales.totalDelivery), icon: Truck, tint: "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300" },
        { label: "Items Sold (Rs.)", value: formatCurrency(sales.totalItems), icon: IndianRupee, tint: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" },
      ]
    : [];

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Sales performance & inventory reports."
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={!sales}>
            <Download className="size-4 mr-1" /> Export CSV
          </Button>
        }
      />

      {/* Date range */}
      <Card className="mb-4">
        <CardContent className="pt-4 pb-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">To</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
          </div>
          <Button size="sm" variant="secondary" onClick={() => { setFrom(monthStartStr()); setTo(todayStr()); }}>
            This Month
          </Button>
          <Button size="sm" variant="ghost" onClick={() => {
            const d = new Date();
            d.setDate(d.getDate() - 7);
            setFrom(d.toISOString().slice(0, 10));
            setTo(todayStr());
          }}>
            Last 7 days
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card><CardContent className="pt-6"><TableSkeleton rows={4} cols={4} /></CardContent></Card>
      ) : !sales ? (
        <EmptyState title="No data" />
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            {summaryCards.map((s) => (
              <Card key={s.label}>
                <CardContent className="pt-4">
                  <div className={`size-8 rounded-md flex items-center justify-center mb-2 ${s.tint}`}>
                    <s.icon className="size-4" />
                  </div>
                  <div className="text-[11px] text-muted-foreground">{s.label}</div>
                  <div className="text-base font-bold">{s.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Trend */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Revenue Trend</CardTitle>
              <CardDescription>Daily revenue from {formatDate(from)} to {formatDate(to)}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sales.trend} margin={{ left: -10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                    <Tooltip formatter={(v: any) => [formatCurrency(Number(v)), "Revenue"]} contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }} />
                    <Line type="monotone" dataKey="revenue" stroke="#059669" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top products */}
            <Card>
              <CardHeader><CardTitle className="text-base">Top Products</CardTitle></CardHeader>
              <CardContent className="p-0">
                {products?.topProducts?.length ? (
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Qty Sold</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.topProducts.map((p: any) => (
                          <TableRow key={p.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <ProductThumb image={p.primaryImage} name={p.name} brand={p.brand?.name} size={32} />
                                <div className="min-w-0">
                                  <div className="text-sm font-medium truncate max-w-[200px]">{p.name}</div>
                                  <div className="text-xs text-muted-foreground">{p.brand?.name || "—"}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-sm font-semibold">{p.qtySold}</TableCell>
                            <TableCell className="text-right text-sm">{formatCurrency(p.revenue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="p-4"><EmptyState title="No sales in this period" /></div>
                )}
              </CardContent>
            </Card>

            {/* Low stock */}
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">Low Stock Alert</CardTitle>
                  <AlertTriangle className="size-4 text-amber-500" />
                </div>
                {products?.lowStock?.length ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportRestockCsv}
                    className="gap-1.5 text-xs"
                  >
                    <Download className="size-3.5" />
                    Restock CSV
                  </Button>
                ) : null}
              </CardHeader>
              <CardContent className="p-0">
                {products?.lowStock?.length ? (
                  <>
                    {/* Info banner explaining the restock suggestion logic */}
                    <div className="flex items-start gap-2 border-b bg-teal-50 px-4 py-2 dark:bg-teal-950/20">
                      <Info className="mt-0.5 size-3.5 shrink-0 text-teal-600 dark:text-teal-400" />
                      <p className="text-[11px] leading-relaxed text-teal-800 dark:text-teal-300">
                        <strong>Suggested</strong> = max(threshold × 3, 30-day sales × 2) − current stock.
                        Velocity: <span className="font-medium text-emerald-600">⚡ Fast</span> (6+),{" "}
                        <span className="font-medium text-amber-600">Moderate</span> (1–5),{" "}
                        <span className="text-muted-foreground">Slow</span> (0).
                      </p>
                    </div>
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Stock</TableHead>
                          <TableHead className="text-right">Threshold</TableHead>
                          <TableHead className="text-right">30d Sold</TableHead>
                          <TableHead className="text-right">Suggested</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.lowStock.map((p: any) => (
                          <TableRow key={p.id}>
                            <TableCell>
                              <div className="text-sm font-medium truncate max-w-[200px]">{p.name}</div>
                              <div className="text-xs text-muted-foreground">{p.brand?.name || "—"}</div>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={`text-sm font-semibold ${p.stock === 0 ? "text-rose-600" : "text-amber-600"}`}>{p.stock}</span>
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">{p.lowStockThreshold}</TableCell>
                            <TableCell className="text-right">
                              <span className={`text-xs font-medium ${
                                p.velocityStatus === "fast" ? "text-emerald-600" :
                                p.velocityStatus === "moderate" ? "text-amber-600" :
                                "text-muted-foreground"
                              }`}>
                                {p.sold30d}
                                {p.velocityStatus === "fast" && " ⚡"}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="text-sm font-semibold text-emerald-600">+{p.suggestedRestock}</span>
                            </TableCell>
                            <TableCell className="text-right text-sm">{formatCurrency(p.sellingPrice)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  </>
                ) : (
                  <div className="p-4"><EmptyState title="No low stock items" /></div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
