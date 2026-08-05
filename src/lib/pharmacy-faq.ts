// ============================================================================
// File: src/lib/pharmacy-faq.ts
// Purpose: Static FAQ knowledge base for the PMS Assistant.
//          The health-assistant API consults this list BEFORE calling the LLM
//          so that common pharmacy questions (delivery, payments, returns,
//          hours, etc.) get an instant, deterministic, zero-cost answer.
//
// Role: Single source of truth for FAQ entries. Each entry has:
//        - keywords: lowercase tokens matched against the user's query
//        - question: a human-readable rephrasing (used for chips/UX)
//        - answer:   the final text returned to the customer
//
// Matching rules (see `matchFaq` below):
//   - The user's query is lowercased and tokenized on whitespace + punctuation.
//   - An entry matches if ANY of its keywords appears as a substring of the
//     query OR as a whole-word token. Multi-word keywords (e.g. "cash on
//     delivery") require the full phrase to appear in the query.
//   - The FIRST matching entry wins (order matters — put more specific entries
//     at the top of the array).
//
// Phase 28.4: Expanded with 20+ new entries covering OTC vs Rx, generics,
// dosage forms, storage, drug interactions, side effects, pregnancy /
// breastfeeding, child dosing, emergencies, refills, expiry, insurance,
// returns, order tracking, and the loyalty program — turning the assistant
// into a genuine pharmacy helper rather than a generic chatbot.
// ============================================================================

export interface PharmacyFaq {
  keywords: string[];
  question: string;
  answer: string;
}

