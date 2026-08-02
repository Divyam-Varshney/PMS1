// ============================================================================
// File: src/app/api/admin/ai/generate-marketing/route.ts
// Purpose: AI Marketing Content Generator — generates social media posts,
//          email campaigns, and promotional content for products.
//          Supports: WhatsApp, Facebook, Instagram, Twitter, Email.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, parseBody } from "@/lib/api";
import { aiChatCompletion } from "@/lib/ai-service";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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
    // Fetch product details
    const product = await db.product.findUnique({
      where: { id: body.productId },
      select: {
        name: true, shortDescription: true, composition: true,
        sellingPrice: true, mrp: true, brand: { select: { name: true } },
        category: { select: { name: true } }, prescriptionRequired: true,
      },
    });

    if (!product) return err("Product not found", 404);

    const discountPct = Number(product.mrp) > 0
      ? Math.round(((Number(product.mrp) - Number(product.sellingPrice)) / Number(product.mrp)) * 100)
      : 0;

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

    return ok({ content: generated, productName: product.name });
  } catch (e: any) {
    console.error("[ai/generate-marketing] error:", e?.message?.slice(0, 200));
    return err("Marketing content generation failed: " + (e?.message || "unknown error"), 500);
  }
}
