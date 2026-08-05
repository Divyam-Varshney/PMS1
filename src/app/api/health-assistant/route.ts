// ============================================================================
// File: src/app/api/health-assistant/route.ts
// Purpose: AI-powered pharmacy assistant chatbot endpoint.
//          Fully integrated with the PMS catalog: searches products (by name,
//          generic, composition, category name, and SYMPTOM-BASED keywords),
//          suggests alternative products (same generic name → same category),
//          checks medical bundles, answers FAQs instantly (no LLM cost), guides
//          customers to the Medicine Request flow when a product is unavailable,
//          nudges customers toward pharmacy features (Upload Prescription,
//          Health Bundles, Related Products, Frequently Bought Together), and
//          falls back to the Z.AI LLM for general pharmacy questions.
//
// Response priority (highest → lowest):
//   1. FAQ knowledge base  — instant, deterministic, zero API cost.
//   2. Product catalog     — exact + symptom + category-aware matches.
//   3. Alternatives        — same generic name → same category, with a
//                            plain-language explanation of WHY each is suitable.
//   4. Medical bundles     — relevant curated kits (when symptom/health query).
//   5. Medicine Request    — guide the customer to request an unavailable item.
//   6. General AI reply    — LLM handles everything else (with product context).
//
// Response shape: { ok: true, data: { reply, products, suggestions, action, faqQuestion? } }
//   - reply:       string  (always present — the assistant's text answer)
//   - products:    ProductSearchResult[] (empty if none)
//   - alternatives: ProductSearchResult[] (empty if none — populated when the
//                  exact product is out of stock or not found)
//   - suggestions: string[] (follow-up chip suggestions, may be empty)
//   - featureCues: string[] (PMS features to nudge the customer toward)
//   - action:      "product_results" | "medicine_request" | "bundle_results" | "faq_answer" | "general_info"
//
// Auth: The route is PUBLIC (no login required). Customers can ask questions
//       before signing up. This matches the existing widget behavior and the
//       store's "browse without account" UX.
//
// Phase 28.4: Now powered by the centralized knowledge layer
//             (src/lib/ai-knowledge-layer.ts) — system prompt, symptom map,
//             category keywords, and feature cues are all defined there.
// ============================================================================

import { ok, err, parseBody } from "@/lib/api";
import { aiChatCompletion } from "@/lib/ai-service";
import { db } from "@/lib/db";
import { PHARMACY_FAQS, matchFaq } from "@/lib/pharmacy-faq";
import { MEDICAL_BUNDLES } from "@/lib/medical-bundles";
import {
  buildAssistantSystemPrompt,
  expandQueryWithSymptoms,
  matchSymptoms,
  matchCategoryKeywords,
  buildAlternativeContext,
  pickFeatureCues,
  lookupBrandToGeneric,
  PHARMACY_FEATURE_CUES,
  type PharmacyFeature,
} from "@/lib/ai-knowledge-layer";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type AssistantAction =
  | "product_results"
  | "medicine_request"
  | "bundle_results"
  | "faq_answer"
  | "general_info";

export interface ProductSearchResult {
  id: string;
  name: string;
  slug: string;
  genericName: string | null;
  composition: string | null;
  manufacturer: string | null;
  shortDescription: string | null;
  mrp: number;
  sellingPrice: number;
  stock: number;
  prescriptionRequired: boolean;
  primaryImage: string | null;
  brandName: string | null;
  image: string | null;
  categoryId: string | null;
  categoryName: string | null;
}