export const PHARMACY_FAQS: PharmacyFaq[] = [
  // --------------------------------------------------------------------------
  // Store / order operations (existing — keep first so they win ties)
  // --------------------------------------------------------------------------
  {
    keywords: ["delivery time", "delivery take", "how long delivery", "delivery duration", "shipping time", "shipping take"],
    question: "How long does delivery take?",
    answer:
      "We offer same-day delivery within Mathura city (order before 6 PM). Nationwide delivery takes 2–3 business days via our courier partners.",
  },
  {
    keywords: ["delivery charge", "delivery fee", "shipping charge", "shipping fee", "delivery cost", "free delivery", "free shipping"],
    question: "What are the delivery charges?",
    answer:
      "Delivery is FREE for all orders above ₹500. For orders below ₹500 within Mathura, a flat ₹20 delivery fee applies. Nationwide shipping fees are calculated at checkout based on the courier's weight slab.",
  },
  {
    keywords: ["upload prescription", "how to upload", "upload rx", "prescription upload"],
    question: "How do I upload my prescription?",
    answer:
      "Go to the 'Upload Prescription' page (from the menu or any product page), select your prescription image or PDF, and click upload. Our pharmacist verifies it within 30 minutes during store hours (8 AM – 10 PM IST). You'll get a WhatsApp/SMS notification once approved.",
  },
  {
    keywords: ["payment", "pay", "upi", "card", "net banking", "payment method", "payment option"],
    question: "What payment methods do you accept?",
    answer:
      "We accept UPI (PhonePe, Google Pay, Paytm, BHIM), all major credit/debit cards, Net Banking, and Cash on Delivery (COD) for orders within Mathura. All online payments are secured via 256-bit SSL encryption.",
  },
  {
    keywords: ["cod", "cash on delivery", "pay on delivery"],
    question: "Is Cash on Delivery available?",
    answer:
      "Yes! Cash on Delivery (COD) is available for all orders within Mathura city. For nationwide shipping, online payment (UPI/Card/Net Banking) is required in advance.",
  },
  {
    keywords: ["track order", "track my order", "order status", "where is my order", "track package"],
    question: "How do I track my order?",
    answer:
      "Go to 'My Orders' in your account, find your order, and tap 'Track Order' to see real-time status (Confirmed → Packed → Out for Delivery → Delivered). You'll also receive SMS/WhatsApp updates at each stage. For same-day Mathura orders, our delivery agent will call you before arriving.",
  },
  {
    keywords: ["store hours", "opening hours", "closing time", "open today", "timing", "open now"],
    question: "What are your store hours?",
    answer:
      "Pradeep Medical Store is open every day from 8:00 AM to 10:00 PM IST. Online orders can be placed 24/7, but prescription verification and same-day delivery happen only during store hours.",
  },
  {
    keywords: ["contact", "phone number", "call", "whatsapp", "email", "reach"],
    question: "How do I contact you?",
    answer:
      "Call/WhatsApp us at +91 99999 99999 (8 AM – 10 PM IST), or use the Contact Us page to send an email. For order-specific queries, please keep your order ID ready. We're located at Main Market, Mathura, Uttar Pradesh 281001.",
  },
  {
    keywords: ["cancel order", "cancel my order", "order cancel", "cancellation"],
    question: "Can I cancel my order?",
    answer:
      "Yes — orders can be cancelled free of charge before they are shipped (usually within 2 hours of placing the order). Go to 'My Orders', select the order, and tap 'Cancel Order'. Refunds for prepaid orders are processed to the original payment method within 5–7 business days.",
  },
  {
    keywords: ["discount", "offer", "coupon", "promo code", "voucher", "save money"],
    question: "Are there any discounts or offers available?",
    answer:
      "Yes! Check the homepage for today's deals and limited-time offers. You can also apply coupon codes at checkout. Subscribe to our WhatsApp updates for exclusive weekly offers. Bundle purchases (like First Aid Kit, Diabetes Care) come with built-in savings of up to 15%.",
  },
  {
    keywords: ["bundle", "health bundle", "care kit", "first aid kit", "combo"],
    question: "What are health bundles?",
    answer:
      "Health bundles are curated kits of medically-related products (e.g. First Aid Kit, Diabetes Care, Cold & Flu Care). Each bundle offers a convenient single purchase with built-in savings. View all bundles on the 'Health Bundles' page from the menu or homepage.",
  },
  {
    keywords: ["location", "address", "where are you", "store location", "shop address"],
    question: "Where is your store located?",
    answer:
      "Pradeep Medical Store is located at Main Market, Mathura, Uttar Pradesh 281001. We ship nationwide from this location. Same-day delivery is available within Mathura city limits.",
  },
  {
    keywords: ["account", "register", "login", "sign up", "sign in", "log in"],
    question: "Do I need an account to order?",
    answer:
      "You can browse products without an account, but you'll need to register (with email + OTP verification) to place an order. This ensures secure delivery and lets you track orders, save addresses, and reorder medicines. Registration is free and takes less than a minute.",
  },
  {
    keywords: ["medicine request", "request medicine", "not available", "out of stock", "request a medicine", "can't find"],
    question: "What if a medicine I need is not listed?",
    answer:
      "If you can't find a medicine in our catalog, use the 'Request Medicines' page from the menu. Type the medicine name, brand, composition, and quantity. Our pharmacist will check availability and contact you within a few hours with price and delivery details. You can also upload a prescription for faster processing.",
  },

  // --------------------------------------------------------------------------
  // PHARMACY KNOWLEDGE — OTC vs Prescription
  // --------------------------------------------------------------------------
  {
    keywords: ["otc", "over the counter", "otc medicine", "otc drug", "non prescription", "without prescription"],
    question: "What is the difference between OTC and prescription medicines?",
    answer:
      "OTC (Over-The-Counter) medicines are safe enough to be used without a doctor's supervision — e.g. paracetamol for mild fever, antacids for acidity, cough syrups for mild cough, antiseptic creams. Prescription (Rx) medicines can be harmful if misused and require a doctor's prescription by law — e.g. antibiotics, insulin, blood pressure medicines, sleeping pills. On our store, Rx products are marked with an 'Rx' badge and a valid prescription must be uploaded before dispatch.",
  },
  {
    keywords: ["when prescription", "need prescription", "require prescription", "prescription required", "rx required", "rx badge", "when do i need", "when is prescription"],
    question: "When do I need a prescription?",
    answer:
      "You need a prescription for: (1) antibiotics (e.g. amoxicillin, azithromycin), (2) hormones and steroids (e.g. insulin, prednisolone), (3) cardiac and BP medicines (e.g. amlodipine, atenolol), (4) psychotropic medicines (e.g. alprazolam), (5) injectables of any kind, and (6) habit-forming painkillers. OTC products like paracetamol (up to 650 mg), antacids, ORS, vitamins, and most topical creams do NOT require a prescription. When in doubt, look for the 'Rx' badge on the product page or consult a doctor.",
  },

  // --------------------------------------------------------------------------
  // PHARMACY KNOWLEDGE — Generic vs Branded
  // --------------------------------------------------------------------------
  {
    keywords: ["generic", "generic medicine", "substitute", "generic substitute", "generic alternative", "branded generic"],
    question: "What are generic medicines and are they safe?",
    answer:
      "A generic medicine has the SAME active ingredient (composition), strength, dosage form, and quality as the branded version — only the name, color, packaging, and price differ. Generic medicines are approved by India's CDSCO and are just as safe and effective as branded ones, typically costing 40–80% less. For example, 'Crocin' (branded) and 'Paracetamol 500 mg' (generic) both contain paracetamol and work identically. Look for the 'Generic' badge on product pages, or ask our pharmacist via chat for a generic substitute of any branded medicine.",
  },
  {
    keywords: ["branded medicine", "brand vs generic", "brand name", "trade name", "why branded costly"],
    question: "Why are branded medicines more expensive than generics?",
    answer:
      "Branded medicines cost more because the manufacturer invests in research, clinical trials, marketing, and brand building. Once the patent expires, other companies can sell the same molecule as a 'generic' at a fraction of the cost. The therapeutic effect is identical. If you're on a long-term medicine (e.g. for diabetes or BP), switching to a generic equivalent with your doctor's OK can save you thousands of rupees a year.",
  },

  // --------------------------------------------------------------------------
  // PHARMACY KNOWLEDGE — Dosage forms
  // --------------------------------------------------------------------------
  {
    keywords: ["dosage form", "tablet vs capsule", "syrup vs tablet", "injection", "cream vs ointment", "when tablet", "when syrup", "when capsule", "when injection", "when cream"],
    question: "What are the common dosage forms and when is each used?",
    answer:
      "Tablets/capsules — swallowed whole, used when the medicine works systemically (whole body) and the patient can swallow. Syrups/suspensions — measured with a dosing cup or syringe, ideal for children, the elderly, and anyone who struggles to swallow pills. Injections — administered by a nurse or doctor; used when the medicine would be destroyed by the stomach (e.g. insulin) or when rapid action is needed. Creams/ointments — applied on the skin for local issues like rashes, wounds, or joint pain. Drops — for eyes, ears, or nose, used directly at the affected site. Inhalers — for asthma and respiratory conditions, deliver medicine straight to the lungs.",
  },
  {
    keywords: ["syrup dosing", "measuring syrup", "5ml syrup", "how to take syrup", "dosing cup", "oral syringe"],
    question: "How do I measure a syrup dose correctly?",
    answer:
      "Always use the measuring cup, spoon, or oral syringe that comes with the syrup — never a kitchen spoon, which is usually inaccurate. Pour to the exact mark (e.g. 5 ml), hold at eye level to confirm, and administer slowly. For baby syrups, an oral syringe is most accurate. Shake the bottle well before each use if it says 'shake well before use' (suspensions need this to mix the medicine evenly).",
  },

  // --------------------------------------------------------------------------
  // PHARMACY KNOWLEDGE — Storage
  // --------------------------------------------------------------------------
  {
    keywords: ["medicine storage", "store medicine", "store medicines", "storing medicine", "storing medicines", "how to store", "keep medicine", "medicine temperature", "refrigerate medicine", "medicine fridge", "refrigerate", "fridge", "store my medicine", "store my medicines"],
    question: "How should I store my medicines?",
    answer:
      "Most medicines should be stored at room temperature (15–25 °C), in a dry place, away from direct sunlight and out of reach of children. Some medicines need refrigeration (2–8 °C) — these include insulin, certain eye drops, vaccines, and some antibiotics (look for 'Store in refrigerator' on the label). NEVER freeze medicines. Keep them in their original packaging with the leaflet. Avoid storing medicines in the bathroom (humidity degrades them) or the car (temperature swings).",
  },
  {
    keywords: ["insulin storage", "store insulin", "insulin fridge", "insulin room temperature"],
    question: "How should I store insulin?",
    answer:
      "Unopened insulin pens/vials must be refrigerated at 2–8 °C — never frozen. The insulin you're currently using can be kept at room temperature (below 25 °C) for up to 28 days (check the leaflet for the exact duration for your brand). Do not leave insulin in a hot car or in sunlight — heat destroys it. Always check the expiry date and discard insulin that has changed color, become cloudy (when it should be clear), or formed crystals.",
  },

  // --------------------------------------------------------------------------
  // PHARMACY KNOWLEDGE — Drug interactions
  // --------------------------------------------------------------------------
  {
    keywords: ["drug interaction", "medicine interaction", "combining medicine", "take together", "mixing medicine", "interaction with", "contraindication", "two medicines", "take two", "take with other medicine"],
    question: "Can I take two medicines together?",
    answer:
      "Some medicines interact with each other and can cause serious harm — e.g. taking two blood thinners together increases bleeding risk, certain antibiotics reduce the effect of contraceptive pills, and some antacids block the absorption of antibiotics. ALWAYS tell your doctor about every medicine you take, including OTC products, herbal supplements, and vitamins. If you're buying two or more prescription medicines from us, our pharmacist will review them for interactions before dispatch. When in doubt, consult your doctor before combining medicines.",
  },
  {
    keywords: ["food interaction", "medicine with food", "empty stomach", "after food", "before food", "with milk", "with alcohol", "grapefruit"],
    question: "Should I take my medicine before or after food?",
    answer:
      "It depends on the medicine. Some must be taken on an empty stomach (e.g. levothyroxine, omeprazole — at least 30–60 min before food) for proper absorption. Others must be taken AFTER food to prevent stomach irritation (e.g. ibuprofen, diclofenac, paracetamol in high doses). Some should NOT be taken with milk or dairy (e.g. tetracycline antibiotics). Alcohol should be avoided with most medicines — especially painkillers, antibiotics, and sedatives. Grapefruit juice interacts with several BP and cholesterol medicines. Always read the label or ask our pharmacist if you're unsure.",
  },

  // --------------------------------------------------------------------------
  // PHARMACY KNOWLEDGE — Side effects
  // --------------------------------------------------------------------------
  {
    keywords: ["side effect", "adverse reaction", "side effects", "medicine reaction", "allergy to medicine", "rash from medicine", "medicine allergy", "allergic reaction"],
    question: "What should I do if I get a side effect from a medicine?",
    answer:
      "Mild side effects (slight nausea, mild headache, drowsiness) often go away as your body adjusts — keep taking the medicine unless your doctor says otherwise. Stop the medicine immediately and seek urgent medical help if you notice: difficulty breathing, swelling of the face/lips/tongue, severe rash or hives, yellowing of eyes (jaundice), severe vomiting, or any bleeding. Report the reaction to your doctor and to us — we'll record it on your profile. You can also report serious side effects to India's national pharmacovigilance program at pvpiipc.org.",
  },

  // --------------------------------------------------------------------------
  // PHARMACY KNOWLEDGE — Pregnancy & breastfeeding
  // --------------------------------------------------------------------------
  {
    keywords: ["pregnancy", "pregnant", "during pregnancy", "safe in pregnancy", "breastfeeding", "lactation", "nursing mother", "while pregnant"],
    question: "Can I take medicines during pregnancy or while breastfeeding?",
    answer:
      "Many medicines can harm the baby during pregnancy or pass into breast milk — so NEVER self-medicate when pregnant or breastfeeding. Paracetamol (in standard doses) is generally considered safe for short-term fever or pain, but ibuprofen, aspirin, most antibiotics, and almost all prescription medicines need a doctor's clearance. Always tell your doctor if you're pregnant, planning pregnancy, or breastfeeding before they prescribe anything. We will not dispense any prescription medicine to a pregnant or nursing customer without a valid prescription that notes the pregnancy.",
  },

  // --------------------------------------------------------------------------
  // PHARMACY KNOWLEDGE — Child dosing
  // --------------------------------------------------------------------------
  {
    keywords: ["child dose", "child dosing", "pediatric dose", "kids dose", "baby medicine", "infant dose", "medicine for children", "medicine for kids", "children dose"],
    question: "How is medicine dosing different for children?",
    answer:
      "Children's doses are calculated by weight (mg per kg of body weight), NOT by age alone — a 5-year-old weighing 18 kg needs a different dose than one weighing 14 kg. Always use a proper measuring syringe or cup (never a kitchen spoon). Never give aspirin to a child under 16 (it can cause a serious condition called Reye's syndrome). For fever, paracetamol pediatric syrup is usually the first choice. For any child under 2 years, or for any prescription medicine, ALWAYS consult a pediatrician first.",
  },

  // --------------------------------------------------------------------------
  // PHARMACY KNOWLEDGE — Emergencies
  // --------------------------------------------------------------------------
  {
    keywords: ["emergency", "urgent", "112", "ambulance", "poison", "medical emergency"],
    question: "What should I do in a medical emergency?",
    answer:
      "For any medical emergency, please call 112 (India's national emergency number) immediately or go to your nearest hospital. Do NOT rely on this chat for emergencies. For poisoning or suspected overdose, call the National Poison Control Centre at +91 11 2394 7047. If someone has collapsed, is not breathing, has severe bleeding, chest pain, sudden weakness on one side, or a seizure, call 112 right away — every minute counts.",
  },
  {
    keywords: ["when to see doctor", "when to consult doctor", "doctor consultation", "see a doctor", "consult physician"],
    question: "When should I see a doctor instead of self-medicating?",
    answer:
      "See a doctor if: (1) your symptoms last more than 3 days or are getting worse, (2) you have a high fever (above 102 °F / 39 °C) that doesn't respond to paracetamol, (3) you have severe pain, vomiting, diarrhea, or blood in stool/urine, (4) the patient is a child under 2, an elderly person, pregnant, or has a chronic illness (diabetes, BP, kidney/liver disease), (5) you think you need an antibiotic — antibiotics do NOT work for viral infections (common cold, flu, viral fever) and taking them unnecessarily makes future infections harder to treat. Our assistant can help you find products, but a doctor's diagnosis is always best for anything beyond minor, self-limiting illnesses.",
  },

  // --------------------------------------------------------------------------
  // PHARMACY KNOWLEDGE — Refills & prescriptions
  // --------------------------------------------------------------------------
  {
    keywords: ["refill prescription", "how to refill", "reorder prescription", "refill rx", "prescription refill"],
    question: "How do I refill a prescription medicine?",
    answer:
      "Two easy ways: (1) Go to 'My Orders', find your previous Rx order, and tap 'Reorder' — the items will be added to your cart and you can upload your new prescription at checkout. (2) Go to 'Upload Prescription' and upload a fresh prescription from your doctor. For chronic conditions (diabetes, BP, thyroid), you can also set up a Refill Reminder from your account — we'll alert you a few days before your medicine runs out so you never miss a dose.",
  },
  {
    keywords: ["repeat", "reorder", "refill", "buy again"],
    question: "Can I reorder my previous medicines?",
    answer:
      "Yes! Go to 'My Orders', find the order you want to repeat, and tap 'Reorder'. All items will be added to your cart. You can also set up Medicine Reminders from your account to get refill alerts on schedule.",
  },
  {
    keywords: ["prescription validity", "valid prescription", "old prescription", "how long prescription valid"],
    question: "How long is a prescription valid for?",
    answer:
      "In India, a prescription is generally valid for 30 days from the date it is issued for most medicines. For habit-forming medicines (sleeping pills, strong painkillers), the validity is shorter and strict records are maintained. For chronic conditions like diabetes or BP, doctors often write 'repeat' on the prescription — we honor that for up to 6 months for non-habit-forming medicines, but we recommend getting a fresh review every 3–6 months. If your prescription is older than 30 days, please upload a new one to avoid dispatch delays.",
  },

  // --------------------------------------------------------------------------
  // PHARMACY KNOWLEDGE — Expiry
  // --------------------------------------------------------------------------
  {
    keywords: ["expiry", "expiration", "expire", "shelf life", "expired medicine"],
    question: "How do I check the expiry date and what do I do with expired medicines?",
    answer:
      "The expiry date is printed on the back or side of every strip/bottle as 'MFG/EXP' or 'EXP' followed by a month-year (e.g. EXP 08/26 means August 2026). NEVER take a medicine after its expiry date — it may have lost potency or become harmful. We follow strict FIFO inventory and never ship medicines with less than 6 months until expiry; if you ever receive a short-dated or expired product, contact us immediately for a free replacement. To dispose of expired medicines safely, drop them at any pharmacy (we accept them) — do NOT flush them or throw them in regular trash, as they can contaminate water and soil.",
  },
  {
    keywords: ["medicine disposal", "dispose medicine", "throw medicine", "discard expired medicine"],
    question: "How do I safely dispose of expired or unused medicines?",
    answer:
      "Do NOT flush medicines down the toilet or throw them in the household bin — they can pollute water and harm wildlife. Bring them to our store (or any pharmacy) and we'll send them for safe incineration through authorized waste handlers. If that's not possible, mix the tablets with used coffee grounds or cat litter in a sealed bag before throwing them in the trash. Always scratch out your name and prescription details on the empty strip before disposal to protect your privacy.",
  },

  // --------------------------------------------------------------------------
  // PHARMACY KNOWLEDGE — Antibiotic stewardship
  // --------------------------------------------------------------------------
  {
    keywords: ["antibiotic course", "complete antibiotic", "stop antibiotic", "antibiotic resistance", "antibiotic misuse"],
    question: "Why must I complete the full course of antibiotics?",
    answer:
      "Even if you feel better after 2–3 days, you MUST complete the full antibiotic course (usually 5–7 days). Stopping early leaves the strongest bacteria alive — they multiply, become resistant to the antibiotic, and your next infection becomes much harder to treat. This is called antibiotic resistance, and it's a global health crisis. Never share your antibiotics with others, never save leftover antibiotics for 'next time', and never take antibiotics without a doctor's prescription — they do NOT work against viral infections like the common cold or flu.",
  },

  // --------------------------------------------------------------------------
  // PHARMACY KNOWLEDGE — Insurance & claims
  // --------------------------------------------------------------------------
  {
    keywords: ["insurance", "insurance claim", "mediclaim", "cashless", "reimbursement", "tpa", "health insurance"],
    question: "Do you accept health insurance / mediclaim?",
    answer:
      "We are a retail pharmacy, so we do not offer cashless insurance billing at the counter. However, we provide a detailed tax invoice with your order (GST number, HSN codes, item-wise pricing) which is accepted by all major insurers (Star Health, ICICI Lombard, HDFC Ergo, etc.) and TPAs for reimbursement claims. Download your invoice from 'My Orders' → Order Details → 'Download Invoice'. For reimbursement claims, submit the original prescription along with the pharmacy invoice to your insurer.",
  },

  // --------------------------------------------------------------------------
  // PHARMACY KNOWLEDGE — Returns & refunds
  // --------------------------------------------------------------------------
  {
    keywords: ["return", "refund", "money back", "return policy", "refund policy"],
    question: "What is your return and refund policy?",
    answer:
      "Due to health & safety regulations, medicines cannot be returned once sold. However, if you receive a damaged, expired, or wrong product, we offer a full refund or replacement within 7 days — just contact us with your order ID and a photo. Non-medicine items (devices, wellness products) can be returned within 7 days if unopened and in original packaging. Refunds for prepaid orders are processed to the original payment method within 5–7 business days.",
  },

  // --------------------------------------------------------------------------
  // PHARMACY KNOWLEDGE — Loyalty program
  // --------------------------------------------------------------------------
  {
    keywords: ["loyalty", "loyalty points", "reward points", "points", "earn points", "redeem points"],
    question: "How does the PMS Loyalty Program work?",
    answer:
      "Earn 1 loyalty point for every ₹100 you spend (1 point = ₹1). Points are credited to your account automatically once your order is delivered, and you can redeem them at checkout for a discount on future orders — up to 10% of the order value. Check your balance in 'My Account' → 'Loyalty Points'. Points expire 12 months after they are earned, so use them before they lapse. Bonus: first-time customers get 50 welcome points on signup.",
  },
  {
    keywords: ["welcome points", "signup bonus", "first order points", "free points"],
    question: "Do I get any points for signing up?",
    answer:
      "Yes! Every new customer receives 50 welcome points on signup (worth ₹50) — credited automatically after email verification. You can redeem them on your first order above ₹500. No code needed — the discount option will appear at checkout.",
  },

  // --------------------------------------------------------------------------
  // PHARMACY KNOWLEDGE — Sharing prescriptions / self-medication
  // --------------------------------------------------------------------------
  {
    keywords: ["share prescription", "someone else prescription", "use another prescription", "give medicine to other", "share medicine"],
    question: "Can I use someone else's prescription or share my medicines?",
    answer:
      "No — never share prescription medicines. A prescription is issued specifically for one person based on their age, weight, medical history, and current conditions. What's safe for one person can be dangerous for another, even if the symptoms look similar. Never give your prescription medicine to a friend or family member, and never take someone else's prescription medicine yourself. Doing so can cause serious harm and is also against the law. If someone you know needs a similar medicine, please ask them to consult a doctor.",
  },
];

