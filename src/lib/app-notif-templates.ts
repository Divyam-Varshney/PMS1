// ============================================================================
// File: src/lib/app-notif-templates.ts
// Purpose: Default seed data for the AppNotifTemplate table. 18 templates
//          mirroring the customer email templates — one push variant per
//          transactional event. Each template has a {{var}} interpolated
//          title + body, an icon (defaults to /icon.png), a deep link back
//          into the customer site (in SPA hash-routing format), and a
//          priority level.
//
// Used by:
//   • ensureTemplatesSeeded() in src/lib/app-notifs.ts on first push API hit
//   • Admin → App Notification Center → Templates tab (read/edit/disable)
//
// DEEP LINK FORMAT NOTE:
//   All deep links use SPA hash routing: "/#v=orders", "/#v=product&productId=xxx".
//   The Service Worker's notificationclick handler + the SWRegister message
//   handler both normalize ANY legacy format ("/account/orders", "?view=shop")
//   into this hash format, but using the correct format directly avoids the
//   conversion step.
// ============================================================================

export interface AppNotifTemplateSeed {
  key: string;
  name: string;
  title: string;
  shortDesc: string;
  fullMessage: string;
  icon?: string;
  bannerImage?: string;
  deepLink?: string;
  variables?: string[];
  category?: string;
  priority?: "low" | "normal" | "high" | "urgent";
}

// Default icon — the PMS capsule. Same on every platform for consistency.
const ICON = "/icon.png";

// Convenience deep links (SPA hash-routing format).
const LINKS = {
  home: "/#v=home",
  shop: "/#v=shop",
  auth: "/#v=auth",
  orders: "/#v=orders",
  account: "/#v=account",
  prescription: "/#v=prescription",
  manualRequest: "/#v=manual-request",
};

