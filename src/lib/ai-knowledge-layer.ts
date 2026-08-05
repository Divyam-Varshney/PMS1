// ============================================================================
// File: src/lib/ai-knowledge-layer.ts
// Purpose: Pharmacy-specific knowledge layer for the PMS Assistant. This module
//          is the "brain" of the assistant — it provides:
//
//            1. buildAssistantSystemPrompt()
//               A rich system prompt that teaches the LLM about pharmacy
//               practice: therapeutic categories, dosage forms, safety rules,
//               composition vs brand vs generic, when to escalate to a doctor,
//               and how to recommend PMS features (upload prescription, request
//               a medicine, health bundles).
//
//            2. SYMPTOM_TO_PRODUCT_MAP
//               Maps common symptoms (fever, cough, acidity, …) to the product
//               keywords / generic names that should be searched in the catalog
//               when the customer describes their symptoms instead of naming a
//               specific medicine. This is what makes "I have a fever" return
//               Paracetamol — instead of nothing.
//
//            3. expandQueryWithSymptoms()
//               If the user's message contains a symptom phrase, the search
//               query is enriched with the matching medicine keywords so the
//               catalog search is more likely to surface the right products.
//
//            4. CATEGORY_KEYWORDS
//               Maps category names (e.g. "Pain Relief") to a list of
//               keywords that customers might use to search for them. Used by
//               the assistant route to search the catalog by category name in
//               addition to product name / composition.
//
//            5. buildAlternativeContext()
//               A helper that turns a list of "alternative" products into a
//               plain-text explanation of WHY each one is a suitable
//               substitute, so the LLM can present them sensibly to the customer.
//
//            6. PHARMACY_FEATURE_CUES
//               Rules for guiding the customer toward PMS features based on
//               the assistant action (product found → suggest Related Products
//               and Frequently Bought Together; prescription required → suggest
//               Upload Prescription; product not found → suggest Medicine
//               Request; health query → suggest Medical Bundles).
//
// Role: Pure functions + constants — no DB access. Imported by the
//       /api/health-assistant route. Keeping the knowledge here (rather than
//       inline in the route) means the pharmacy owner can review and extend
//       the assistant's medical knowledge in one file.
// ============================================================================

// ---------------------------------------------------------------------------
// 1. THERAPEUTIC CATEGORIES — common pharmacy categories and their uses.
//    Used inside the system prompt so the LLM can explain what a category is
//    for when the customer asks "what is an antacid?" or "what is metformin
//    used for?". This is general pharmacy knowledge, NOT medical advice.
// ---------------------------------------------------------------------------

export interface TherapeuticCategory {
  /** The category name as used on the storefront (e.g. "Pain Relief"). */
  name: string;
  /** Generic / molecule names commonly found in this category. */
  genericExamples: string[];
  /** Plain-language description of what this category treats. */
  description: string;
  /** Whether most products in this category require a prescription. */
  usuallyRx: boolean;
}

