// ============================================================================
// File: src/app/api/admin/notifications/templates/route.ts
// Purpose: List + create notification templates. Supports custom HTML/CSS
//          email templates with variable placeholders.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, parseBody } from "@/lib/api";

export async function GET() {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const items = await db.notificationTemplate.findMany({ orderBy: { key: "asc" } });
  return ok(items);
}

export async function POST(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const body = await parseBody<{
    key: string;
    name: string;
    channel: string;
    subject: string;
    body: string;
    variables?: string;
    isActive?: boolean;
  }>(req);
  if (!body?.key || !body?.name || !body?.subject || !body?.body) {
    return err("Key, name, subject, and body are required", 400);
  }
  // Ensure key is unique
  const existing = await db.notificationTemplate.findUnique({ where: { key: body.key } });
  if (existing) return err("A template with this key already exists", 400);

  const template = await db.notificationTemplate.create({
    data: {
      key: body.key,
      name: body.name,
      channel: body.channel || "email",
      subject: body.subject,
      body: body.body,
      variables: body.variables || "[]",
      isActive: body.isActive ?? true,
    },
  });
  return ok(template, 201);
}
