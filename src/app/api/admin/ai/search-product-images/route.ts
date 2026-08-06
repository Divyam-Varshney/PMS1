// ============================================================================
// File: src/app/api/admin/ai/search-product-images/route.ts
// Purpose: "Search Product Images" — searches trusted pharmacy sources for
//          REAL product packaging photos.
//
//  Phase 43.5: COMPLETE IMAGE LOADING AUDIT & FIX
//
//  ROOT CAUSE FOUND:
//  ─────────────────
//  The previous implementation gated the Z.AI SDK native image search behind
//  `if (config.provider === "z-ai-sdk")`. But the admin had configured Groq
//  (an OpenAI-compatible provider) for chat completion — so the route fell
//  into the OpenAI-compatible branch, which asks the LLM to *generate* image
//  URLs. LLMs fabricate URLs that look valid but 404, AND the Groq API key
//  was returning 403 Forbidden — so image search was completely broken.
//
//  FIX:
//  ───
//  The Z.AI SDK's `images.search.create()` is a TRUE web image search (backed
//  by Google), completely independent from the chat-completion provider. It
//  returns REAL, accessible image URLs hosted on z-cdn.chatglm.cn. It works
//  in the sandbox via the hardcoded ZAI token (no API key needed).
//
//  NEW STRATEGY (provider-agnostic):
//    1. ALWAYS try the Z.AI SDK native image search first.
//    2. If it succeeds → return real image URLs (the common case in dev).
//    3. If it throws (e.g. production without ZAI config, or network error)
//       → fall back to the OpenAI-compatible chat-based URL generation path.
//    4. If BOTH fail → return a clear error explaining the situation.
//
//  This decouples image search from chat completion: admins can use Groq for
//  chat AND get real image search results via the Z.AI SDK simultaneously.
// ============================================================================

import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, parseBody } from "@/lib/api";
import {
  getAIConfig,
  searchProductImages,
  getTrustedSources,
  aiChatCompletion,
} from "@/lib/ai-service";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface SearchRequest {
  productName?: string;
  brand?: string;
  composition?: string;
  source?: string;
  count?: number;
}

/**
 * Build the grouped-response payload shared by both code paths.
 */
function buildResponse(
  results: Array<{ url: string; source: string; width?: string; height?: string }>,
  query: string,
  sourceId: string,
  sourceLabel: string,
  provider?: string
) {
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
    query,
    source: sourceId,
    sourceLabel,
    sourceCount: Object.keys(grouped).length,
    ...(provider ? { provider } : {}),
  });
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

    // ─────────────────────────────────────────────────────────────────────
    // PATH 1 (PREFERRED): Z.AI SDK native image search.
    //
    // The Z.AI SDK has a built-in web image search (backed by Google) that
    // returns REAL, accessible image URLs. This works regardless of which
    // chat-completion provider (Groq, Gemini, OpenAI, etc.) is configured,
    // because image search is a separate capability from chat.
    //
    // We ALWAYS try this first. In the dev sandbox, the hardcoded ZAI token
    // makes this work with zero configuration. In production, it works if
    // Z_AI_BASE_URL + Z_AI_API_KEY + Z_AI_TOKEN env vars are set, OR if the
    // admin has configured the Z.AI SDK provider in the DB.
    // ─────────────────────────────────────────────────────────────────────
    try {
      const { results, sourceLabel } = await searchProductImages(
        body.productName,
        body.brand,
        sourceId,
        count
      );

      if (results.length > 0) {
        return buildResponse(results, body.productName, sourceId, sourceLabel, "z-ai-sdk");
      }
      // If results.length === 0, fall through to the OpenAI-compatible path
      // (the Z.AI search may have returned nothing for this query/source).
      //console.log("[ai/search-product-images] Z.AI SDK returned 0 results, falling back to chat-based search");
    } catch (zaiError: any) {
      // Z.AI SDK unavailable (e.g. production without ZAI config) — fall
      // back to the OpenAI-compatible chat-based URL generation path.
      console.warn(
        "[ai/search-product-images] Z.AI SDK image search unavailable, falling back to chat-based search. Error:",
        zaiError?.message?.slice(0, 150)
      );
    }

    // ─────────────────────────────────────────────────────────────────────
    // PATH 2 (FALLBACK): OpenAI-compatible chat-based URL generation.
    //
    // Asks the configured chat provider (Groq, Gemini, OpenAI, etc.) to
    // generate direct image URLs from trusted pharmacy websites. This is
    // less reliable than PATH 1 (LLMs sometimes fabricate URLs), but it's
    // the only option when the Z.AI SDK is unavailable.
    // ─────────────────────────────────────────────────────────────────────
    const queryParts = [body.productName.trim()];
    if (body.brand?.trim()) queryParts.push(body.brand.trim());
    const searchQuery = queryParts.join(" ");

    const pharmacySites = [
      "1mg.com", "apollopharmacy.in", "pharmeasy.in", "netmeds.com",
      "amazon.in", "practo.com", "medplusmart.com",
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

    let chatContent = "";
    try {
      const result = await aiChatCompletion(
        [
          {
            role: "system",
            content:
              "You are a helpful assistant that finds product image URLs from pharmacy websites. You return only valid JSON arrays with real image URLs. Never invent or fabricate URLs — only return URLs you are confident exist.",
          },
          { role: "user", content: prompt },
        ],
        { temperature: 0.3, max_tokens: 1500 }
      );
      chatContent = result.content?.trim() || "";
    } catch (chatError: any) {
      // Both paths failed. Return a clear, actionable error.
      return err(
        `Image search failed. The Z.AI SDK image search was unavailable and the configured chat provider (${config.providerId}) returned an error: ${chatError?.message?.slice(0, 150) || "unknown"}. ` +
        `To fix: (1) ensure the Z.AI SDK is configured (works by default in dev), OR (2) verify your AI provider API key in Admin → Settings → AI Integration.`,
        500
      );
    }

    // Parse the JSON array from the AI response
    let images: any[] = [];
    try {
      const jsonMatch = chatContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) images = JSON.parse(jsonMatch[0]);
    } catch {
      // JSON parsing failed — return empty results
    }

    const results = images
      .filter((item: any) => {
        const url = item.url || "";
        const source = (item.source || "").toLowerCase();
        return (
          url.startsWith("https://") &&
          pharmacySites.some((site) => source.includes(site) || url.includes(site))
        );
      })
      .map((item: any) => ({
        url: item.url,
        source: item.source || "Unknown",
        width: item.width || 0,
        height: item.height || 0,
        selected: false,
      }))
      .slice(0, count);

    return buildResponse(
      results,
      body.productName,
      sourceId,
      "AI-powered search",
      config.providerId
    );
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
