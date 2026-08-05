// ============================================================================
// File: src/lib/product-info.ts
// Purpose: Generates rich, context-aware product information sections
//          (Uses & Benefits, How to Use, Side Effects, Warnings, Storage,
//          Disclaimer) from a product's category + dosageForm + composition.
//          Used by the Accordion on the product detail page.
//
//          These are GENERIC pharmacy-grade defaults — they do NOT replace
//          a doctor's advice or product-specific label information. The
//          customer must always read the actual product label.
// ============================================================================

import type { Product } from "@/components/customer/api";

export interface ProductInfoSection {
  /** Stable key — used as the Accordion item value. */
  key: string;
  /** Section title shown in the Accordion trigger. */
  title: string;
  /** Section body — plain text (may contain simple bullet lists separated by \n). */
  body: string;
}

// ---------------------------------------------------------------------------
// Dosage form normalization — extract from product.unit / packSize / name.
// ---------------------------------------------------------------------------
type DosageForm =
  | "tablet"
  | "capsule"
  | "syrup"
  | "injection"
  | "cream"
  | "ointment"
  | "drops"
  | "inhaler"
  | "powder"
  | "soap"
  | "device"
  | "other";

function detectDosageForm(product: Pick<Product, "name" | "unit" | "packSize">): DosageForm {
  const text = `${product.name ?? ""} ${product.unit ?? ""} ${product.packSize ?? ""}`.toLowerCase();
  if (/\btablet|tab\b/.test(text)) return "tablet";
  if (/\bcapsule|cap\b/.test(text)) return "capsule";
  if (/\bsyrup|suspension|liquid\b/.test(text)) return "syrup";
  if (/\binjection|vial|ampoule\b/.test(text)) return "injection";
  if (/\bcream\b/.test(text)) return "cream";
  if (/\bointment|gel\b/.test(text)) return "ointment";
  if (/\bdrops?|eye drop|ear drop\b/.test(text)) return "drops";
  if (/\binhaler|rotacap\b/.test(text)) return "inhaler";
  if (/\bpowder|granules| sachet\b/.test(text)) return "powder";
  if (/\bsoap|bar\b/.test(text)) return "soap";
  if (/\bdevice|meter|kit|monitor|machine\b/.test(text)) return "device";
  return "other";
}

// ---------------------------------------------------------------------------
// "How to Use" — generic instructions per dosage form.
// ---------------------------------------------------------------------------
function howToUse(form: DosageForm): string {
  switch (form) {
    case "tablet":
      return "Swallow the tablet whole with a glass of water. Do not crush, chew, or break it unless advised by your doctor. Take with or after food if it upsets your stomach.";
    case "capsule":
      return "Swallow the capsule whole with water. Do not open, crush, or chew the capsule. Take at the same time each day for the best effect.";
    case "syrup":
      return "Shake the bottle well before each use. Measure the dose using the provided measuring cup or syringe. Take as directed by your physician.";
    case "injection":
      return "To be administered only by a qualified healthcare professional (doctor or nurse). Do not self-inject. Stored under controlled conditions before use.";
    case "cream":
      return "Clean and dry the affected area. Apply a thin layer of the cream and gently rub it in. Wash your hands before and after application. Avoid contact with eyes.";
    case "ointment":
      return "Clean and dry the affected area. Apply a small amount of ointment and spread evenly. Cover with a sterile dressing if advised by your doctor.";
    case "drops":
      return "Tilt your head back (or to the side for ear drops). Gently squeeze the dropper to release the prescribed number of drops. Close your eyes / keep your head tilted for 1–2 minutes. Do not touch the dropper tip.";
    case "inhaler":
      return "Shake the inhaler well before use. Breathe out fully, place the mouthpiece in your mouth, and press the canister while breathing in deeply. Hold your breath for 10 seconds. Rinse your mouth afterwards.";
    case "powder":
      return "Dissolve the powder or granules in the specified amount of water (usually a glass). Stir well and drink immediately after preparation. Do not store the reconstituted solution for later use.";
    case "soap":
      return "Wet the skin, work the soap into a lather, gently massage onto the affected or required area, then rinse thoroughly with water. Use 1–2 times daily or as directed.";
    case "device":
      return "Read the product manual carefully before use. Follow the manufacturer's instructions for setup, calibration, and cleaning. Store in a dry place away from children.";
    default:
      return "Use exactly as directed by your doctor or pharmacist. Read the product label carefully. Do not exceed the recommended dose.";
  }
}

