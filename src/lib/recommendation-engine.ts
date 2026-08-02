// ============================================================================
// File: src/lib/recommendation-engine.ts
// Purpose: Pharmacy-specific recommendation engine. Given the current product
//          + the full active catalog, returns:
//            - related      (same category / generic / brand / complementary)
//            - frequently bought (complementary items, e.g. Dettol → bandages)
//            - alternatives (same generic name, different brand — usually
//                            cheaper/generic substitutes)
//
// Role: Central place where all "you might also like" logic lives. Used by
//       /api/catalog/recommendations/[productId]. Pure functions — no DB
//       access — so it can be unit-tested in isolation if needed.
//
// Scoring philosophy (medical relevance over commerce):
//   1. Same category      +5   (a cough syrup is more relevant to another
//                                cough syrup than to a vitamin)
//   2. Same generic name  +4   (other Paracetamol brands are direct
//                                alternatives — relevant for substitution)
//   3. Same brand         +2   (brand trust — minor boost)
//   4. Complementary      +6   (the BIG one — Dettol → bandages → cotton
//                                is a medically meaningful trio, not a
//                                random "more from this category" list)
//   5. Same Rx/OTC type   +1   (don't recommend Rx items to an OTC shopper
//                                and vice-versa)
//
// All scores are additive — a complementary item from the same category would
// score 5+6+1=12, beating a same-category-only item (5+1=6).
// ============================================================================

// Minimal product shape needed by the engine. Defined locally so this module
// has no runtime dependency on Prisma and can be imported by API routes /
// tests / scripts.
export interface RecommendationProductLike {
  id: string;
  name: string;
  slug?: string;
  composition?: string | null;
  genericName?: string | null;
  manufacturer?: string | null;
  prescriptionRequired?: boolean;
  isGeneric?: boolean;
  isBestSeller?: boolean;
  isFeatured?: boolean;
  isTrending?: boolean;
  stock?: number | string;
  displayOrder?: number | string;
  reviewCount?: number | string;
  avgRating?: unknown;
  categoryId?: string | null;
  brandId?: string | null;
  category?: { id?: string; name: string } | null;
  brand?: { id?: string; name: string } | null;
  mrp?: unknown;
  sellingPrice?: unknown;
  primaryImage?: string | null;
  images?: Array<{ imagePath: string; isPrimary?: boolean; altText?: string | null }>;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// COMPLEMENTARY_MAP
// ---------------------------------------------------------------------------
// Maps a generic-name / composition keyword (lowercased) to an array of
// complementary keywords. If the current product matches a KEY, any candidate
// product whose name / composition / genericName / category matches one of
// the corresponding VALUES receives +6 score — they're "useful together"
// (Dettol + bandages + cotton = a real first-aid combo).
//
// This is the medical-relevance core of the engine. Extend this map to teach
// the engine new complementary pairings — no code changes needed elsewhere.
// ---------------------------------------------------------------------------
export const COMPLEMENTARY_MAP: Record<string, string[]> = {
  // Pain & fever
  paracetamol: ["ibuprofen", "ors", "thermometer", "cold compress", "cough syrup"],
  ibuprofen: ["paracetamol", "ors", "antacid", "cold compress"],
  aspirin: ["paracetamol", "omeprazole", "ors"],

  // Antiseptics & wound care
  antiseptic: ["bandage", "cotton", "gauze", "medical tape", "micropore"],
  dettol: ["bandage", "cotton", "gauze", "medical tape"],
  savlon: ["bandage", "cotton", "gauze", "medical tape"],

  // Cold, cough, flu
  cough: ["thermometer", "steam inhaler", "tissue", "vapor rub", "honey"],
  cold: ["thermometer", "steam inhaler", "tissue", "vapor rub", "paracetamol"],
  antihistamine: ["cough syrup", "thermometer", "tissue", "vapor rub"],

  // Diabetes
  insulin: ["syringe", "glucometer", "test strip", "lancet", "alcohol swab"],
  glucometer: ["test strip", "lancet", "alcohol swab", "battery"],
  metformin: ["glucometer", "test strip", "lancet"],

  // BP / cardiac
  "blood pressure": ["bp monitor", "battery", "log book"],
  amlodipine: ["bp monitor", "omeprazole"],

  // Antibiotics — pair with probiotics (medical best practice: antibiotics
  // disrupt gut flora, so a probiotic helps restore it)
  antibiotic: ["probiotic", "ors", "antacid"],
  amoxicillin: ["probiotic", "ors", "antacid"],
  azithromycin: ["probiotic", "ors", "antacid"],
  ceftriaxone: ["probiotic", "ors", "antacid"],

  // Digestive
  antacid: ["probiotic", "ors", "enzyme"],
  ors: ["probiotic", "antacid", "thermometer"],
  protonix: ["antacid", "probiotic"],

  // Vitamins & women's health
  iron: ["folic acid", "vitamin c", "calcium"],
  "folic acid": ["iron", "calcium", "multivitamin"],
  calcium: ["vitamin d3", "magnesium", "iron"],

  // Skin
  sunscreen: ["moisturizer", "aloe vera", "antiseptic cream"],

  // Eye & ear
  "eye drop": ["cotton bud", "lubricant"],
  "ear drop": ["cotton bud", "wax solvent"],

  // Baby
  diaper: ["baby wipe", "baby lotion", "rash cream", "baby powder"],
  "baby wipe": ["diaper", "baby lotion", "rash cream"],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function num(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    try {
      return Number((value as { toNumber: () => number }).toNumber());
    } catch {
      return 0;
    }
  }
  return 0;
}

/** Lowercased haystack of all matchable text fields on a product. */
function productHaystack(p: RecommendationProductLike): string {
  return [
    p.name,
    p.composition,
    p.genericName,
    p.manufacturer,
    p.category?.name,
  ]
    .filter((s): s is string => Boolean(s && typeof s === "string"))
    .map((s) => s.toLowerCase())
    .join(" || ");
}

/** Find complementary keyword sets for the given product. Returns the union
 *  of all complementary keywords whose KEYS appear in the product text. */
function complementaryKeywordsFor(p: RecommendationProductLike): string[] {
  const text = productHaystack(p);
  const out: string[] = [];
  for (const [key, vals] of Object.entries(COMPLEMENTARY_MAP)) {
    if (text.includes(key)) {
      for (const v of vals) if (!out.includes(v)) out.push(v);
    }
  }
  return out;
}

/** True if the candidate text mentions any of the given keywords. */
function matchesAny(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(k));
}

