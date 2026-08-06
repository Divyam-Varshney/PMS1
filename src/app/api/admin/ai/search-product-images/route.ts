// ============================================================================
// File: src/app/api/admin/ai/search-product-images/route.ts
// Purpose: "Search Product Images" — searches trusted pharmacy sources for
//          REAL product packaging photos using the Z.AI SDK image search API.
//
//          Workflow:
//            1. Admin opens Product Add/Edit → Gallery tab
//            2. Product title is auto-read from the form (no manual typing)
//            3. Admin clicks "Search Images" with selected source
//            4. This API calls aiService.searchProductImages()
//            5. Z.AI SDK searches the web for real product images
//            6. Results are filtered to only include images from the selected source
//            7. Images are returned to the frontend for selection
//            8. Admin selects images → they're uploaded to the product gallery
// ============================================================================

import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, parseBody } from "@/lib/api";
import { getAIConfig, searchProductImages, getTrustedSources } from "@/lib/ai-service";

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

    // Image search is a Z.AI SDK-specific feature (uses zai.images.search.create).
    // For other providers (Groq, Gemini, OpenAI), return a helpful message
    // instead of crashing with a confusing error.
    if (config.provider !== "z-ai-sdk") {
      return ok({
        results: [],
        grouped: {},
        count: 0,
        query: body.productName,
        source: sourceId,
        sourceLabel: "",
        sourceCount: 0,
        message: "Image search is only available with the Z.AI SDK provider. With other providers, please upload product images manually via the gallery tab.",
      });
    }

    const { results, sourceLabel } = await searchProductImages(
      body.productName,
      body.brand,
      sourceId,
      count
    );

    // Group results by source website
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
