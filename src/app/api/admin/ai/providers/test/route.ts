// ============================================================================
// File: src/app/api/admin/ai/providers/test/route.ts
// Purpose: Test AI provider connection by sending a simple chat completion
//          request. Returns success/failure with response time.
// ============================================================================

import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, parseBody } from "@/lib/api";
import { aiChatCompletion } from "@/lib/ai-service";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const body = await parseBody<{
    provider: string;
    providerId: string;
    apiKey: string;
    baseUrl: string;
    model: string;
  }>(req);

  if (!body) return err("Configuration is required", 400);

  // If the API key is masked, use the saved config
  let apiKey = body.apiKey || "";
  if (apiKey.includes("••••")) {
    const saved = await getSetting<any>("ai.config");
    apiKey = saved?.apiKey || "";
  }

  // Temporarily save the test config so aiChatCompletion uses it
  const { saveAIConfig } = await import("@/lib/ai-service");
  await saveAIConfig({
    provider: body.provider,
    providerId: body.providerId,
    apiKey,
    baseUrl: body.baseUrl,
    model: body.model,
    enabled: true,
  });

  const start = Date.now();
  try {
    const result = await aiChatCompletion(
      [
        { role: "system", content: "You are a test bot. Reply with exactly: CONNECTION_OK" },
        { role: "user", content: "Test connection. Reply with CONNECTION_OK." },
      ],
      { temperature: 0, max_tokens: 20 }
    );

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const content = result.content?.trim() || "";

    if (content.length > 0) {
      return ok({
        ok: true,
        message: `Connected successfully in ${elapsed}s. Response: "${content.slice(0, 50)}"`,
        model: body.model || "default",
      });
    } else {
      return ok({
        ok: false,
        message: `Connected but got empty response in ${elapsed}s. Check your model name.`,
      });
    }
  } catch (e: any) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    return ok({
      ok: false,
      message: `Failed in ${elapsed}s: ${e?.message?.slice(0, 150) || "unknown error"}`,
    });
  }
}