// ---------------------------------------------------------------------------
// Main engine — getRelatedProducts
// ---------------------------------------------------------------------------

export interface ScoredProduct<T> {
  product: T;
  score: number;
}

/**
 * Rank candidate products by medical relevance to the current product.
 *
 * @param product  The current product (excluded from results).
 * @param allProducts  All active+public products to rank against.
 * @param limit  Max number of related products to return (default 8).
 */
export function getRelatedProducts<T extends RecommendationProductLike>(
  product: T,
  allProducts: T[],
  limit = 8
): T[] {
  const complementaryKws = complementaryKeywordsFor(product);
  const productGeneric = (product.genericName || "").toLowerCase().trim();

  const scored: ScoredProduct<T>[] = [];

  for (const candidate of allProducts) {
    if (candidate.id === product.id) continue;

    let score = 0;

    // 1. Same category (+5)
    if (
      product.categoryId &&
      candidate.categoryId &&
      product.categoryId === candidate.categoryId
    ) {
      score += 5;
    }

    // 2. Same generic name (+4) — e.g. other Paracetamol products
    const candidateGeneric = (candidate.genericName || "").toLowerCase().trim();
    if (productGeneric && candidateGeneric && productGeneric === candidateGeneric) {
      score += 4;
    }

    // 3. Same brand (+2)
    if (
      product.brandId &&
      candidate.brandId &&
      product.brandId === candidate.brandId
    ) {
      score += 2;
    }

    // 4. Complementary keywords (+6)
    if (complementaryKws.length > 0) {
      const candidateText = productHaystack(candidate);
      if (matchesAny(candidateText, complementaryKws)) {
        score += 6;
      }
    }

    // 5. Same prescription type (+1) — both Rx or both OTC
    const aRx = Boolean(product.prescriptionRequired);
    const bRx = Boolean(candidate.prescriptionRequired);
    if (aRx === bRx) score += 1;

    // Require a minimum signal — avoid recommending unrelated items just
    // because they share the same Rx/OTC type. (score=1 alone is too weak.)
    if (score < 2) continue;

    scored.push({ product: candidate, score });
  }

  // Sort: score desc, then displayOrder asc, then reviewCount desc.
  // Within the SAME score bucket, push in-stock items to the top.
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;

    const aStock = num(a.product.stock) > 0 ? 1 : 0;
    const bStock = num(b.product.stock) > 0 ? 1 : 0;
    if (aStock !== bStock) return bStock - aStock;

    const aOrder = num(a.product.displayOrder);
    const bOrder = num(b.product.displayOrder);
    if (aOrder !== bOrder) return aOrder - bOrder;

    return num(b.product.reviewCount) - num(a.product.reviewCount);
  });

  return scored.slice(0, limit).map((s) => s.product);
}

