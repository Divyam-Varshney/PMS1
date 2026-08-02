// ============================================================================
// File: src/lib/permissions.ts
// Purpose: Granular permission helpers for the admin permission system.
//          The Admin model has a `permissions` field (JSON-encoded array of
//          enabled permission keys, or null for "all permissions"). Super
//          admins always have every permission regardless of the field value;
//          for other roles the field gates which sidebar sections and API
//          endpoints they can reach.
// Role: Single source of truth for permission checks so the layout guard,
//       API guards and the AdminsView Permissions dialog stay consistent.
// ============================================================================

import { ADMIN_PERMISSIONS, AdminPermissionKey } from "@/lib/constants";

/// Minimal admin shape required for permission checks — works with the row
/// returned by `getAdminFromRequest()` (which selects id, name, email, role,
/// isActive, permissions) and with the slimmer AdminInfo used client-side.
export interface AdminForPermissions {
  role: string;
  permissions?: string | null;
}

/// Returns true if the admin has the given permission key. Super admins
/// implicitly have ALL permissions regardless of the `permissions` field.
/// For other roles the field is parsed as a JSON array of enabled keys; if
/// parsing fails or the field is null/empty, no permissions are granted.
export function hasPermission(admin: AdminForPermissions | null | undefined, key: AdminPermissionKey): boolean {
  if (!admin) return false;
  if (admin.role === "super_admin") return true;
  const perms = parseAdminPermissions(admin.permissions);
  return perms.includes(key);
}

/// Returns the array of enabled permission keys for the given admin.
/// Super admins return the full ADMIN_PERMISSIONS list (since they have all).
/// Other roles return the parsed array, or an empty array if the field is
/// null/empty/malformed.
export function getAdminPermissions(admin: AdminForPermissions | null | undefined): AdminPermissionKey[] {
  if (!admin) return [];
  if (admin.role === "super_admin") return [...ADMIN_PERMISSIONS];
  return parseAdminPermissions(admin.permissions);
}

/// Returns true if the admin has ANY of the given permission keys. Useful for
/// guards that accept a small set of related keys (e.g. "orders" or "customers"
/// both unlock the order detail view).
export function hasAnyPermission(admin: AdminForPermissions | null | undefined, keys: AdminPermissionKey[]): boolean {
  if (!admin) return false;
  if (admin.role === "super_admin") return true;
  const perms = parseAdminPermissions(admin.permissions);
  return keys.some((k) => perms.includes(k));
}

/// Returns the canonical list of all permission keys (ADMIN_PERMISSIONS).
export function getAllPermissions(): readonly AdminPermissionKey[] {
  return ADMIN_PERMISSIONS;
}

/// Serializes an array of permission keys into the JSON string format expected
/// by the Admin.permissions column. Empty arrays produce "[]" (admin with no
/// permissions — can log in but sees no nav items).
export function serializePermissions(keys: AdminPermissionKey[]): string {
  return JSON.stringify(Array.from(new Set(keys)));
}

/// Parses the Admin.permissions JSON string back into a typed array of keys.
/// Unknown keys (e.g. from older schema versions) are silently dropped so the
/// UI never breaks on legacy data. Returns [] on any parse failure.
export function parseAdminPermissions(raw: string | null | undefined): AdminPermissionKey[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid = new Set<string>(ADMIN_PERMISSIONS as readonly string[]);
    return parsed.filter((k): k is AdminPermissionKey => typeof k === "string" && valid.has(k));
  } catch {
    return [];
  }
}