export interface AssistantResponse {
  reply: string;
  products: ProductSearchResult[];
  alternatives?: ProductSearchResult[];
  suggestions: string[];
  action: AssistantAction;
  faqQuestion?: string;
  bundleIds?: string[];
  featureCues?: PharmacyFeature[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract a search query from the user's latest message.
 * Strips common question words ("what", "which", "is", "are", "the", "a", "an",
 * "medicine", "for", "tablet", etc.) so the catalog search is more accurate.
 */
function extractSearchQuery(message: string): string {
  const cleaned = message
    .toLowerCase()
    .replace(/[?.!]+$/g, "")
    .trim();

  // Common stopwords that don't add value for product search.
  const stopwords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "what", "which", "who", "whom", "whose", "when", "where", "why", "how",
    "do", "does", "did", "can", "could", "would", "should", "will", "shall",
    "i", "me", "my", "we", "our", "you", "your", "he", "she", "it", "they",
    "for", "of", "to", "in", "on", "at", "by", "with", "from", "about",
    "and", "or", "but", "not", "so", "than", "too", "very", "just",
    "medicine", "tablet", "tablets", "drug", "drugs", "pill", "pills",
    "please", "need", "want", "looking", "find", "give", "show", "tell",
    "have", "has", "had", "get", "got",
  ]);

  const tokens = cleaned
    .split(/[^a-z0-9]+/g)
    .filter((t) => t.length > 1 && !stopwords.has(t));

  // If everything got stripped (e.g. "what medicine?"), fall back to the
  // original cleaned message so we at least try something.
  return tokens.length > 0 ? tokens.join(" ") : cleaned;
}

/**
 * Decide whether the user's message looks like a product search (vs. a
 * general pharmacy question or greeting). We consider it a product search if:
 *   - It contains a medicine-like token (>= 4 chars, alphabetic), AND
 *   - It isn't clearly a FAQ-style question (handled by matchFaq before this),
 *     AND
 *   - It isn't a pure greeting / conversational utterance.
 */
function looksLikeProductSearch(message: string): boolean {
  const cleaned = message.toLowerCase().trim();
  if (cleaned.length < 3) return false;

  // Pure greetings / conversational utterances — don't trigger a catalog
  // search (the LLM can handle these gracefully).
  const conversational = /^(hi|hello|hey|yo|hiya|hey there|hello there|hi there|good (morning|afternoon|evening|night)|thanks|thank you|ty|thx|ok|okay|got it|sure|cool|nice|great|bye|goodbye|see ya|yes|no|yep|nope|help|please help|hi bot|hello bot)\b/i;
  if (conversational.test(cleaned)) return false;

  // FAQ-style questions usually start with these words — skip product search
  // for them since matchFaq() will have already handled them. BUT allow
  // "do you have X" / "is X available" patterns through (they're product
  // searches phrased as questions).
  if (/^(how|what|when|where|why|who|do|does|can|is|are)\b/.test(cleaned)) {
    if (/\b(have|stock|available|sell|carry|give|find|show)\b/.test(cleaned)) return true;
    return false;
  }
  return true;
}

/**
 * Search the product catalog. Returns up to `limit` active, public products
 * matching the query across name, genericName, composition, description,
 * manufacturer, AND category name (so "pain relief" matches products in the
 * Pain Relief category even if no product name contains that phrase).
 *
 * The query is also expanded with symptom-based keywords (e.g. "I have fever"
 * is enriched with "paracetamol crocin dolo thermometer") so symptom queries
 * return relevant products instead of empty results.
 */
