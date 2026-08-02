// ============================================================================
// File: src/components/customer/refund-policy-view.tsx
// Purpose: Refund & Return Policy page for the online pharmacy. Clearly
//          states eligibility, non-returnable items (medicines), the return
//          process, refund timeline, and cancellation policy.
// ============================================================================

"use client";

import { useUI } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  RotateCcw,
  Clock,
  ShieldAlert,
  PackageCheck,
  CreditCard,
  XCircle,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { motion } from "framer-motion";

export function RefundPolicyView() {
  const navigate = useUI((s) => s.navigate);
  const lastUpdated = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      {/* Back link */}
      <button
        onClick={() => navigate({ name: "home" })}
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Back to home
      </button>

      {/* Hero header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-6 text-white shadow-sm sm:p-8"
      >
        <div className="flex items-center gap-2">
          <Badge className="bg-white/20 text-white backdrop-blur-sm hover:bg-white/20">
            <RotateCcw className="size-3" /> Policy
          </Badge>
          <span className="text-xs text-white/80">Last updated: {lastUpdated}</span>
        </div>
        <h1 className="mt-3 text-2xl font-bold sm:text-3xl">Refund &amp; Return Policy</h1>
        <p className="mt-1 text-sm text-white/90 sm:text-base">
          Our policies ensure safety, fairness, and transparency for every order.
        </p>
      </motion.div>

      {/* Important notice banner — the critical 2-3 hour policy */}
      <Card className="mb-6 flex items-start gap-3 border-amber-200 bg-amber-50 p-4">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
        <div className="text-sm">
          <p className="font-semibold text-amber-900">Important: Time-sensitive returns</p>
          <p className="mt-1 text-amber-800">
            Returns are accepted <strong>only</strong> for damaged or incorrect items.
            Replacement is available for expired medicines.{" "}
            <strong>Requests must be made within 2-3 hours after delivery.</strong> Please
            inspect your order immediately upon receipt.
          </p>
        </div>
      </Card>

      {/* Sections */}
      <div className="space-y-6">
        {/* 1. Eligibility */}
        <PolicySection
          number={1}
          icon={CheckCircle2}
          title="Eligibility for Returns"
          color="text-emerald-600 bg-emerald-50"
        >
          <p>
            We accept returns under the following conditions:
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>The product received is damaged (broken seal, leakage, physical damage).</li>
            <li>The wrong product was delivered (different from what you ordered).</li>
            <li>The medicine is expired at the time of delivery.</li>
            <li>The request is raised within <strong>2-3 hours of delivery</strong>.</li>
            <li>The product packaging is intact and the original invoice is available.</li>
          </ul>
        </PolicySection>

        {/* 2. Non-returnable items */}
        <PolicySection
          number={2}
          icon={ShieldAlert}
          title="Non-Returnable Items"
          color="text-rose-600 bg-rose-50"
        >
          <p>
            For safety and regulatory reasons, the following items{" "}
            <strong>cannot be returned or refunded</strong> (except when received
            damaged, incorrect, or expired — see above):
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li><strong>All dispensed medicines</strong> — once a prescription medicine leaves the pharmacy, it cannot be returned, even if unopened.</li>
            <li>Refrigerated/cold-chain products (insulin, vaccines, biologics) — due to temperature sensitivity.</li>
            <li>Personal care items that have been opened or used (sanitary products, oral care, etc.).</li>
            <li>Products with broken seals or missing original packaging.</li>
            <li>Products where the batch number or expiry date has been tampered with.</li>
          </ul>
          <p className="mt-2 rounded-md bg-rose-50/60 p-3 text-sm text-rose-900">
            This policy is in line with the Drugs &amp; Cosmetics Act, 1940 and
            protects all our customers from counterfeit or contaminated medicines.
          </p>
        </PolicySection>

        {/* 3. Return process */}
        <PolicySection
          number={3}
          icon={RotateCcw}
          title="Return Process"
          color="text-teal-600 bg-teal-50"
        >
          <p>To initiate a return, follow these steps:</p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>
              <strong>Within 2-3 hours of delivery</strong>, contact us via phone,
              WhatsApp, or email with your order ID and a photo/video of the issue.
            </li>
            <li>Our team will review your request and confirm eligibility within 1-2 hours.</li>
            <li>If approved, keep the product in its original packaging ready for pickup.</li>
            <li>Our delivery partner will collect the item at no additional charge.</li>
            <li>Once the item is inspected at our pharmacy, a refund or replacement will be processed.</li>
          </ol>
        </PolicySection>

        {/* 4. Refund timeline */}
        <PolicySection
          number={4}
          icon={CreditCard}
          title="Refund Timeline"
          color="text-cyan-600 bg-cyan-50"
        >
          <p>Refunds are processed as follows after the returned item is inspected and approved:</p>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Payment Method</th>
                  <th className="px-4 py-2 text-left font-semibold">Refund Mode</th>
                  <th className="px-4 py-2 text-left font-semibold">Timeline</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="px-4 py-2.5">UPI / Cards / Net Banking</td>
                  <td className="px-4 py-2.5">Original payment method</td>
                  <td className="px-4 py-2.5">5-7 business days</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5">Cash on Delivery (COD)</td>
                  <td className="px-4 py-2.5">Bank transfer / UPI</td>
                  <td className="px-4 py-2.5">7-10 business days</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5">Wallet / Store Credit</td>
                  <td className="px-4 py-2.5">Wallet / store credit</td>
                  <td className="px-4 py-2.5">Within 24 hours</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Refund timelines depend on your bank or payment gateway and may vary.
            We are not responsible for delays caused by banking processes.
          </p>
        </PolicySection>

        {/* 5. Cancellation policy */}
        <PolicySection
          number={5}
          icon={XCircle}
          title="Cancellation Policy"
          color="text-amber-600 bg-amber-50"
        >
          <p>You can cancel an order under the following conditions:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>Before dispatch:</strong> Full refund, no questions asked.
              Cancel from the &quot;My Orders&quot; page or contact us.
            </li>
            <li>
              <strong>After dispatch but before delivery:</strong> Refund will be
              processed after deducting any shipping/handling charges already
              incurred. The courier will attempt to return the package.
            </li>
            <li>
              <strong>After delivery:</strong> Orders cannot be cancelled — please
              refer to the return policy above.
            </li>
            <li>
              <strong>Auto-cancellation by us:</strong> We may cancel an order if
              a prescription cannot be verified, the product is out of stock, or
              the delivery address is outside our service area. Full refunds are
              issued in such cases.
            </li>
          </ul>
        </PolicySection>
      </div>

      {/* Footer CTA */}
      <Card className="mt-8 flex flex-col items-start gap-3 border-emerald-200 bg-emerald-50/50 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <PackageCheck className="size-5 shrink-0 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              Need to report an issue with your order?
            </p>
            <p className="text-xs text-muted-foreground">
              Reach out within 2-3 hours of delivery for the fastest resolution.
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate({ name: "contact" })}
          className="shrink-0 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
        >
          Contact Us
        </button>
      </Card>

      <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="size-3.5" />
        <span>Have questions? Our team is available during store hours to assist you.</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reusable numbered section with an icon and color-coded badge.
// ---------------------------------------------------------------------------
function PolicySection({
  number,
  icon: Icon,
  title,
  color,
  children,
}: {
  number: number;
  icon: typeof RotateCcw;
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
    >
      <div className="mb-3 flex items-center gap-3">
        <div className={`flex size-10 items-center justify-center rounded-xl ${color}`}>
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Section {number}
          </p>
          <h2 className="text-lg font-bold sm:text-xl">{title}</h2>
        </div>
      </div>
      <div className="prose prose-sm max-w-none text-sm leading-relaxed text-muted-foreground sm:text-base sm:leading-relaxed [&_li]:my-1 [&_p]:mb-2 [&_strong]:text-foreground">
        {children}
      </div>
    </motion.section>
  );
}
