// ============================================================================
// File: src/app/api/admin/app-notifs/generate/route.ts
// Purpose: AI-assisted notification content generation. The admin enters a
//          topic + tone, and we ask the configured AI provider to draft:
//            • title  (<=60 chars — short enough for the notification title)
//            • message (<=200 chars — fits in the notification body preview)
//            • ctaText (a short label for the call-to-action button)
//            • emoji  (a single emoji to prepend to the title)
//            • priority ("normal" | "high")
//
//          Returns the structured draft. The admin reviews + edits before
//          broadcasting. Never broadcasts automatically.
// ============================================================================

import { ok, err, unauthorized, parseBody } from "@/lib/api";
import { getAdminFromRequest } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { aiChatCompletion } from "@/lib/ai-service";

interface GenerateBody {
  topic?: string;
  tone?: "professional" | "friendly" | "urgent" | "celebratory" | "informative";
  audience?: string; // optional description of the target segment
}

interface GeneratedDraft {
  title: string;
  message: string;
  ctaText: string;
  emoji: string;
  priority: "normal" | "high";
  deepLink?: string;
}

export async function POST(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  if (!hasPermission(admin, "newsletter")) {
    return err("You don't have permission to generate App notifications", 403);
  }

  const body = await parseBody<GenerateBody>(req);
  if (!body?.topic?.trim()) {
    return err("Please provide a topic for the notification", 400);
  }

  const topic = body.topic.trim();
  const tone = body.tone || "professional";
  const audience = body.audience?.trim() || "all customers of Pradeep Medical Store, an online pharmacy in Mathura";

  const systemPrompt = `You are a push notification copywriter for Pradeep Medical Store, an online pharmacy in Mathura, India.
Write concise, engaging push notifications in English.
Pharmacy context: medicines, health, prescriptions, wellness, fast delivery in Mathura.
Constraints:
- Title: max 60 characters, must grab attention.
- Message: max 200 characters, friendly but professional.
- CTA: 2-3 word call-to-action label (e.g. "Shop Now", "Order Today", "View Offer").
- Emoji: a single emoji that fits the message (no emoji spam).
- Priority: "high" only for urgent (sale ending today, refill reminder) — otherwise "normal".
- Tone: ${tone}.

Respond ONLY with valid JSON, no markdown, no code fences, exactly this shape:
{"title":"...","message":"...","ctaText":"...","emoji":"...","priority":"normal"}`;

  const userPrompt = `Topic: ${topic}
Audience: ${audience}
Tone: ${tone}

Draft a push notification. Respond with JSON only.`;

  try {
    const result = await aiChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.7, max_tokens: 400 }
    );

    const content = result.content.trim();
    // Strip code fences if the model added them despite instructions.
    const cleaned = content
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    let parsed: Partial<GeneratedDraft>;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback: if JSON parse fails, return the raw text as the message.
      return ok({
        title: topic.slice(0, 60),
        message: cleaned.slice(0, 200),
        ctaText: "Shop Now",
        emoji: "💊",
        priority: "normal" as const,
      } satisfies GeneratedDraft);
    }

    const draft: GeneratedDraft = {
      title: String(parsed.title || topic).slice(0, 60),
      message: String(parsed.message || "").slice(0, 200),
      ctaText: String(parsed.ctaText || "Shop Now").slice(0, 30),
      emoji: String(parsed.emoji || "💊").slice(0, 4),
      priority: parsed.priority === "high" ? "high" : "normal",
    };

    return ok(draft);
  } catch (e: any) {
    return err(
      `AI generation failed: ${e?.message || "unknown error"}. Make sure the AI provider is configured in Settings → AI Providers.`,
      500
    );
  }
}
