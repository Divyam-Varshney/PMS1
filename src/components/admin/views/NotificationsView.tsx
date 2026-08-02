// ============================================================================
// File: src/components/admin/views/NotificationsView.tsx
// Purpose: Notifications log list with channel filter + search.
// ============================================================================

"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { PageHeader, StatusBadge, TableSkeleton, EmptyState } from "../ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Bell, Search } from "lucide-react";
import { formatDateTime } from "@/lib/format";

export function NotificationsView() {
  const [channel, setChannel] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const query = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (channel !== "all") p.set("channel", channel);
    if (search.trim()) p.set("search", search.trim());
    return p.toString();
  }, [channel, search, page]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-notifications", query],
    queryFn: () =>
      api.get<{ items: any[]; total: number; totalPages: number; page: number }>(
        `/api/admin/notifications?${query}`
      ),
  });

  return (
    <div>
      <PageHeader title="Notifications" description="Log of all emails & WhatsApp messages sent." />

      <Card className="mb-4">
        <CardContent className="pt-4 pb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by recipient, subject, template..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <Select value={channel} onValueChange={(v) => { setChannel(v); setPage(1); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Channels</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4"><TableSkeleton rows={8} cols={5} /></div>
          ) : !data?.items?.length ? (
            <div className="p-4"><EmptyState title="No notifications" icon={<Bell className="size-6" />} /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Subject / Template</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((n) => (
                    <TableRow key={n.id}>
                      <TableCell>
                        <div className="text-sm font-medium">{n.to}</div>
                        {n.customer && <div className="text-xs text-muted-foreground">{n.customer.name}</div>}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs px-2 py-0.5 rounded bg-muted capitalize">{n.channel}</span>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{n.subject || "—"}</div>
                        {n.templateKey && <div className="text-xs text-muted-foreground font-mono">{n.templateKey}</div>}
                      </TableCell>
                      <TableCell><StatusBadge status={n.status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</TableCell>
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
