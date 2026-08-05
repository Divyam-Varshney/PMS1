// ============================================================================
// File: src/app/api/admin/reviews/[id]/ai-reply/route.ts
// Purpose: Generate a professional admin reply for a customer review using AI.
//          POST → returns { reply: string } that the admin can edit before
//          saving via PATCH /api/admin/reviews/[id] { adminReply }.
//          The reply is NOT auto-saved — the admin reviews and confirms it.
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

  const authorName = review.customer?.name || review.authorName;
  const productName = review.product?.name ?? "your recent purchase";
  const title = review.title?.trim() || "";
  const body = review.body?.trim() || "";

  // Tone: grateful for high ratings, empathetic + corrective for low ratings.
  const isLowRating = review.rating <= 2;
  const toneInstruction = isLowRating
    ? "Be empathetic and apologetic. Acknowledge the issue, offer to make it right, and invite the customer to contact the store directly."
    : "Be warm and appreciative. Thank the customer for their feedback and reinforce the value they highlighted.";

  const prompt = `You are responding on behalf of "Pradeep Medical Store" (Mathura, India) to a customer product review. Write a professional, polite, and human-sounding reply (max 120 words).

Customer name: ${authorName}
Product: ${productName}
Rating: ${review.rating}/5
Review title: ${title || "(no title)"}
Review body: ${body || "(no body)"}

Instructions:
- Address the customer by name.
- ${toneInstruction}
- Mention the product name naturally.
- For low ratings, offer a concrete next step (contact store, replacement, refund enquiry).
- Keep it concise (3-5 sentences).
- Do NOT include placeholders like [Name] — write the actual reply.
- Do NOT mention that you are an AI.
- Sign off as "Team Pradeep Medical Store" or "Pradeep Medical Store Team".

Write the reply body only (no subject, no JSON, no markdown).`;

  try {
    const result = await aiChatCompletion(
      [
        { role: "system", content: "You are a professional customer support writer for a pharmacy. Write natural, warm, human-sounding replies." },
        { role: "user", content: prompt },
      ],
      { temperature: 0.6, max_tokens: 400 }
    );

    let reply = result.content?.trim() || "";
    // Strip accidental markdown code fences
    reply = reply.replace(/^```(?:\w+)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

    if (!reply) return err("AI did not return a reply", 500);

    return ok({ reply });
  } catch (e: any) {
    console.error("[admin/reviews/ai-reply] error:", e?.message?.slice(0, 200));
    return err("AI reply generation failed: " + (e?.message || "unknown error"), 500);
  }
}
