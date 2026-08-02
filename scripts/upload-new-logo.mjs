import { storage } from '../src/lib/storage/index.ts';
import { readFileSync } from 'fs';
import { db } from '../src/lib/db.ts';

// Upload the badge logo (primary) to cloud
const logoPath = '/home/z/my-project/public/logo.png';
const buffer = readFileSync(logoPath);
console.log('Badge logo size:', buffer.length, 'bytes');

try {
  const result = await storage.upload('brands', buffer, {
    ownerId: 'branding',
    filename: 'pms-badge-logo-' + Date.now() + '.png',
  });
  console.log('Uploaded to cloud:', result.url);

  await db.setting.upsert({
    where: { key: 'store.logo' },
    update: { value: JSON.stringify(result.url) },
    create: { key: 'store.logo', value: JSON.stringify(result.url), category: 'store' },
  });
  console.log('✓ store.logo updated in DB');
} catch (e) {
  console.log('Cloud upload failed:', e.message);
}
process.exit(0);