async function searchCatalogProducts(
  rawQuery: string,
  limit = 5
): Promise<ProductSearchResult[]> {
  if (!rawQuery || rawQuery.trim().length < 2) return [];

  // Expand the query with symptom-based product keywords (e.g. "fever" → also
  // search for "paracetamol"). The original query is preserved so a search
  // like "paracetamol for fever" still matches the exact name.
  const expanded = expandQueryWithSymptoms(rawQuery);
  // Also include category-name keywords (e.g. "pain relief" → expand with
  // "paracetamol ibuprofen diclofenac" via CATEGORY_KEYWORDS).
  const categoryMatches = matchCategoryKeywords(expanded);

  // The base OR clauses search by name, generic, composition, description,
  // manufacturer. We ALSO search by category name (joined via the `category`
  // relation) so that "pain relief" matches products in the Pain Relief
  // category even when no individual product name contains that phrase.
  const tokens = expanded
    .split(/[^a-z0-9]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  // Build the OR clauses — use the expanded tokens to search each text field.
  // This handles multi-word queries like "paracetamol syrup for child".
  const orClauses: Array<Record<string, unknown>> = [];

  // Always include the FULL expanded query as a phrase (best for multi-word
  // brand/product names like "Crocin Advance").
  orClauses.push({ name: { contains: expanded, mode: "insensitive" } });
  orClauses.push({ genericName: { contains: expanded, mode: "insensitive" } });
  orClauses.push({ composition: { contains: expanded, mode: "insensitive" } });
  orClauses.push({ shortDescription: { contains: expanded, mode: "insensitive" } });
  orClauses.push({ manufacturer: { contains: expanded, mode: "insensitive" } });

  // Add per-token searches so "Crocin 500" still matches "Crocin" + "500".
  for (const tok of tokens) {
    orClauses.push({ name: { contains: tok, mode: "insensitive" } });
    orClauses.push({ genericName: { contains: tok, mode: "insensitive" } });
    orClauses.push({ composition: { contains: tok, mode: "insensitive" } });
  }

  // Category-name search — match products whose category name contains the
  // query OR any of the matched category keywords from CATEGORY_KEYWORDS.
  if (categoryMatches.length > 0) {
    orClauses.push({
      category: {
        name: { contains: categoryMatches[0], mode: "insensitive" },
      },
    });
  }

  const products = await db.product.findMany({
    where: {
      status: "active",
      visibility: "public",
      OR: orClauses,
    },
    take: limit,
    orderBy: [{ stock: "desc" }, { isBestSeller: "desc" }, { reviewCount: "desc" }],
    include: {
      brand: { select: { name: true } },
      category: { select: { id: true, name: true } },
      images: {
        where: { isPrimary: true },
        take: 1,
        select: { imagePath: true },
      },
    },
  });

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    genericName: p.genericName,
    composition: p.composition,
    manufacturer: p.manufacturer,
    shortDescription: p.shortDescription,
    mrp: Number(p.mrp),
    sellingPrice: Number(p.sellingPrice),
    stock: p.stock,
    prescriptionRequired: p.prescriptionRequired,
    primaryImage: p.primaryImage,
    brandName: p.brand?.name ?? null,
    image: p.images[0]?.imagePath ?? p.primaryImage ?? null,
    categoryId: p.category?.id ?? null,
    categoryName: p.category?.name ?? null,
  }));
}

/**
 * Find alternative products for a query that didn't match (or matched only
 * out-of-stock products). Strategy:
 *   1. Extract the most likely "generic name" hint from the query.
 *   2. Search the catalog for products with that generic name (excluding the
 *      out-of-stock ones already shown to the customer).
 *   3. If still empty, search the same category.
 *   4. If still empty, return [] — the assistant will then suggest the
 *      Medicine Request form.
 *
 * Note on admin-defined ProductRelationships:
 *   The PMS schema does not currently have a ProductRelationship table. When
 *   one is added in the future, this function should ALSO consult
 *   `db.productRelationship.findMany({ where: { type: "alternative",
 *   productId: ... } })` to surface admin-curated alternatives first. For now,
 *   we rely on the generic-name + category fallback, which is what the
 *   existing /api/catalog/recommendations engine already uses.
 */
