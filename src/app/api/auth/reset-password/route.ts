import { db } from "@/lib/db";
import { ok, err, parseBody } from "@/lib/api";
import { hashPassword } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await parseBody<{ email: string; code: string; password: string }>(req);
  if (!body?.email || !body?.code || !body?.password) return err("Email, OTP code and new password are required");
  if (body.password.length < 6) return err("Password must be at least 6 characters");
  const emailLc = body.email.toLowerCase().trim();
  const customer = await db.customer.findUnique({ where: { email: emailLc } });
  if (!customer) return err("Account not found");
  const otp = await db.otp.findFirst({ where: { customerId: customer.id, purpose: "reset", used: false, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  if (!otp) return err("OTP expired or not found. Please request a new one.");
  if (otp.attempts >= 5) return err("Too many attempts. Please request a new OTP.");
  if (otp.code !== body.code.trim()) { await db.otp.update({ where: { id: otp.id }, data: { attempts: otp.attempts + 1 } }); return err("Invalid OTP code"); }
  await db.$transaction([
    db.customer.update({ where: { id: customer.id }, data: { passwordHash: hashPassword(body.password) } }),
    db.otp.updateMany({ where: { customerId: customer.id }, data: { used: true } }),
  ]);
  return ok({ reset: true });
}
