// ============================================================================
// File: src/app/api/admin/settings/store-status/route.ts
// Purpose: Quick store open/close toggle. GET returns current status, PATCH
//          updates it.
// ============================================================================

import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, parseBody } from "@/lib/api";
import { getSetting, setSetting, isStoreOpen } from "@/lib/settings";

export async function GET() {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const [open, openStatus, openTime, closeTime] = await Promise.all([
    isStoreOpen(),
    getSetting<boolean>("store.openStatus"),
    getSetting<string>("store.openTime"),
    getSetting<string>("store.closeTime"),
  ]);
  return ok({ open, openStatus, openTime, closeTime });
}

export async function PATCH(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const body = await parseBody<{ openStatus?: boolean }>(req);
  if (typeof body?.openStatus !== "boolean") return err("openStatus boolean required", 400);
  await setSetting("store.openStatus", body.openStatus, "store");
  return ok({ openStatus: body.openStatus });
}
