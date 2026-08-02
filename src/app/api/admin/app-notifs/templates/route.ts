// ============================================================================
// File: src/app/api/admin/app-notifs/templates/route.ts
// Purpose: Admin endpoints for managing AppNotifTemplate rows.
//          GET  → list all templates (with optional category filter)
//          PUT  → update a template's editable fields (title, body, icon,
//                 deepLink, priority, isEnabled, ...)
// ============================================================================

import { db } from "@/lib/db";
import { ok, err, unauthorized, parseBody } from "@/lib/api";
import { getAdminFromRequest } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { ensureTemplatesSeeded } from "@/lib/app-notifs";

export async function GET(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  if (!hasPermission(admin, "newsletter")) {
    return err("You don't have permission to manage App notifications", 403);
  }

  // Lazily seed defaults on first admin visit.
  await ensureTemplatesSeeded();

  const url = new URL(req.url);
  const category = url.searchParams.get("category");

  const templates = await db.appNotifTemplate.findMany({
    where: category ? { category } : undefined,
    orderBy: [{ category: "asc" }, { key: "asc" }],
  });

  return ok({ templates });
}

interface UpdateBody {
  id?: string;
  title?: string;
  fullMessage?: string;
  shortDesc?: string;
  icon?: string | null;
  bannerImage?: string | null;
  deepLink?: string | null;
  priority?: string;
  category?: string;
}

export async function PUT(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  if (!hasPermission(admin, "newsletter")) {
    return err("You don't have permission to manage App notifications", 403);
  }

  const body = await parseBody<UpdateBody>(req);
  if (!body?.id) return err("Missing template id", 400);

  const existing = await db.appNotifTemplate.findUnique({ where: { id: body.id } });
  if (!existing) return err("Template not found", 404);

  // Whitelist fields — `key`, `name`, `variables` are NOT editable (they're
  // the API contract used by sendAutoNotification; renaming them would break
  // the integration with the checkout / status / payment routes).
  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title.slice(0, 255);
  if (body.fullMessage !== undefined) data.fullMessage = body.fullMessage;
  if (body.shortDesc !== undefined) data.shortDesc = body.shortDesc?.slice(0, 500) ?? null;
  if (body.icon !== undefined) data.icon = body.icon || null;
  if (body.bannerImage !== undefined) data.bannerImage = body.bannerImage || null;
  if (body.deepLink !== undefined) data.deepLink = body.deepLink || null;
  if (body.priority !== undefined && ["normal", "high"].includes(body.priority)) {
    data.priority = body.priority;
  }
  if (body.category !== undefined && ["transactional", "campaign", "system"].includes(body.category)) {
    data.category = body.category;
  }

  const updated = await db.appNotifTemplate.update({
    where: { id: body.id },
    data,
  });

  return ok(updated);
}
