import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
// The user specified these brands: Sun Pharma, Cipla, Himalaya, Mankind, Dabur, Micro Labs, Abbott, Dr. Reddy's, Zydus, Torrent
const featuredNames = ['Sun Pharma', 'Cipla', 'Himalaya', 'Mankind', 'Dabur', 'Micro Labs', 'MicroLab', 'Abbott', "Dr. Reddy's", 'Dr Reddy', 'Zydus', 'Torrent'];
// First, unfeature all
await db.brand.updateMany({ data: { isFeaturedOnHomepage: false } });
// Then feature matching brands
let count = 0;
for (const name of featuredNames) {
  const brands = await db.brand.findMany({ where: { name: { contains: name, mode: 'insensitive' } } });
  for (const b of brands) {
    await db.brand.update({ where: { id: b.id }, data: { isFeaturedOnHomepage: true, displayOrder: count } });
    console.log(`  ✓ [${count}] ${b.name}`);
    count++;
  }
}
// If fewer than 10 featured, add top brands by product count
if (count < 10) {
  const more = await db.brand.findMany({ where: { isFeaturedOnHomepage: false, status: 'active' }, include: { _count: { select: { products: true } } }, orderBy: { _count: { products: 'desc' } }, take: 10 - count });
  for (const b of more) {
    await db.brand.update({ where: { id: b.id }, data: { isFeaturedOnHomepage: true, displayOrder: count } });
    console.log(`  ✓ [${count}] ${b.name} (${b._count.products} products)`);
    count++;
  }
}
console.log(`\nTotal featured: ${count}`);
await db.$disconnect();
process.exit(0);