export const DEFAULT_APP_NOTIF_TEMPLATES: AppNotifTemplateSeed[] = [
  // 1. WELCOME — sent on registration
  {
    key: "welcome",
    name: "Welcome",
    title: "Welcome to Pradeep Medical Store, {{name}}! 🎉",
    shortDesc: "Sent when a new customer registers (welcome push).",
    fullMessage:
      "Your account is ready. Order medicines online in Mathura with fast doorstep delivery. Upload prescriptions, request medicines, and track orders — all in one place.",
    icon: ICON,
    deepLink: LINKS.home,
    variables: ["name"],
    category: "transactional",
    priority: "high",
  },
  // 2. ORDER PLACED — fires from /api/checkout after order creation.
  {
    key: "order_placed",
    name: "Order Placed",
    title: "Order {{orderNumber}} placed ✅",
    shortDesc: "Sent to the customer after they place an order.",
    fullMessage:
      "Hi {{name}}, your order {{orderNumber}} for Rs. {{amount}} has been placed successfully ({{paymentMethod}}). We'll notify you once it's confirmed.",
    icon: ICON,
    deepLink: LINKS.orders,
    variables: ["name", "orderNumber", "amount", "paymentMethod"],
    category: "transactional",
    priority: "high",
  },
  // 3. PAYMENT PENDING
  {
    key: "payment_pending",
    name: "Payment Pending",
    title: "Payment pending for order {{orderNumber}} ⏳",
    shortDesc: "Sent when an order's payment is awaiting confirmation.",
    fullMessage:
      "Hi {{name}}, your payment of Rs. {{amount}} for order {{orderNumber}} is pending. Please complete the payment to avoid cancellation.",
    icon: ICON,
    deepLink: LINKS.orders,
    variables: ["name", "orderNumber", "amount"],
    category: "transactional",
    priority: "high",
  },
  // 4. PAYMENT SUCCESSFUL — fires from /api/admin/orders/[id]/payment when
  //    paymentStatus is set to "paid".
  {
    key: "payment_successful",
    name: "Payment Successful",
    title: "Payment successful 💚",
    shortDesc: "Sent when the admin marks an order's payment as paid.",
    fullMessage:
      "Hi {{name}}, we've received your payment of Rs. {{amount}} for order {{orderNumber}}. Thank you!",
    icon: ICON,
    deepLink: LINKS.orders,
    variables: ["name", "orderNumber", "amount"],
    category: "transactional",
    priority: "normal",
  },
  // 5. PAYMENT FAILED — fires when paymentStatus = "failed".
  {
    key: "payment_failed",
    name: "Payment Failed",
    title: "Payment failed for order {{orderNumber}} ❌",
    shortDesc: "Sent when the admin marks an order's payment as failed.",
    fullMessage:
      "Hi {{name}}, your payment of Rs. {{amount}} for order {{orderNumber}} could not be processed. Please retry or use a different payment method.",
    icon: ICON,
    deepLink: LINKS.orders,
    variables: ["name", "orderNumber", "amount"],
    category: "transactional",
    priority: "high",
  },
  // 6. ORDER CONFIRMED — fires when status = "confirmed".
  {
    key: "order_confirmed",
    name: "Order Confirmed",
    title: "Order {{orderNumber}} confirmed 📋",
    shortDesc: "Sent when the admin confirms an order.",
    fullMessage:
      "Good news {{name}}! Your order {{orderNumber}} has been confirmed and is being prepared for dispatch.",
    icon: ICON,
    deepLink: LINKS.orders,
    variables: ["name", "orderNumber"],
    category: "transactional",
    priority: "normal",
  },
  // 7. ORDER PROCESSING — informational status between confirmed + packed.
  {
    key: "order_processing",
    name: "Order Processing",
    title: "Your order {{orderNumber}} is being processed 🔄",
    shortDesc: "Sent when the order moves into the processing stage.",
    fullMessage:
      "Hi {{name}}, we're picking and packing your medicines for order {{orderNumber}}. Hang tight — you'll be notified when it ships.",
    icon: ICON,
    deepLink: LINKS.orders,
    variables: ["name", "orderNumber"],
    category: "transactional",
    priority: "normal",
  },
  // 8. ORDER PACKED — fires when status = "packed".
  {
    key: "order_packed",
    name: "Order Packed",
    title: "Order {{orderNumber}} packed 📦",
    shortDesc: "Sent when the order is packed and ready for dispatch.",
    fullMessage:
      "Hi {{name}}, your order {{orderNumber}} has been packed and is ready to ship. Out for delivery soon!",
    icon: ICON,
    deepLink: LINKS.orders,
    variables: ["name", "orderNumber"],
    category: "transactional",
    priority: "normal",
  },
  // 9. OUT FOR DELIVERY — fires when status = "out_for_delivery".
  {
    key: "out_for_delivery",
    name: "Out for Delivery",
    title: "Order {{orderNumber}} is out for delivery 🚚",
    shortDesc: "Sent when the order is handed to the delivery agent.",
    fullMessage:
      "Hi {{name}}, your order {{orderNumber}} is on its way! Please keep your phone reachable for the delivery agent.",
    icon: ICON,
    deepLink: LINKS.orders,
    variables: ["name", "orderNumber"],
    category: "transactional",
    priority: "high",
  },
  // 10. ORDER DELIVERED — fires when status = "delivered".
  {
    key: "order_delivered",
    name: "Order Delivered",
    title: "Order {{orderNumber}} delivered ✨",
    shortDesc: "Sent when the order is marked as delivered.",
    fullMessage:
      "Hi {{name}}, your order {{orderNumber}} has been delivered. Thank you for choosing Pradeep Medical Store! Rate your experience from the orders page.",
    icon: ICON,
    deepLink: LINKS.orders,
    variables: ["name", "orderNumber"],
    category: "transactional",
    priority: "normal",
  },
  // 11. ORDER CANCELLED — fires when status = "cancelled".
  {
    key: "order_cancelled",
    name: "Order Cancelled",
    title: "Order {{orderNumber}} cancelled 🚫",
    shortDesc: "Sent when the admin cancels an order.",
    fullMessage:
      "Hi {{name}}, your order {{orderNumber}} has been cancelled. Reason: {{reason}}. For help, please contact our support team.",
    icon: ICON,
    deepLink: LINKS.orders,
    variables: ["name", "orderNumber", "reason"],
    category: "transactional",
    priority: "high",
  },
  // 12. REFUND INITIATED — fires when paymentStatus = "refund_initiated".
  {
    key: "refund_initiated",
    name: "Refund Initiated",
    title: "Refund initiated for order {{orderNumber}} 💸",
    shortDesc: "Sent when a refund is started for a cancelled/failed order.",
    fullMessage:
      "Hi {{name}}, we've initiated a refund of Rs. {{amount}} for order {{orderNumber}}. The amount will reflect in your account within 5-7 business days.",
    icon: ICON,
    deepLink: LINKS.orders,
    variables: ["name", "orderNumber", "amount"],
    category: "transactional",
    priority: "normal",
  },
  // 13. REFUND COMPLETED — fires when paymentStatus = "refunded" after
  //     the refund is confirmed by the admin.
  {
    key: "refund_completed",
    name: "Refund Completed",
    title: "Refund completed for order {{orderNumber}} ✅",
    shortDesc: "Sent when the refund is marked as completed.",
    fullMessage:
      "Hi {{name}}, your refund of Rs. {{amount}} for order {{orderNumber}} has been completed. If you don't see it in your account, please contact your bank.",
    icon: ICON,
    deepLink: LINKS.orders,
    variables: ["name", "orderNumber", "amount"],
    category: "transactional",
    priority: "normal",
  },
  // 14. PRESCRIPTION UPLOADED — fires after a customer uploads a new
  //     prescription via /api/prescriptions.
  {
    key: "prescription_uploaded",
    name: "Prescription Uploaded",
    title: "Prescription received 📄",
    shortDesc: "Sent to the customer after they upload a prescription.",
    fullMessage:
      "Hi {{name}}, we've received your prescription (Ref: {{refId}}). Our pharmacist will review it shortly. You'll be notified once it's approved.",
    icon: ICON,
    deepLink: LINKS.prescription,
    variables: ["name", "refId"],
    category: "transactional",
    priority: "normal",
  },
  // 15. PRESCRIPTION UNDER REVIEW — fires when admin opens the
  //     prescription for verification.
  {
    key: "prescription_under_review",
    name: "Prescription Under Review",
    title: "Prescription {{refId}} under review 🔍",
    shortDesc: "Sent when the admin starts reviewing a prescription.",
    fullMessage:
      "Hi {{name}}, your prescription (Ref: {{refId}}) is now being reviewed by our pharmacist. We'll notify you once it's approved.",
    icon: ICON,
    deepLink: LINKS.prescription,
    variables: ["name", "refId"],
    category: "transactional",
    priority: "normal",
  },
  // 16. PRESCRIPTION APPROVED — fires from /api/admin/orders/[id]/
  //     prescription-verify when action = "approve".
  {
    key: "prescription_approved",
    name: "Prescription Approved",
    title: "Prescription {{refId}} approved ✅",
    shortDesc: "Sent when the admin approves a prescription.",
    fullMessage:
      "Hi {{name}}, your prescription (Ref: {{refId}}) has been approved. You can now place an order with the prescribed medicines.",
    icon: ICON,
    deepLink: LINKS.prescription,
    variables: ["name", "refId"],
    category: "transactional",
    priority: "high",
  },
  // 17. PRESCRIPTION REJECTED — fires from /api/admin/orders/[id]/
  //     prescription-verify when action = "reject".
  {
    key: "prescription_rejected",
    name: "Prescription Rejected",
    title: "Prescription {{refId}} rejected ❌",
    shortDesc: "Sent when the admin rejects a prescription.",
    fullMessage:
      "Hi {{name}}, your prescription (Ref: {{refId}}) could not be approved. Reason: {{reason}}. Please upload a clearer copy or contact our pharmacist.",
    icon: ICON,
    deepLink: LINKS.prescription,
    variables: ["name", "refId", "reason"],
    category: "transactional",
    priority: "high",
  },
  // 18. MEDICINE REQUEST UPDATED — fires when an admin updates a
  //     manual medicine request's status.
  {
    key: "medicine_request_updated",
    name: "Medicine Request Updated",
    title: "Medicine request {{refId}} updated 🔄",
    shortDesc: "Sent when the admin updates a manual medicine request.",
    fullMessage:
      "Hi {{name}}, your medicine request (Ref: {{refId}}) has been updated to: {{status}}. Tap to view details.",
    icon: ICON,
    deepLink: LINKS.manualRequest,
    variables: ["name", "refId", "status"],
    category: "transactional",
    priority: "normal",
  },
  // 19. STOCK ALERT — system-level, fired by the stock-notifier when a
  //     product the customer subscribed to is back in stock.
  {
    key: "stock_alert",
    name: "Stock Alert",
    title: "📦 Back in Stock: {{productName}}",
    shortDesc: "Sent when a product the customer subscribed to is back in stock.",
    fullMessage:
      "Good news {{name}}! {{productName}} is back in stock. Order now before it runs out again.",
    icon: ICON,
    deepLink: LINKS.shop,
    variables: ["name", "productName"],
    category: "system",
    priority: "high",
  },
  // 20. ACCOUNT VERIFICATION — fired on registration (currently informational;
  //     the OTP itself is delivered via email).
  {
    key: "account_verification",
    name: "Account Verification",
    title: "✅ Verify Your Account",
    shortDesc: "Sent to remind the customer to verify their email.",
    fullMessage:
      "Welcome to {{storeName}}! Please verify your email address to complete your registration. Check your inbox for the OTP.",
    icon: ICON,
    deepLink: LINKS.auth,
    variables: ["customerName", "storeName"],
    category: "transactional",
    priority: "high",
  },
  // 21. PASSWORD RESET — fired when a customer requests a password reset.
  {
    key: "password_reset",
    name: "Password Reset",
    title: "🔑 Password Reset Request",
    shortDesc: "Sent when a customer requests a password reset (informational).",
    fullMessage:
      "A password reset was requested for your {{storeName}} account. Check your email for the OTP. If you didn't request this, please ignore — your account is safe.",
    icon: ICON,
    deepLink: LINKS.auth,
    variables: ["customerName", "storeName"],
    category: "transactional",
    priority: "urgent",
  },
];
