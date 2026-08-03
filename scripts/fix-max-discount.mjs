import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const products = await db.product.findMany({
  where: { maxDiscountPct: { gt: 0 } },
  select: { id: true, name: true, mrp: true, sellingPrice: true, baseDiscountPct: true, maxDiscountPct: true }
});
console.log(`Products with maxDiscountPct > 0: ${products.length}`);
let fixed = 0;
for (const p of products) {
  const mrp = Number(p.mrp);
  const sp = Number(p.sellingPrice);
  const derivedBase = mrp > 0 ? Math.round(((mrp - sp) / mrp) * 1000) / 10 : 0;
  const wasAutoSet = Number(p.maxDiscountPct) === Number(p.baseDiscountPct) &&
                     Number(p.baseDiscountPct) === derivedBase;
  if (wasAutoSet) {
    await db.product.update({ where: { id: p.id }, data: { maxDiscountPct: 0 } });
    fixed++;
  }
}
console.log(`Fixed (auto-set → 0): ${fixed}`);
console.log(`Kept (intentionally set): ${products.length - fixed}`);
await db.$disconnect();
process.exit(0);
