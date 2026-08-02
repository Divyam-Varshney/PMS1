// One-time sync: fix the product.primaryImage cache field to match the actual
// primary ProductImage record. This fixes the cache desync that caused
// "Today's Deals" (and any other section reading product.primaryImage directly)
// to show the wrong image.
import { db } from '../src/lib/db.ts';

const products = await db.product.findMany({
  where: { primaryImage: { not: null } },
  select: { id: true, name: true, primaryImage: true, images: { where: { isPrimary: true }, take: 1, select: { imagePath: true } } },
});

console.log(`=== Checking ${products.length} products with primaryImage set ===\n`);
let synced = 0, alreadyOk = 0, noImage = 0;

for (const p of products) {
  const actualPrimary = p.images[0]?.imagePath;
  if (!actualPrimary) {
    // No primary ProductImage record — clear the stale cache
    console.log(`✗ CLEAR | ${p.name.slice(0, 50)} | had: ${p.primaryImage?.slice(0, 60)}`);
    await db.product.update({ where: { id: p.id }, data: { primaryImage: null } });
    noImage++;
    continue;
  }
  if (p.primaryImage === actualPrimary) {
    alreadyOk++;
    continue;
  }
  // Desync detected — fix it
  console.log(`✗ SYNC  | ${p.name.slice(0, 50)}`);
  console.log(`         was: ${p.primaryImage?.slice(0, 80)}`);
  console.log(`         now: ${actualPrimary.slice(0, 80)}`);
  await db.product.update({ where: { id: p.id }, data: { primaryImage: actualPrimary } });
  synced++;
}

console.log(`\n=== Summary ===`);
console.log(`  Already in sync: ${alreadyOk}`);
console.log(`  Synced (fixed):  ${synced}`);
console.log(`  Cleared (no ProductImage record): ${noImage}`);
console.log(`  Total checked:   ${products.length}`);

process.exit(0);
