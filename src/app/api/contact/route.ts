// ============================================================================
// File: src/app/api/contact/route.ts
// Purpose: Contact form submission endpoint. Persists the message to the
//          NotificationLog (channel=email, templateKey=contact_form) so the
//          admin can read all enquiries from the Notifications panel.
// ============================================================================

import { db } from "@/lib/db";
import { ok, err, parseBody } from "@/lib/api";
import { getSetting } from "@/lib/settings";

interface ContactPayload {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
}

export async function POST(req: Request) {
  try {
    const body = await parseBody<ContactPayload>(req);
    if (!body?.name || !body?.email || !body?.message)
      return err("Name, email and message are required", 400);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email))
      return err("Please enter a valid email address", 400);

    const storeEmail = await getSetting<string>("store.email");
    const subject = body.subject?.trim() || `Contact form: ${body.name}`;
    const composedBody = [
      `New contact form submission`,
      ``,
      `Name: ${body.name}`,
      `Email: ${body.email}`,
      body.phone ? `Phone: ${body.phone}` : null,
      ``,
      `Message:`,
      body.message,
    ]
      .filter(Boolean)
      .join("\n");

    await db.notificationLog.create({
      data: {
        recipient: storeEmail || "care@pradeepmedical.com",
        channel: "email",
        subject,
        body: composedBody,
        status: "sent",
        templateKey: "contact_form",
      },
    });

    return ok({ received: true }, 201);
  } catch (e) {
    return err("Failed to submit contact form. Please try again.", 500);
  }
}