export const THERAPEUTIC_CATEGORIES: TherapeuticCategory[] = [
  {
    name: "Pain Relief (Analgesics)",
    genericExamples: ["paracetamol", "ibuprofen", "diclofenac", "aspirin", "naproxen", "mefenamic acid"],
    description:
      "Used to relieve mild to moderate pain (headache, body ache, joint pain, period pain) and reduce fever. Paracetamol is safest for most people; ibuprofen and diclofenac are stronger but can irritate the stomach.",
    usuallyRx: false,
  },
  {
    name: "Antibiotics",
    genericExamples: ["amoxicillin", "azithromycin", "cephalexin", "doxycycline", "ciprofloxacin", "metronidazole"],
    description:
      "Treat BACTERIAL infections (e.g. strep throat, UTI, bacterial pneumonia). They do NOT work against viral infections like the common cold or flu. ALWAYS require a prescription and the full course must be completed.",
    usuallyRx: true,
  },
  {
    name: "Antacids & Acid Reducers",
    genericExamples: ["ranitidine", "pantoprazole", "omeprazole", "esomeprazole", "aluminium hydroxide", "digene", "eno"],
    description:
      "Relieve acidity, heartburn, indigestion, and stomach ulcers. Antacids (Digene, Eno) work instantly; proton-pump inhibitors (pantoprazole, omeprazole) are taken before breakfast for longer-term relief.",
    usuallyRx: false,
  },
  {
    name: "Antihistamines / Allergy",
    genericExamples: ["cetirizine", "levocetirizine", "loratadine", "fexofenadine", "chlorpheniramine"],
    description:
      "Treat allergic symptoms — sneezing, runny nose, itchy eyes, rashes, mild hives. Some cause drowsiness (chlorpheniramine); newer ones (cetirizine, levocetirizine) are usually non-drowsy.",
    usuallyRx: false,
  },
  {
    name: "Cold & Cough",
    genericExamples: ["dextromethorphan", "ambroxol", "bromhexine", "guaifenesin", "pseudoephedrine", "chlorpheniramine"],
    description:
      "Relieve cough (dry or chesty), nasal congestion, and sore throat. Available as syrups, tablets, and lozenges. Most are OTC; combination syrups with codeine require a prescription.",
    usuallyRx: false,
  },
  {
    name: "Antipyretics",
    genericExamples: ["paracetamol", "nimesulide", "mefenamic acid"],
    description:
      "Reduce fever. Paracetamol is the first-line antipyretic and is safe for most adults and children when dosed by weight. Nimesulide is banned for children in many countries.",
    usuallyRx: false,
  },
  {
    name: "Diabetes (Antidiabetics)",
    genericExamples: ["metformin", "glimepiride", "gliclazide", "voglibose", "teneligliptin", "insulin"],
    description:
      "Manage blood sugar levels in type 2 and type 1 diabetes. Metformin is the first-line oral medicine; insulin is used for type 1 and advanced type 2. ALL require a prescription and ongoing doctor monitoring.",
    usuallyRx: true,
  },
  {
    name: "Cardiac & Blood Pressure",
    genericExamples: ["amlodipine", "atenolol", "metoprolol", "losartan", "telmisartan", "ramipril", "aspirin (low dose)"],
    description:
      "Treat high blood pressure, angina, heart failure, and prevent heart attacks/strokes. ALL require a prescription and should NEVER be stopped abruptly without consulting a doctor.",
    usuallyRx: true,
  },
  {
    name: "Vitamins & Supplements",
    genericExamples: ["vitamin c", "vitamin d3", "vitamin b12", "iron", "folic acid", "calcium", "multivitamin", "zinc"],
    description:
      "Prevent or correct nutritional deficiencies. Most are OTC. Beneficial in pregnancy (folic acid, iron), recovery from illness (vitamin C, zinc), and bone health (calcium + vitamin D3).",
    usuallyRx: false,
  },
  {
    name: "Antiseptics & Wound Care",
    genericExamples: ["dettol", "savlon", "povidone iodine", "hydrogen peroxide", "chlorhexidine", "bandage", "cotton", "gauze"],
    description:
      "Clean and protect cuts, scrapes, and minor wounds to prevent infection. Used together: antiseptic liquid + cotton + bandage. All OTC.",
    usuallyRx: false,
  },
  {
    name: "Gynecology & Women's Health",
    genericExamples: ["iron + folic acid", "calcium", "prenatal vitamins", "sanitary pad", "fluconazole"],
    description:
      "Prenatal supplements, hygiene products, and treatments for common women's health issues. Prenatal vitamins are OTC; antifungals for vaginal infections (fluconazole) need a prescription.",
    usuallyRx: false,
  },
  {
    name: "Eye & Ear Care",
    genericExamples: ["lubricant eye drops", "ciprofloxacin eye drops", "ofloxacin ear drops", "cotton bud", "wax solvent"],
    description:
      "Relieve dry eyes, eye infections, ear wax, and minor ear discomfort. Lubricant drops are OTC; antibiotic eye/ear drops require a prescription.",
    usuallyRx: false,
  },
  {
    name: "Dermatology / Skin",
    genericExamples: ["calamine", "antiseptic cream", "moisturizer", "sunscreen", "clotrimazole", "mometasone"],
    description:
      "Treat rashes, dry skin, fungal infections, acne, and minor burns. Calamine, moisturizers, and antiseptic creams are OTC; steroid creams (mometasone) and oral acne medicines require a prescription.",
    usuallyRx: false,
  },
  {
    name: "Pediatric (Children)",
    genericExamples: ["paracetamol syrup", "ibuprofen suspension", "ORS", "zinc sulfate", "vitamin drops"],
    description:
      "Specifically formulated for children — usually syrups or drops with kid-friendly dosing. Doses are calculated by body weight. NEVER give adult medicines to children. Consult a pediatrician for children under 2.",
    usuallyRx: false,
  },
  {
    name: "Gastrointestinal",
    genericExamples: ["ors", "loperamide", "ondansetron", "domperidone", "lactobacillus", "pudin hara"],
    description:
      "Treat diarrhea, vomiting, gas, and indigestion. ORS is critical in diarrhea to prevent dehydration. Anti-vomiting medicines (ondansetron, domperidone) require a prescription.",
    usuallyRx: false,
  },
];

