// ============================================================================
// File: src/app/api/customer/reminders/route.ts
// Purpose: GET lists the customer's medicine reminders; POST creates a new
//          reminder. Both require customer auth via getCustomerFromRequest.
// ============================================================================

import { db } from "@/lib/db";
import { ok, err, unauthorized, parseBody } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

const FREQ_VALUES = new Set(["daily", "twice-daily", "weekly", "custom"]);
const MAX_TIMES = 8;

export async function GET() {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login");

  const reminders = await db.medicineReminder.findMany({
    where: { customerId: customer.id },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });

  return ok({ items: reminders });
}

export async function POST(req: Request) {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login");

  const body = await parseBody<{
    productName?: string;
    dosage?: string | null;
    frequency?: string;
    times?: string[];
    startDate?: string;
    endDate?: string | null;
  }>(req);

  if (!body) return err("Invalid request body");
  const productName = body.productName?.trim();
  if (!productName) return err("Product name is required");
  if (productName.length > 255) return err("Product name is too long (max 255 chars)");

  const frequency = body.frequency ?? "daily";
  if (!FREQ_VALUES.has(frequency)) {
    return err("Invalid frequency. Must be one of: daily, twice-daily, weekly, custom");
  }

  // Validate times — array of "HH:MM" strings, max 8 entries.
  let times: string[] = [];
  if (Array.isArray(body.times)) {
    times = body.times
      .filter((t) => typeof t === "string" && /^\d{2}:\d{2}$/.test(t))
      .slice(0, MAX_TIMES);
  }
  if (times.length === 0) {
    // Default based on frequency
    if (frequency === "daily") times = ["08:00"];
    else if (frequency === "twice-daily") times = ["08:00", "20:00"];
    else if (frequency === "weekly") times = ["09:00"];
    else times = ["08:00"];
  }

  const dosage = body.dosage?.trim() || null;
  if (dosage && dosage.length > 100) {
    return err("Dosage is too long (max 100 chars)");
  }

  const startDate = body.startDate ? new Date(body.startDate) : new Date();
  if (Number.isNaN(startDate.getTime())) {
    return err("Invalid startDate");
  }

  let endDate: Date | null = null;
  if (body.endDate) {
    endDate = new Date(body.endDate);
    if (Number.isNaN(endDate.getTime())) {
      return err("Invalid endDate");
    }
    if (endDate < startDate) {
      return err("endDate must be on or after startDate");
    }
  }

  const reminder = await db.medicineReminder.create({
    data: {
      customerId: customer.id,
      productName,
      dosage,
      frequency,
      times: JSON.stringify(times),
      startDate,
      endDate,
      isActive: true,
    },
  });

  return ok(reminder);
}
