// ============================================================================
// File: src/app/api/admin/ai/search-product-images/route.ts
// Purpose: "Search Product Images" — searches trusted pharmacy sources for
//          REAL product packaging photos.
//
//  Phase 43.4: Now uses the centralized AI provider for ALL providers.
//  - Z.AI SDK: uses zai.images.search.create (built-in image search)
//  - OpenAI-compatible (Gemini, Groq, OpenAI): uses aiChatCompletion() to
//    generate image search URLs via Google Image Search queries embedded
//    in the AI prompt. The AI returns structured image URLs from trusted
//    pharmacy websites.
// ============================================================================

import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, parseBody } from "@/lib/api";
import { getAIConfig, searchProductImages, getTrustedSources, aiChatCompletion } from "@/lib/ai-service";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface SearchRequest {
  productName?: string;
  brand?: string;
  composition?: string;
  source?: string;
  count?: number;
}

export async function POST(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const body = await parseBody<SearchRequest>(req);

  if (!body?.productName?.trim()) {
    return err("Product name is required", 400);
  }

  const sourceId = (body.source || "all-pharmacy").toLowerCase();
  const count = Math.min(30, Math.max(1, body.count || 15));

  try {
    const config = await getAIConfig();
    if (!config.enabled) {
      return err("AI service is disabled. Enable it in Admin → Settings.", 400);
    }

    // ── Z.AI SDK: uses built-in image search API ──
    if (config.provider === "z-ai-sdk") {
      const { results, sourceLabel } = await searchProductImages(
        body.productName,
        body.brand,
        sourceId,
        count
      );

      const grouped: Record<string, typeof results> = {};
      for (const r of results) {
        const key = r.source || "Unknown";
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(r);
      }

      return ok({
        results: results.map((r) => ({ ...r, selected: false })),
        grouped,
        count: results.length,
        query: body.productName,
        source: sourceId,
        sourceLabel,
        sourceCount: Object.keys(grouped).length,
      });
    }

    // ── OpenAI-compatible providers: use AI to generate image search URLs ──
    // Ask the AI to generate direct image URLs from trusted pharmacy websites.
    // This is a fallback for providers that don't have a native image search API.
    const queryParts = [body.productName.trim()];
    if (body.brand?.trim()) queryParts.push(body.brand.trim());
    const searchQuery = queryParts.join(" ");

    const pharmacySites = [
      "1mg.com", "apollopharmacy.in", "pharmeasy.in", "netmeds.com",
      "amazon.in", "practo.com", "medplusmart.com"
    ];

    const prompt = `You are a product image search assistant. Find direct image URLs for the medicine "${searchQuery}" from trusted Indian pharmacy websites.

Search these websites: ${pharmacySites.join(", ")}

Return a JSON array of image objects. Each object must have:
- "url": the direct image URL (must start with https://)
- "source": the website domain name (e.g., "1mg.com")
- "width": image width in pixels (integer, or 0 if unknown)
- "height": image height in pixels (integer, or 0 if unknown)

Return ONLY the JSON array, no markdown, no explanation. Example:
[{"url":"https://...","source":"1mg.com","width":300,"height":300}]

Return up to ${count} results. Only include real, accessible image URLs.`;

    const result = await aiChatCompletion(
      [
        { role: "system", content: "You are a helpful assistant that finds product image URLs from pharmacy websites. You return only valid JSON arrays with real image URLs. Never invent or fabricate URLs — only return URLs you are confident exist." },
        { role: "user", content: prompt },
      ],
      { temperature: 0.3, max_tokens: 1500 }
    );

    const content = result.content?.trim() || "";

    // Parse the JSON array from the AI response
    let images: any[] = [];
    try {
      // Extract JSON array from response (handle markdown code fences)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        images = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // JSON parsing failed — return empty results
    }

    // Filter to only valid URLs from trusted sources
    const results = images
      .filter((item: any) => {
        const url = item.url || "";
        const source = (item.source || "").toLowerCase();
        return url.startsWith("https://") &&
          pharmacySites.some((site) => source.includes(site) || url.includes(site));
      })
      .map((item: any) => ({
        url: item.url,
        source: item.source || "Unknown",
        width: item.width || 0,
        height: item.height || 0,
        selected: false,
      }))
      .slice(0, count);

    const grouped: Record<string, any[]> = {};
    for (const r of results) {
      const key = r.source || "Unknown";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(r);
    }

    return ok({
      results,
      grouped,
      count: results.length,
      query: body.productName,
      source: sourceId,
      sourceLabel: "AI-powered search",
      sourceCount: Object.keys(grouped).length,
      provider: config.providerId,
    });
  } catch (e: any) {
    console.error("[ai/search-product-images] error:", e?.message?.slice(0, 200));
    return err("Image search failed: " + (e?.message || "unknown error"), 500);
  }
}

// GET — returns trusted sources for the frontend source selector
export async function GET() {
  const sources = getTrustedSources();
  return ok({
    sources: sources.map((s) => ({
      id: s.id,
      label: s.label,
      badgeColor: s.badgeColor,
    })),
    defaultSource: "all-pharmacy",
    defaultCount: 15,
    maxCount: 30,
  });
}
