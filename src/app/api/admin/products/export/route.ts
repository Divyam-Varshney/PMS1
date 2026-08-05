import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { unauthorized } from "@/lib/api";

function csvEscape(v: any): string { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; }

export async function GET(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const url = new URL(req.url);
  const idsParam = url.searchParams.get("ids");
  const where = idsParam ? { id: { in: idsParam.split(",").filter(Boolean) } } : {};
  const products = await db.product.findMany({ where, include: { brand: { select: { name: true } }, category: { select: { name: true } } }, orderBy: { createdAt: "desc" } });
  const headers = ["name","slug","sku","shortDescription","composition","genericName","manufacturer","brand","category","unit","packSize","mrp","sellingPrice","baseDiscountPct","maxDiscountPct","costPrice","taxPct","stock","lowStockThreshold","prescriptionRequired","isGeneric","isFeatured","isBestSeller","isTrending","status","visibility","hsnCode"];
  const rows = products.map((p) => [p.name,p.slug,p.sku,p.shortDescription,p.composition,p.genericName,p.manufacturer,p.brand?.name,p.category?.name,p.unit,p.packSize,p.mrp,p.sellingPrice,p.baseDiscountPct,p.maxDiscountPct,p.costPrice ?? "",p.taxPct,p.stock,p.lowStockThreshold,p.prescriptionRequired,p.isGeneric,p.isFeatured,p.isBestSeller,p.isTrending,p.status,p.visibility,p.hsnCode].map(csvEscape).join(","));
  const csv = [headers.join(","), ...rows].join("\n");
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="products-${new Date().toISOString().slice(0,10)}.csv"` } });
}