// ---------------------------------------------------------------------------
// Matcher
// ---------------------------------------------------------------------------

/**
 * Tokenize a query into lowercase words (split on whitespace + punctuation).
 * "How to track my order?" → ["how", "to", "track", "my", "order"]
 */
function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((t) => t.length > 1);
}

/**
 * Find the best-matching FAQ entry for a user's query.
 *
 * Algorithm:
 *   - For each FAQ entry, score it by counting how many of its keywords
 *     appear in the query (either as a substring or as whole tokens).
 *   - Multi-word keywords require the full phrase to be a substring of the
 *     query (e.g. "cash on delivery" must appear verbatim).
 *   - Return the entry with the highest score, or null if no entry scored > 0.
 *   - Ties are broken by array order (first entry wins).
 *
 * Returns `{ faq, score }` or `null`.
 */
export function matchFaq(query: string): { faq: PharmacyFaq; score: number } | null {
  if (!query || typeof query !== "string") return null;
  const q = query.toLowerCase();
  const tokens = new Set(tokenize(query));

  let best: { faq: PharmacyFaq; score: number } | null = null;

  for (const faq of PHARMACY_FAQS) {
    let score = 0;
    for (const kw of faq.keywords) {
      const k = kw.toLowerCase();
      if (k.includes(" ")) {
        // Multi-word keyword — require verbatim substring match.
        if (q.includes(k)) score += 3;
      } else {
        // Single-word keyword — match if it appears as a whole token OR
        // as a substring of any token (handles plurals like "delivery"/"deliveries").
        if (tokens.has(k)) score += 2;
        else if (q.includes(k)) score += 1;
      }
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { faq, score };
    }
  }

  // Require a minimum score of 2 to avoid false positives on tiny queries.
  if (!best || best.score < 2) return null;
  return best;
}
