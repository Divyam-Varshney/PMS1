// ============================================================================
// File: src/components/customer/terms-view.tsx
// Purpose: Professional Terms & Conditions page for the online pharmacy.
//          Numbered sections with a sticky table of contents (desktop) and
//          clean typography. Linked from the footer + the registration form
//          "I agree to the Terms & Conditions" checkbox.
// ============================================================================

"use client";

import { useEffect, useState } from "react";
import { useUI } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, ShieldCheck, ChevronLeft } from "lucide-react";
import { motion } from "framer-motion";

// ---------------------------------------------------------------------------
// Sections — id (for anchor navigation), title, and content (JSX so we can
// use rich formatting: lists, emphasis, etc.).
// ---------------------------------------------------------------------------
interface Section {
  id: string;
  number: number;
  title: string;
  content: React.ReactNode;
}

const SECTIONS: Section[] = [
  {
    id: "introduction",
    number: 1,
    title: "Introduction",
    content: (
      <div className="space-y-3">
        <p>
          Welcome to <strong>Pradeep Medical Store</strong> (&quot;we&quot;, &quot;us&quot;,
          &quot;our&quot;), a licensed online pharmacy operating from Mathura, Uttar
          Pradesh, India. By accessing our website or placing an order, you
          agree to be bound by these Terms &amp; Conditions (&quot;Terms&quot;).
        </p>
        <p>
          These Terms govern your use of our website, mobile interfaces, and
          all services provided through them (collectively, the
          &quot;Services&quot;). If you do not agree with any part of these Terms,
          please do not use our Services.
        </p>
        <p>
          We are committed to providing genuine medicines and healthcare
          products in compliance with the Drugs &amp; Cosmetics Act, 1940 and
          all applicable pharmacy regulations in India.
        </p>
      </div>
    ),
  },
  {
    id: "account-registration",
    number: 2,
    title: "Account Registration",
    content: (
      <div className="space-y-3">
        <p>
          To place an order, you must register for an account by providing
          accurate, complete, and current information including your full
          name, email address, mobile number, and delivery address.
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>You must be at least 18 years old to register and place orders.</li>
          <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
          <li>You agree to notify us immediately of any unauthorized use of your account.</li>
          <li>One account per customer — creating multiple accounts with the same phone or email is not permitted.</li>
          <li>We reserve the right to suspend or terminate accounts that violate these Terms or engage in fraudulent activity.</li>
        </ul>
      </div>
    ),
  },
  {
    id: "privacy",
    number: 3,
    title: "Privacy & Data Protection",
    content: (
      <div className="space-y-3">
        <p>
          We respect your privacy and are committed to protecting your
          personal and health-related information. Our data handling practices
          comply with applicable Indian data protection regulations.
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>We collect only the information necessary to process orders, deliver medicines, and provide customer support.</li>
          <li>Your prescription data is stored securely and accessible only to licensed pharmacists for verification.</li>
          <li>We never sell your personal or health data to third parties.</li>
          <li>Aggregated, anonymized data may be used for analytics to improve our services.</li>
          <li>You may request access to, correction of, or deletion of your personal data at any time by contacting us.</li>
        </ul>
      </div>
    ),
  },
  {
    id: "order-processing",
    number: 4,
    title: "Order Processing",
    content: (
      <div className="space-y-3">
        <p>
          All orders are subject to product availability and confirmation of
          the order price. We reserve the right to refuse or cancel any order
          at our discretion, including orders that:
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Require a valid prescription that cannot be verified.</li>
          <li>Appear to be fraudulent, suspicious, or in violation of these Terms.</li>
          <li>Involve Schedule X drugs or other restricted substances we do not stock.</li>
          <li>Are placed outside our delivery zones.</li>
        </ul>
        <p>
          Order acceptance occurs when we dispatch the products — until then,
          no contract is formed. You will receive order confirmation, dispatch,
          and delivery updates via email and SMS.
        </p>
      </div>
    ),
  },
  {
    id: "returns-refunds",
    number: 5,
    title: "Returns & Refunds",
    content: (
      <div className="space-y-3">
        <p>
          Due to the nature of pharmaceutical products, our return policy is
          restricted to protect consumer safety. Please review our{" "}
          <strong>Refund Policy</strong> page for complete details.
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Returns are accepted only for damaged or incorrect items received.</li>
          <li>Replacement is available for expired medicines if reported within 2-3 hours of delivery.</li>
          <li>Prescription medicines cannot be returned once dispensed, except in cases of dispensing error.</li>
          <li>Refunds are processed to the original payment method within 5-7 business days.</li>
        </ul>
      </div>
    ),
  },
  {
    id: "prescription-policy",
    number: 6,
    title: "Prescription Policy",
    content: (
      <div className="space-y-3">
        <p>
          Medicines marked with an &quot;Rx&quot; badge require a valid
          doctor&apos;s prescription as mandated by the Drugs &amp; Cosmetics
          Rules, 1945.
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Prescriptions must be issued by a registered medical practitioner (RMP) in India.</li>
          <li>Prescriptions must clearly show the doctor&apos;s name, registration number, date, patient name, and the prescribed medicines.</li>
          <li>Our pharmacists verify every prescription before dispatch. We may contact you for clarification if needed.</li>
          <li>We reserve the right to refuse supply if a prescription is invalid, expired, or illegible.</li>
          <li>Repeat prescriptions are valid for the duration specified by the prescribing doctor, up to a maximum of 6 months.</li>
        </ul>
      </div>
    ),
  },
  {
    id: "liability",
    number: 7,
    title: "Limitation of Liability",
    content: (
      <div className="space-y-3">
        <p>
          To the maximum extent permitted by law, Pradeep Medical Store shall
          not be liable for any indirect, incidental, special, consequential,
          or punitive damages arising from your use of our Services.
        </p>
        <p>
          We are not liable for any adverse health outcomes resulting from
          self-medication, misuse of medicines, or failure to consult a
          qualified medical practitioner. Always seek professional medical
          advice before starting, stopping, or changing any treatment.
        </p>
        <p>
          Our total liability for any claim arising from your use of our
          Services shall not exceed the total amount you paid for the
          specific order giving rise to the claim.
        </p>
      </div>
    ),
  },
  {
    id: "governing-law",
    number: 8,
    title: "Governing Law & Dispute Resolution",
    content: (
      <div className="space-y-3">
        <p>
          These Terms are governed by and construed in accordance with the
          laws of the Republic of India. Any disputes arising from these Terms
          or your use of our Services shall be subject to the exclusive
          jurisdiction of the courts at <strong>Mathura, Uttar Pradesh</strong>.
        </p>
        <p>
          Before initiating legal proceedings, we encourage you to contact us
          so we can attempt to resolve the dispute amicably. We will respond
          to all complaints within 7 business days.
        </p>
      </div>
    ),
  },
  {
    id: "changes",
    number: 9,
    title: "Changes to These Terms",
    content: (
      <div className="space-y-3">
        <p>
          We may update these Terms from time to time to reflect changes in
          our practices, legal requirements, or operational features. The
          &quot;Last updated&quot; date at the top of this page indicates when
          the Terms were last revised.
        </p>
        <p>
          For significant changes, we will notify you via email or a
          prominent notice on our website at least 7 days before the changes
          take effect. Your continued use of our Services after the effective
          date constitutes acceptance of the revised Terms.
        </p>
      </div>
    ),
  },
];

