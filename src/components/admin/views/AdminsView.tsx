// ============================================================================
// File: src/components/admin/views/AdminsView.tsx
// Purpose: Admin accounts list + add dialog (super_admin only) + toggle active
//          + delete (cannot delete self) + granular permissions editor
//          (super_admin only, non-super_admin target rows only).
//          Clean, sober, premium — emerald accent palette (no indigo/blue).
// ============================================================================
"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, run } from "../api";
import { PageHeader, TableSkeleton, EmptyState } from "../ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Trash2,
  UserCog,
  Loader2,
  ShieldCheck,
  KeyRound,
  Search,
  X,
  MoreHorizontal,
  Mail,
  Phone,
  Clock,
  SlidersHorizontal,
} from "lucide-react";
import { formatDateTime } from "@/lib/format";
import {
  ADMIN_PERMISSIONS,
  ADMIN_PERMISSION_LABELS,
  PERMISSION_GROUPS,
  AdminPermissionKey,
} from "@/lib/constants";
import { getAdminPermissions } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const EMPTY = { name: "", email: "", phone: "", password: "", role: "admin" };

interface AdminRow {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  isActive: boolean;
  permissions?: string | null;
  lastLoginAt?: string | null;
  createdAt?: string | null;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";
}

function roleBadgeClass(role: string): string {
  if (role === "super_admin") {
    return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50";
  }
  if (role === "manager") {
    return "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-900/50";
  }
  return "bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-800/60 dark:text-stone-300 dark:border-stone-700";
}

function roleLabel(role: string): string {
  if (role === "super_admin") return "Super Admin";
  if (role === "manager") return "Manager";
  return "Admin";
}

