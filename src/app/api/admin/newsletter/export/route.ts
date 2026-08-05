// ============================================================================
// File: src/app/api/admin/newsletter/export/route.ts
// Purpose: Export ALL newsletter subscribers as a CSV file. Admin-only.
//          Columns: email, name, isActive, subscribedAt.
// Role: Powers the "Export CSV" button in the Admin Panel → Newsletter view.
// ============================================================================

import { db } from "@/lib/db";
import { unauthorized } from "@/lib/api";
import { getAdminFromRequest } from "@/lib/auth";

function csvEscape(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const subscribers = await db.newsletterSubscriber.findMany({
    orderBy: { createdAt: "desc" },
  });

  const headers = ["email", "name", "isActive", "subscribedAt"];
  const rows = subscribers.map((s) =>
    [s.email, s.name ?? "", s.isActive ? "yes" : "no", s.createdAt.toISOString()].map(csvEscape).join(",")
  );
  const csv = [headers.join(","), ...rows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
