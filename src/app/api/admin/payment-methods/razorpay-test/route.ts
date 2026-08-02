// ============================================================================
// File: src/app/api/admin/payment-methods/razorpay-test/route.ts
// Purpose: Test Razorpay credentials from the admin "Test Connection" button.
//          Creates a Rs. 1 test order, then cancels it. Proves the Key ID +
//          Key Secret are valid AND have permission to create orders.
// Role: Admin-only. Reads credentials from PaymentMethod.config (key="razorpay").
// ============================================================================

import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized } from "@/lib/api";
import { testRazorpayConnection } from "@/lib/razorpay";

export async function POST() {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  try {
    const result = await testRazorpayConnection();
    return ok(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Razorpay test failed";
    // 400 — credentials present but the API call failed (bad key, network,
    // forbidden, etc.). The admin sees the message in a toast.
    return err(message, 400);
  }
}