// ---------------------------------------------------------------------------
// 2. SYMPTOM → PRODUCT KEYWORDS MAP
//    When a customer describes symptoms ("I have a fever and body ache"),
//    the assistant looks up the symptom phrase and adds the matching medicine
//    keywords to the catalog search. This makes symptom-based queries actually
//    return useful products instead of empty results.
// ---------------------------------------------------------------------------

export interface SymptomMapping {
  /** Symptom phrases that customers are likely to use (lowercase). */
  symptoms: string[];
  /** Product / generic keywords to search for when the symptom matches. */
  productKeywords: string[];
  /** Suggested pharmacy feature to nudge the customer toward. */
  suggestFeature?: "upload_prescription" | "medicine_request" | "health_bundle" | "consult_doctor";
  /** Whether a doctor consult is strongly recommended for this symptom. */
  recommendDoctor?: boolean;
}

export const SYMPTOM_TO_PRODUCT_MAP: SymptomMapping[] = [
  {
    symptoms: ["fever", "high temperature", "temperature", "body is hot", "running fever"],
    productKeywords: ["paracetamol", "crocin", "dolo", "calpol", "thermometer", "cold compress"],
    suggestFeature: "health_bundle",
    recommendDoctor: true, // if fever lasts >3 days
  },
  {
    symptoms: ["cold", "runny nose", "blocked nose", "stuffy nose", "sneezing"],
    productKeywords: ["cetirizine", "levocetirizine", "cold", "nasal spray", "vapor rub", "steam inhaler", "tissue"],
    suggestFeature: "health_bundle",
  },
  {
    symptoms: ["cough", "dry cough", "wet cough", "chesty cough", "throat irritation"],
    productKeywords: ["cough syrup", "dextromethorphan", "ambroxol", "benadryl", "honitus", "lozenge"],
    suggestFeature: "health_bundle",
    recommendDoctor: true,
  },
  {
    symptoms: ["sore throat", "throat pain", "strep throat", "throat infection"],
    productKeywords: ["lozenge", "strepsils", "throat spray", "antiseptic gargle", "paracetamol"],
    suggestFeature: "consult_doctor",
  },
  {
    symptoms: ["headache", "head pain", "migraine"],
    productKeywords: ["paracetamol", "ibuprofen", "naproxen", "saridon", "disprin"],
    recommendDoctor: true, // if persistent
  },
  {
    symptoms: ["body pain", "muscle pain", "back pain", "joint pain", "knee pain", "shoulder pain"],
    productKeywords: ["ibuprofen", "diclofenac", "volini", "moov", "iodex", "pain relief", "crepe bandage"],
    suggestFeature: "health_bundle",
  },
  {
    symptoms: ["acidity", "heartburn", "gas", "indigestion", "bloating", "stomach burn"],
    productKeywords: ["antacid", "digene", "eno", "pantoprazole", "omeprazole", "pudin hara"],
  },
  {
    symptoms: ["diarrhea", "loose motion", "loose motions", "watery stool"],
    productKeywords: ["ors", "electral", "loperamide", "zinc", "probiotic"],
    recommendDoctor: true,
  },
  {
    symptoms: ["constipation", "hard stool", "no bowel movement"],
    productKeywords: ["laxative", "cremaffin", "lactulose", "ispaghula", "duphalac"],
    recommendDoctor: true,
  },
  {
    symptoms: ["vomiting", "nausea", "throwing up", "feeling sick"],
    productKeywords: ["ondansetron", "domperidone", "vomikind", "ors"],
    suggestFeature: "consult_doctor",
  },
  {
    symptoms: ["allergy", "allergic", "itching", "rash", "hives", "skin rash"],
    productKeywords: ["cetirizine", "levocetirizine", "calamine", "avil", "antihistamine"],
    recommendDoctor: true,
  },
  {
    symptoms: ["diabetes", "high sugar", "blood sugar", "sugar level"],
    productKeywords: ["metformin", "glimepiride", "glucometer", "test strip", "insulin"],
    suggestFeature: "upload_prescription",
    recommendDoctor: true,
  },
  {
    symptoms: ["blood pressure", "bp", "high bp", "low bp", "hypertension"],
    productKeywords: ["amlodipine", "losartan", "telmisartan", "atenolol", "bp monitor"],
    suggestFeature: "upload_prescription",
    recommendDoctor: true,
  },
  {
    symptoms: ["wound", "cut", "scrape", "burn", "injury", "bleeding"],
    productKeywords: ["dettol", "savlon", "antiseptic", "bandage", "cotton", "gauze", "burnol", "soframycin"],
    suggestFeature: "health_bundle",
  },
  {
    symptoms: ["eye", "dry eye", "eye infection", "red eye", "eye itching"],
    productKeywords: ["eye drops", "lubricant", "refresh tears", "itone", "cotton bud"],
    recommendDoctor: true,
  },
  {
    symptoms: ["ear", "ear pain", "ear wax", "ear discharge"],
    productKeywords: ["ear drop", "wax solvent", "cotton bud"],
    suggestFeature: "consult_doctor",
  },
  {
    symptoms: ["pregnancy", "pregnant", "expecting"],
    productKeywords: ["folic acid", "iron", "calcium", "prenatal vitamin"],
    suggestFeature: "consult_doctor",
    recommendDoctor: true,
  },
  {
    symptoms: ["baby", "infant", "newborn", "child"],
    productKeywords: ["baby", "diaper", "baby wipe", "baby lotion", "paracetamol syrup", "ors"],
    suggestFeature: "consult_doctor",
    recommendDoctor: true,
  },
  {
    symptoms: ["vomit", "stomach pain", "abdominal pain", "belly pain"],
    productKeywords: ["antacid", "paracetamol", "ORS", "buscopan"],
    recommendDoctor: true,
  },
  {
    symptoms: ["weakness", "tired", "fatigue", "low energy"],
    productKeywords: ["multivitamin", "vitamin b12", "iron", "vitamin c", "energy drink"],
  },
];