// ---------------------------------------------------------------------------
// Frequently Bought Together — complementary items (medical combo)
// ---------------------------------------------------------------------------

/**
 * Return the top `limit` products that are COMPLEMENTARY to the current
 * product (e.g. Dettol → bandages, cotton, gauze). This is what powers the
 * "Frequently Bought Together" section on the product page — now medically
 * relevant, not just same-category.
 *
 * Same scoring as `getRelatedProducts` but filtered to ONLY complementary
 * matches (score >= 6 from the complementary bonus alone).
 */
export function getFrequentlyBought<T extends RecommendationProductLike>(
  product: T,
  allProducts: T[],
  limit = 3
): T[] {
  const complementaryKws = complementaryKeywordsFor(product);
  if (complementaryKws.length === 0) return [];

  const out: T[] = [];
  for (const candidate of allProducts) {
    if (candidate.id === product.id) continue;
    const candidateText = productHaystack(candidate);
    if (matchesAny(candidateText, complementaryKws)) {
      out.push(candidate);
    }
    if (out.length >= limit * 3) break; // collect a pool, then sort
  }

  // Sort the pool: in-stock first, then best-seller, then displayOrder asc,
  // then reviewCount desc. Take `limit`.
  out.sort((a, b) => {
    const aStock = num(a.stock) > 0 ? 1 : 0;
    const bStock = num(b.stock) > 0 ? 1 : 0;
    if (aStock !== bStock) return bStock - aStock;

    const aBest = a.isBestSeller ? 1 : 0;
    const bBest = b.isBestSeller ? 1 : 0;
    if (aBest !== bBest) return bBest - aBest;

    const aOrder = num(a.displayOrder);
    const bOrder = num(b.displayOrder);
    if (aOrder !== bOrder) return aOrder - bOrder;

    return num(b.reviewCount) - num(a.reviewCount);
  });

  return out.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Generic Alternatives — same generic name, different brand, cheaper
// ---------------------------------------------------------------------------

/**
 * Return up to `limit` products with the SAME generic name as the current
 * product but a DIFFERENT brand. Sorted by sellingPrice ascending so the
 * cheapest generic substitute appears first.
 *
 * If the current product has no genericName, returns [].
 */
export function getGenericAlternatives<T extends RecommendationProductLike>(
  product: T,
  allProducts: T[],
  limit = 4
): T[] {
  const genericName = (product.genericName || "").toLowerCase().trim();
  if (!genericName) return [];

  const candidates = allProducts.filter((p) => {
    if (p.id === product.id) return false;
    const g = (p.genericName || "").toLowerCase().trim();
    if (g !== genericName) return false;
    // Different brand — prefer real alternatives, not the same product re-listed.
    if (product.brandId && p.brandId && product.brandId === p.brandId) return false;
    return true;
  });

  candidates.sort((a, b) => {
    // Cheapest first — most actionable substitution.
    const aPrice = num(a.sellingPrice);
    const bPrice = num(b.sellingPrice);
    if (aPrice !== bPrice) return aPrice - bPrice;

    const aStock = num(a.stock) > 0 ? 1 : 0;
    const bStock = num(b.stock) > 0 ? 1 : 0;
    if (aStock !== bStock) return bStock - aStock;

    return num(b.reviewCount) - num(a.reviewCount);
  });

  return candidates.slice(0, limit);
}
