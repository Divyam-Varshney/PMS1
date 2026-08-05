# PMS Recommendation Engine — Architecture Blueprint

> **Status:** Phase 75 — implemented and shipped to production.
> **Last updated:** 2026-07-30
> **Owner:** Customer storefront (Task ID 3 — full-stack-developer)

This document describes the PMS (Pradeep Medical Store) intelligent
recommendation engine: what it is, how it scores related products, the
complementary-keyword map that powers "Frequently Bought Together", and a
roadmap for future enhancements.

---

## 1. Why a Pharmacy-Specific Engine?

Generic e-commerce engines (Amazon, Flipkart) rank related products by
co-purchase frequency and user behaviour signals. For a **pharmacy** that
approach has three problems:

1. **Cold-start** — a new product has zero purchase history, so collaborative
   filtering recommends nothing.
2. **Medical relevance** — `paracetamol` and `cough syrup` may be bought
   together by people with the flu, but a co-purchase engine won't surface
   that pairing until thousands of customers have done it.
3. **Safety** — recommending an OTC vitamin on an Rx-insulin page (or
   vice-versa) is medically confusing.

The PMS engine solves all three with a **rule-based scoring system** grounded
in pharmacy domain knowledge:

- Same category / generic name / brand → trust signals
- A **complementary-keyword map** → medically relevant pairings
  (Dettol → bandages → cotton — a real first-aid trio)
- Same Rx/OTC type → safety guardrail