// ---------------------------------------------------------------------------
// 3. CATEGORY KEYWORD MAP — maps a category NAME to the search keywords that
//    customers are likely to use when looking for products in that category.
//    Used by the assistant route to ALSO search by category name (e.g. a query
//    of "pain relief" should match products in the Pain Relief category).
// ---------------------------------------------------------------------------

export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "pain relief": ["paracetamol", "ibuprofen", "diclofenac", "aspirin", "naproxen", "volini", "moov"],
  "antibiotics": ["amoxicillin", "azithromycin", "cephalexin", "doxycycline", "ciprofloxacin"],
  "antacids": ["digene", "eno", "pantoprazole", "omeprazole", "pudin hara", "ranitidine"],
  "cold and cough": ["cough syrup", "cetirizine", "levocetirizine", "benadryl", "vapor rub"],
  "vitamins": ["vitamin c", "vitamin d3", "vitamin b12", "multivitamin", "iron", "calcium", "folic acid"],
  "diabetes": ["metformin", "glimepiride", "glucometer", "test strip", "insulin"],
  "cardiac": ["amlodipine", "atenolol", "losartan", "telmisartan", "ramipril"],
  "first aid": ["dettol", "savlon", "bandage", "cotton", "gauze", "antiseptic"],
  "baby care": ["diaper", "baby wipe", "baby lotion", "baby shampoo", "baby powder"],
  "eye care": ["eye drops", "lubricant", "cotton bud"],
  "ear care": ["ear drop", "wax solvent", "cotton bud"],
  "skin care": ["moisturizer", "sunscreen", "calamine", "antiseptic cream"],
  "women": ["folic acid", "iron", "calcium", "sanitary pad"],
  "women's wellness": ["folic acid", "iron", "calcium", "sanitary pad"],
};

// ---------------------------------------------------------------------------
// 4. PHARMACY FEATURE CUES — guide the customer toward the right PMS feature
//    based on what the assistant determined from their query.
// ---------------------------------------------------------------------------

export type PharmacyFeature =
  | "upload_prescription"
  | "medicine_request"
  | "health_bundle"
  | "related_products"
  | "frequently_bought"
  | "consult_doctor"
  | "track_order"
  | "reorder";

