// ============================================================================
// File: src/components/admin/views/AdminsView.tsx
// Purpose: Admin accounts list + add dialog (super_admin only) + toggle active
//          + delete (cannot delete self) + granular permissions editor
//          (super_admin only, non-super_admin target rows only).
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, UserCog, Loader2, ShieldCheck, KeyRound } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import {
  ADMIN_PERMISSIONS,
  ADMIN_PERMISSION_LABELS,
  AdminPermissionKey,
} from "@/lib/constants";
import { getAdminPermissions } from "@/lib/permissions";

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

export function AdminsView({ currentAdmin }: { currentAdmin: { id: string; role: string } }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-admins"],
    queryFn: () => api.get<AdminRow[]>("/api/admin/admins"),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);

  // Permissions dialog state — holds the target admin + the local working copy
  // of their permission set. Initialized from the row's stored permissions
  // when the dialog opens, persisted via PATCH on save.
  const [permsTarget, setPermsTarget] = useState<AdminRow | null>(null);
  const [permsWorking, setPermsWorking] = useState<AdminPermissionKey[]>([]);
  const [permsSaving, setPermsSaving] = useState(false);

  const isSuper = currentAdmin.role === "super_admin";

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
    <div>
      <PageHeader
        title="Admins"
        description="Manage admin accounts and granular permissions."
        actions={
          isSuper ? (
            <Button onClick={() => setOpen(true)}><Plus className="size-4 mr-1" /> Add Admin</Button>
          ) : (
            <span className="text-xs text-muted-foreground">Only super admins can create new admins.</span>
          )
        }
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4"><TableSkeleton rows={4} cols={6} /></div>
          ) : !data?.length ? (
            <div className="p-4"><EmptyState title="No admins" icon={<UserCog className="size-6" />} /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Active</TableHead>
                    {isSuper && <TableHead></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((a) => {
                    const perms = getAdminPermissions(a);
                    const isSuperRow = a.role === "super_admin";
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium text-sm">
                          {a.name}
                          {a.id === currentAdmin.id && <span className="text-xs text-muted-foreground ml-1">(you)</span>}
                        </TableCell>
                        <TableCell className="text-sm">{a.email}</TableCell>
                        <TableCell className="text-sm">{a.phone || "—"}</TableCell>
                        <TableCell>
                          <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary capitalize">
                            {a.role.replace("_", " ")}
                          </span>
                        </TableCell>
                        <TableCell>
                          {isSuperRow ? (
                            <Badge className="bg-emerald-100 text-emerald-700 gap-1">
                              <ShieldCheck className="size-3" /> All ({ADMIN_PERMISSIONS.length})
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              <KeyRound className="size-3" /> {perms.length} of {ADMIN_PERMISSIONS.length}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {a.lastLoginAt ? formatDateTime(a.lastLoginAt) : "Never"}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={a.isActive}
                            onCheckedChange={(v) => toggle(a.id, v)}
                            disabled={a.id === currentAdmin.id}
                          />
                        </TableCell>
                        {isSuper && (
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1 text-xs"
                                disabled={isSuperRow}
                                onClick={() => openPerms(a)}
                                title={isSuperRow ? "Super admins have all permissions" : "Edit permissions"}
                              >
                                <KeyRound className="size-3.5" /> Permissions
                              </Button>
                              {a.id !== currentAdmin.id && (
                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => del(a)}>
                                  <Trash2 className="size-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Admin dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Admin</DialogTitle>
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
                Super admins get all permissions automatically. Other roles start with no permissions — use the Permissions button to grant access.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={saving}>
              {saving && <Loader2 className="size-4 mr-1 animate-spin" />}
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
// reset cleanly when the target changes. Renders a responsive grid of toggle
// switches for every ADMIN_PERMISSIONS key, with Select All / Deselect All
// shortcuts. Super admin target rows are never editable (the dialog isn't
// reachable for them from the table).
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
  // Close on Escape / backdrop click is handled by Dialog. When the target
  // becomes null (save success or cancel) we just stop rendering the body.
  const allKeys = useMemo(() => [...ADMIN_PERMISSIONS], []);
  const selectedCount = working.length;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-5 text-primary" />
            Permissions — {target?.name ?? ""}
          </DialogTitle>
          <DialogDescription>
            Toggle which sections of the admin panel this account can access.
            Changes take effect on the admin&apos;s next login.
          </DialogDescription>
        </DialogHeader>

        {/* Toolbar — Select All / Deselect All + live count */}
        <div className="flex items-center justify-between gap-2 border-y py-2">
          <div className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{selectedCount}</span>
            {" "}of {allKeys.length} permissions enabled
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

        {/* Permission toggle grid — 2 columns on md+, 1 on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto pr-1">
          {allKeys.map((key) => {
            const enabled = working.includes(key);
            return (
              <label
                key={key}
                htmlFor={`perm-${key}`}
                className={`flex items-center justify-between gap-2 rounded-lg border p-2.5 cursor-pointer transition-colors ${
                  enabled
                    ? "border-primary/40 bg-primary/5"
                    : "border-border hover:bg-accent/40"
                }`}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {ADMIN_PERMISSION_LABELS[key]}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">{key}</div>
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

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button onClick={onSave} disabled={saving}>
            {saving && <Loader2 className="size-4 mr-1 animate-spin" />}
            Save Permissions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
