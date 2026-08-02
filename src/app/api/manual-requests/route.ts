// ============================================================================
// File: src/app/api/manual-requests/route.ts
// Purpose: Accept a manual medicine request from a customer — they type a list
//          of medicines they want and any notes. Stored as ManualRequest.
//          GET returns the current customer's request history (newest first)
//          so the ManualRequestView can render a "Request History" section
//          with status, admin notes, and the originally requested medicines.
// Role: Powers ManualRequestView.
// ============================================================================

import { db } from "@/lib/db";
import { ok, unauthorized, err, parseBody } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth";
import { createAdminNotification } from "@/lib/admin-notifications";
import { sendNotification } from "@/lib/notifications";

// ----------------------------------------------------------------------------
// GET /api/manual-requests
// Returns the current customer's manual request history, newest first. Used by
// ManualRequestView's history section.
// ----------------------------------------------------------------------------
export async function GET() {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login to view requests");

  const rows = await db.manualRequest.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
  });

  const items = rows.map((r) => ({
    id: r.id,
    status: r.status,
    medicineList: r.medicineList,
    notes: r.notes,
    adminNotes: r.adminNotes,
    convertedOrderId: r.convertedOrderId,
    createdAt: r.createdAt.toISOString(),
  }));

  return ok({ items, total: items.length });
}

export async function POST(req: Request) {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login to submit a request");

  const body = await parseBody<{ medicineList?: string; notes?: string }>(req);
  if (!body?.medicineList || body.medicineList.trim().length < 3) {
    return err("Please enter at least one medicine name");
  }

  const manualRequest = await db.manualRequest.create({
    data: {
      customerId: customer.id,
      medicineList: body.medicineList.trim(),
      notes: body.notes?.trim() || null,
      status: "pending",
    },
  });

  // Admin notification
  await createAdminNotification({
    type: "new_manual_request",
    title: "New Manual Medicine Request",
    message: `${customer.name} requested: ${body.medicineList.trim().slice(0, 60)}${body.medicineList.trim().length > 60 ? "..." : ""}`,
    refId: manualRequest.id,
    refType: "manual_request",
    customerName: customer.name,
    emailDetails: [
      `Customer: ${customer.name} (${customer.email}, ${customer.phone})`,
      `Medicines Requested:`,
      body.medicineList.trim(),
      body.notes ? `Notes: ${body.notes.trim()}` : "",
    ].filter(Boolean).join("\n"),
  });

  // Customer "submitted" confirmation email — uses the manual_request_submitted
  // template from DEFAULT_TEMPLATES. Failures are swallowed (notification log
  // still records the attempt) so they never block the submit response.
  try {
    await sendNotification({
      to: customer.email,
      templateKey: "manual_request_submitted",
      vars: { name: customer.name, medicineList: body.medicineList.trim() },
      customerId: customer.id,
      channel: "email",
    });
  } catch (e) {
    console.error("[mr] submitted email send failed:", e);
  }

  return ok(manualRequest);
}