async function findAlternativeProducts(
  query: string,
  excludeIds: string[] = [],
  limit = 3
): Promise<ProductSearchResult[]> {
  if (!query || query.trim().length < 2) return [];
  const lower = query.toLowerCase();

  // Step 1: try to find any product that matches the query loosely — that
  // gives us the generic name + category to search for alternatives. This is
  // important when the user asked for "Crocin" and we have 0 in stock — we
  // still want to find the generic-name "Paracetamol" matches.
  const seed = await db.product.findFirst({
    where: {
      OR: [
        { name: { contains: lower, mode: "insensitive" } },
        { genericName: { contains: lower, mode: "insensitive" } },
        { composition: { contains: lower, mode: "insensitive" } },
        { shortDescription: { contains: lower, mode: "insensitive" } },
      ],
    },
    select: { genericName: true, categoryId: true, category: { select: { id: true, name: true } } },
  });

  // Build exclusion list (so we don't re-show out-of-stock items).
  const excludeFilter = excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {};

  // Step 2: same generic name (excluding the seed itself + already-shown items)
  // We also fall back to the BRAND_TO_GENERIC map — e.g. if the customer asked
  // for "Tylenol" (which we don't carry), we look up that Tylenol = Paracetamol
  // and search our catalog for paracetamol products.
  const genericHints = new Set<string>();
  if (seed?.genericName) genericHints.add(seed.genericName);
  for (const g of lookupBrandToGeneric(lower)) genericHints.add(g);

  if (genericHints.size > 0) {
    const sameGeneric = await db.product.findMany({
      where: {
        status: "active",
        visibility: "public",
        stock: { gt: 0 },
        OR: Array.from(genericHints).map((g) => ({
          genericName: { equals: g, mode: "insensitive" },
        })),
        ...excludeFilter,
      },
      take: limit,
      orderBy: [{ isGeneric: "desc" }, { sellingPrice: "asc" }, { reviewCount: "desc" }],
      include: {
        brand: { select: { name: true } },
        category: { select: { id: true, name: true } },
        images: { where: { isPrimary: true }, take: 1, select: { imagePath: true } },
      },
    });
    if (sameGeneric.length > 0) {
      return sameGeneric.map(mapToResult);
    }
  }

  // Step 3: same category
  if (seed?.categoryId) {
    const sameCategory = await db.product.findMany({
      where: {
        status: "active",
        visibility: "public",
        stock: { gt: 0 },
        categoryId: seed.categoryId,
        ...excludeFilter,
      },
      take: limit,
      orderBy: [{ isBestSeller: "desc" }, { sellingPrice: "asc" }, { reviewCount: "desc" }],
      include: {
        brand: { select: { name: true } },
        category: { select: { id: true, name: true } },
        images: { where: { isPrimary: true }, take: 1, select: { imagePath: true } },
      },
    });
    if (sameCategory.length > 0) {
      return sameCategory.map(mapToResult);
    }
  }

  // Step 4: no safe alternative found — return [] so the route can suggest
  // the Medicine Request form / consult-a-pharmacist message.
  return [];
}

/** Map a Prisma product row to the API response shape (used by both helpers). */
function mapToResult(p: any): ProductSearchResult {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    genericName: p.genericName,
    composition: p.composition,
    manufacturer: p.manufacturer,
    shortDescription: p.shortDescription,
    mrp: Number(p.mrp),
    sellingPrice: Number(p.sellingPrice),
    stock: p.stock,
    prescriptionRequired: p.prescriptionRequired,
    primaryImage: p.primaryImage,
    brandName: p.brand?.name ?? null,
    image: p.images?.[0]?.imagePath ?? p.primaryImage ?? null,
    categoryId: p.category?.id ?? null,
    categoryName: p.category?.name ?? null,
  };
}

/**
 * Find medical bundles whose keywords overlap with the query tokens.
 * Returns up to 3 bundle IDs (sorted by match count, desc).
 */
