import { db } from "@/lib/db";
import { ok, parseBody } from "@/lib/api";
import { generateOtp } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { sendOtp } from "@/lib/notifications";

export async function POST(req: Request) {
  const body = await parseBody<{ email: string }>(req);
  const emailLc = body?.email?.toLowerCase().trim();
  if (!emailLc) return ok({ sent: false });
  const customer = await db.customer.findUnique({ where: { email: emailLc } });
  if (!customer) return ok({ sent: true });
  const recent = await db.otp.findFirst({ where: { customerId: customer.id, purpose: "reset", createdAt: { gt: new Date(Date.now() - 60000) } }, orderBy: { createdAt: "desc" } });
  if (recent) return ok({ sent: true, rateLimited: true });
  await db.otp.updateMany({ where: { customerId: customer.id, purpose: "reset", used: false }, data: { used: true } });
  const expiryMinutes = await getSetting<number>("auth.otpExpiryMinutes");
  const otp = generateOtp();
  await db.otp.create({ data: { customerId: customer.id, code: otp, purpose: "reset", channel: "email", expiresAt: new Date(Date.now() + expiryMinutes * 60000) } });
  await sendOtp({ id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, whatsappOptIn: customer.whatsappOptIn }, otp, "reset", expiryMinutes);
  return ok({ sent: true });
}
