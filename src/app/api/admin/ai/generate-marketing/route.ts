// ============================================================================
// File: src/app/api/admin/ai/generate-marketing/route.ts
// Purpose: AI Marketing Content Generator — generates social media posts,
//          email campaigns, and promotional content for products.
//          Supports: WhatsApp, Facebook, Instagram, Twitter, Email.
//          Also generates a complete responsive HTML email (dark-themed,
//          table-based, email-client compatible) via a second AI call.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, parseBody } from "@/lib/api";
import { aiChatCompletion } from "@/lib/ai-service";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const body = await parseBody<{
    productId?: string;
    platforms?: string[]; // whatsapp, facebook, instagram, twitter, email
    tone?: string; // professional, casual, promotional, educational
  }>(req);

  if (!body?.productId) {
    return err("Product ID is required", 400);
  }

  const platforms = body.platforms?.length ? body.platforms : ["whatsapp", "facebook", "instagram", "email"];
  const tone = body.tone || "promotional";

  try {
    // Fetch product details (including slug + primaryImage for the HTML email)
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

    // Resolve absolute URLs for the email (image + product page).
    const siteUrl = (await getSetting<string>("store.websiteUrl")) || "https://pradeepmedical.com";
    const baseUrl = siteUrl.replace(/\/$/, "");
    const productPageUrl = `${baseUrl}/products/${product.slug}`;
    const rawImage = product.primaryImage || "";
    const productImageUrl = rawImage
      ? (rawImage.startsWith("http://") || rawImage.startsWith("https://")
          ? rawImage
          : `${baseUrl}${rawImage.startsWith("/") ? "" : "/"}${rawImage}`)
      : "";

    const prompt = `Generate marketing content for a pharmacy product. Return ONLY valid JSON.

Product: ${product.name}
Brand: ${product.brand?.name || "Unknown"}
Category: ${product.category?.name || "General"}
Composition: ${product.composition || "N/A"}
Price: ₹${Number(product.sellingPrice)} (MRP ₹${Number(product.mrp)}, ${discountPct}% off)
Description: ${product.shortDescription || "N/A"}
Prescription Required: ${product.prescriptionRequired ? "Yes" : "No"}
Tone: ${tone}

Generate marketing content for these platforms: ${platforms.join(", ")}

Return JSON with this structure:
{
  "whatsapp": "Short WhatsApp message with emojis, max 200 chars. Include price and discount.",
  "facebook": "Facebook post, 2-3 paragraphs, engaging with hashtags. Include call to action.",
  "instagram": "Instagram caption with emojis and hashtags. Visual and lifestyle-focused.",
  "twitter": "Twitter/X post, max 280 chars, punchy with hashtags.",
  "email": {
    "subject": "Email subject line",
    "body": "Email body, 3-4 paragraphs, professional tone, include product benefits and price."
  },
  "sms": "SMS message, max 160 chars, include price and offer."
}

Rules:
- Use ₹ symbol for prices
- Include relevant hashtags (#pharmacy #health #medicine #Mathura)
- Mention "Pradeep Medical Store" in longer content
- Include "Free delivery above ₹499" where space allows
- For prescription medicines, add "Prescription required" disclaimer
- Return ONLY the JSON, no markdown`;

    const result = await aiChatCompletion(
      [
        { role: "system", content: "You are a pharmacy marketing expert. Return only valid JSON." },
        { role: "user", content: prompt },
      ],
      { temperature: 0.7, max_tokens: 1500 }
    );

    const content = result.content?.trim() || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return err("AI did not return valid JSON", 500);
    }

    let generated: any;
    try {
      generated = JSON.parse(jsonMatch[0]);
    } catch {
      return err("AI returned invalid JSON", 500);
    }

    // ── Second AI call: generate a complete responsive HTML email ──
    // Runs in parallel-safe sequence after the JSON content. Failures here
    // are non-fatal — the plain-text outputs are still returned. We only
    // attach `htmlEmail` to the response when the AI returns usable HTML.
    let htmlEmail: string | undefined;
    try {
      const emailSystemPrompt =
        "You are a professional email marketing designer. Generate a complete, responsive HTML email for the following product. " +
        "The email must be a full HTML document with inline CSS, table-based layout, and include:\n" +
        "- A dark-themed header with the store name \"Pradeep Medical Store\"\n" +
        "- Product image (use the provided URL)\n" +
        "- Product name and short marketing description\n" +
        "- Price and discount info\n" +
        "- A prominent emerald CTA button linking to the product page\n" +
        "- Professional footer with contact info\n" +
        "- Use emerald (#059669, #10b981) and teal (#0d9488) accent colors\n" +
        "- Dark backgrounds (#0f172a, #1e293b) with light text (#f1f5f9)\n" +
        "- Inline CSS only, table-based layout, email-client compatible\n" +
        "Output ONLY the HTML, no markdown code fences.";

      const emailUserPrompt = `Generate a complete responsive HTML email for this pharmacy product.

Store name: Pradeep Medical Store
Store website: ${baseUrl}
Product page URL (use for the CTA button): ${productPageUrl}
Product image URL${productImageUrl ? "" : " (none available — use a styled placeholder block instead)"}: ${productImageUrl || "N/A"}
Product name: ${product.name}
Brand: ${product.brand?.name || "Unknown"}
Category: ${product.category?.name || "General"}
Composition: ${product.composition || "N/A"}
Short description: ${product.shortDescription || "N/A"}
Selling price: ₹${Number(product.sellingPrice)}
MRP: ₹${Number(product.mrp)}
Discount: ${discountPct}% off
Prescription required: ${product.prescriptionRequired ? "Yes — include a clear prescription-required disclaimer" : "No"}
Tone: ${tone}

Requirements:
- Full standalone <!DOCTYPE html> document, table-based layout, inline CSS only.
- Dark theme: body background #0f172a, content card background #1e293b, text #f1f5f9.
- Header bar with emerald (#10b981) accent and the store name "Pradeep Medical Store".
- Show the product image (max width 100%, height auto, border-radius 12px). If no image URL was provided, render a 280x200 emerald-tinted placeholder box with the product name.
- Show product name as an h1, then a one-sentence marketing hook, then price row showing ₹sellingPrice (large, emerald) struck-through ₹MRP and a "${discountPct}% OFF" badge.
- CTA button: emerald (#10b981) background, white bold text "Shop Now", border-radius 8px, 16px 28px padding, links to ${productPageUrl}.
- Footer: store name, website, and "Free delivery above ₹499" + "Mathura, UP" line. Small muted text (#94a3b8) on #0f172a background.
- Max content width 600px, centered. Mobile-responsive (use 100% width tables on small screens via media query if needed).
- ${product.prescriptionRequired ? "Include a small prescription-required disclaimer line above the footer." : "Do not include any prescription disclaimer."}

Output ONLY the raw HTML. No markdown, no \`\`\`html fences, no explanations.`;

      const htmlResult = await aiChatCompletion(
        [
          { role: "system", content: emailSystemPrompt },
          { role: "user", content: emailUserPrompt },
        ],
        { temperature: 0.5, max_tokens: 2500 }
      );

      let html = htmlResult.content?.trim() || "";
      // Strip markdown code fences if the model added them despite instructions.
      html = html
        .replace(/^```(?:html)?\s*/i, "")
        .replace(/\s*```\s*$/i, "")
        .trim();
      // Only keep it if it looks like an HTML document.
      if (html && /<html[\s>]/i.test(html) && /<\/html>/i.test(html)) {
        htmlEmail = html;
      } else if (html && /<!doctype html/i.test(html)) {
        htmlEmail = html;
      }
    } catch (e: any) {
      // Non-fatal — plain-text outputs are still returned.
      console.error("[ai/generate-marketing] htmlEmail error:", e?.message?.slice(0, 200));
    }

    if (htmlEmail) {
      generated.htmlEmail = htmlEmail;
    }

    return ok({ content: generated, productName: product.name });
  } catch (e: any) {
    console.error("[ai/generate-marketing] error:", e?.message?.slice(0, 200));
    return err("Marketing content generation failed: " + (e?.message || "unknown error"), 500);
  }
}
