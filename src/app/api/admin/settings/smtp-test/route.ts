// ============================================================================
// File: src/app/api/admin/settings/smtp-test/route.ts
// Purpose: Test the SMTP connection. Called by the "Test Connection" button
//          in Admin → Settings → SMTP. Verifies that the SMTP server is
//          reachable and the credentials work — without sending an email.
// ============================================================================

import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized } from "@/lib/api";
import { testSmtpConnection } from "@/lib/notifications";

export async function POST() {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const result = await testSmtpConnection();
  if (result.success) {
    return ok({ success: true, message: "SMTP connection verified successfully! Credentials are correct." });
  }
  return err(result.error || "SMTP connection failed", 400);
}
