// ============================================================================
// File: src/app/api/admin/reviews/[id]/ai-moderate/route.ts
// Purpose: Re-run AI moderation on a single review. Useful when the customer
//          edited their review, when the original moderation verdict was
//          missing/failed, or when the admin wants a fresh AI assessment.
//          POST → runs moderation → updates `aiStatus` + `aiNote` → returns
//          the verdict and the updated review.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, notFound } from "@/lib/api";
import { aiChatCompletion } from "@/lib/ai-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;

  const review = await db.review.findUnique({
    where: { id },
    include: {
      product: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true } },
    },
  });
  if (!review) return notFound("Review not found");

  const titleTrim = review.title?.trim() || "";
  const bodyTrim = review.body?.trim() || "";
  const authorName = review.customer?.name || review.authorName;

  const prompt = `You are a content moderation AI for a pharmacy product review system. Decide whether the following review should be auto-approved or flagged for human review.

Return ONLY valid JSON:
{"status": "auto_approved" | "flag", "note": "short reason (max 120 chars)"}

Flag (status="flag") if the review:
- Contains promotional links, URLs, or contact info
- Contains abusive, hateful, or harassing language
- Is spam (e.g. repeated characters, irrelevant content, gibberish)
- Mentions competitor products by name with disparaging intent
- Contains personally identifiable information about others

Otherwise auto-approve (status="auto_approved").

Product: ${review.product?.name ?? "Unknown"}
Author: ${authorName}
Rating: ${review.rating}/5
Title: ${titleTrim}
Body: ${bodyTrim}

Return ONLY the JSON.`;

  try {
    const result = await aiChatCompletion(
      [
        { role: "system", content: "You are a content moderation AI. Return only valid JSON." },
        { role: "user", content: prompt },
      ],
      { temperature: 0.2, max_tokens: 200 }
    );
    const text = result.content?.trim() || "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return err("AI did not return valid JSON", 500);

    let verdict: { status?: string; note?: string };
    try {
      verdict = JSON.parse(m[0]);
    } catch {
      return err("AI returned invalid JSON", 500);
    }

    // Normalize the status string: "flag" → "flagged", otherwise keep as-is.
    const normalizedStatus =
      verdict.status === "auto_approved"
        ? "auto_approved"
        : verdict.status === "flag" || verdict.status === "flagged"
          ? "flagged"
          : "manual";
    const note = typeof verdict.note === "string" ? verdict.note.slice(0, 200) : null;

    const updated = await db.review.update({
      where: { id },
      data: { aiStatus: normalizedStatus, aiNote: note },
    });

    return ok({
      aiStatus: normalizedStatus,
      aiNote: note,
      review: updated,
    });
  } catch (e: any) {
    console.error("[admin/reviews/ai-moderate] error:", e?.message?.slice(0, 200));
    return err("AI moderation failed: " + (e?.message || "unknown error"), 500);
  }
}
