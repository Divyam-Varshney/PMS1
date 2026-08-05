// ============================================================================
// File: src/app/api/admin/settings/route.ts
// Purpose: Read & bulk-update admin settings (grouped by category).
// ============================================================================

import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, parseBody } from "@/lib/api";
import { getAllSettings, updateSettings } from "@/lib/settings";
import { DEFAULT_SETTINGS } from "@/lib/constants";

export async function GET() {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const all = await getAllSettings();
  const grouped: Record<string, Record<string, any>> = {};
  for (const [key, value] of Object.entries(all)) {
    const category = DEFAULT_SETTINGS[key]?.category ?? "general";
    if (!grouped[category]) grouped[category] = {};
    grouped[category][key] = value;
  }
  return ok({ settings: all, grouped });
}

export async function PUT(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const body = await parseBody<{ settings?: Record<string, any> }>(req);
  if (!body?.settings) return err("settings object is required", 400);

  await updateSettings(body.settings);
  const refreshed = await getAllSettings();
  return ok(refreshed);
}
