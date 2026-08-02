// ============================================================================
// File: src/app/api/admin/brands/import/route.ts
// Purpose: Import brands from CSV. Upserts by slug.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized } from "@/lib/api";
import { slugify } from "@/lib/format";

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { current.push(field); field = ""; }
      else if (ch === "\n") { current.push(field); rows.push(current); current = []; field = ""; }
      else if (ch === "\r") { /* skip */ }
      else field += ch;
    }
  }
  if (field || current.length) { current.push(field); rows.push(current); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

export async function POST(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return err("No CSV file uploaded", 400);

  const text = await file.text();
  const rows = parseCSV(text);
  if (rows.length < 2) return err("CSV is empty or has no data rows", 400);

  const headers = rows[0].map((h) => h.trim());
  const dataRows = rows.slice(1);

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = (row[idx] ?? "").trim(); });

    try {
      const name = obj.name;
      if (!name) { errors.push(`Row ${i + 2}: missing name`); continue; }
      const slug = obj.slug || slugify(name);

      const data = {
        name,
        slug,
        description: obj.description || null,
        displayOrder: parseInt(obj.displayOrder) || 0,
        status: obj.status || "active",
        visibility: obj.visibility || "public",
      };

      const existing = await db.brand.findUnique({ where: { slug } });
      if (existing) {
        await db.brand.update({ where: { slug }, data });
        updated++;
      } else {
        await db.brand.create({ data });
        created++;
      }
    } catch (e: any) {
      errors.push(`Row ${i + 2}: ${e?.message ?? "unknown error"}`);
    }
  }

  return ok({ created, updated, errors, total: dataRows.length });
}
