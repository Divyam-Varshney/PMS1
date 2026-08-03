// ============================================================================
// File: src/lib/medical-bundles.ts
// Purpose: Curated medical bundle definitions for the PMS customer storefront.
//          Each bundle is a medically meaningful kit (e.g. "First Aid Kit",
//          "Diabetes Care") — NOT a random product combination. The bundles
//          are resolved at request-time against the live catalog by matching
//          the bundle's keywords against product name / composition /
//          genericName / category name.
//
// Role: Single source of truth for bundle definitions + the resolver function
//       used by /api/catalog/bundles. Keeping the medical logic in a config
//       file (rather than a DB table) means the pharmacy can ship curated
//       kits immediately and edit them with a single PR.
//
// Palette: emerald / teal / green / amber — NO indigo or blue (pharmacy theme).
// ============================================================================

// A minimal product shape that the resolver needs. Defined locally so this
// module has no dependency on the Prisma client (keeps it importable from
// anywhere — API routes, scripts, tests).
export interface BundleProductLike {
  id: string;
  name: string;
  slug?: string;
  composition?: string | null;
  genericName?: string | null;
  manufacturer?: string | null;
  isBestSeller?: boolean;
  isFeatured?: boolean;
  isTrending?: boolean;
  stock?: number | string;
  displayOrder?: number | string;
  reviewCount?: number | string;
  status?: string;
  visibility?: string;
  categoryId?: string | null;
  brandId?: string | null;
  category?: { name: string } | null;
  brand?: { name: string } | null;
  mrp?: unknown;
  sellingPrice?: unknown;
  primaryImage?: string | null;
  images?: Array<{ imagePath: string; isPrimary?: boolean; altText?: string | null }>;
  [key: string]: unknown;
}

export interface MedicalBundle {
  /** Stable slug used as the React key + URL anchor. */
  id: string;
  name: string;
  /** Short marketing copy shown under the bundle name on the card header. */
  description: string;
  /** Lucide icon name — resolved client-side via the BUNDLE_ICONS map. */
  icon: string;
  /** Tailwind gradient classes for the card header. NO indigo/blue. */
  accentColor: string;
  /** Subtle background tint (Tailwind classes) for the card body. */
  accentBg: string;
  /** Border tint for the card. */
  accentBorder: string;
  /** Matching keywords — case-insensitive, matched against name, composition,
   *  genericName, manufacturer, and category.name. The more keywords a
   *  product matches, the higher its rank inside the bundle. */
  keywords: string[];
  /** Maximum number of products to include in the bundle. */
  maxItems: number;
}

// ---------------------------------------------------------------------------
// MEDICAL BUNDLES — 10 curated pharmacy kits.
//
// The keywords are written to match the COMMON Indian pharmacy inventory:
// generic names (paracetamol, metformin), product types (glucometer, BP
// monitor), and category names (baby care, eye care). This makes the
// resolver robust to brand variation — e.g. "Diabetes Care" will pick up
// Accu-Chek, OneTouch, Dr. Morepen etc. glucometers alike.
// ---------------------------------------------------------------------------
export const MEDICAL_BUNDLES: MedicalBundle[] = [
  {
    id: "first-aid-kit",
    name: "First Aid Kit",
    description: "Be ready for cuts, scrapes, and minor wounds at home or on the go.",
    icon: "Package",
    accentColor: "from-emerald-500 to-teal-600",
    accentBg: "from-emerald-50 to-teal-50",
    accentBorder: "border-emerald-200",
    keywords: [
      "bandage", "band-aid", "antiseptic", "dettol", "savlon", "cotton",
      "gauze", "medical tape", "micropore", "first aid", "adhesive",
    ],
    maxItems: 6,
  },
  {
    id: "diabetes-care",
    name: "Diabetes Care",
    description: "Everything you need to monitor and manage blood sugar levels.",
    icon: "Activity",
    accentColor: "from-teal-500 to-emerald-600",
    accentBg: "from-teal-50 to-emerald-50",
    accentBorder: "border-teal-200",
    keywords: [
      "glucometer", "glucose meter", "test strip", "lancet", "alcohol swab",
      "insulin", "metformin", "diabetes", "blood sugar", "accu-chek",
      "onetouch", "dr. morepen",
    ],
    maxItems: 6,
  },
  {
    id: "blood-pressure-care",
    name: "Blood Pressure Care",
    description: "Track your BP accurately with monitors and accessories.",
    icon: "HeartPulse",
    accentColor: "from-rose-500 to-emerald-600",
    accentBg: "from-rose-50 to-emerald-50",
    accentBorder: "border-rose-200",
    keywords: [
      "bp monitor", "blood pressure", "bp machine", "sphygmomanometer",
      "omron", "carry pouch", "batteries", "cuff",
    ],
    maxItems: 6,
  },
  {
    id: "baby-care",
    name: "Baby Care",
    description: "Daily essentials to keep your little one comfortable and rash-free.",
    icon: "Baby",
    accentColor: "from-pink-400 to-rose-500",
    accentBg: "from-pink-50 to-rose-50",
    accentBorder: "border-pink-200",
    keywords: [
      "diaper", "pampers", "mamypoko", "baby wipe", "baby lotion",
      "baby cream", "baby shampoo", "baby soap", "baby powder", "johnson",
    ],
    maxItems: 6,
  },
  {
    id: "cold-flu-care",
    name: "Cold & Flu Care",
    description: "Recover faster with fever, congestion, and steam essentials.",
    icon: "Thermometer",
    accentColor: "from-cyan-500 to-teal-600",
    accentBg: "from-cyan-50 to-teal-50",
    accentBorder: "border-cyan-200",
    keywords: [
      "thermometer", "steam inhaler", "vaporizer", "tissue", "vicks",
      "paracetamol", "cold", "flu", "cough syrup", "vapor rub",
    ],
    maxItems: 6,
  },
  {
    id: "womens-wellness",
    name: "Women's Wellness",
    description: "Supplements and hygiene essentials for women's daily health.",
    icon: "HeartPulse",
    accentColor: "from-fuchsia-500 to-pink-600",
    accentBg: "from-fuchsia-50 to-pink-50",
    accentBorder: "border-fuchsia-200",
    keywords: [
      "iron", "folic acid", "calcium", "sanitary pad", "whisper",
      "stayfree", "multivitamin", "women", "prenatal",
    ],
    maxItems: 6,
  },
  {
    id: "joint-bone-care",
    name: "Joint & Bone Care",
    description: "Relieve pain and support mobility with supports and supplements.",
    icon: "Bone",
    accentColor: "from-amber-500 to-orange-600",
    accentBg: "from-amber-50 to-orange-50",
    accentBorder: "border-amber-200",
    keywords: [
      "pain relief", "pain spray", "volini", "moov", "iodex",
      "crepe bandage", "calcium", "vitamin d3", "knee cap", "joint",
    ],
    maxItems: 6,
  },
  {
    id: "digestive-health",
    name: "Digestive Health",
    description: "Soothe acidity, restore gut flora, and stay hydrated.",
    icon: "Pill",
    accentColor: "from-emerald-500 to-green-600",
    accentBg: "from-emerald-50 to-green-50",
    accentBorder: "border-emerald-200",
    keywords: [
      "antacid", "eno", "digene", "pudin hara", "probiotic", "ors",
      "electral", "enzyme", "digestion", "acidity",
    ],
    maxItems: 6,
  },
  {
    id: "eye-ear-care",
    name: "Eye & Ear Care",
    description: "Maintain clear vision and clean ears with daily essentials.",
    icon: "Eye",
    accentColor: "from-sky-400 to-teal-500",
    accentBg: "from-sky-50 to-teal-50",
    accentBorder: "border-sky-200",
    keywords: [
      "eye drops", "lubricant", "cotton bud", "ear drop", "ear bud",
      "spectrum", "refresh tears", "itone", "wax",
    ],
    maxItems: 6,
  },
  {
    id: "skin-care",
    name: "Skin Care",
    description: "Heal, protect, and moisturize your skin every day.",
    icon: "Droplet",
    accentColor: "from-teal-500 to-emerald-600",
    accentBg: "from-teal-50 to-emerald-50",
    accentBorder: "border-teal-200",
    keywords: [
      "antiseptic cream", "moisturizer", "sunscreen", "boroplus",
      "himani", "lotion", "skin", "calamine", "winter",
    ],
    maxItems: 6,
  },
];

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

