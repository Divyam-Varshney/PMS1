// ============================================================================
// File: src/app/api/newsletter/subscribe/route.ts
// Purpose: Public endpoint that lets anyone subscribe to the newsletter from
//          the customer site footer. Idempotent — re-subscribing an existing
//          email re-activates it (sets isActive=true) instead of erroring.
// Role: Powers the footer newsletter form on the customer site.
// ============================================================================

import { db } from "@/lib/db";
import { ok, err, parseBody } from "@/lib/api";

export async function POST(req: Request) {
  const body = await parseBody<{ email?: string; name?: string }>(req);
  if (!body) return err("Invalid request body");

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email) return err("Email is required");
  // Basic email format validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return err("Please enter a valid email address");
  }
  const name = body.name?.trim() || null;

  // Upsert: if the subscriber already exists (even if previously deactivated),
  // re-activate it and update the name. New emails create a fresh row.
  const subscriber = await db.newsletterSubscriber.upsert({
    where: { email },
    update: { isActive: true, ...(name ? { name } : {}) },
    create: { email, name },
  });

  return ok({
    id: subscriber.id,
    email: subscriber.email,
    message: "Subscribed successfully",
  });
}
