// ============================================================================
// File: prisma/seed.ts
// Purpose: Database seed script. Creates the super admin, default settings,
//          notification templates, brands, categories, demo products, a demo
//          customer, coupons, discount rules and a delivery zone.
// Role: Run via `npm run db:seed` to bootstrap a fresh installation so the
//       app is immediately usable for demo / first launch.
// ============================================================================

import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";
import { DEFAULT_SETTINGS, DEFAULT_TEMPLATES } from "../src/lib/constants";
import { slugify } from "../src/lib/format";

async function main() {
  console.log("🌱 Seeding PMS database...");

  // ---- 1. Super Admin ----
  const adminEmail = "admin@pradeepmedical.com";
  const existingAdmin = await db.admin.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    await db.admin.create({
      data: {
        name: "Pradeep (Super Admin)",
        email: adminEmail,
        phone: "+91 99999 00000",
        passwordHash: hashPassword("admin123"),
        role: "super_admin",
        isActive: true,
      },
    });
    console.log("  ✓ Created super admin (admin@pradeepmedical.com / admin123)");
  }

  // ---- 2. Settings ----
  for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
    await db.setting.upsert({
      where: { key },
      update: {},
      create: { key, value: JSON.stringify(def.value), category: def.category },
    });
  }
  console.log("  ✓ Seeded settings");

  // ---- 3. Notification templates ----
  for (const t of DEFAULT_TEMPLATES) {
    // key is unique; for email & whatsapp variants we append channel to key
    const key = `${t.key}_${t.channel}`;
    await db.notificationTemplate.upsert({
      where: { key },
      update: {},
      create: {
        key,
        name: t.name,
        channel: t.channel,
        subject: t.subject,
        body: t.body,
        variables: JSON.stringify(t.variables),
        isActive: true,
      },
    });
  }
  console.log("  ✓ Seeded notification templates");

  // ---- 4. Brands ----
  const brands = [
    "Cipla", "Sun Pharma", "Dr. Reddy's", "Mankind", "Abbott",
    "GSK", "Pfizer", "Himalaya", "Dabur", "Patanjali",
    "Zandu", "Calvin", "Livcare",
  ];
  const brandRecords: any[] = [];
  for (let i = 0; i < brands.length; i++) {
    const name = brands[i];
    const b = await db.brand.upsert({
      where: { slug: slugify(name) },
      update: {},
      create: {
        name,
        slug: slugify(name),
        description: `${name} - trusted pharmaceutical brand`,
        displayOrder: i,
        status: "active",
        visibility: "public",
      },
    });
    brandRecords.push(b);
  }
  console.log(`  ✓ Seeded ${brandRecords.length} brands`);

  // ---- 5. Categories ----
  const categories = [
    { name: "Prescription Medicines", desc: "Medicines requiring a valid prescription" },
    { name: "OTC Medicines", desc: "Over-the-counter medicines" },
    { name: "Wellness & Supplements", desc: "Vitamins, supplements and health tonics" },
    { name: "Personal Care", desc: "Skincare, hygiene and personal care" },
    { name: "Baby Care", desc: "Baby food, diapers and care products" },
    { name: "Diabetes Care", desc: "Diabetes management products" },
    { name: "Devices & Equipment", desc: "Medical devices and equipment" },
    { name: "Ayurveda", desc: "Ayurvedic and herbal medicines" },
  ];
  const catRecords: any[] = [];
  for (let i = 0; i < categories.length; i++) {
    const c = categories[i];
    const rec = await db.category.upsert({
      where: { slug: slugify(c.name) },
      update: {},
      create: {
        name: c.name,
        slug: slugify(c.name),
        description: c.desc,
        displayOrder: i,
        status: "active",
        visibility: "public",
      },
    });
    catRecords.push(rec);
  }
  console.log(`  ✓ Seeded ${catRecords.length} categories`);

  // ---- 6. Products ----
  const products = [
    { name: "Paracetamol 500mg (Strip of 10)", cat: "OTC Medicines", brand: "Calvin", composition: "Paracetamol 500mg", generic: true, rx: false, mrp: 35, sp: 30, stock: 200, unit: "Strip", pack: "10 tablets" },
    { name: "Azithromycin 500mg (Strip of 3)", cat: "Prescription Medicines", brand: "Cipla", composition: "Azithromycin 500mg", generic: false, rx: true, mrp: 120, sp: 108, stock: 80, unit: "Strip", pack: "3 tablets" },
    { name: "Vitamin C 1000mg (Bottle of 30)", cat: "Wellness & Supplements", brand: "Himalaya", composition: "Ascorbic Acid 1000mg", generic: false, rx: false, mrp: 250, sp: 225, stock: 150, unit: "Bottle", pack: "30 tablets" },
    { name: "Metformin 500mg (Strip of 15)", cat: "Diabetes Care", brand: "Sun Pharma", composition: "Metformin Hydrochloride 500mg", generic: true, rx: true, mrp: 45, sp: 38, stock: 120, unit: "Strip", pack: "15 tablets" },
    { name: "Cetirizine 10mg (Strip of 10)", cat: "OTC Medicines", brand: "Dr. Reddy's", composition: "Cetirizine Hydrochloride 10mg", generic: true, rx: false, mrp: 25, sp: 22, stock: 300, unit: "Strip", pack: "10 tablets" },
    { name: "Pantoprazole 40mg (Strip of 10)", cat: "Prescription Medicines", brand: "Mankind", composition: "Pantoprazole 40mg", generic: true, rx: true, mrp: 95, sp: 85, stock: 90, unit: "Strip", pack: "10 tablets" },
    { name: "Multivitamin Capsules (Bottle of 60)", cat: "Wellness & Supplements", brand: "Dabur", composition: "Multivitamin & Minerals", generic: false, rx: false, mrp: 380, sp: 342, stock: 60, unit: "Bottle", pack: "60 capsules" },
    { name: "Hand Sanitizer 500ml", cat: "Personal Care", brand: "Dabur", composition: "Ethyl Alcohol 70%", generic: false, rx: false, mrp: 199, sp: 179, stock: 100, unit: "Bottle", pack: "500 ml" },
    { name: "Baby Diapers Medium (Pack of 30)", cat: "Baby Care", brand: "Patanjali", composition: "Disposable Diapers", generic: false, rx: false, mrp: 499, sp: 449, stock: 50, unit: "Pack", pack: "30 diapers" },
    { name: "Digital Thermometer", cat: "Devices & Equipment", brand: "Abbott", composition: "Digital Thermometer", generic: false, rx: false, mrp: 250, sp: 225, stock: 40, unit: "Piece", pack: "1 unit" },
    { name: "Ashwagandha Capsules (Bottle of 60)", cat: "Ayurveda", brand: "Himalaya", composition: "Withania Somnifera 250mg", generic: false, rx: false, mrp: 320, sp: 288, stock: 70, unit: "Bottle", pack: "60 capsules" },
    { name: "Insulin Syringe (Pack of 10)", cat: "Diabetes Care", brand: "Abbott", composition: "Single-use Insulin Syringe", generic: false, rx: true, mrp: 150, sp: 135, stock: 110, unit: "Pack", pack: "10 syringes" },
    { name: "Cough Syrup 100ml", cat: "OTC Medicines", brand: "Zandu", composition: "Ayurvedic Cough Formula", generic: false, rx: false, mrp: 110, sp: 99, stock: 85, unit: "Bottle", pack: "100 ml" },
    { name: "Iron + Folic Acid (Bottle of 30)", cat: "Wellness & Supplements", brand: "Livcare", composition: "Iron + Folic Acid", generic: true, rx: false, mrp: 85, sp: 72, stock: 130, unit: "Bottle", pack: "30 tablets" },
    { name: "Antiseptic Liquid 250ml", cat: "Personal Care", brand: "Dabur", composition: "Chloroxylenol", generic: false, rx: false, mrp: 145, sp: 130, stock: 95, unit: "Bottle", pack: "250 ml" },
    { name: "Protein Powder 500g", cat: "Wellness & Supplements", brand: "Himalaya", composition: "Whey Protein", generic: false, rx: false, mrp: 899, sp: 809, stock: 35, unit: "Jar", pack: "500 g" },
  ];

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const cat = catRecords.find((c) => c.name === p.cat)!;
    const brand = brandRecords.find((b) => b.name === p.brand)!;
    const slug = slugify(p.name);
    await db.product.upsert({
      where: { slug },
      update: {},
      create: {
        name: p.name,
        slug,
        sku: `SKU-${String(i + 1).padStart(4, "0")}`,
        shortDescription: `${p.composition} - ${p.pack}`,
        description: `${p.name} by ${p.brand}. ${p.composition}. Pack: ${p.pack}.`,
        composition: p.composition,
        manufacturer: p.brand,
        genericName: p.generic ? p.composition : null,
        prescriptionRequired: p.rx,
        isGeneric: p.generic,
        brandId: brand.id,
        categoryId: cat.id,
        unit: p.unit,
        packSize: p.pack,
        mrp: p.mrp,
        sellingPrice: p.sp,
        baseDiscountPct: p.mrp > 0 ? Math.round(((p.mrp - p.sp) / p.mrp) * 1000) / 10 : 0,
        maxDiscountPct: p.mrp > 0 ? Math.round(((p.mrp - p.sp) / p.mrp) * 1000) / 10 : 0,
        stock: p.stock,
        lowStockThreshold: 10,
        hsnCode: "30049099",
        displayOrder: i,
        isFeatured: i < 6,
        isBestSeller: i % 5 === 0,
        isTrending: i % 4 === 0,
        status: "active",
        visibility: "public",
      },
    });
  }
  console.log(`  ✓ Seeded ${products.length} products`);

  // ---- 7. Demo customer — REMOVED ----
  // The demo customer with customer@demo.com was removed because:
  //   1. Gmail kept trying to deliver notification emails to demo.com (non-existent domain)
  //   2. This caused "Delivery incomplete" bounce-back emails for days
  //   3. The demo customer is not needed — admin can register real customers via the site
  // If you need a test customer, register one via the customer site with a real email.

  // ---- 8. Vouchers (flat-amount deductions, NOT coupons) ----
  // Vouchers give a flat Rs. amount off (not a percentage). They reduce the
  // final payable amount directly — they do NOT increase product discounts.
  await db.voucher.upsert({
    where: { code: "WELCOME50" },
    update: {},
    create: {
      code: "WELCOME50",
      description: "Flat Rs. 50 off on first order above Rs. 200",
      amount: 50,
      scope: "cart",
      minOrder: 200,
      maxRedemptions: 1000,
      perCustomerLimit: 1,
      isActive: true,
    },
  });
  await db.voucher.upsert({
    where: { code: "SAVE100" },
    update: {},
    create: {
      code: "SAVE100",
      description: "Flat Rs. 100 off on orders above Rs. 500",
      amount: 100,
      scope: "cart",
      minOrder: 500,
      maxRedemptions: 500,
      perCustomerLimit: 0,
      isActive: true,
    },
  });
  console.log("  ✓ Seeded vouchers");

  // ---- 9. Delivery zones (locality-based) ----
  async function upsertByName<T extends { name: string }>(
    model: { findFirst: (a: { where: { name: string } }) => Promise<T | null>; create: (a: { data: any }) => Promise<T> },
    data: any
  ) {
    const found = await model.findFirst({ where: { name: data.name } });
    if (!found) await model.create({ data });
  }
  await upsertByName(db.deliveryZone, {
    name: "Mathura City",
    localities: "Krishna Nagar\nHoli Gate\nMaholi Road\nMaholi Gaon\nDampier Nagar\nManas Nagar",
    pincodes: "281001,281004,281005,281006",
    charge: 20,
    freeAbove: 500,
    minOrder: 0,
    estimatedHours: 1,
    isActive: true,
    displayOrder: 1,
  });
  await upsertByName(db.deliveryZone, {
    name: "Vrindavan",
    localities: "Vrindavan\nGovardhan\nGokul",
    pincodes: "281121,281121",
    charge: 50,
    freeAbove: 1000,
    minOrder: 0,
    estimatedHours: 4,
    isActive: true,
    displayOrder: 2,
  });
  console.log("  ✓ Seeded delivery zones");

  // ---- 10. Payment methods (modular, admin-managed) ----
  // COD — always active by default; customers pay cash on delivery.
  await db.paymentMethod.upsert({
    where: { key: "cod" },
    update: {},
    create: {
      key: "cod",
      label: "Cash on Delivery",
      description: "Pay with cash when your order is delivered",
      icon: "Banknote",
      displayOrder: 1,
      isActive: true,
    },
  });
  // QR Code — active by default. The admin uploads a QR image via the
  // Payment Methods view; it's stored in config.qrImage and shown to the
  // customer on the order-success page so they can scan & pay via UPI.
  // Admin manually marks the order as paid once the transfer is confirmed.
  await db.paymentMethod.upsert({
    where: { key: "qr" },
    update: {},
    create: {
      key: "qr",
      label: "QR Code Payment",
      description: "Scan our QR code and pay when your order is delivered",
      icon: "QrCode",
      displayOrder: 2,
      isActive: true,
      config: JSON.stringify({ qrImage: "" }),
    },
  });
  // Razorpay — disabled by default; admin must enter Key ID + Key Secret in
  // the Payment Methods view (and click "Test Connection") before enabling.
  // Credentials are stored in config as { keyId, keySecret } — never in
  // the global Settings table.
  await db.paymentMethod.upsert({
    where: { key: "razorpay" },
    update: {},
    create: {
      key: "razorpay",
      label: "Razorpay",
      description: "Pay securely online via UPI / cards / net banking (Razorpay)",
      icon: "CreditCard",
      gateway: "razorpay",
      displayOrder: 3,
      isActive: false,
      config: JSON.stringify({ keyId: "", keySecret: "" }),
    },
  });
  // UPI — kept for backward compat; disabled by default (admin can enable).
  await db.paymentMethod.upsert({
    where: { key: "upi" },
    update: {},
    create: {
      key: "upi",
      label: "UPI Payment",
      description: "Pay via UPI (Google Pay, PhonePe, Paytm)",
      icon: "Smartphone",
      displayOrder: 4,
      isActive: false,
    },
  });
  console.log("  ✓ Seeded payment methods");

  console.log("✅ Seed complete!");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