function searchBundles(query: string): string[] {
  if (!query || query.trim().length < 2) return [];
  const q = query.toLowerCase();
  const scored: Array<{ bundleId: string; score: number }> = [];
  for (const bundle of MEDICAL_BUNDLES) {
    let score = 0;
    for (const kw of bundle.keywords) {
      if (q.includes(kw.toLowerCase())) score += 1;
    }
    if (score > 0) scored.push({ bundleId: bundle.id, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map((s) => s.bundleId);
}

/**
 * Build a compact string summary of the matched products to inject into the
 * LLM context, so the model can reference them by name/price in its reply.
 */
function buildProductContext(products: ProductSearchResult[]): string {
  if (products.length === 0) return "";
  const lines = products.map((p, i) => {
    const price = `₹${p.sellingPrice}`;
    const rx = p.prescriptionRequired ? " [Rx required]" : "";
    const stock = p.stock > 0 ? "in stock" : "out of stock";
    const brand = p.brandName ? ` (${p.brandName})` : "";
    const generic = p.genericName ? ` — generic: ${p.genericName}` : "";
    return `${i + 1}. ${p.name}${brand} — ${price}, ${stock}${rx}${generic}`;
  });
  return `\n\nAvailable products in our catalog (reference these in your reply):\n${lines.join("\n")}`;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    const body = await parseBody<{ messages: ChatMessage[]; query?: string }>(req);

    // Support both multi-message chat and a single `query` field.
    let messages: ChatMessage[];
    if (body?.messages && Array.isArray(body.messages) && body.messages.length > 0) {
      messages = body.messages;
    } else if (body?.query) {
      messages = [{ role: "user", content: body.query }];
    } else {
      return err("No message provided", 400);
    }

    // Keep only the last 8 messages to stay within token limits.
    const recentMessages = messages.slice(-8);

    // Validate message content.
    for (const m of recentMessages) {
      if (!m.content || typeof m.content !== "string" || m.content.length > 1000) {
        return err("Invalid message format", 400);
      }
    }

    // The latest user message drives the search.
    const lastUserMsg = [...recentMessages].reverse().find((m) => m.role === "user");
    const userQuery = lastUserMsg?.content?.trim() ?? "";

    // -------------------------------------------------------------------
    // Priority 1: FAQ knowledge base — instant, no LLM call, no DB hit.
    // -------------------------------------------------------------------
    if (userQuery) {
      const faqMatch = matchFaq(userQuery);
      if (faqMatch) {
        const suggestions = pickFaqSuggestions(faqMatch.faq);
        return ok<AssistantResponse>({
          reply: faqMatch.faq.answer,
          products: [],
          suggestions,
          action: "faq_answer",
          faqQuestion: faqMatch.faq.question,
        });
      }
    }

    // Detect symptom phrases for later feature-cue selection.
    const symptomMatches = matchSymptoms(userQuery);
    const hasSymptoms = symptomMatches.length > 0;
    const recommendDoctor =
      hasSymptoms && symptomMatches.some((m) => m.recommendDoctor);

    // -------------------------------------------------------------------
    // Priority 2: Product catalog search (enriched with symptom + category
    // keywords).
    // -------------------------------------------------------------------
    let products: ProductSearchResult[] = [];
    let bundleIds: string[] = [];
    if (userQuery && looksLikeProductSearch(userQuery)) {
      const searchQuery = extractSearchQuery(userQuery);
      // Run product + bundle search in parallel — they hit different sources
      // (DB vs. the in-memory MEDICAL_BUNDLES constant).
      const [prodResults, bundleResults] = await Promise.all([
        searchCatalogProducts(searchQuery || userQuery, 5),
        Promise.resolve(searchBundles(searchQuery || userQuery)),
      ]);
      products = prodResults;
      bundleIds = bundleResults;
    }

    // -------------------------------------------------------------------
    // Priority 3: ALTERNATIVES — if any matched product is out of stock, OR
    // if no products matched at all but the query looked like a product
    // search, find alternatives (same generic name → same category).
    // -------------------------------------------------------------------
    let alternatives: ProductSearchResult[] = [];
    const outOfStockIds = products.filter((p) => p.stock <= 0).map((p) => p.id);
    const hasOutOfStock = outOfStockIds.length > 0;

    if (products.length === 0 && userQuery && looksLikeProductSearch(userQuery)) {
      // No products matched — try to find alternatives (e.g. user asked for
      // "Crocin" and we have it in stock under a different brand, or we have
      // the generic "Paracetamol").
      const searchQuery = extractSearchQuery(userQuery);
      alternatives = await findAlternativeProducts(searchQuery || userQuery, [], 3);
    } else if (hasOutOfStock) {
      // Some matched products are out of stock — find alternatives based on
      // the FIRST out-of-stock product's generic name / category.
      const seedProduct = products.find((p) => p.stock <= 0);
      if (seedProduct) {
        const altQuery =
          seedProduct.genericName || seedProduct.name || extractSearchQuery(userQuery);
        alternatives = await findAlternativeProducts(altQuery, outOfStockIds, 3);
      }
    }

    // -------------------------------------------------------------------
    // Priority 4/5/6: Build the AI prompt based on what we found.
    // -------------------------------------------------------------------
    const productContext = buildProductContext(products);
    const altContext = buildAlternativeContext(alternatives, {
      genericName: products[0]?.genericName ?? alternatives[0]?.genericName,
      categoryId: products[0]?.categoryId ?? alternatives[0]?.categoryId,
      categoryName: products[0]?.categoryName ?? alternatives[0]?.categoryName,
    });

    let contextNote = "";
    let action: AssistantAction;

    const hasRxProduct =
      products.some((p) => p.prescriptionRequired) ||
      alternatives.some((p) => p.prescriptionRequired);

    if (products.length > 0) {
      action = "product_results";
      contextNote =
        productContext +
        (alternatives.length > 0 ? altContext : "") +
        `\n\nThe customer asked: "${userQuery}". ` +
        `The products above match their query. Recommend the most relevant one(s) from this list in your reply — reference them by name and price. ` +
        (hasOutOfStock
          ? `Some matched products are OUT OF STOCK — mention the alternatives provided below if they're a good substitute. `
          : "") +
        (hasRxProduct
          ? `One or more of these products requires a prescription — remind the customer to upload a valid prescription. `
          : "") +
        `If none are a perfect match, mention that and suggest the closest alternative. ` +
        `Do NOT mention products that aren't in the lists above.`;
    } else if (alternatives.length > 0) {
      // No direct matches but we found alternatives — surface them and ask
      // the customer if any would work.
      action = "product_results";
      contextNote =
        altContext +
        `\n\nThe customer asked: "${userQuery}". ` +
        `We could NOT find an exact match in our catalog, but the alternatives above may be suitable. ` +
        `Present them to the customer with name, price, and a one-line reason WHY each is a suitable substitute (same active ingredient / same therapeutic category). ` +
        `If the customer wants the exact medicine they originally asked for, suggest the "Request a Medicine" form.`;
    } else if (bundleIds.length > 0) {
      // Bundles matched even though no individual products did — surface the
      // bundle CTA instead of telling the customer to request a new medicine.
      // (e.g. "show me diabetes care kits" → suggest the Diabetes Care bundle.)
      action = "bundle_results";
      contextNote =
        `\n\nThe customer asked: "${userQuery}". ` +
        `We found relevant health bundle(s) in our catalog: ${bundleIds.join(", ")}. ` +
        `Tell the customer that we have curated health bundles they might find useful, ` +
        `and they can browse them on the Health Bundles page (a button is shown below the chat ` +
        `to take them there). Keep your reply brief and helpful.`;
    } else if (userQuery && looksLikeProductSearch(userQuery)) {
      // No products found AND no bundles matched AND it looked like a product
      // search → guide to the Medicine Request form.
      action = "medicine_request";
      contextNote =
        `\n\nThe customer asked: "${userQuery}". ` +
        `We searched our catalog but could NOT find any matching product, and could not determine a safe alternative. ` +
        `Politely tell the customer that this medicine is not currently in our catalog, ` +
        `and guide them to use the "Request a Medicine" feature — they can list the ` +
        `medicine and our pharmacist will check availability and contact them with price ` +
        `and delivery details. ` +
        (hasSymptoms
          ? `The customer described symptoms, so also recommend consulting a doctor for a proper diagnosis. `
          : "") +
        `Keep it brief and helpful.`;
    } else {
      // General pharmacy question — let the LLM handle it freely.
      action = "general_info";
      contextNote = hasSymptoms
        ? `\n\nThe customer's query mentions symptoms: ${symptomMatches
            .map((m) => m.symptoms[0])
            .join(", ")}. Provide helpful general information AND recommend consulting a doctor if symptoms persist beyond 3 days, worsen, or affect a child, elderly person, or pregnant woman.`
        : "";
    }

    // -------------------------------------------------------------------
    // Call the LLM with the system prompt + conversation + product context.
    // -------------------------------------------------------------------
    const systemPrompt = buildAssistantSystemPrompt();
    let reply: string;
    try {
      const result = await aiChatCompletion(
        [
          { role: "system", content: systemPrompt + contextNote },
          ...recentMessages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ],
        { temperature: 0.6, max_tokens: 500 }
      );
      reply = result.content || "";
    } catch (aiErr) {
      console.error("[health-assistant] AI call failed:", aiErr);
      // If the AI fails but we have product results, still return them with a
      // sensible fallback message — don't leave the customer hanging.
      if (products.length > 0) {
        reply =
          `I found ${products.length} product${products.length === 1 ? "" : "s"} matching your search. ` +
          (alternatives.length > 0
            ? `I also found ${alternatives.length} alternative${alternatives.length === 1 ? "" : "s"} you might consider. `
            : "") +
          `Tap any product card below to view details, or use the search bar for more options.`;
      } else if (alternatives.length > 0) {
        reply =
          `I couldn't find an exact match, but I found ${alternatives.length} alternative${alternatives.length === 1 ? "" : "s"} that may be suitable. ` +
          `Tap any product card below to view details, or use the "Request a Medicine" form to source the exact item.`;
      } else if (action === "medicine_request") {
        reply =
          `I couldn't find that medicine in our catalog right now. ` +
          `You can request it via our "Request a Medicine" form — our pharmacist ` +
          `will check availability and get back to you with price and delivery details.`;
      } else {
        reply =
          `I'm having trouble generating a response right now. ` +
          `Please try again in a moment, or call us at +91 99999 99999 for immediate help.`;
      }
    }

    // -------------------------------------------------------------------
    // Feature cues — guide the customer toward the right PMS feature.
    // -------------------------------------------------------------------
    const featureCues = pickFeatureCues(action, {
      hasProducts: products.length > 0 || alternatives.length > 0,
      hasRxProduct,
      hasOutOfStock,
      hasSymptoms,
      isHealthQuery: action === "general_info",
    });
    if (recommendDoctor && !featureCues.includes("consult_doctor")) {
      featureCues.push("consult_doctor");
    }

    // -------------------------------------------------------------------
    // Suggestions (follow-up chips) — pick based on the action.
    // -------------------------------------------------------------------
    const suggestions =
      action === "product_results"
        ? alternatives.length > 0
          ? [
              "Show me more options",
              "Why is this an alternative?",
              "Do I need a prescription?",
            ]
          : [
              "Show me more options",
              "Are there generic alternatives?",
              "Do I need a prescription?",
            ]
        : action === "medicine_request"
          ? ["Open Medicine Request", "Upload prescription instead", "Browse all products"]
          : action === "bundle_results"
            ? ["View all health bundles", "What's in the First Aid Kit?", "Delivery charges?"]
            : hasSymptoms
              ? ["Suggest a medicine", "Show health bundles", "When should I see a doctor?"]
              : ["Delivery charges?", "How to track my order?", "Upload prescription"];

    const response: AssistantResponse = {
      reply,
      products,
      suggestions,
      action,
      ...(alternatives.length > 0 ? { alternatives } : {}),
      ...(bundleIds.length > 0 ? { bundleIds } : {}),
      ...(featureCues.length > 0 ? { featureCues } : {}),
    };

    return ok<AssistantResponse>(response);
  } catch (e) {
    console.error("[health-assistant] Error:", e);
    return err("Assistant is temporarily unavailable. Please try again.", 500);
  }
}

// ---------------------------------------------------------------------------
// Suggestion chip helpers
// ---------------------------------------------------------------------------

/** Pick 2–3 follow-up suggestion chips based on which FAQ was matched. */
function pickFaqSuggestions(faq: { keywords: string[]; question: string }): string[] {
  // Find the FAQ entries that share keywords with the matched FAQ — those are
  // the most likely "next questions" the customer will have.
  const related = PHARMACY_FAQS.filter(
    (f) => f.question !== faq.question && f.keywords.some((k) => faq.keywords.includes(k))
  ).slice(0, 2);

  const chips = related.map((f) => f.question);

  // Always offer one general follow-up so the customer isn't stuck.
  chips.push("Talk to a pharmacist");

  return chips.slice(0, 3);
}

// Re-export the feature-cue metadata so the frontend widget can render the
// cues without having to duplicate the labels.
export { PHARMACY_FEATURE_CUES };
