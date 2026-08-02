// ============================================================================
// File: src/app/api/auth/login-verify/route.ts
// Purpose: Verify the OTP after login. Sets the pms_customer_token cookie.
//          Supports `remember` flag for 30-day sessions.
// ============================================================================

import { db } from "@/lib/db";
import { okNoCache, err, parseBody } from "@/lib/api";
import { signToken, setCustomerCookie } from "@/lib/auth";

// Auth routes must never be cached.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  const body = await parseBody<{ email: string; code: string; remember?: boolean }>(req);
  if (!body?.email || !body?.code) return err("Email and OTP code are required");

  const emailLc = body.email.toLowerCase().trim();
  const customer = await db.customer.findUnique({ where: { email: emailLc } });
  if (!customer) return err("Account not found");

  const otp = await db.otp.findFirst({
    where: {
      customerId: customer.id,
      purpose: "login",
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) return err("OTP expired or not found. Please request a new one.");
  if (otp.attempts >= 5) return err("Too many attempts. Please request a new OTP.");

  if (otp.code !== body.code.trim()) {
    await db.otp.update({ where: { id: otp.id }, data: { attempts: otp.attempts + 1 } });
    return err("Invalid OTP code");
  }

  await db.otp.updateMany({
    where: { customerId: customer.id, purpose: "login" },
    data: { used: true },
  });

  const token = signToken({ sub: customer.id, type: "customer", email: customer.email });
  await setCustomerCookie(token, !!body.remember);
  return okNoCache({
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    isEmailVerified: customer.isEmailVerified,
  });
}