// ===========================================================================
// MAIN VIEW
// ===========================================================================
export function AdminsView({ currentAdmin }: { currentAdmin: { id: string; role: string } }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-admins"],
    queryFn: () => api.get<AdminRow[]>("/api/admin/admins"),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);

  // Search + filter state
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Permissions dialog state
  const [permsTarget, setPermsTarget] = useState<AdminRow | null>(null);
  const [permsWorking, setPermsWorking] = useState<AdminPermissionKey[]>([]);
  const [permsSaving, setPermsSaving] = useState(false);

  // Mobile filter sheet
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const isSuper = currentAdmin.role === "super_admin";

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.filter((a) => {
      if (roleFilter !== "all" && a.role !== roleFilter) return false;
      if (statusFilter === "active" && !a.isActive) return false;
      if (statusFilter === "inactive" && a.isActive) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        (a.phone || "").toLowerCase().includes(q)
      );
    });
  }, [data, search, roleFilter, statusFilter]);

  const activeFilterCount =
    (roleFilter !== "all" ? 1 : 0) + (statusFilter !== "all" ? 1 : 0) + (search.trim() ? 1 : 0);

  function clearFilters() {
    setSearch("");
    setRoleFilter("all");
    setStatusFilter("all");
  }

  async function create() {
    if (!form.name || !form.email || !form.password) return;
    setSaving(true);
    const r = await run(() => api.post("/api/admin/admins", form), {
      success: "Admin created",
      error: "Create failed",
    });
    setSaving(false);
    if (r) {
      setOpen(false);
      setForm(EMPTY);
      qc.invalidateQueries({ queryKey: ["admin-admins"] });
    }
  }

  async function toggle(id: string, next: boolean) {
    const r = await run(() => api.patch(`/api/admin/admins/${id}`, { isActive: next }), {
      success: next ? "Admin activated" : "Admin deactivated",
      error: "Update failed",
    });
    if (r) qc.invalidateQueries({ queryKey: ["admin-admins"] });
  }

  async function del(a: AdminRow) {
    const r = await run(() => api.del(`/api/admin/admins/${a.id}`), {
      success: "Admin deleted",
      error: "Delete failed",
    });
    if (r) qc.invalidateQueries({ queryKey: ["admin-admins"] });
  }

  function openPerms(a: AdminRow) {
    setPermsTarget(a);
    setPermsWorking(getAdminPermissions(a));
  }

  function togglePerm(key: AdminPermissionKey) {
    setPermsWorking((cur) =>
      cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]
    );
  }

  function selectAllPerms() {
    setPermsWorking([...ADMIN_PERMISSIONS]);
  }

  function deselectAllPerms() {
    setPermsWorking([]);
  }

  async function savePerms() {
    if (!permsTarget) return;
    setPermsSaving(true);
    const r = await run(
      () => api.patch(`/api/admin/admins/${permsTarget.id}`, { permissions: permsWorking }),
      { success: "Permissions updated", error: "Update failed" }
    );
    setPermsSaving(false);
    if (r) {
      setPermsTarget(null);
      qc.invalidateQueries({ queryKey: ["admin-admins"] });
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Admins"
        description="Manage admin accounts and granular permissions."
        actions={
          isSuper ? (
            <Button onClick={() => setOpen(true)} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              <Plus className="size-4" /> Add Admin
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">Only super admins can create new admins.</span>
          )
        }
      />

      {/* Search + filter bar */}
      <Card className="shadow-sm">
        <CardContent className="pt-5 pb-4 space-y-3">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, phone…"
                className="pl-10 h-10"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-40 h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>

              <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="lg:hidden h-10 gap-1.5">
                    <SlidersHorizontal className="size-4" />
                    Filters
                    {activeFilterCount > 0 && (
                      <Badge className="bg-emerald-600 text-white ml-1 px-1.5 py-0 h-5 text-[10px]">
                        {activeFilterCount}
                      </Badge>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:max-w-md">
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                  </SheetHeader>
                  <div className="px-4 pb-6 space-y-4">
                    <div>
                      <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Role</Label>
                      <Select value={roleFilter} onValueChange={setRoleFilter}>
                        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Roles</SelectItem>
                          <SelectItem value="super_admin">Super Admin</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Status</Label>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {activeFilterCount > 0 && (
                      <Button variant="ghost" size="sm" className="w-full" onClick={clearFilters}>
                        <X className="size-3 mr-1" /> Clear All Filters
                      </Button>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          {activeFilterCount > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
              <span className="text-xs text-muted-foreground">
                {filtered.length} of {data?.length ?? 0} admins
              </span>
              {roleFilter !== "all" && (
                <Badge variant="outline" className="gap-1 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50">
                  Role: {roleLabel(roleFilter)}
                  <button onClick={() => setRoleFilter("all")}><X className="size-3" /></button>
                </Badge>
              )}
              {statusFilter !== "all" && (
                <Badge variant="outline" className="gap-1 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50">
                  Status: {statusFilter === "active" ? "Active" : "Inactive"}
                  <button onClick={() => setStatusFilter("all")}><X className="size-3" /></button>
                </Badge>
              )}
              <Button variant="ghost" size="sm" className="h-7 ml-auto text-xs" onClick={clearFilters}>
                <X className="size-3 mr-1" /> Clear All
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table / cards */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4"><TableSkeleton rows={4} cols={6} /></div>
          ) : filtered.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title={data?.length ? "No admins match your filters" : "No admins yet"}
                description={data?.length ? "Try clearing filters or adjusting your search." : "Add the first admin to get started."}
                icon={<UserCog className="size-6" />}
                action={
                  data?.length && activeFilterCount > 0 ? (
                    <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Admin</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Role</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Permissions</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Last Login</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Status</th>
                      <th className="w-10 px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((a) => {
                      const perms = getAdminPermissions(a);
                      const isSuperRow = a.role === "super_admin";
                      return (
                        <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="size-9">
                                <AvatarFallback className={cn(
                                  "text-xs font-semibold",
                                  isSuperRow
                                    ? "bg-emerald-600 text-white"
                                    : "bg-muted text-foreground"
                                )}>
                                  {getInitials(a.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="font-medium flex items-center gap-1.5">
                                  {a.name}
                                  {a.id === currentAdmin.id && (
                                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">you</span>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                                  <span className="inline-flex items-center gap-1">
                                    <Mail className="size-3" /> {a.email}
                                  </span>
                                  {a.phone && (
                                    <span className="inline-flex items-center gap-1">
                                      <Phone className="size-3" /> {a.phone}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={cn("gap-1 capitalize", roleBadgeClass(a.role))}>
                              {isSuperRow && <ShieldCheck className="size-3" />}
                              {roleLabel(a.role)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            {isSuperRow ? (
                              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 gap-1">
                                <ShieldCheck className="size-3" /> All ({ADMIN_PERMISSIONS.length})
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1">
                                <KeyRound className="size-3" /> {perms.length} / {ADMIN_PERMISSIONS.length}
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {a.lastLoginAt ? (
                              <span className="inline-flex items-center gap-1">
                                <Clock className="size-3" />
                                {formatDateTime(a.lastLoginAt)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground italic">Never</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={a.isActive}
                                onCheckedChange={(v) => toggle(a.id, v)}
                                disabled={a.id === currentAdmin.id}
                              />
                              <span className={cn(
                                "text-xs font-medium",
                                a.isActive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                              )}>
                                {a.isActive ? "Active" : "Inactive"}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {isSuper && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="size-8">
                                    <MoreHorizontal className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem
                                    disabled={isSuperRow}
                                    onClick={() => openPerms(a)}
                                  >
                                    <KeyRound className="size-3.5 mr-2" /> Edit Permissions
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-rose-600 focus:text-rose-700"
                                    disabled={a.id === currentAdmin.id}
                                    onClick={() => del(a)}
                                  >
                                    <Trash2 className="size-3.5 mr-2" /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y">
                {filtered.map((a) => {
                  const perms = getAdminPermissions(a);
                  const isSuperRow = a.role === "super_admin";
                  return (
                    <div key={a.id} className="p-4">
                      <div className="flex items-start gap-3">
                        <Avatar className="size-10 shrink-0">
                          <AvatarFallback className={cn(
                            "text-sm font-semibold",
                            isSuperRow
                              ? "bg-emerald-600 text-white"
                              : "bg-muted text-foreground"
                          )}>
                            {getInitials(a.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium truncate">{a.name}</span>
                            {a.id === currentAdmin.id && (
                              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">you</span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">{a.email}</div>
                          {a.phone && (
                            <div className="text-xs text-muted-foreground truncate">{a.phone}</div>
                          )}
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            <Badge variant="outline" className={cn("gap-1 capitalize", roleBadgeClass(a.role))}>
                              {isSuperRow && <ShieldCheck className="size-3" />}
                              {roleLabel(a.role)}
                            </Badge>
                            {isSuperRow ? (
                              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 gap-1">
                                All ({ADMIN_PERMISSIONS.length})
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1">
                                <KeyRound className="size-3" /> {perms.length} / {ADMIN_PERMISSIONS.length}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-3">
                            <div className="text-xs text-muted-foreground">
                              {a.lastLoginAt ? `Last: ${formatDateTime(a.lastLoginAt)}` : "Never logged in"}
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={a.isActive}
                                onCheckedChange={(v) => toggle(a.id, v)}
                                disabled={a.id === currentAdmin.id}
                              />
                              {isSuper && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1 text-xs h-8"
                                  disabled={isSuperRow}
                                  onClick={() => openPerms(a)}
                                >
                                  <KeyRound className="size-3.5" /> Perms
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add Admin dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="size-5 text-emerald-600" /> Add Admin
            </DialogTitle>
            <DialogDescription>Create a new admin account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Phone (optional)</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Super admins get all permissions automatically. Other roles start with no permissions — use the Permissions editor to grant access.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={saving} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              {saving && <Loader2 className="size-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permissions editor dialog */}
      <PermissionsDialog
        target={permsTarget}
        working={permsWorking}
        saving={permsSaving}
        onToggle={togglePerm}
        onSelectAll={selectAllPerms}
        onDeselectAll={deselectAllPerms}
        onCancel={() => setPermsTarget(null)}
        onSave={savePerms}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// PermissionsDialog — controlled by the parent so the working state can be
// reset cleanly when the target changes. Renders a grouped, responsive grid
// of toggle switches for every ADMIN_PERMISSIONS key. Super admin target
// rows are never editable (the dialog isn't reachable for them from the
// table). Each module group is independently toggleable via a group header
// checkbox; Select All / Deselect All are also available.
// ---------------------------------------------------------------------------
function PermissionsDialog({
  target,
  working,
  saving,
  onToggle,
  onSelectAll,
  onDeselectAll,
  onCancel,
  onSave,
}: {
  target: AdminRow | null;
  working: AdminPermissionKey[];
  saving: boolean;
  onToggle: (key: AdminPermissionKey) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const open = target !== null;
  const selectedCount = working.length;

  function toggleGroup(group: { permissions: AdminPermissionKey[] }) {
    const allOn = group.permissions.every((k) => working.includes(k));
    if (allOn) {
      // turn off all in group
      group.permissions.forEach((k) => {
        if (working.includes(k)) onToggle(k);
      });
    } else {
      // turn on all in group
      group.permissions.forEach((k) => {
        if (!working.includes(k)) onToggle(k);
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-5 text-emerald-600" />
            Permissions — {target?.name ?? ""}
          </DialogTitle>
          <DialogDescription>
            Toggle which modules this account can access. Changes take effect on the admin&apos;s next login.
          </DialogDescription>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2 border-y py-2">
          <div className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{selectedCount}</span>
            {" "}of {ADMIN_PERMISSIONS.length} permissions enabled
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={onSelectAll} disabled={saving}>
              Select All
            </Button>
            <Button size="sm" variant="outline" onClick={onDeselectAll} disabled={saving || selectedCount === 0}>
              Deselect All
            </Button>
          </div>
        </div>

        {/* Grouped permission grid */}
        <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-4">
          {PERMISSION_GROUPS.map((group) => {
            const groupKeys = group.permissions;
            const enabledCount = groupKeys.filter((k) => working.includes(k)).length;
            const allOn = enabledCount === groupKeys.length;
            const someOn = enabledCount > 0 && !allOn;
            return (
              <div key={group.label} className="rounded-lg border bg-card">
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/40">
                  <div className="text-sm font-semibold flex items-center gap-2">
                    {group.label}
                    <span className="text-xs text-muted-foreground font-normal">
                      ({enabledCount}/{groupKeys.length})
                    </span>
                  </div>
                  <button
                    onClick={() => toggleGroup(group)}
                    disabled={saving}
                    className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline disabled:opacity-50"
                  >
                    {allOn ? "Clear group" : "Enable all"}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 p-2">
                  {groupKeys.map((key) => {
                    const enabled = working.includes(key);
                    return (
                      <label
                        key={key}
                        htmlFor={`perm-${key}`}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 cursor-pointer transition-colors",
                          enabled
                            ? "border-emerald-400/60 bg-emerald-50/40 dark:bg-emerald-950/20"
                            : "border-border hover:bg-accent/40"
                        )}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">
                            {ADMIN_PERMISSION_LABELS[key]}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate font-mono">{key}</div>
                        </div>
                        <Switch
                          id={`perm-${key}`}
                          checked={enabled}
                          onCheckedChange={() => onToggle(key)}
                          disabled={saving}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button onClick={onSave} disabled={saving} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save Permissions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