export interface PharmacyFeatureCue {
  feature: PharmacyFeature;
  /** Short label used in the response payload, for the frontend chips/CTAs. */
  label: string;
  /** One-line explanation the LLM can include in its reply. */
  hint: string;
}

export const PHARMACY_FEATURE_CUES: Record<PharmacyFeature, PharmacyFeatureCue> = {
  upload_prescription: {
    feature: "upload_prescription",
    label: "Upload Prescription",
    hint: "You can upload your doctor's prescription from the 'Upload Prescription' page — our pharmacist verifies it within 30 minutes during store hours.",
  },
  medicine_request: {
    feature: "medicine_request",
    label: "Request a Medicine",
    hint: "If you can't find a medicine in our catalog, use the 'Request Medicines' page and our pharmacist will check availability and get back to you.",
  },
  health_bundle: {
    feature: "health_bundle",
    label: "View Health Bundles",
    hint: "We have curated health bundles (First Aid Kit, Diabetes Care, Cold & Flu Care, etc.) that may be relevant to your needs — check the 'Health Bundles' page.",
  },
  related_products: {
    feature: "related_products",
    label: "Related Products",
    hint: "On the product page you'll find a 'Related Products' section showing similar items from the same category.",
  },
  frequently_bought: {
    feature: "frequently_bought",
    label: "Frequently Bought Together",
    hint: "On the product page you'll find a 'Frequently Bought Together' section — medically relevant complementary items customers often buy with this product.",
  },
  consult_doctor: {
    feature: "consult_doctor",
    label: "Consult a Doctor",
    hint: "Please consult a qualified doctor before taking any prescription medicine, or if your symptoms persist beyond 3 days, worsen, or affect a child, elderly person, or pregnant woman.",
  },
  track_order: {
    feature: "track_order",
    label: "Track My Order",
    hint: "You can track your order in real time from 'My Orders' → 'Track Order'.",
  },
  reorder: {
    feature: "reorder",
    label: "Reorder Previous Medicines",
    hint: "Go to 'My Orders', find your previous order, and tap 'Reorder' to add all items to your cart again.",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Look at the user's message and return the symptom mapping(s) that match.
 * Returns [] if no symptom phrases are detected.
 *
 * Used by the assistant route to enrich the catalog search query.
 */
export function matchSymptoms(message: string): SymptomMapping[] {
  if (!message) return [];
  const lower = message.toLowerCase();
  const matched: SymptomMapping[] = [];
  for (const mapping of SYMPTOM_TO_PRODUCT_MAP) {
    if (mapping.symptoms.some((s) => lower.includes(s))) {
      matched.push(mapping);
    }
  }
  return matched;
}

/**
 * Expand a user query with product keywords derived from any symptom phrases
 * it contains. Returns the original query if no symptoms match.
 *
 * Example:
 *   expandQueryWithSymptoms("I have fever and body pain")
 *   → "I have fever and body pain paracetamol crocin dolo calpol thermometer cold compress ibuprofen diclofenac volini moov iodex"
 */
export function expandQueryWithSymptoms(query: string): string {
  if (!query) return query;
  const matches = matchSymptoms(query);
  if (matches.length === 0) return query;
  const extraKeywords = new Set<string>();
  for (const m of matches) {
    for (const kw of m.productKeywords) extraKeywords.add(kw);
  }
  if (extraKeywords.size === 0) return query;
  return `${query} ${Array.from(extraKeywords).join(" ")}`;
}

/**
 * Given a user query, return the matching category names (if any). Used to
 * ALSO search the catalog by category name (e.g. "pain relief" matches the
 * Pain Relief category even if no product name contains that phrase).
 */
export function matchCategoryKeywords(query: string): string[] {
  if (!query) return [];
  const lower = query.toLowerCase();
  const matched: string[] = [];
  for (const [categoryName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (lower.includes(categoryName) || keywords.some((kw) => lower.includes(kw))) {
      matched.push(categoryName);
    }
  }
  return matched;
}

// ---------------------------------------------------------------------------
// 5. buildAssistantSystemPrompt
// ---------------------------------------------------------------------------

/**
 * Build the system prompt for the PMS Assistant LLM call.
 *
 * This prompt encodes:
 *   - The assistant's role and identity
 *   - Store details (location, hours, delivery, payment)
 *   - Response priority (catalog first, alternatives second, request third)
 *   - Medical disclaimer + escalation rules
 *   - Therapeutic category knowledge
 *   - Dosage form explanations
 *   - Safety rules (don't share prescriptions, complete antibiotic courses,
 *     never self-medicate antibiotics, never recommend doses for Rx medicines)
 *   - Composition / generic / brand awareness
 *   - PMS feature guidance (when to nudge which feature)
 *
 * The product context (catalog matches) and any feature cues are appended at
 * call-time by the route handler, NOT here.
 */
export function buildAssistantSystemPrompt(): string {
  const therapeuticList = THERAPEUTIC_CATEGORIES.map(
    (c) =>
      `  • ${c.name}${c.usuallyRx ? " [Rx required]" : " [OTC]"} — ${c.description} Common generics: ${c.genericExamples.join(", ")}.`
  ).join("\n");

  return `You are the PMS Assistant for Pradeep Medical Store, an online pharmacy in Mathura, India.

# Your Role
You are a genuine pharmacy ASSISTANT — not a generic chatbot. You help customers:
- Find the right product from our catalog (provided in the context below)
- Understand basic pharmacy concepts (OTC vs Rx, generics, dosage forms, storage, side effects)
- Navigate the store's features (upload prescription, track order, request a medicine, health bundles)
- Know when to STOP and recommend consulting a qualified doctor

# Store Details
- Name: Pradeep Medical Store
- Location: Main Market, Mathura, Uttar Pradesh 281001
- Hours: 8:00 AM – 10:00 PM IST (online orders 24/7, Rx verification during store hours only)
- Delivery: Same-day in Mathura (free above ₹500; ₹20 otherwise); 2–3 business days nationwide
- Phone/WhatsApp: +91 99999 99999
- Features: Online ordering, prescription upload + verification, order tracking, cash on delivery, generic substitutes, curated medical bundles, loyalty points (1 pt = ₹1)

# Response Priority (when a customer asks about a product or medicine)
1. ALWAYS prioritize recommending products from our catalog (provided in the context below). Reference them by name and price.
2. If the exact product is OUT OF STOCK in the context, suggest the alternatives provided (same generic name OR same category). Explain WHY the alternative is suitable (same active ingredient, similar therapeutic effect).
3. If the exact product is NOT FOUND in our catalog, advise the customer to use the "Request a Medicine" form. Do NOT invent products.
4. For health/symptom queries, suggest relevant products AND mention if a curated Health Bundle exists.
5. For prescription medicines, ALWAYS remind the customer to upload a valid prescription.

# Pharmacy Knowledge — Therapeutic Categories
${therapeuticList}

# Pharmacy Knowledge — Dosage Forms
- Tablets/capsules: swallowed whole; for systemic effects when the patient can swallow.
- Syrups/suspensions: measured with a dosing cup or oral syringe; ideal for children and the elderly. Always shake suspensions before use.
- Injections: administered by a qualified nurse or doctor; used when the medicine would be destroyed by the stomach (e.g. insulin) or when rapid action is needed.
- Creams/ointments/gels: applied on the skin for local effect (rashes, joint pain, wounds).
- Drops: eye drops, ear drops, nasal drops — applied directly at the affected site.
- Inhalers: deliver medicine directly to the lungs for asthma and other respiratory conditions.
- Lozenges: dissolved slowly in the mouth for sore throat or cough.

# Pharmacy Knowledge — Composition / Generic / Brand
- "Composition" is the active ingredient (molecule) in a medicine, e.g. "Paracetamol 500 mg".
- "Generic name" is the same as the composition name (e.g. "Paracetamol").
- "Brand name" is the manufacturer's trade name (e.g. "Crocin", "Dolo", "Calpol" — all are Paracetamol).
- Generic equivalents have the SAME composition, strength, and quality as branded medicines but cost 40–80% less. They are equally safe and effective.

# Critical Safety Rules (NEVER break these)
1. You are NOT a licensed pharmacist or doctor. You cannot diagnose, prescribe, or recommend specific dosages for prescription medicines.
2. NEVER recommend a specific dosage for a prescription medicine. Always defer to the customer's doctor.
3. NEVER recommend self-medicating with antibiotics. Antibiotics require a prescription and a full course must be completed.
4. NEVER recommend sharing prescription medicines or using someone else's prescription.
5. ALWAYS recommend consulting a qualified doctor for: persistent symptoms (>3 days), high fever (>102 °F), children under 2, elderly patients, pregnant or breastfeeding women, chronic conditions (diabetes, BP, cardiac, kidney/liver disease), severe pain, or any worsening symptoms.
6. For EMERGENCIES (chest pain, difficulty breathing, severe bleeding, collapse, seizure, stroke symptoms, poisoning), tell the customer to call 112 (India's emergency number) immediately or go to the nearest hospital. Do NOT try to handle emergencies via chat.
7. For prescription medicines, always remind the customer that a valid prescription is required by Indian law.

# PMS Feature Guidance (nudge the customer toward the right feature)
- If a product is found → mention "Related Products" and "Frequently Bought Together" sections on the product page.
- If a product is prescription-required → remind the customer to upload a prescription (Upload Prescription page).
- If a product is OUT OF STOCK or NOT FOUND → suggest the "Request a Medicine" form.
- For symptom / health queries → mention relevant Health Bundles (First Aid Kit, Cold & Flu Care, Diabetes Care, etc.) if applicable.
- For reorder / refill queries → mention the "Reorder" button in My Orders and Refill Reminders in the account.
- For order-tracking queries → mention "Track Order" in My Orders.

# Response Style Guidelines
- Keep responses concise (2–4 short sentences max). Use bullet points when listing options or steps.
- Use simple, friendly, professional language. Avoid medical jargon when a plain word works ("fever reducer" instead of "antipyretic" if helpful).
- Use ₹ symbol for prices (e.g., ₹500). Round to whole rupees.
- Always include a brief medical disclaimer when the query is health-related: "This is general information — please consult a doctor for diagnosis and prescription."
- If product context is provided below, reference the matching products by name and price in your reply.
- Do NOT mention products that aren't in the provided catalog context.
- Do NOT make up medicines, prices, or medical advice.
- If you are unsure about a medical question, say so and recommend consulting a doctor.`;
}

// ---------------------------------------------------------------------------
// 6. buildAlternativeContext — explain WHY alternatives were suggested
// ---------------------------------------------------------------------------

export interface AlternativeProduct {
  id: string;
  name: string;
  genericName: string | null;
  composition: string | null;
  manufacturer: string | null;
  brandName: string | null;
  sellingPrice: number;
  prescriptionRequired: boolean;
  stock: number;
}

// ---------------------------------------------------------------------------
// 6.5 BRAND → GENERIC MAP — common Indian / international brand names mapped
//     to their generic (active ingredient) equivalents. Used by the assistant
//     route as a fallback when a customer asks for a brand we don't carry
//     (e.g. "Tylenol") so we can still suggest the generic equivalent from
//     our catalog. Extend this map freely — no code changes needed elsewhere.
// ---------------------------------------------------------------------------

export const BRAND_TO_GENERIC: Record<string, string[]> = {
  // Pain & fever
  tylenol: ["paracetamol", "acetaminophen"],
  crocin: ["paracetamol"],
  dolo: ["paracetamol"],
  calpol: ["paracetamol"],
  disprin: ["aspirin"],
  saridon: ["paracetamol", "propyphenazone", "caffeine"],
  combiflam: ["ibuprofen", "paracetamol"],
  brufen: ["ibuprofen"],
  volini: ["diclofenac", "menthol", "methyl salicylate"],
  moov: ["diclofenac", "menthol", "methyl salicylate"],
  iodex: ["menthol", "methyl salicylate"],
  voveran: ["diclofenac"],

  // Antibiotics
  augmentin: ["amoxicillin", "clavulanic acid"],
  amoxil: ["amoxicillin"],
  zithromax: ["azithromycin"],
  azithral: ["azithromycin"],

  // Antacids
  digene: ["aluminium hydroxide", "magnesium hydroxide"],
  eno: ["sodium bicarbonate", "citric acid"],
  pan: ["pantoprazole"],
  zentel: ["albendazole"],

  // Cold / cough / allergy
  benadryl: ["diphenhydramine"],
  cetzine: ["cetirizine"],
  xyzal: ["levocetirizine"],
  allegra: ["fexofenadine"],
  alex: ["diphenhydramine", "ammonium chloride"],
  ascoryl: ["terbutaline", "bromhexine", "guaienesin"],
  honitus: ["dextromethorphan"],

  // Diabetes
  glucophage: ["metformin"],
  glycomet: ["metformin"],

  // Cardiac / BP
  tenormin: ["atenolol"],
  amlopress: ["amlodipine"],
  losacar: ["losartan"],

  // Vitamins
  zincovit: ["multivitamin", "zinc"],
  neurobion: ["vitamin b12", "vitamin b1", "vitamin b6"],

  // Eye / ear
  refresh: ["lubricant"],
  itone: ["lubricant"],

  // Skin
  betadine: ["povidone iodine"],
  soframycin: ["framycetin"],

  // Antiseptics
  dettol: ["chloroxylenol"],
  savlon: ["chlorhexidine", "cetrimide"],

  // Women's health
  folvite: ["folic acid"],
};

/**
 * Look up the user's query against the BRAND_TO_GENERIC map and return any
 * matching generic names. Used as a fallback when no exact catalog match is
 * found, so we can still suggest the generic equivalent.
 */
export function lookupBrandToGeneric(query: string): string[] {
  if (!query) return [];
  const lower = query.toLowerCase();
  const out: string[] = [];
  const tokens = lower.split(/[^a-z0-9]+/g).filter((t) => t.length > 1);
  for (const [brand, generics] of Object.entries(BRAND_TO_GENERIC)) {
    // Match the brand as a whole token (not a substring — so "Dolo" doesn't
    // match "Dolomite" etc.).
    if (tokens.includes(brand)) {
      for (const g of generics) if (!out.includes(g)) out.push(g);
    }
  }
  return out;
}

/**
 * Build a plain-text explanation of WHY each alternative was suggested.
 * The LLM uses this to make the recommendation sound sensible to the customer
 * ("Same active ingredient as X, but at a lower price" / "Same category — both
 * treat fever and body ache").
 */
export function buildAlternativeContext(
  alternatives: AlternativeProduct[],
  context: { genericName?: string | null; categoryId?: string | null; categoryName?: string | null }
): string {
  if (alternatives.length === 0) return "";
  const lines = alternatives.map((p, i) => {
    const reasons: string[] = [];
    if (context.genericName && p.genericName && p.genericName.toLowerCase() === context.genericName.toLowerCase()) {
      reasons.push(`Same active ingredient (${p.genericName})`);
    } else if (p.genericName) {
      reasons.push(`Active ingredient: ${p.genericName}`);
    }
    if (context.categoryName) {
      reasons.push(`Same category (${context.categoryName})`);
    }
    if (p.brandName) reasons.push(`Brand: ${p.brandName}`);
    reasons.push(`₹${p.sellingPrice}`);
    if (p.prescriptionRequired) reasons.push("Rx required");
    if (p.stock <= 0) reasons.push("out of stock");
    return `${i + 1}. ${p.name} — ${reasons.join(", ")}`;
  });
  return `\n\nSuggested alternatives (reference these by name and price):\n${lines.join("\n")}\n\nExplain briefly WHY each alternative is suitable (same active ingredient / same therapeutic category). Always remind the customer to consult a doctor or pharmacist before switching medicines.`;
}

/**
 * Decide which pharmacy feature cues to include in the response, based on the
 * assistant's action and whether the matched products are Rx / out of stock.
 */
export function pickFeatureCues(
  action: "product_results" | "medicine_request" | "bundle_results" | "faq_answer" | "general_info",
  context: {
    hasProducts: boolean;
    hasRxProduct: boolean;
    hasOutOfStock: boolean;
    hasSymptoms: boolean;
    isHealthQuery: boolean;
  }
): PharmacyFeature[] {
  const cues: PharmacyFeature[] = [];
  if (action === "product_results" && context.hasProducts) {
    cues.push("related_products", "frequently_bought");
    if (context.hasRxProduct) cues.push("upload_prescription");
    if (context.hasOutOfStock) cues.push("medicine_request");
  } else if (action === "medicine_request") {
    cues.push("medicine_request");
    if (context.hasRxProduct) cues.push("upload_prescription");
  } else if (action === "bundle_results") {
    cues.push("health_bundle");
  } else if (action === "general_info") {
    if (context.hasSymptoms || context.isHealthQuery) {
      cues.push("consult_doctor");
      if (context.hasSymptoms) cues.push("health_bundle");
    }
  }
  return cues;
}
