// ============================================================================
// File: src/app/api/admin/ai/generate-marketing/route.ts
// Purpose: AI Marketing Content Generator — generates social media posts,
//          email campaigns, promotional content, HTML emails, and campaign
//          ideas for pharmacy products. Supports seasonal/festival campaigns.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, parseBody } from "@/lib/api";
import { aiChatCompletion } from "@/lib/ai-service";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function POST(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const body = await parseBody<{
    productId?: string;
    /** Optional: array of product IDs for multi-product campaigns. When
     *  provided, the email highlights all selected products. The first
     *  product is treated as the primary/"hero" product. */
    productIds?: string[];
    platforms?: string[];
    tone?: string;
    campaignType?: string; // diwali, independence_day, monsoon, etc.
  }>(req);

  // Support both productId (legacy) and productIds (multi-select).
  const idsRaw = Array.from(
    new Set([
      ...((body && Array.isArray(body.productIds)) ? body.productIds : []),
      ...(body && body.productId ? [body.productId] : []),
    ])
  );
  if (idsRaw.length === 0) return err("At least one product ID is required", 400);

  const platforms = (body && Array.isArray(body.platforms) && body.platforms.length) ? body.platforms : ["email"];
  const tone = (body && body.tone) || "promotional";
  const campaignType = (body && body.campaignType) || "";

  try {
    const products = await db.product.findMany({
      where: { id: { in: idsRaw } },
      select: {
        id: true,
        name: true, slug: true, shortDescription: true, composition: true,
        sellingPrice: true, mrp: true, brand: { select: { name: true } },
        category: { select: { name: true } }, prescriptionRequired: true,
        primaryImage: true,
      },
    });
    if (products.length === 0) return err("Products not found", 404);

    // Primary product = first selected. Used for hero image / page URL.
    const product = products[0];

    const discountPct = Number(product.mrp) > 0
      ? Math.round(((Number(product.mrp) - Number(product.sellingPrice)) / Number(product.mrp)) * 100)
      : 0;

    const siteUrl = (await getSetting<string>("store.websiteUrl")) || "https://pradeepmedical.com";
    const baseUrl = siteUrl.replace(/\/$/, "");
    const productPageUrl = `${baseUrl}/products/${product.slug}`;
    const rawImage = product.primaryImage || "";
    const productImageUrl = rawImage
      ? (rawImage.startsWith("http") ? rawImage : `${baseUrl}${rawImage.startsWith("/") ? "" : "/"}${rawImage}`)
      : "";

    // Build a single string describing all selected products (used by the AI
    // to write copy that references each product).
    const productListText = products
      .map((p, i) => {
        const pct = Number(p.mrp) > 0
          ? Math.round(((Number(p.mrp) - Number(p.sellingPrice)) / Number(p.mrp)) * 100)
          : 0;
        return `  ${i + 1}. ${p.name} — Brand: ${p.brand?.name || "Unknown"} | ₹${Number(p.sellingPrice)} (MRP ₹${Number(p.mrp)}, ${pct}% off) | ${p.prescriptionRequired ? "Rx required" : "OTC"} | ${p.shortDescription || "Quality pharmacy product"}`;
      })
      .join("\n");

    // ── Build campaign context ──
    const campaignContext = campaignType
      ? `\nCampaign Theme: ${campaignType.replace(/_/g, " ")}\nTailor the content to this campaign theme. Use relevant cultural references, seasonal language, and appropriate tone.`
      : "";

    // ── Prompt 1: Marketing content (JSON) ──
    const prompt = `You are a pharmacy marketing expert for "Pradeep Medical Store" in Mathura, India. Generate professional email marketing content. Return ONLY valid JSON.

Selected product(s):
${productListText}

Tone: ${tone}${campaignContext}

Generate EMAIL-focused marketing content. Return JSON:
{
  "email": {
    "subject": "Email subject line (max 60 chars, compelling, urgency-driven)",
    "body": "Plain-text email body, 3-4 paragraphs, professional tone, include product benefits and price."
  },
  "previewText": "Preview text (max 90 chars) shown next to the subject in inboxes. Must complement the subject, not repeat it.",
  "headline": "Marketing headline for the email hero section (max 80 chars). Bold, benefit-driven.",
  "promotionalDescription": "1-2 sentence promotional description of the offer/product(s) shown under the headline. Persuasive, concrete.",
  "ctaText": "Call-to-action button text, max 25 chars (e.g. 'Shop Now', 'Order Today', 'Get Yours')",
  "campaignTitle": "Short internal campaign title (max 50 chars)",
  "campaignDescription": "1-2 sentence campaign summary for admin reference",
  "suggestedEmoji": "Single emoji representing this campaign",
  "priority": "normal|high|urgent",
  "whatsapp": "Short WhatsApp teaser with emojis, max 200 chars. Include price and discount. (Optional cross-channel reuse.)",
  "sms": "SMS teaser, max 160 chars, include price and offer. (Optional cross-channel reuse.)"
}

Rules:
- Use ₹ symbol for prices
- Mention "Pradeep Medical Store" in the email body
- Include "Free delivery above ₹500" where space allows
- For prescription medicines, add "Prescription required" disclaimer
- Content should sound natural, trustworthy, and medically appropriate
- Return ONLY the JSON, no markdown`;

    const result = await aiChatCompletion(
      [{ role: "system", content: "You are a pharmacy marketing expert. Return only valid JSON." }, { role: "user", content: prompt }],
      { temperature: 0.7, max_tokens: 1500 }
    );

    const content = result.content?.trim() || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return err("AI did not return valid JSON", 500);

    let generated: any;
    try { generated = JSON.parse(jsonMatch[0]); } catch { return err("AI returned invalid JSON", 500); }

    // ── Prompt 2: HTML email (dark theme, responsive) ──
    let htmlEmail: string | undefined;
    try {
      const emailSystemPrompt = "You are a professional email marketing designer for a pharmacy. Generate a complete, responsive HTML email. Output ONLY raw HTML, no markdown.";

      const productsBlock = products
        .map((p, i) => {
          const pct = Number(p.mrp) > 0
            ? Math.round(((Number(p.mrp) - Number(p.sellingPrice)) / Number(p.mrp)) * 100)
            : 0;
          const url = `${baseUrl}/products/${p.slug}`;
          const img = p.primaryImage
            ? (p.primaryImage.startsWith("http")
                ? p.primaryImage
                : `${baseUrl}${p.primaryImage.startsWith("/") ? "" : "/"}${p.primaryImage}`)
            : "";
          return `  ${i + 1}. ${p.name} | Brand: ${p.brand?.name || "Unknown"} | Price: ₹${Number(p.sellingPrice)} (MRP ₹${Number(p.mrp)}, ${pct}% off) | URL: ${url} | Image: ${img || "N/A"} | ${p.prescriptionRequired ? "Rx required" : "OTC"} | Desc: ${p.shortDescription || "Quality pharmacy product"}`;
        })
        .join("\n");

      const emailUserPrompt = `Generate a complete responsive HTML email for this pharmacy marketing campaign.

Store: Pradeep Medical Store (Mathura, India)
Website: ${baseUrl}
Logo URL: ${baseUrl}/logo.png (use as the brand logo in the header)

Selected product(s):
${productsBlock}

Headline to use: ${generated.headline || product.name}
Promotional description: ${generated.promotionalDescription || product.shortDescription || "Quality pharmacy product"}
CTA button text: ${generated.ctaText || "Shop Now"}
CTA button URL: ${productPageUrl}

Requirements:
- Full <!DOCTYPE html> document, table-based layout, inline CSS only
- Dark theme: body #0f172a, card #1e293b, text #f1f5f9
- Emerald accents: #10b981, #059669, #0d9488
- Header: gradient emerald bar with the brand logo image (use ${baseUrl}/logo.png) on the left + "Pradeep Medical Store" wordmark
- For EACH selected product: show product image (max-width 100%, border-radius 12px), product name as h2, short description, price row with discount badge, and an individual CTA button linking to its product page URL
- Hero section at the top: large headline + promotional description
- Primary CTA button: emerald bg, white bold text "${generated.ctaText || "Shop Now"} →", links to ${productPageUrl}
- Footer: store name, address "Main Market, Mathura, Uttar Pradesh 281001", "Free delivery above ₹500", phone +91 99999 99999, email care@pradeepmedical.com
- Max width 600px, mobile responsive
- ${product.prescriptionRequired ? "Include prescription-required disclaimer above footer" : "No prescription disclaimer needed"}

Output ONLY raw HTML. No markdown, no code fences.`;

      const htmlResult = await aiChatCompletion(
        [{ role: "system", content: emailSystemPrompt }, { role: "user", content: emailUserPrompt }],
        { temperature: 0.5, max_tokens: 3500 }
      );

      let html = htmlResult.content?.trim() || "";
      html = html.replace(/^```(?:html)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
      if (html && (/<html[\s>]/i.test(html) || /<!doctype html/i.test(html))) {
        htmlEmail = html;
      }
    } catch (e: any) {
      console.error("[ai/generate-marketing] htmlEmail error:", e?.message?.slice(0, 200));
    }

    if (htmlEmail) generated.htmlEmail = htmlEmail;

    return ok({
      content: generated,
      productName: products.length === 1 ? product.name : `${product.name} + ${products.length - 1} more`,
      productNames: products.map((p) => p.name),
    });
  } catch (e: any) {
    console.error("[ai/generate-marketing] error:", e?.message?.slice(0, 200));
    return err("Marketing content generation failed: " + (e?.message || "unknown error"), 500);
  }
}