/** Convert a Prisma Decimal / string / number to a safe JS number for arithmetic. */
function num(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  // Prisma Decimal has a .toNumber() method; try that as a last resort.
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    try {
      return Number((value as { toNumber: () => number }).toNumber());
    } catch {
      return 0;
    }
  }
  return 0;
}

/**
 * Resolve a single medical bundle to a list of products from the live catalog.
 *
 * Algorithm:
 *   1. Filter `products` to those whose name OR composition OR genericName OR
 *      manufacturer OR category.name contains ANY of the bundle's keywords
 *      (case-insensitive). Score each product by how many keywords matched.
 *   2. Sort by:
 *        a. in-stock first  (stock > 0)
 *        b. best-seller flag
 *        c. match score (more keyword matches = higher rank)
 *        d. displayOrder asc
 *        e. reviewCount desc
 *   3. Take the top `bundle.maxItems`.
 */
export function resolveBundleProducts<T extends BundleProductLike>(
  bundle: MedicalBundle,
  products: T[]
): T[] {
  if (!products.length || !bundle.keywords.length) return [];

  const lowerKeywords = bundle.keywords.map((k) => k.toLowerCase());

  // Step 1: filter + score
  const scored: Array<{ product: T; score: number }> = [];
  for (const p of products) {
    const haystacks = [
      p.name,
      p.composition,
      p.genericName,
      p.manufacturer,
      p.category?.name,
    ]
      .filter((s): s is string => Boolean(s && typeof s === "string"))
      .map((s) => s.toLowerCase());

    let score = 0;
    for (const kw of lowerKeywords) {
      if (haystacks.some((h) => h.includes(kw))) score += 1;
    }
    if (score > 0) scored.push({ product: p, score });
  }

  // Step 2: sort (in-stock first, then best-seller, then score, then displayOrder, then reviews)
  scored.sort((a, b) => {
    const aStock = num(a.product.stock) > 0 ? 1 : 0;
    const bStock = num(b.product.stock) > 0 ? 1 : 0;
    if (aStock !== bStock) return bStock - aStock;

    const aBest = a.product.isBestSeller ? 1 : 0;
    const bBest = b.product.isBestSeller ? 1 : 0;
    if (aBest !== bBest) return bBest - aBest;

    if (b.score !== a.score) return b.score - a.score;

    const aOrder = num(a.product.displayOrder);
    const bOrder = num(b.product.displayOrder);
    if (aOrder !== bOrder) return aOrder - bOrder;

    return num(b.product.reviewCount) - num(a.product.reviewCount);
  });

  return scored.slice(0, bundle.maxItems).map((s) => s.product);
}

/** Convenience: resolve every bundle, dropping bundles with 0 matching products. */
export function resolveAllBundles<T extends BundleProductLike>(products: T[]) {
  const out: Array<{ bundle: MedicalBundle; products: T[] }> = [];
  for (const bundle of MEDICAL_BUNDLES) {
    const items = resolveBundleProducts(bundle, products);
    if (items.length > 0) out.push({ bundle, products: items });
  }
  return out;
}