export function TermsView() {
  const navigate = useUI((s) => s.navigate);
  const [activeId, setActiveId] = useState<string>("introduction");

  // Track the section currently in view via IntersectionObserver, and
  // highlight the corresponding link in the table of contents.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        }
      },
      // Trigger when a section's top crosses ~30% of the viewport.
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  const lastUpdated = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
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
            <FileText className="size-3" /> Legal
          </Badge>
          <span className="text-xs text-white/80">Last updated: {lastUpdated}</span>
        </div>
        <h1 className="mt-3 text-2xl font-bold sm:text-3xl">Terms &amp; Conditions</h1>
        <p className="mt-1 text-sm text-white/90 sm:text-base">
          Please read these Terms carefully before using our online pharmacy services.
        </p>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Sticky table of contents (desktop only) */}
        <aside className="hidden lg:block">
          <div className="sticky top-4">
            <Card className="p-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                On this page
              </h2>
              <nav className="space-y-1">
                {SECTIONS.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      document
                        .getElementById(s.id)
                        ?.scrollIntoView({ behavior: "smooth", block: "start" });
                      setActiveId(s.id);
                    }}
                    className={`flex items-start gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                      activeId === s.id
                        ? "bg-emerald-50 font-medium text-emerald-700"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    <span className="text-xs tabular-nums opacity-70">{s.number}.</span>
                    <span>{s.title}</span>
                  </a>
                ))}
              </nav>
            </Card>
          </div>
        </aside>

        {/* Main content — numbered sections */}
        <div className="space-y-8">
          {SECTIONS.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-4">
              <div className="mb-3 flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                  {s.number}
                </div>
                <h2 className="mt-1 text-xl font-bold sm:text-2xl">{s.title}</h2>
              </div>
              <div className="prose prose-sm max-w-none text-sm leading-relaxed text-muted-foreground sm:text-base sm:leading-relaxed [&_li]:my-0.5 [&_p]:mb-2 [&_strong]:text-foreground">
                {s.content}
              </div>
            </section>
          ))}

          {/* Footer / acceptance note */}
          <Card className="flex flex-col items-start gap-3 border-emerald-200 bg-emerald-50/50 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <ShieldCheck className="size-5 shrink-0 text-emerald-600" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Questions about these Terms?
                </p>
                <p className="text-xs text-muted-foreground">
                  We&apos;re happy to clarify anything. Reach out via the Contact Us page.
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
        </div>
      </div>
    </div>
  );
}