No machine learning required. The engine runs entirely in-memory against the
active catalog and resolves in milliseconds.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  /api/catalog/recommendations/[productId]  (Next.js route)      │
│                                                                 │
│  1. Single DB query — fetch ALL active+public products          │
│     (with brand, category, primary image)                       │
│  2. Find the current product by id OR slug                      │
│  3. Run the engine in-memory:                                   │
│     - getRelatedProducts(current, all, 8)                       │
│     - getFrequentlyBought (current, all, 3)                     │
│     - getGenericAlternatives(current, all, 4)                   │
│  4. okCached({ related, frequentlyBought, alternatives },       │
│               { sMaxage: 60, swr: 300 })                        │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  src/lib/recommendation-engine.ts  (pure functions, no DB)      │
│                                                                 │
│  - getRelatedProducts   — top 8 by medical-relevance score      │
│  - getFrequentlyBought  — top 3 complementary items             │
│  - getGenericAlternatives — top 4 same-generic, cheaper brands  │
│  - COMPLEMENTARY_MAP    — the domain-knowledge config           │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  src/components/customer/product-view.tsx                       │
│                                                                 │
│  - "Related products"           — 8-cell grid                   │
│  - "Frequently Bought Together" — combo deal card               │
│  - "Save more with generic options" — alternatives with badge   │
└─────────────────────────────────────────────────────────────────┘
```

The engine is **pure** (no DB access, no I/O) so it can be unit-tested in
isolation and reused by other routes (search, cart upsell, etc.) without
duplication.

---

## 3. Scoring System — `getRelatedProducts`

For each candidate product (every active+public product except the current
one), the engine computes an additive score:

| Factor                         | Score | Why it matters (medical relevance) |
| ------------------------------ | ----- | ---------------------------------- |
| Same category                  | +5    | A cough syrup is more relevant to another cough syrup than to a vitamin. The category captures the *therapeutic class* at a coarse level. |
| Same generic name              | +4    | Other Paracetamol brands are direct substitutes — relevant for "save more" substitution. The generic name is the INN (International Nonproprietary Name), the medically meaningful identifier. |
| Same brand                     | +2    | Brand trust — minor boost. Customers loyal to a brand (e.g. Dettol) often want to stay within it. |
| **Complementary keywords**     | **+6**| The big one. Dettol → bandages → cotton is a medically meaningful first-aid trio, not a random "more from this category" list. This is what makes the engine *pharmacy-specific*. |
| Same prescription type (Rx/OTC)| +1    | Don't recommend Rx items to an OTC shopper and vice-versa. Safety guardrail — prevents a customer from seeing prescription-only medicines on a vitamin page. |

A minimum score of **2** is required (so an unrelated product that only
matches the Rx/OTC flag isn't surfaced).

### Sort Order

Within the same score bucket, candidates are sorted by:

1. **In-stock first** — out-of-stock items are demoted (but still shown if
   they're the only relevant matches).
2. **displayOrder asc** — admin-controlled merchandising order.
3. **reviewCount desc** — popular products first.

This means a complementary item from the same category (score 5+6+1=12) will
always beat a same-category-only item (score 5+1=6), and within the
complementary bucket the in-stock best-seller wins.

---

## 4. The COMPLEMENTARY_MAP

This is the **medical-relevance core** of the engine. It maps a generic-name
or composition keyword (lowercased) to a list of complementary keywords. If
the current product's text (name, composition, genericName, manufacturer, or
category name) matches a KEY, any candidate whose text matches one of the
VALUES receives +6 score.

```typescript
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

  // Antibiotics — pair with probiotics (antibiotics disrupt gut flora;
  // a probiotic helps restore it — a real pharmacological best practice)
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
  antiseptic: ["bandage", "cotton", "gauze"],

  // Eye & ear
  "eye drop": ["cotton bud", "lubricant"],
  "ear drop": ["cotton bud", "wax solvent"],

  // Baby
  diaper: ["baby wipe", "baby lotion", "rash cream", "baby powder"],
  "baby wipe": ["diaper", "baby lotion", "rash cream"],
};
```

### Why these pairings?

| Pairing | Medical rationale |
| ------- | ----------------- |
| `paracetamol` → `ors` | Fever causes dehydration; ORS restores electrolytes. |
| `paracetamol` → `thermometer` | To monitor whether the fever is breaking. |
| `antiseptic` → `bandage` / `cotton` / `gauze` | The classic first-aid trio: clean the wound, then dress it. |
| `insulin` → `syringe` / `glucometer` / `test strip` | Diabetics need all four to inject and monitor. |
| `antibiotic` → `probiotic` | Antibiotics disrupt gut flora; probiotics restore it. This is standard pharmacy advice in India. |
| `iron` → `folic acid` | Anaemia treatment typically combines both — they're synergistic for RBC production. |
| `calcium` → `vitamin d3` | Vitamin D3 is required for calcium absorption. |
| `diaper` → `baby wipe` / `rash cream` | Diaper rash prevention trio. |
| `sunscreen` → `moisturizer` | Sunscreen can be drying; moisturizer maintains skin barrier. |
| `eye drop` → `cotton bud` | For cleaning the eye area before applying drops. |

### Extending the map

To teach the engine a new complementary pairing, **add a single line** to
`COMPLEMENTARY_MAP` in `src/lib/recommendation-engine.ts`. No other code
changes needed. The keys are matched case-insensitively against the product's
name / composition / genericName / manufacturer / category name.

---

## 5. Three Recommendation Sets

### 5.1 Related Products (`getRelatedProducts`)

- **Used by:** the "Related products" grid on the product page.
- **Limit:** 8 products.
- **Logic:** full scoring system (section 3). Returns the top-scored
  candidates that scored ≥ 2.

### 5.2 Frequently Bought Together (`getFrequentlyBought`)

- **Used by:** the "Frequently Bought Together" combo card on the product page.
- **Limit:** 3 products.
- **Logic:** candidates are filtered to ONLY complementary matches
  (i.e. they must match a complementary keyword from `COMPLEMENTARY_MAP`).
  This makes the combo *medically relevant* — Dettol + bandages + cotton is a
  real first-aid kit, not just "more antiseptics".
- The combo is rendered with the current product as the first tile (with a
  "This item" badge) plus the 3 complementary items.

### 5.3 Generic Alternatives (`getGenericAlternatives`)

- **Used by:** the "Save more with generic options" section on the product page.
- **Limit:** 4 products.
- **Logic:** products with the SAME `genericName` as the current product but
  a DIFFERENT brand. Sorted by `sellingPrice` ascending so the cheapest
  substitute appears first. If the current product has no `genericName`,
  returns `[]` (no section is rendered).
- Each alternative card shows a "Save Rs. X" badge if it's cheaper than the
  current product.

---

## 6. Caching Strategy

| Endpoint | Cache | Rationale |
| -------- | ----- | --------- |
| `/api/catalog/recommendations/[productId]` | `s-maxage=60, swr=300` | Recommendations change only when products or their fields change. 60s CDN cache + 5min stale-while-revalidate gives a great UX without serving stale data after a product rename / price change. |
| `/api/catalog/bundles` (related feature) | `s-maxage=300, swr=600` | Bundles change even more rarely — only when products are added/removed or their names change. 5min CDN cache + 10min SWR. |

Both endpoints fetch the full active catalog ONCE per request and compute
everything in-memory. For a typical pharmacy catalog (~500 products) this is
sub-millisecond — no need for materialized views or pre-computed tables.

---

## 7. Future Enhancements

The current engine is a strong V1 — medically relevant, cold-start safe,
and explainable (every recommendation has a clear reason). The next phases
can layer additional signals on top without rewriting the core:

### 7.1 Purchase History (co-purchase frequency)

Once we have enough orders, we can compute co-purchase counts and add them
as a scoring factor:

- `+3` if 5+ customers bought both products together in the last 30 days
- `+5` if 20+ customers did

This is classical collaborative filtering — but it **augments** the
medical-relevance score rather than replacing it, so the engine stays
cold-start safe.

### 7.2 Seasonal Demand

In India, demand for cough/cold/flu products spikes during monsoon and
winter. The engine could boost complementary items seasonally:

- July–September (monsoon): `+2` to cold/flu complementary keywords
- October–February (winter): `+2` to pain relief / vitamin C / moisturizer

Implementation: add a `seasonalBoost(keywords, month)` helper that returns a
score multiplier per keyword.

### 7.3 Prescription Context

When a customer uploads a prescription, we can read the medicines on it and
pre-build a "Frequently Bought Together" bundle for the entire prescription —
e.g. if the prescription lists an antibiotic, automatically suggest a
probiotic + ORS. This requires OCR or manual prescription parsing (already
partially implemented in the admin prescription workflow).

### 7.4 Customer Behaviour Signals

Track per-customer:

- **Wishlist additions** — if a customer wishlists 3 paracetamol products,
  show them the cheapest generic alternative proactively.
- **Cart abandonment** — if a customer leaves an Rx product in the cart
  without uploading a prescription, surface the prescription upload CTA.
- **Repeat purchases** — if a customer buys insulin monthly, surface a
  "subscribe & save" option 25 days after their last purchase.

### 7.5 Health Goals

Let customers set health goals (e.g. "diabetes management",
"weight loss", "prenatal care") in their profile. The engine can then:

- Pin a relevant bundle to the top of their home page.
- Boost complementary items aligned with their goal.
- Surface generic alternatives first (cost-conscious care).

### 7.6 Stock-Aware Recommendations

Currently the engine demotes out-of-stock items within a score bucket. A
future enhancement could **substitute** them: if the recommended complementary
item is out of stock, surface a same-generic alternative instead of just
hiding it.

### 7.7 A/B Testing the Scoring Weights

The current weights (+5, +4, +2, +6, +1) are domain-expert heuristics. We
could A/B test variations (e.g. +6 for same-category vs +5) and measure
click-through rate on the "Related products" grid. The scoring function is
a pure config — no code changes needed to swap weights.

### 7.8 Editorial Bundles

The medical bundles feature (Phase 75, `src/lib/medical-bundles.ts`) is the
**curated** counterpart to this engine — pharmacists hand-pick kits (First
Aid, Diabetes Care, etc.). A future admin UI could let pharmacists create
custom bundles and have them appear in both the home carousel and as a
"Recommended bundle" card on relevant product pages.

---

## 8. File Map

| File | Role |
| ---- | ---- |
| `src/lib/recommendation-engine.ts` | Pure engine: scoring + complementary map + 3 recommenders. No DB. |
| `src/app/api/catalog/recommendations/[productId]/route.ts` | API route: 1 DB query → in-memory engine → cached response. |
| `src/lib/medical-bundles.ts` | Curated medical bundle definitions + resolver (sister feature). |
| `src/app/api/catalog/bundles/route.ts` | API route for the curated bundles. |
| `src/components/customer/product-view.tsx` | Renders related / frequentlyBought / alternatives sections. |
| `src/components/customer/medical-bundles-section.tsx` | Home page bundle carousel. |
| `src/components/customer/bundle-view.tsx` | Dedicated /bundles view. |
| `src/components/customer/api.ts` | Query keys `qk.productRecommendations` + `qk.bundles` + TypeScript types. |

---

## 9. Glossary

- **Generic name (INN)** — International Nonproprietary Name of the active
  ingredient. E.g. "Paracetamol" is the generic name; "Crocin" and "Dolo"
  are brand names for the same generic.
- **Composition** — Active ingredient + strength. E.g. "Paracetamol 650mg".
- **Rx / OTC** — Prescription-only / Over-The-Counter. The
  `prescriptionRequired` flag on the Product model.
- **Complementary** — Two products that are medically useful together (not
  the same — that would be an *alternative*). E.g. insulin + syringe.
- **Alternative** — A product with the same active ingredient as the current
  one (different brand). Usually cheaper / generic.
