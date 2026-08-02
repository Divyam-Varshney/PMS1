// ============================================================================
// File: src/app/api/auth/register/route.ts
// Purpose: Customer registration step 1 — does NOT create a Customer record.
//          Instead, stores the registration data in the OTP's pendingData field.
//          The Customer is only created in /verify-otp after successful OTP
//          verification. This prevents unverified accounts from blocking
//          re-registration with the same email/phone.
// ============================================================================

import { db } from "@/lib/db";
import { ok, err, parseBody } from "@/lib/api";
import { hashPassword, generateOtp } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { sendOtp } from "@/lib/notifications";

interface RegisterBody {
  name: string;
  email: string;
  phone: string;
  password: string;
  address?: {
    line1: string;
    city?: string;
    district?: string;
    state?: string;
    pincode: string;
    /** Locality/Area — required for accurate delivery charges. Sourced from
     *  the delivery zones configured in admin. Optional here for backward
     *  compatibility (the registration form enforces it client-side). */
    locality?: string;
  };
}

export async function POST(req: Request) {
  const body = await parseBody<RegisterBody>(req);
  if (!body) return err("Invalid request body");
  const { name, email, phone, password } = body;
  if (!name || !email || !phone || !password) {
    return err("Name, email, phone and password are required");
  }
  if (password.length < 6) return err("Password must be at least 6 characters");

  const emailLc = email.toLowerCase().trim();
  const phoneTrim = phone.trim();

  // Check if a VERIFIED customer already exists with this email or phone.
  // Unverified accounts don't exist in the DB anymore (we don't create them
  // until OTP verification), so this check only blocks genuine duplicates.
  const existing = await db.customer.findFirst({
    where: { OR: [{ email: emailLc }, { phone: phoneTrim }] },
  });
  if (existing) {
    if (existing.email === emailLc) return err("An account with this email already exists");
    return err("An account with this phone already exists");
  }

  // Hash the password now (so we don't store plaintext in pendingData)
  const passwordHash = hashPassword(password);

  // Store the registration data in the OTP record's pendingData field.
  // No Customer record is created until the OTP is verified.
  const expiryMinutes = await getSetting<number>("auth.otpExpiryMinutes");
  const otp = generateOtp();

  // Invalidate any previous pending registration OTPs for this email
  await db.otp.updateMany({
    where: { purpose: "register", used: false, pendingData: { contains: emailLc } },
    data: { used: true },
  });

  await db.otp.create({
    data: {
      customerId: null, // No customer yet — created on verification
      code: otp,
      purpose: "register",
      channel: "email",
      expiresAt: new Date(Date.now() + expiryMinutes * 60 * 1000),
      pendingData: JSON.stringify({
        name: name.trim(),
        email: emailLc,
        phone: phoneTrim,
        passwordHash,
        address: body.address?.line1 && body.address?.pincode
          ? {
              line1: body.address.line1,
              city: body.address.city || "Mathura",
              district: body.address.district || "Mathura",
              state: body.address.state || "Uttar Pradesh",
              pincode: body.address.pincode,
              locality: body.address.locality || null,
            }
          : null,
      }),
    },
  });

  // Send OTP via email. No Customer exists yet (created on verification), so
  // we deliberately do NOT pass an id — sendOtp's customer.id is optional and
  // NotificationLog.customerId will be null for this registration OTP.
  await sendOtp(
    { name: name.trim(), email: emailLc, phone: phoneTrim, whatsappOptIn: true },
    otp,
    "register",
    expiryMinutes
  );

  return ok({ email: emailLc, name: name.trim() }, 200);
}
