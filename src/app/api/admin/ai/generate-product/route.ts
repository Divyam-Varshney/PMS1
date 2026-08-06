// ============================================================================
// File: src/app/api/admin/ai/generate-product/route.ts
// Purpose: AI Product Generator — ACCURACY-FIRST approach.
//
//          Workflow:
//            1. Admin enters product title (e.g., "Monocef 250 Injection")
//            2. API performs WEB SEARCH on trusted pharmacy sites (1mg, Apollo,
//               PharmEasy, Netmeds, Amazon) to find real product data
//            3. Web search results are fed to the AI as verified context
//            4. AI generates structured JSON using ONLY the verified context
//               (not its own potentially-incorrect knowledge)
//            5. Brand/category matching against DB
//            6. Returns generated fields for admin review
//
//          This "search-then-generate" approach ensures accuracy by grounding
//          the AI in real pharmacy data before generating any content.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, parseBody } from "@/lib/api";
import { aiChatCompletion } from "@/lib/ai-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // web search + AI generation can take 20-40s

interface SearchResult {
  url: string;
  name: string;
  snippet: string;
  host_name: string;
}

export async function POST(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const body = await parseBody<{ title?: string }>(req);
  if (!body?.title?.trim()) {
    return err("Product title is required", 400);
  }

  const title = body.title.trim();

  try {
    // ── Step 1: Web search (Z.AI SDK only — optional enhancement) ──
    // The web_search function is Z.AI-specific. For other providers (Groq,
    // Gemini, OpenAI), we skip web search and rely on the AI model's own
    // pharmaceutical knowledge. This is wrapped in try/catch so it never
    // blocks the AI generation step.
    let searchContext = "";
    let relevantResults: any[] = [];

    try {
      const { getZaiInstance } = await import("@/lib/ai-service");
      const zai = await getZaiInstance();

      // Search 1: General pharmacy search (broad)
      const searchQuery1 = `${title} medicine India pharmacy 1mg apollo pharmeasy`;
      const searchResults1 = await zai.functions.invoke("web_search", {
        query: searchQuery1,
        num: 10,
      });

      // Search 2: Price-specific search
      const searchQuery2 = `${title} price MRP India buy online`;
      const searchResults2 = await zai.functions.invoke("web_search", {
        query: searchQuery2,
        num: 5,
      });

      // Combine and deduplicate search results
      const allResults = [
        ...(Array.isArray(searchResults1) ? searchResults1 : []),
        ...(Array.isArray(searchResults2) ? searchResults2 : []),
      ];

      // Filter to pharmacy-relevant sources
      const pharmacySources = ["1mg.com", "apollopharmacy", "pharmeasy", "netmeds", "amazon", "practo", "medplus"];
      const pharmacyResults = allResults.filter((r: any) => {
        const host = (r.host_name || "").toLowerCase();
        return pharmacySources.some((src) => host.includes(src));
      });

      // Use pharmacy results if found, otherwise use all results
      relevantResults = pharmacyResults.length > 0 ? pharmacyResults : allResults.slice(0, 8);

      // Format search context for the AI
      searchContext = relevantResults
        .map((r: any, i: number) => {
          return `[${i + 1}] Source: ${r.host_name}
Title: ${r.name}
Details: ${r.snippet}`;
        })
        .join("\n\n");
    } catch (searchError: any) {
      // Web search is Z.AI-only. If the provider is Groq/Gemini/OpenAI,
      // getZaiInstance() will fail. That's OK — we continue without search
      // context and the AI generates content from its own knowledge.
      console.log("[ai/generate-product] Web search skipped:", searchError?.message?.slice(0, 80));
    }

    // ── Step 2: Fetch existing brands + categories for matching ──
    const [brands, categories] = await Promise.all([
      db.brand.findMany({ select: { id: true, name: true }, where: { status: "active" } }),
      db.category.findMany({ select: { id: true, name: true }, where: { status: "active" } }),
    ]);

    const brandList = brands.map((b) => b.name).join(", ");
    const categoryList = categories.map((c) => c.name).join(", ");

    // ── Step 3: AI generation with VERIFIED web search context ──
    const prompt = `You are a senior pharmacy content writer and licensed pharmacist creating accurate, professional product information for an Indian online pharmacy (Pradeep Medical Store, Mathura). Your content quality must match what customers find on trusted Indian pharmacy sites like 1mg (Tata 1mg), Apollo Pharmacy, and PharmEasy.

IMPORTANT: You MUST use the web search results below as your PRIMARY source of truth. Only use your own pharmaceutical knowledge to fill gaps the search results don't cover. Never contradict the search results. If the search results are silent on a section, write a brief, accurate generic answer (e.g., standard storage guidance for tablets) rather than inventing product-specific claims.

Product Title entered by admin: "${title}"

=== WEB SEARCH RESULTS (from trusted Indian pharmacy sources) ===
${searchContext || "No search results found. Use your pharmaceutical knowledge carefully — do NOT invent product-specific facts."}

=== EXISTING BRANDS IN DATABASE ===
${brandList || "none"}

=== EXISTING CATEGORIES IN DATABASE ===
${categoryList || "none"}

=== PHARMACY FIELD DEFINITIONS (CRITICAL — read carefully) ===
- **productName**: The commercial/brand name of the medicine as sold (e.g., "Monocef", "Dolo", "Crocin", "Azithral"). This is NOT the generic name.
- **brandName**: The company that markets/sells this product (e.g., "Aristo", "Sun Pharma", "Cipla", "GSK"). This is the marketing company, NOT the product name.
- **manufacturer**: The company that manufactures the product. Often same as brand, but can differ (e.g., manufactured by "Sun Pharma" but marketed by "Aristo").
- **genericName**: The generic/salt name of the active ingredient (e.g., "Ceftriaxone", "Paracetamol", "Azithromycin"). This is the INN (International Nonproprietary Name).
- **composition**: The active ingredient(s) with strength (e.g., "Ceftriaxone 250mg", "Paracetamol 650mg", "Amoxicillin 500mg + Clavulanic Acid 125mg").
- **strength**: The dosage strength (e.g., "250mg", "500mg", "650mg", "1000mg").
- **dosageForm**: The form of the medicine (e.g., "Tablet", "Capsule", "Injection", "Syrup", "Cream", "Drops", "Inhaler").
- **packSize**: How many units per pack (e.g., "1 vial", "15 tablets", "30 capsules", "100 ml").
- **unit**: The packaging unit (e.g., "Vial", "Strip", "Bottle", "Tube", "Pack", "Piece").
- **categoryName**: The therapeutic category (e.g., "Antibiotics", "Pain Relief", "Diabetes Care", "OTC Medicines", "Prescription Medicines").

=== EXAMPLES (to prevent field confusion) ===
Example 1: "Monocef 250 Injection"
- productName: "Monocef 250 Injection" (NOT "Ceftriaxone")
- brandName: "Aristo" (the company that markets Monocef)
- manufacturer: "Aristo Pharmaceuticals"
- genericName: "Ceftriaxone"
- composition: "Ceftriaxone 250mg"
- dosageForm: "Injection"
- unit: "Vial"
- packSize: "1 vial"

Example 2: "Dolo 650 Tablet"
- productName: "Dolo 650 Tablet"
- brandName: "Sun Pharma" (markets Dolo brand)
- manufacturer: "Sun Pharmaceutical Industries"
- genericName: "Paracetamol"
- composition: "Paracetamol 650mg"
- dosageForm: "Tablet"
- unit: "Strip"
- packSize: "15 tablets"

Example 3: "Augmentin 625 Tablet"
- productName: "Augmentin 625 Tablet"
- brandName: "GSK"
- manufacturer: "GlaxoSmithKline"
- genericName: "Amoxicillin + Clavulanic Acid"
- composition: "Amoxicillin 500mg + Clavulanic Acid 125mg"
- dosageForm: "Tablet"
- unit: "Strip"
- packSize: "10 tablets"

=== CONTENT QUALITY STANDARDS (CRITICAL) ===
The "description" field MUST be rich, structured HTML that resembles what customers see on 1mg / Apollo Pharmacy / PharmEasy product pages. Use semantic HTML tags only — <h3> for section headings, <p> for paragraphs, <ul><li> for bullet lists. NO inline styles, NO markdown, NO class attributes.

The description MUST contain the following sections in this exact order. Each section starts with an <h3> heading:

1. **<h3>About the medicine</h3>** — 1 short paragraph (2–3 sentences): what this medicine is, its generic name + strength, who markets it, and its dosage form. Plain English a non-medical customer can understand.

2. **<h3>Uses / What it is used for</h3>** — A <ul> list of 3–6 bullet points describing the conditions/symptoms this medicine is commonly used to treat (e.g., "Bacterial infections of the respiratory tract", "Fever and mild to moderate pain"). Use the search results as the source. Each bullet should be specific and clinically accurate.

3. **<h3>How it works</h3>** — 1 short paragraph (2–3 sentences) explaining the mechanism of action in simple, non-jargon language. (e.g., "Ceftriaxone is a cephalosporin antibiotic. It kills bacteria by preventing them from forming the protective cell wall they need to survive.") Do NOT use overly technical pharmacology terms a layperson wouldn't understand.

4. **<h3>Key benefits</h3>** — A <ul> list of 2–4 bullet points highlighting the practical benefits to the patient (e.g., "Fast relief from fever and body ache", "Broad-spectrum coverage against common bacteria", "Well-tolerated by most adults when taken as prescribed").

5. **<h3>How to take</h3>** — 1 short paragraph (2–3 sentences) of GENERAL guidance only. NEVER specify a dose (e.g., "take 2 tablets twice daily"). Instead say things like "Take this medicine in the dose and duration as advised by your doctor", "Swallow the tablet whole with water; do not crush or chew", "It can be taken with or without food", "For injections, a qualified healthcare professional will administer it". Always end with: "Do not self-medicate or change the dose without consulting your doctor."

6. **<h3>Common side effects</h3>** — A <ul> list of 3–6 well-known, mild side effects from verified pharmacy sources (e.g., "Nausea or vomiting", "Diarrhoea", "Stomach pain", "Headache", "Skin rash"). If the medicine is generally well-tolerated (e.g., plain paracetamol at normal doses), still list the rare/mild ones but note they usually resolve on their own. Precede the list with a one-line <p>: "Most side effects are mild and do not require medical attention. Common side effects may include:". Follow the list with a <p>: "Consult your doctor if any side effect persists, worsens, or bothers you."

7. **<h3>Storage instructions</h3>** — 1 short paragraph (1–2 sentences) with practical storage guidance appropriate to the dosage form (e.g., for tablets: "Store below 25°C in a cool, dry place away from direct sunlight. Keep out of reach of children."; for syrups: "Store in a cool place. Do not refrigerate unless advised. Use within one month of opening."; for injections: "Store below 25°C. Do not freeze. Protect from light.").

8. **<h3>Warnings & precautions</h3>** — A <ul> list of 3–6 bullets covering: pregnancy & breastfeeding (e.g., "Consult your doctor before using this medicine if you are pregnant or planning a pregnancy"), allergies, kidney/liver disease, history of gastrointestinal issues, drug interactions of concern, alcohol advice, and the universal "Complete the full course of antibiotics as prescribed; do not stop just because you feel better" (only when relevant for antibiotics). End with a <p>: "Inform your doctor about all other medicines you are taking, including over-the-counter drugs and herbal supplements, before starting this medicine."

9. **<h3>Disclaimer</h3>** — A short <p> disclaimer: "This information is intended for educational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified doctor or pharmacist before starting or changing any medication. Pradeep Medical Store does not endorse or recommend any specific dosage."

=== SAFETY RULES (NON-NEGOTIABLE) ===
- NEVER specify an exact dose (e.g., "500 mg twice daily"), frequency, or duration. The dose is ALWAYS for a doctor to decide.
- NEVER recommend the medicine for conditions not listed in the search results or established pharmacology.
- NEVER claim the medicine is "safe for everyone" — always defer to a doctor.
- NEVER recommend self-medication for prescription medicines (antibiotics, injections, cardiac, diabetes, psychiatric, hormonal, antiepileptic, oncology).
- If the product is a prescription medicine, mention in the warnings that a valid prescription is required.
- Use simple Indian English spelling (e.g., "diarrhoea", "foetal", "oedema") consistent with Indian pharmacy sites.
- Keep the entire description under ~600 words total — concise but complete.

=== YOUR TASK ===
Based on the web search results above AND the field definitions AND the content quality standards, generate a JSON object:

{
  "slug": "url-friendly-slug",
  "sku": "SKU-XXXX",
  "hsnCode": "30049099",
  "shortDescription": "1-line description of what the medicine is used for (under 120 chars, e.g., 'Used to treat bacterial infections caused by susceptible organisms')",
  "description": "<h3>About the medicine</h3><p>...</p><h3>Uses / What it is used for</h3><ul><li>...</li></ul><h3>How it works</h3><p>...</p><h3>Key benefits</h3><ul><li>...</li></ul><h3>How to take</h3><p>...</p><h3>Common side effects</h3><p>Most side effects are mild...</p><ul><li>...</li></ul><p>Consult your doctor...</p><h3>Storage instructions</h3><p>...</p><h3>Warnings & precautions</h3><ul><li>...</li></ul><p>Inform your doctor...</p><h3>Disclaimer</h3><p>...</p>",
  "composition": "Active ingredient(s) with strength — from search results",
  "genericName": "Generic/salt name only (no strength)",
  "manufacturer": "Full manufacturer company name",
  "brandName": "Brand/marketing company name (from search results, or match existing brand)",
  "categoryName": "Therapeutic category (match existing if possible)",
  "unit": "Vial|Strip|Bottle|Tube|Pack|Piece|Jar",
  "packSize": "e.g., 1 vial, 15 tablets, 30 capsules",
  "mrp": 100,
  "sellingPrice": 85,
  "prescriptionRequired": true,
  "isGeneric": false,
  "keywords": "comma,separated,keywords",
  "seoTitle": "SEO title (under 60 chars)",
  "metaDescription": "SEO meta description (under 160 chars)"
}

=== CRITICAL RULES ===
1. Use the EXACT brand name and manufacturer from the search results. Do NOT guess.
2. If search results say "Aristo" is the brand, use "Aristo" — NOT "Sun Pharma".
3. The productName is the COMMERCIAL name (e.g., "Monocef"), NOT the generic name (e.g., "Ceftriaxone").
4. The genericName is the SALT name only (e.g., "Ceftriaxone"), NOT the brand name.
5. composition includes the strength (e.g., "Ceftriaxone 250mg").
6. MRP must be a realistic Indian market price (from search results if available).
7. sellingPrice should be ~15% less than MRP.
8. prescriptionRequired: true for antibiotics, injections, cardiac, diabetes, psychiatric, hormonal medicines.
9. isGeneric: false for branded products (like Monocef, Dolo, Augmentin). true only for generic-named products.
10. If the brand exists in the database brands list, use that EXACT name.
11. If the category exists in the database categories list, use that EXACT name.
12. The description MUST follow the 9-section structure above, in order, with semantic HTML only.
13. Return ONLY the JSON. No markdown, no explanation, no code fences.`;

    const result = await aiChatCompletion(
      [
        {
          role: "system",
          content: "You are a senior pharmacy content writer and licensed pharmacist specializing in Indian pharmaceuticals. You ALWAYS verify information against web search results before generating content. You NEVER confuse product names with brand names or generic names. You write in clear, simple Indian English suitable for non-medical customers, using semantic HTML only (h3, p, ul, li) — never markdown, never inline styles. You NEVER specify exact dosage, frequency, or duration — that is always for a doctor to decide. You ALWAYS include the standard medical disclaimer. Return only valid JSON with no markdown fences."
        },
        { role: "user", content: prompt },
      ],
      { temperature: 0.2, max_tokens: 3500 }
    );

    const content = result.content?.trim() || "";

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return err("AI did not return valid JSON. Please try again.", 500);
    }

    let generated: any;
    try {
      generated = JSON.parse(jsonMatch[0]);
    } catch {
      return err("AI returned invalid JSON. Please try again.", 500);
    }

    // ── Step 4: Brand matching ──
    // Try exact match first, then fuzzy match (case-insensitive, partial)
    const brandNameLower = (generated.brandName || "").toLowerCase();
    const matchedBrand = brands.find(
      (b) => b.name.toLowerCase() === brandNameLower
    ) || brands.find(
      (b) => b.name.toLowerCase().includes(brandNameLower) || brandNameLower.includes(b.name.toLowerCase())
    );

    if (matchedBrand) {
      generated.brandId = matchedBrand.id;
      generated.brandExists = true;
      generated.brandName = matchedBrand.name; // Use the exact DB name
    } else {
      generated.brandExists = false;
    }

    // ── Step 5: Category matching ──
    const categoryNameLower = (generated.categoryName || "").toLowerCase();
    const matchedCategory = categories.find(
      (c) => c.name.toLowerCase() === categoryNameLower
    ) || categories.find(
      (c) => c.name.toLowerCase().includes(categoryNameLower) || categoryNameLower.includes(c.name.toLowerCase())
    );

    if (matchedCategory) {
      generated.categoryId = matchedCategory.id;
      generated.categoryExists = true;
      generated.categoryName = matchedCategory.name;
    } else {
      generated.categoryExists = false;
    }

    // ── Step 6: Calculate discount ──
    if (generated.mrp && generated.sellingPrice) {
      const mrp = Number(generated.mrp);
      const sp = Number(generated.sellingPrice);
      generated.baseDiscountPct = mrp > 0 ? Math.round(((mrp - sp) / mrp) * 1000) / 10 : 0;
      generated.maxDiscountPct = 0;
    }

    // Include search metadata for transparency
    return ok({
      generated,
      title,
      searchResultsCount: relevantResults.length,
      sourcesUsed: relevantResults.map((r: any) => r.host_name).filter(Boolean).slice(0, 5),
    });
  } catch (e: any) {
    console.error("[ai/generate-product] error:", e?.message?.slice(0, 200));
    return err("AI generation failed: " + (e?.message || "unknown error"), 500);
  }
}
