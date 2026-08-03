// ============================================================================
// File: src/lib/stock-notifier.ts
// Purpose: Back-in-stock notification dispatcher.
//   When a product's stock transitions from 0 (or <=0) to >0, this helper
//   finds all ACTIVE StockSubscription records for that product, marks them
//   "notified" (with notifiedAt timestamp), and creates AdminNotification
//   entries so the admin can see how many customers were notified.
//   In a production system this would also send emails/push notifications;
//   here we persist the intent and surface it in the admin panel.
// ============================================================================

import { db } from "@/lib/db";

/**
 * Process back-in-stock notifications for a product.
 * Call this AFTER updating product stock, passing the OLD stock value
 * (so we can detect the 0 → >0 transition).
 *
 * Returns the number of subscribers that were notified.
 */
export async function notifyBackInStock(productId: string, oldStock: number, newStock: number): Promise<number> {
  // Only trigger on the 0 → positive transition
  if (oldStock > 0 || newStock <= 0) return 0;

  const product = await db.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true },
  });
  if (!product) return 0;

  // Find all active subscriptions
  const subs = await db.stockSubscription.findMany({
    where: { productId, status: "active" },
    include: { customer: { select: { name: true, email: true } } },
  });

  if (subs.length === 0) return 0;

  // Mark all as notified in a single bulk update
  await db.stockSubscription.updateMany({
    where: { id: { in: subs.map((s) => s.id) } },
    data: { status: "notified", notifiedAt: new Date() },
  });

  // Create a single admin notification summarizing the restock
  await db.adminNotification.create({
    data: {
      type: "back_in_stock",
      title: `${product.name} is back in stock`,
      message: `${subs.length} customer${subs.length === 1 ? "" : "s"} requested restock alert for "${product.name}". They have been notified.`,
      refId: productId,
      refType: "product",
    },
  });

  // NOTE: In a production system, we would also dispatch emails here via
  // an email service (SES/SendGrid). For now we record the notification
  // intent in the DB so admins can see it in the Notifications panel.

  return subs.length;
}
