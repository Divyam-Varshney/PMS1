// ============================================================================
// File: src/app/api/admin/app-notifs/broadcast/route.ts
// Purpose: Admin "send to ALL customers" broadcast endpoint. Sends a single
//          push notification to every active customer (excluding only those
//          who explicitly disabled notifications in their preferences).
//
//          Body:
//            {
//              title: string,           // notification title (required)
//              body: string,             // notification body (required)
//              icon?: string,            // icon URL (defaults to /icon.png)
//              image?: string,           // large banner image URL
//              tag?: string,             // grouping tag (default pms-campaign)
//              deepLink?: string,        // click target (default /)
//              priority?: "normal" | "high",
//              metadata?: object         // arbitrary debug data
//            }
//
//          Returns the BroadcastResult (sent / failed / skipped counts).
//          Permission-gated to "newsletter" (same as the App Notification
//          Center view itself).
// ============================================================================

import { ok, err, unauthorized, parseBody } from "@/lib/api";
import { getAdminFromRequest } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { broadcastCampaign } from "@/lib/app-notifs";

interface BroadcastBody {
  title?: string;
  body?: string;
  icon?: string;
  image?: string;
  tag?: string;
  deepLink?: string;
  priority?: "normal" | "high";
  metadata?: Record<string, unknown>;
}

export async function POST(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  if (!hasPermission(admin, "newsletter")) {
    return err("You don't have permission to broadcast App notifications", 403);
  }

  const body = await parseBody<BroadcastBody>(req);
  if (!body?.title?.trim() || !body?.body?.trim()) {
    return err("Missing required fields: title, body", 400);
  }

  const result = await broadcastCampaign({
    title: body.title.trim(),
    body: body.body.trim(),
    icon: body.icon,
    image: body.image,
    tag: body.tag || "pms-campaign",
    deepLink: body.deepLink || "/",
    priority: body.priority === "high" ? "high" : "normal",
    metadata: {
      ...body.metadata,
      broadcastBy: admin.id,
      broadcastByName: admin.name,
    },
  });

  return ok(result);
}
