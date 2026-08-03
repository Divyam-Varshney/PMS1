// ============================================================================
// File: src/app/api/auth/verify-otp/route.ts
// Purpose: Verify the OTP after registration. Creates the Customer record from
//          the pendingData stored in the OTP (the customer was NOT created
//          during registration — only after successful OTP verification).
//          Sets the pms_customer_token cookie + logs the user in.
// ============================================================================

import { db } from "@/lib/db";
import { okNoCache, err, parseBody } from "@/lib/api";
import { signToken, setCustomerCookie } from "@/lib/auth";

// Auth routes must never be cached.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  const body = await parseBody<{ email: string; code: string }>(req);
  if (!body?.email || !body?.code) return err("Email and OTP code are required");

  const emailLc = body.email.toLowerCase().trim();

  // Find the most recent unused, non-expired registration OTP.
  // The OTP has customerId=null (no customer created yet) + pendingData
  // containing the registration details.
  const otp = await db.otp.findFirst({
    where: {
      purpose: "register",
      used: false,
      expiresAt: { gt: new Date() },
      pendingData: { contains: emailLc },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) return err("OTP expired or not found. Please request a new one.");

  if (otp.attempts >= 5) {
    return err("Too many attempts. Please request a new OTP.");
  }

  if (otp.code !== body.code.trim()) {
    await db.otp.update({ where: { id: otp.id }, data: { attempts: otp.attempts + 1 } });
    return err("Invalid OTP code");
  }

  // Parse the pending registration data
  let pending: any;
  try {
    pending = JSON.parse(otp.pendingData || "{}");
  } catch {
    return err("Registration data corrupted. Please register again.");
  }

  if (!pending.email || !pending.passwordHash) {
    return err("Registration data incomplete. Please register again.");
  }

  // Double-check no customer was created with this email in the meantime
  const existing = await db.customer.findUnique({ where: { email: pending.email } });
  if (existing) {
    await db.otp.update({ where: { id: otp.id }, data: { used: true } });
    return err("An account with this email already exists. Please login.");
  }

  // Create the Customer NOW (only after OTP verification)
  const customer = await db.customer.create({
    data: {
      name: pending.name,
      email: pending.email,
      phone: pending.phone,
      passwordHash: pending.passwordHash,
      isEmailVerified: true,
    },
  });

  // Create the address if provided
  if (pending.address) {
    await db.address.create({
      data: {
        customerId: customer.id,
        label: "Home",
        line1: pending.address.line1,
        city: pending.address.city || "Mathura",
        district: pending.address.district || "Mathura",
        state: pending.address.state || "Uttar Pradesh",
        pincode: pending.address.pincode,
        // Carry the locality from the registration payload — powers accurate
        // delivery-charge calculation on subsequent orders.
        locality: pending.address.locality || null,
        isDefault: true,
      },
    });
  }

  // Mark the OTP as used
  await db.otp.update({ where: { id: otp.id }, data: { used: true, customerId: customer.id } });

  // Set the auth cookie
  const token = signToken({ sub: customer.id, type: "customer", email: customer.email });
  await setCustomerCookie(token);

  return okNoCache({
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    isEmailVerified: true,
  });
}
