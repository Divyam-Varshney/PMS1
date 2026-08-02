import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized } from "@/lib/api";
import { slugify } from "@/lib/format";

function parseCSV(text: string): string[][] {
  const rows: string[][] = []; let current: string[] = []; let field = ""; let inQ = false;
  for (let i = 0; i < text.length; i++) { const ch = text[i];
    if (inQ) { if (ch === '"') { if (text[i+1] === '"') { field += '"'; i++; } else inQ = false; } else field += ch; }
    else { if (ch === '"') inQ = true; else if (ch === ",") { current.push(field); field = ""; } else if (ch === "\n") { current.push(field); rows.push(current); current = []; field = ""; } else if (ch !== "\r") field += ch; } }
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
  const [brands, categories] = await Promise.all([db.brand.findMany({ select: { id: true, name: true } }), db.category.findMany({ select: { id: true, name: true } })]);
  const brandMap = new Map(brands.map((b) => [b.name.toLowerCase(), b.id]));
  const categoryMap = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
  let created = 0, updated = 0; const errors: string[] = [];
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]; const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = (row[idx] ?? "").trim(); });
    try {
      const name = obj.name; if (!name) { errors.push(`Row ${i+2}: missing name`); continue; }
      const slug = obj.slug || slugify(name);
      const mrp = parseFloat(obj.mrp) || 0; const sellingPrice = parseFloat(obj.sellingPrice) || mrp;
      const derivedBase = mrp > 0 ? Math.round(((mrp - sellingPrice) / mrp) * 1000) / 10 : 0;
      const baseDiscountPct = obj.baseDiscountPct ? parseFloat(obj.baseDiscountPct) : derivedBase;
      const maxDiscountPct = obj.maxDiscountPct ? parseFloat(obj.maxDiscountPct) : baseDiscountPct;
      const costPrice = obj.costPrice ? parseFloat(obj.costPrice) : null;
      const brandId = obj.brand ? brandMap.get(obj.brand.toLowerCase()) : null;
      const categoryId = obj.category ? categoryMap.get(obj.category.toLowerCase()) : null;
      const data = { name, slug, sku: obj.sku || null, shortDescription: obj.shortDescription || null, composition: obj.composition || null, genericName: obj.genericName || null, manufacturer: obj.manufacturer || null, brandId: brandId || null, categoryId: categoryId || null, unit: obj.unit || null, packSize: obj.packSize || null, mrp, sellingPrice, baseDiscountPct, maxDiscountPct, costPrice, taxPct: parseFloat(obj.taxPct) || 0, stock: parseInt(obj.stock) || 0, lowStockThreshold: parseInt(obj.lowStockThreshold) || 10, prescriptionRequired: obj.prescriptionRequired === "true" || obj.prescriptionRequired === "1", isGeneric: obj.isGeneric === "true" || obj.isGeneric === "1", isFeatured: obj.isFeatured === "true" || obj.isFeatured === "1", isBestSeller: obj.isBestSeller === "true" || obj.isBestSeller === "1", isTrending: obj.isTrending === "true" || obj.isTrending === "1", status: obj.status || "active", visibility: obj.visibility || "public", hsnCode: obj.hsnCode || null };
      const existing = await db.product.findUnique({ where: { slug } });
      if (existing) { await db.product.update({ where: { slug }, data }); updated++; }
      else { await db.product.create({ data }); created++; }
    } catch (e: any) { errors.push(`Row ${i+2}: ${e?.message ?? "error"}`); }
  }
  return ok({ created, updated, errors, total: dataRows.length });
}
