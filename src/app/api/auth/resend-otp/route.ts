// ============================================================================
// File: src/app/api/auth/resend-otp/route.ts
// Purpose: Resend an OTP for register or login. For register, the customer
//          doesn't exist yet — the OTP has pendingData. For login, the customer
//          exists. Rate-limited to 1/60s per email+purpose.
// ============================================================================

import { db } from "@/lib/db";
import { ok, err, parseBody } from "@/lib/api";
import { generateOtp } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { sendOtp } from "@/lib/notifications";

const PURPOSES = new Set(["register", "login"]);

export async function POST(req: Request) {
  const body = await parseBody<{ email: string; purpose: "register" | "login" }>(req);
  if (!body?.email || !body.purpose || !PURPOSES.has(body.purpose)) return err("Email and purpose (register|login) are required");
  const emailLc = body.email.toLowerCase().trim();

  // For registration: no customer exists yet. Find the pending OTP by pendingData.
  // For login: the customer exists — find by customerId.
  let customerId: string | null = null;
  let customerName = emailLc;
  let customerPhone = "";
  let whatsappOptIn = true;
  let pendingData: string | null = null;

  if (body.purpose === "register") {
    // Find the most recent pending registration OTP for this email
    const existingOtp = await db.otp.findFirst({
      where: { purpose: "register", used: false, pendingData: { contains: emailLc } },
      orderBy: { createdAt: "desc" },
    });
    if (!existingOtp?.pendingData) return err("No pending registration found. Please register again.");
    try {
      const pending = JSON.parse(existingOtp.pendingData);
      customerName = pending.name || emailLc;
      customerPhone = pending.phone || "";
      pendingData = existingOtp.pendingData; // Reuse the same pendingData
    } catch {
      return err("Registration data corrupted. Please register again.");
    }
    // Rate limit
    if (existingOtp.createdAt > new Date(Date.now() - 60000)) {
      return err("Please wait a minute before requesting another OTP.");
    }
    // Invalidate old OTPs
    await db.otp.updateMany({
      where: { purpose: "register", used: false, pendingData: { contains: emailLc } },
      data: { used: true },
    });
  } else {
    // Login: customer exists
    const customer = await db.customer.findUnique({ where: { email: emailLc } });
    if (!customer) return err("Account not found");
    customerId = customer.id;
    customerName = customer.name;
    customerPhone = customer.phone;
    whatsappOptIn = customer.whatsappOptIn;
    const recent = await db.otp.findFirst({
      where: { customerId: customer.id, purpose: "login", createdAt: { gt: new Date(Date.now() - 60000) } },
      orderBy: { createdAt: "desc" },
    });
    if (recent) return err("Please wait a minute before requesting another OTP.");
    await db.otp.updateMany({ where: { customerId: customer.id, purpose: "login", used: false }, data: { used: true } });
  }

  const expiryMinutes = await getSetting<number>("auth.otpExpiryMinutes");
  const otp = generateOtp();
  await db.otp.create({
    data: {
      customerId,
      code: otp,
      purpose: body.purpose,
      channel: "email",
      expiresAt: new Date(Date.now() + expiryMinutes * 60000),
      pendingData, // Carries forward the registration data for register OTPs
    },
  });
  await sendOtp(
    { id: customerId ?? undefined, name: customerName, email: emailLc, phone: customerPhone, whatsappOptIn },
    otp,
    body.purpose,
    expiryMinutes
  );
  return ok({ sent: true });
}