// ---------------------------------------------------------------------------
// "Uses & Benefits" — derived from composition + category. Generic message
// when neither is available.
// ---------------------------------------------------------------------------
function usesAndBenefits(product: Pick<Product, "composition" | "genericName" | "category" | "name" | "shortDescription">): string {
  const parts: string[] = [];
  if (product.shortDescription) {
    parts.push(product.shortDescription);
  }
  if (product.composition) {
    parts.push(
      `This medicine contains ${product.composition}. It is used to treat the condition(s) it has been prescribed for — typically relieving symptoms related to ${product.category?.name?.toLowerCase() ?? "the affected condition"}.`
    );
  } else if (product.genericName) {
    parts.push(
      `This medicine contains the active ingredient ${product.genericName}, commonly used for ${product.category?.name?.toLowerCase() ?? "the relevant condition"}.`
    );
  } else {
    parts.push(
      `${product.name} is a ${product.category?.name?.toLowerCase() ?? "pharmacy"} product. Consult your doctor or pharmacist for the specific indications and benefits of this medicine.`
    );
  }
  parts.push(
    "Always take this medicine exactly as prescribed. Do not share it with others even if their symptoms appear similar."
  );
  return parts.join("\n\n");
}

// ---------------------------------------------------------------------------
// "Side Effects" — common side effects per category. Generic if unknown.
// ---------------------------------------------------------------------------
function sideEffects(product: Pick<Product, "category" | "prescriptionRequired">): string {
  const cat = (product.category?.name ?? "").toLowerCase();
  // Simple keyword routing based on the category name.
  if (/pain|fever|analgesic|nsaid/.test(cat)) {
    return [
      "Common side effects may include:",
      "• Nausea or indigestion",
      "• Stomach pain or discomfort",
      "• Heartburn",
      "• Dizziness or headache",
      "• Mild allergic rash (rare)",
      "",
      "Serious side effects are rare but seek immediate medical attention if you experience black stools, severe abdominal pain, persistent vomiting, or signs of an allergic reaction (swelling, difficulty breathing).",
    ].join("\n");
  }
  if (/antibiotic|infection/.test(cat)) {
    return [
      "Common side effects may include:",
      "• Nausea or vomiting",
      "• Diarrhoea or loose stools",
      "• Mild skin rash",
      "• Headache",
      "• Changes in taste",
      "",
      "Stop taking the medicine and consult your doctor immediately if you develop severe diarrhoea, yellowing of the skin or eyes, or any signs of an allergic reaction.",
    ].join("\n");
  }
  if (/vitamin|supplement|nutr/.test(cat)) {
    return [
      "Most people do not experience any side effects when taken at the recommended dose.",
      "Rare side effects may include:",
      "• Mild stomach upset",
      "• Nausea",
      "• Headache",
      "• Unusual taste in the mouth",
      "",
      "Discontinue use and consult your doctor if you experience any persistent or severe symptoms.",
    ].join("\n");
  }
  if (/skin|cream|ointment|topical/.test(cat)) {
    return [
      "Common side effects may include:",
      "• Mild burning, stinging, or irritation at the application site",
      "• Redness or dryness of the skin",
      "• Itching",
      "• Skin peeling (rare)",
      "",
      "Discontinue use and consult your doctor if irritation persists, worsens, or if you develop signs of an allergic reaction.",
    ].join("\n");
  }
  if (/cough|cold|respiratory/.test(cat)) {
    return [
      "Common side effects may include:",
      "• Drowsiness or dizziness",
      "• Dry mouth",
      "• Nausea",
      "• Mild headache",
      "• Constipation",
      "",
      "Avoid driving or operating machinery if you feel drowsy. Consult your doctor if symptoms persist or worsen.",
    ].join("\n");
  }
  if (/diabetic|sugar|diabetes/.test(cat)) {
    return [
      "Common side effects may include:",
      "• Low blood sugar (hypoglycaemia) — sweating, shakiness, hunger, confusion",
      "• Nausea or stomach upset",
      "• Mild weight gain",
      "• Headache",
      "",
      "Carry a fast-acting sugar source (glucose tablets, juice) in case of low blood sugar. Seek medical help if you experience persistent low blood sugar or any allergic reactions.",
    ].join("\n");
  }
  // Generic fallback — Rx vs OTC framing.
  if (product.prescriptionRequired) {
    return [
      "Side effects vary depending on the active ingredient and individual response. Common possibilities include:",
      "• Nausea or stomach upset",
      "• Headache or dizziness",
      "• Mild allergic reactions (rash, itching)",
      "• Changes in appetite or sleep",
      "",
      "This is a prescription medicine — your doctor has weighed the benefits against potential side effects before prescribing it. Report any unexpected or severe side effects to your doctor immediately.",
    ].join("\n");
  }
  return [
    "Most people use this product without any side effects. Rare possibilities include:",
    "• Mild stomach upset",
    "• Allergic rash (rare)",
    "• Headache",
    "",
    "Discontinue use and consult your doctor or pharmacist if you experience any persistent or unusual symptoms.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// "Warnings & Precautions" — standard warnings with extra caution for Rx.
// ---------------------------------------------------------------------------
function warnings(product: Pick<Product, "prescriptionRequired" | "category" | "name">): string {
  const lines: string[] = [
    "General precautions:",
    "• Inform your doctor about any other medicines you are taking, including over-the-counter drugs and herbal supplements.",
    "• Inform your doctor if you are pregnant, planning to become pregnant, or breastfeeding before using this medicine.",
    "• Do not use this medicine if you are allergic to any of its ingredients. Check the label carefully.",
    "• Keep out of reach of children.",
    "• Do not exceed the recommended dose or duration of use.",
  ];
  if (product.prescriptionRequired) {
    lines.push(
      "",
      "This is a prescription medicine. Use only under medical supervision. A valid doctor's prescription is required to purchase this medicine."
    );
  }
  const cat = (product.category?.name ?? "").toLowerCase();
  if (/diabetic|sugar/.test(cat)) {
    lines.push(
      "",
      "Diabetic medicines: Monitor your blood sugar regularly. Avoid alcohol while taking this medicine as it may affect blood sugar control."
    );
  }
  if (/antibiotic/.test(cat)) {
    lines.push(
      "",
      "Antibiotics: Complete the full course as prescribed, even if you feel better. Stopping early can cause the infection to return and may contribute to antibiotic resistance."
    );
  }
  if (/pain|nsaid/.test(cat)) {
    lines.push(
      "",
      "Pain relievers: Take with or after food to reduce stomach irritation. Avoid long-term use without medical supervision. Not recommended for people with stomach ulcers or kidney problems without consulting a doctor."
    );
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// "Storage" — standard storage instructions.
// ---------------------------------------------------------------------------
function storage(product: Pick<Product, "category" | "prescriptionRequired">): string {
  const cat = (product.category?.name ?? "").toLowerCase();
  if (/insulin|injection|vial/.test(cat)) {
    return [
      "Storage instructions:",
      "• Store in the refrigerator (2°C – 8°C). Do not freeze.",
      "• Protect from light. Keep in the original carton.",
      "• Once opened, follow the product-specific storage instructions (some may be stored at room temperature below 25°C for up to 28 days).",
      "• Discard if the solution changes colour or shows particles.",
    ].join("\n");
  }
  if (/syrup|suspension|liquid|drops/.test(cat)) {
    return [
      "Storage instructions:",
      "• Store below 25°C in a cool, dry place.",
      "• Protect from direct sunlight and heat.",
      "• Keep the bottle tightly closed when not in use.",
      "• Use within the period marked on the label after opening (typically 14–28 days).",
      "• Do not refrigerate unless advised by your pharmacist.",
    ].join("\n");
  }
  if (/cream|ointment|gel|lotion/.test(cat)) {
    return [
      "Storage instructions:",
      "• Store below 25°C in a cool, dry place.",
      "• Protect from direct sunlight and freezing.",
      "• Keep the tube tightly closed after each use.",
      "• Do not use past the expiry date printed on the pack.",
    ].join("\n");
  }
  return [
    "Storage instructions:",
    "• Store below 25°C in a cool, dry place.",
    "• Protect from direct sunlight, heat, and moisture.",
    "• Keep in the original packaging until needed.",
    "• Keep out of reach of children.",
    "• Do not use past the expiry date printed on the pack.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// "Disclaimer" — standard medical disclaimer.
// ---------------------------------------------------------------------------
function disclaimer(): string {
  return [
    "This information is provided for general educational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment.",
    "",
    "Always seek the advice of your doctor or qualified healthcare provider with any questions you may have regarding a medical condition. Never disregard professional medical advice or delay in seeking it because of something you have read here.",
    "",
    `Pradeep Medical Store is a licensed pharmacy in Mathura. Our licensed pharmacists review every prescription order before dispatch. For any questions about this medicine, please call us or consult your doctor.`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Public API — generate all sections for a product.
// ---------------------------------------------------------------------------
export function generateProductInfo(
  product: Pick<Product, "name" | "shortDescription" | "composition" | "genericName" | "category" | "prescriptionRequired" | "unit" | "packSize">
): ProductInfoSection[] {
  const dosageForm = detectDosageForm(product);
  return [
    {
      key: "uses",
      title: "Uses & Benefits",
      body: usesAndBenefits(product),
    },
    {
      key: "how-to-use",
      title: "How to Use",
      body: howToUse(dosageForm),
    },
    {
      key: "side-effects",
      title: "Side Effects",
      body: sideEffects(product),
    },
    {
      key: "warnings",
      title: "Warnings & Precautions",
      body: warnings(product),
    },
    {
      key: "storage",
      title: "Storage",
      body: storage(product),
    },
    {
      key: "disclaimer",
      title: "Disclaimer",
      body: disclaimer(),
    },
  ];
}
