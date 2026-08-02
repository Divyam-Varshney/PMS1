// ============================================================================
// File: src/app/api/admin/ai/providers/route.ts
// Purpose: GET/PUT AI provider configuration. Stored in DB (Setting key
//          "ai.config"). API keys are masked in GET responses.
// ============================================================================

import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, parseBody } from "@/lib/api";
import { getAIConfig, saveAIConfig } from "@/lib/ai-service";

export const dynamic = "force-dynamic";

// GET — returns AI config with masked API key
export async function GET() {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const config = await getAIConfig();

  // Mask API key for security — show only last 4 chars
  const maskedKey = config.apiKey
    ? `••••••••${config.apiKey.slice(-4)}`
    : "";

  return ok({
    ...config,
    apiKey: maskedKey,
    _hasKey: !!config.apiKey,
  });
}

// PUT — saves AI config
export async function PUT(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const body = await parseBody<{ config: any }>(req);
  if (!body?.config) return err("Config is required", 400);

  const c = body.config;

  // If API key is masked (••••••), keep the existing key
  let apiKey = c.apiKey || "";
  if (apiKey.includes("••••")) {
    const existing = await getAIConfig();
    apiKey = existing.apiKey;
  }

  await saveAIConfig({
    provider: c.provider || "z-ai-sdk",
    providerId: c.providerId || "z-ai-sdk",
    apiKey,
    baseUrl: c.baseUrl || "",
    model: c.model || "",
    enabled: c.enabled ?? true,
  });

  return ok({ saved: true });
}
