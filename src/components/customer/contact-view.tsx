// ============================================================================
// File: src/components/customer/contact-view.tsx
// Purpose: Contact page with an emerald gradient hero, split layout (form on
//          the left, store info on the right), social media icons, business
//          hours, FAQ accordion, and a gradient map placeholder.
// Role: Lets customers reach the pharmacy directly and find quick answers.
// ============================================================================

"use client";

import { useMutation } from "@tanstack/react-query";
import { api } from "./api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Send,
  Loader2,
  CheckCircle2,
  MessageCircle,
  ExternalLink,
  Facebook,
  Instagram,
  Twitter,
  HelpCircle,
  Navigation,
  User,
  MessageSquare,
} from "lucide-react";
import { usePublicSettings } from "./use-public-settings";
import { toast } from "sonner";
import { useState } from "react";
import { motion } from "framer-motion";

export function ContactView() {
  const { settings, isStoreOpen } = usePublicSettings();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Submit the contact form to /api/contact, which persists it to the
  // NotificationLog so admins can read all enquiries from the Notifications
  // panel (templateKey = contact_form).
  const submitMutation = useMutation({
    mutationFn: () =>
      api.post("/api/contact", { name, email, phone, message }),
    onSuccess: () => {
      toast.success("Message sent! We'll get back to you shortly.");
      setSubmitted(true);
      setName("");
      setEmail("");
      setPhone("");
      setSubject("");
      setMessage("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !message) {
      toast.error("Please fill in your name, email and message");
      return;
    }
    submitMutation.mutate();
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      {/* ----------------------------------------------------------------- */}
      {/* Emerald gradient hero with store open/closed badge                */}
      {/* ----------------------------------------------------------------- */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-6 text-white shadow-lg sm:p-10"
      >
        {/* Decorative dotted overlay */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />
        {/* Decorative blobs */}
        <div className="absolute -right-12 -top-12 size-48 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-16 -left-12 size-56 rounded-full bg-teal-300/20 blur-3xl" />

        <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <Badge className="mb-3 bg-white/20 text-white backdrop-blur-sm hover:bg-white/20">
              <MessageSquare className="size-3" /> We&apos;d love to hear from you
            </Badge>
            <h1 className="text-2xl font-bold sm:text-4xl">Get in Touch</h1>
            <p className="mt-2 text-sm text-white/90 sm:text-base">
              Questions about an order, a medicine, or your prescription? Our
              pharmacists are here to help — reach out and we&apos;ll respond within
              one business day.
            </p>
          </div>

          {/* Store open/closed status badge — top-right of the hero */}
          <div className="flex flex-col items-start gap-2 rounded-2xl bg-white/15 p-4 backdrop-blur-sm sm:items-end">
            <div className="flex items-center gap-2">
              <span
                className={`flex size-2.5 items-center justify-center rounded-full ${
                  isStoreOpen ? "bg-emerald-300" : "bg-amber-300"
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${
                    isStoreOpen ? "bg-emerald-100" : "bg-amber-100"
                  }`}
                />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide">
                {isStoreOpen ? "Open Now" : "Currently Closed"}
              </span>
            </div>
            <p className="text-xs text-white/80">
              {settings?.store.openTime} - {settings?.store.closeTime}
            </p>
            <p className="text-xs text-white/80">All days, IST</p>
          </div>
        </div>
      </motion.div>

      {/* ----------------------------------------------------------------- */}
      {/* Split layout — form LEFT, info RIGHT (stacked on mobile)          */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ----------------------------- FORM ----------------------------- */}
        <div className="space-y-4">
          {submitted ? (
            <Card className="gap-3 p-6 text-center">
              <CheckCircle2 className="mx-auto size-14 text-emerald-600" />
              <h2 className="text-lg font-semibold">Message sent!</h2>
              <p className="text-sm text-muted-foreground">
                Thanks for reaching out. Our team will respond within one
                business day. For urgent queries, please call us directly.
              </p>
              <Button
                onClick={() => {
                  setSubmitted(false);
                  setName("");
                  setEmail("");
                  setPhone("");
                  setSubject("");
                  setMessage("");
                }}
                variant="outline"
              >
                Send another message
              </Button>
            </Card>
          ) : (
            <Card className="gap-4 p-5 sm:p-6">
              <div>
                <h2 className="text-lg font-semibold">Send us a message</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Fill out the form below and we&apos;ll get back to you as soon as possible.
                </p>
              </div>
              <form onSubmit={onSubmit} className="space-y-4">
                <Field id="c-name" label="Your Name" required>
                  <div className="relative">
                    <User className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="c-name"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-8"
                      required
                    />
                  </div>
                </Field>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field id="c-email" label="Email" required>
                    <div className="relative">
                      <Mail className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="c-email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-8"
                        required
                      />
                    </div>
                  </Field>
                  <Field id="c-phone" label="Phone">
                    <div className="relative">
                      <Phone className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="c-phone"
                        placeholder="+91 98765 43210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </Field>
                </div>

                <Field id="c-subject" label="Subject">
                  <Input
                    id="c-subject"
                    placeholder="Order enquiry, prescription, etc."
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </Field>

                <Field id="c-message" label="Message" required>
                  <Textarea
                    id="c-message"
                    placeholder="How can we help you?"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    required
                  />
                </Field>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
                  disabled={submitMutation.isPending}
                >
                  {submitMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="size-4" /> Send message
                    </>
                  )}
                </Button>
              </form>
            </Card>
          )}

          {/* FAQ — moved under the form so it's still visible after submit. */}
          <Card className="p-5 sm:p-6">
            <h2 className="mb-1 flex items-center gap-2 text-base font-semibold">
              <HelpCircle className="size-4 text-emerald-600" /> Frequently Asked Questions
            </h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Quick answers to common questions. Can&apos;t find what you need? Use the form above.
            </p>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="q1">
                <AccordionTrigger className="text-sm">
                  Do I need a prescription to order medicines?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  Only prescription medicines (marked with an &quot;Rx&quot; badge) require
                  a valid doctor&apos;s prescription. You can upload it during checkout
                  or send it via WhatsApp. Over-the-counter (OTC) products do not
                  require a prescription.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q2">
                <AccordionTrigger className="text-sm">
                  How long does delivery take in Mathura?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  Express delivery within Mathura city typically takes 30-45
                  minutes for in-stock items. Orders placed after closing time
                  will be delivered the next business day. You&apos;ll receive live
                  tracking updates once your order is dispatched.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q3">
                <AccordionTrigger className="text-sm">
                  What is your return and refund policy?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  Due to safety regulations, prescription medicines cannot be
                  returned once dispensed. Damaged or incorrect items can be
                  reported within 2-3 hours of delivery for a full refund or
                  replacement. Refunds are processed to the original payment
                  method within 5-7 business days.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q4">
                <AccordionTrigger className="text-sm">
                  Can I order medicines for someone else?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  Yes — you can place an order for a family member or friend.
                  Just enter their delivery address at checkout. For
                  prescription medicines, the prescription must be in the name
                  of the person the medicine is intended for.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>
        </div>

        {/* ----------------------------- INFO ----------------------------- */}
        <div className="space-y-4">
          <Card className="gap-3 p-5 sm:p-6">
            <h2 className="text-base font-semibold">Store Information</h2>
            <div className="space-y-3 text-sm">
              <InfoRow icon={MapPin} label="Address">
                {settings?.store.address}
              </InfoRow>
              <InfoRow icon={Phone} label="Phone">
                <a href={`tel:${settings?.store.phone}`} className="hover:text-primary">
                  {settings?.store.phone}
                </a>
              </InfoRow>
              <InfoRow icon={Mail} label="Email">
                <a href={`mailto:${settings?.store.email}`} className="hover:text-primary">
                  {settings?.store.email}
                </a>
              </InfoRow>
              <InfoRow icon={Clock} label="Hours">
                <div className="flex items-center gap-2">
                  <span>
                    {settings?.store.openTime} - {settings?.store.closeTime}
                  </span>
                  <Badge
                    className={
                      isStoreOpen
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }
                  >
                    {isStoreOpen ? "Open now" : "Closed"}
                  </Badge>
                </div>
              </InfoRow>
            </div>
          </Card>

          {/* Business hours - full weekly schedule for clarity */}
          <Card className="gap-3 p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Clock className="size-4 text-emerald-600" /> Business Hours
            </h2>
            <ul className="space-y-1.5 text-sm">
              <DayRow day="Monday - Friday" hours={(settings?.store.openTime || "09:00") + " - " + (settings?.store.closeTime || "21:00")} />
              <DayRow day="Saturday" hours={(settings?.store.openTime || "09:00") + " - " + (settings?.store.closeTime || "21:00")} />
              <DayRow day="Sunday" hours="10:00 - 18:00" />
              <li className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
                <span>All times in IST</span>
                <Badge variant="outline" className={isStoreOpen ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}>
                  {isStoreOpen ? "● Open now" : "● Currently closed"}
                </Badge>
              </li>
            </ul>
          </Card>

          {/* Quick contact + Social row */}
          <Card className="gap-3 p-5 sm:p-6">
            <h2 className="text-base font-semibold">Connect with us</h2>
            <div className="flex flex-col gap-2">
              <Button variant="outline" className="justify-start gap-2" asChild>
                <a href={`tel:${settings?.store.phone}`}>
                  <Phone className="size-4" /> Call the pharmacy
                </a>
              </Button>
              <Button variant="outline" className="justify-start gap-2" asChild>
                <a href={`mailto:${settings?.store.email}`}>
                  <Mail className="size-4" /> Send us an email
                </a>
              </Button>
              {settings?.store.phone && (
                <Button variant="outline" className="justify-start gap-2" asChild>
                  <a
                    href={`https://wa.me/${settings.store.phone.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle className="size-4" /> Chat on WhatsApp
                    <ExternalLink className="ml-auto size-3.5" />
                  </a>
                </Button>
              )}
            </div>
            {/* Social media icons row */}
            <div className="mt-2 flex items-center gap-2 border-t pt-3">
              <span className="text-xs text-muted-foreground">Follow us:</span>
              <SocialIcon
                icon={Facebook}
                label="Facebook"
                href="https://facebook.com"
                color="hover:bg-blue-50 hover:text-blue-600"
              />
              <SocialIcon
                icon={Instagram}
                label="Instagram"
                href="https://instagram.com"
                color="hover:bg-pink-50 hover:text-pink-600"
              />
              <SocialIcon
                icon={Twitter}
                label="Twitter"
                href="https://twitter.com"
                color="hover:bg-sky-50 hover:text-sky-600"
              />
              {settings?.store.phone && (
                <SocialIcon
                  icon={MessageCircle}
                  label="WhatsApp"
                  href={`https://wa.me/${settings.store.phone.replace(/[^0-9]/g, "")}`}
                  color="hover:bg-emerald-50 hover:text-emerald-600"
                />
              )}
            </div>
          </Card>

          {/* Map placeholder - gradient box with "Map" label. No real map
              integration; purely a visual placeholder until a maps API key
              is added. */}
          <Card className="overflow-hidden p-0 py-0">
            <div className="relative aspect-video w-full bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600">
              {/* Subtle grid pattern overlay for a "map" feel */}
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage:
                    "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
                  backgroundSize: "32px 32px",
                }}
              />
              {/* Decorative "route" line */}
              <svg
                className="absolute inset-0 size-full opacity-30"
                viewBox="0 0 400 225"
                preserveAspectRatio="none"
              >
                <path
                  d="M20 180 Q 120 80, 200 130 T 380 60"
                  fill="none"
                  stroke="white"
                  strokeWidth="3"
                  strokeDasharray="8 6"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white">
                <div className="flex size-12 items-center justify-center rounded-full bg-white/25 backdrop-blur-sm">
                  <MapPin className="size-6" />
                </div>
                <p className="text-sm font-semibold uppercase tracking-wide">Map</p>
                <p className="px-6 text-center text-xs text-white/90">
                  {settings?.store.address || "Pradeep Medical Store, Mathura"}
                </p>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(settings?.store.address || "Mathura")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur-sm transition-colors hover:bg-white/30"
                >
                  <Navigation className="size-3" /> Open in Google Maps
                </a>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Field({
  id,
  label,
  required,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </Label>
      {children}
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof MapPin;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-emerald-600" />
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="font-medium text-foreground">{children}</div>
      </div>
    </div>
  );
}

function DayRow({ day, hours }: { day: string; hours: string }) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-muted-foreground">{day}</span>
      <span className="font-medium text-foreground">{hours}</span>
    </li>
  );
}

function SocialIcon({
  icon: Icon,
  label,
  href,
  color,
}: {
  icon: typeof Facebook;
  label: string;
  href: string;
  color: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className={`flex size-9 items-center justify-center rounded-full border bg-card text-muted-foreground transition-colors ${color}`}
    >
      <Icon className="size-4" />
    </a>
  );
}
