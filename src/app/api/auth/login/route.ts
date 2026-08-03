// ============================================================================
// File: src/app/api/auth/login/route.ts
// Purpose: Customer login. Validates password. If `auth.requireOtpOnLogin`
//          setting is true, generates + sends an OTP and returns otpRequired.
//          Otherwise sets the cookie directly. Supports `remember` flag for
//          30-day sessions (vs default 7-day).
// ============================================================================

import { db } from "@/lib/db";
import { okNoCache, err, parseBody } from "@/lib/api";
import { verifyPassword, generateOtp, signToken, setCustomerCookie } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { sendOtp } from "@/lib/notifications";

// Auth routes must never be cached — a cached pre-login response can cause
// auto-logout bugs when the browser serves the stale response after login.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  const body = await parseBody<{ email: string; password: string; remember?: boolean }>(req);
  if (!body?.email || !body?.password) return err("Email and password are required");

  const emailLc = body.email.toLowerCase().trim();
  const customer = await db.customer.findUnique({ where: { email: emailLc } });
  if (!customer) return err("Invalid email or password");
  if (!customer.isActive) return err("Your account has been deactivated. Please contact support.");

  const valid = verifyPassword(body.password, customer.passwordHash);
  if (!valid) return err("Invalid email or password");

  const requireOtp = await getSetting<boolean>("auth.requireOtpOnLogin");
  if (requireOtp) {
    const expiryMinutes = await getSetting<number>("auth.otpExpiryMinutes");
    const otp = generateOtp();
    await db.otp.create({
      data: {
        customerId: customer.id,
        code: otp,
        purpose: "login",
        channel: "email",
        expiresAt: new Date(Date.now() + expiryMinutes * 60 * 1000),
      },
    });
    await sendOtp(
      { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, whatsappOptIn: customer.whatsappOptIn },
      otp,
      "login",
      expiryMinutes
    );
    return okNoCache({ otpRequired: true, remember: !!body.remember, customer: { id: customer.id, email: customer.email, name: customer.name } });
  }

  const token = signToken({ sub: customer.id, type: "customer", email: customer.email });
  await setCustomerCookie(token, !!body.remember);
  return okNoCache({
    otpRequired: false,
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      isEmailVerified: customer.isEmailVerified,
    },
  });
}
