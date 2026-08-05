// ============================================================================
// File: src/app/api/push/vapid-public/route.ts
// Purpose: Public endpoint returning the VAPID public key. Called by the
//          browser before calling PushManager.subscribe(). No auth — the
//          key is PUBLIC (it's only used by the browser to encrypt pushes,
//          not to authenticate them).
// ============================================================================

import { ok, err } from "@/lib/api";
import { isPushConfigured, getVapidPublicKey } from "@/lib/push-service";

export async function GET() {
  if (!isPushConfigured()) {
    return err("Web Push is not configured (missing VAPID keys)", 503);
  }
  return ok({ publicKey: getVapidPublicKey() });
}
