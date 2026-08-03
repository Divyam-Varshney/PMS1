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
    platforms?: string[];
    tone?: string;
    campaignType?: string; // diwali, independence_day, monsoon, etc.
  }>(req);

  if (!body?.productId) return err("Product ID is required", 400);

  const platforms = body.platforms?.length ? body.platforms : ["whatsapp", "facebook", "instagram", "email"];
  const tone = body.tone || "promotional";
  const campaignType = body.campaignType || "";

  try {
    const product = await db.product.findUnique({
      where: { id: body.productId },
      select: {
        name: true, slug: true, shortDescription: true, composition: true,
        sellingPrice: true, mrp: true, brand: { select: { name: true } },
        category: { select: { name: true } }, prescriptionRequired: true,
        primaryImage: true,
      },
    });
    if (!product) return err("Product not found", 404);

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

    // ── Build campaign context ──
    const campaignContext = campaignType
      ? `\nCampaign Theme: ${campaignType.replace(/_/g, " ")}\nTailor the content to this campaign theme. Use relevant cultural references, seasonal language, and appropriate tone.`
      : "";

    // ── Prompt 1: Marketing content (JSON) ──
    const prompt = `You are a pharmacy marketing expert for "Pradeep Medical Store" in Mathura, India. Generate professional marketing content. Return ONLY valid JSON.

Product: ${product.name}
Brand: ${product.brand?.name || "Unknown"}
Category: ${product.category?.name || "General"}
Composition: ${product.composition || "N/A"}
Price: ₹${Number(product.sellingPrice)} (MRP ₹${Number(product.mrp)}, ${discountPct}% off)
Description: ${product.shortDescription || "N/A"}
Prescription Required: ${product.prescriptionRequired ? "Yes" : "No"}
Tone: ${tone}${campaignContext}

Generate marketing content for: ${platforms.join(", ")}

Return JSON:
{
  "whatsapp": "Short WhatsApp message with emojis, max 200 chars. Include price and discount.",
  "facebook": "Facebook post, 2-3 paragraphs, engaging with hashtags. Include call to action.",
  "instagram": "Instagram caption with emojis and hashtags. Visual and lifestyle-focused.",
  "twitter": "Twitter/X post, max 280 chars, punchy with hashtags.",
  "email": {
    "subject": "Email subject line (max 60 chars)",
    "body": "Email body, 3-4 paragraphs, professional tone, include product benefits and price."
  },
  "sms": "SMS message, max 160 chars, include price and offer.",
  "campaignTitle": "Short campaign title (max 50 chars)",
  "campaignDescription": "1-2 sentence campaign summary",
  "ctaText": "Call-to-action button text (e.g. 'Shop Now', 'Order Today')",
  "suggestedEmoji": "Single emoji representing this campaign",
  "priority": "normal|high|urgent"
}

Rules:
- Use ₹ symbol for prices
- Include relevant hashtags (#pharmacy #health #medicine #Mathura #Wellness)
- Mention "Pradeep Medical Store" in longer content
- Include "Free delivery above ₹499" where space allows
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

      const emailUserPrompt = `Generate a complete responsive HTML email for this pharmacy product.

Store: Pradeep Medical Store (Mathura, India)
Website: ${baseUrl}
Product page: ${productPageUrl}
Product image: ${productImageUrl || "N/A (use styled placeholder)"}
Product: ${product.name}
Brand: ${product.brand?.name || "Unknown"}
Price: ₹${Number(product.sellingPrice)} (MRP ₹${Number(product.mrp)}, ${discountPct}% off)
Description: ${product.shortDescription || "Quality pharmacy product"}
Prescription: ${product.prescriptionRequired ? "Required — include disclaimer" : "Not required"}
${campaignContext}

Requirements:
- Full <!DOCTYPE html> document, table-based layout, inline CSS only
- Dark theme: body #0f172a, card #1e293b, text #f1f5f9
- Emerald accents: #10b981, #059669, #0d9488
- Header: gradient emerald bar with "Pradeep Medical Store" + tagline
- Product image (max-width 100%, border-radius 12px) or placeholder
- Product name as h1, marketing hook, price row with discount badge
- CTA button: emerald bg, white bold text "Shop Now →", links to ${productPageUrl}
- Footer: store name, address "Mathura, UP", "Free delivery above ₹499", contact info
- Max width 600px, mobile responsive
- ${product.prescriptionRequired ? "Include prescription-required disclaimer above footer" : "No prescription disclaimer needed"}

Output ONLY raw HTML. No markdown, no code fences.`;

      const htmlResult = await aiChatCompletion(
        [{ role: "system", content: emailSystemPrompt }, { role: "user", content: emailUserPrompt }],
        { temperature: 0.5, max_tokens: 3000 }
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

    return ok({ content: generated, productName: product.name });
  } catch (e: any) {
    console.error("[ai/generate-marketing] error:", e?.message?.slice(0, 200));
    return err("Marketing content generation failed: " + (e?.message || "unknown error"), 500);
  }
}
