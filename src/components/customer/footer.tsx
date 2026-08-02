// ============================================================================
// File: src/components/customer/footer.tsx
// Purpose: Site footer with store info, quick links, contact, payment badges,
//          license info, copyright. Sticks to bottom via mt-auto.
// Role: Sticky footer pattern (root wrapper is min-h-screen flex flex-col).
// ============================================================================

"use client";

import { MapPin, Phone, Mail, Clock, ShieldCheck, Truck, FileText, Send, BookOpen, RotateCcw } from "lucide-react";
import { useUI } from "@/lib/store";
import { usePublicSettings } from "./use-public-settings";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";
import { TrustBadges } from "@/components/shared/trust-badges";

export function Footer() {
  const navigate = useUI((s) => s.navigate);
  const { settings } = usePublicSettings();
  const [email, setEmail] = useState("");
  const [subscribing, setSubscribing] = useState(false);
  if (!settings) return null;
  const s = settings.store;

  const onSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    // Basic email format check — UI feedback before hitting the API.
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Please enter a valid email address");
      return;
    }
    setSubscribing(true);
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const json = await res.json().catch(() => ({ ok: false, error: "Invalid JSON" }));
      if (!res.ok || !json.ok) {
        throw new Error(json.error || `Request failed (${res.status})`);
      }
      setEmail("");
      toast.success("Thanks for subscribing!", {
        description: "You'll start receiving health tips & exclusive offers soon.",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to subscribe");
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <footer className="mt-auto border-t border-border/50 bg-accent/20 pb-16 lg:pb-0">
      <div className="mx-auto max-w-7xl px-4 py-12 pb-24 lg:pb-12">
        {/* Newsletter subscription banner — sits at the top of the footer so
            it's the first thing customers see when they scroll past content. */}
        <div className="mb-12 overflow-hidden rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/80 p-6 shadow-premium sm:p-8">
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-premium-sm shadow-emerald-600/30">
                <Send className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground sm:text-lg">
                  Subscribe for health tips and exclusive offers
                </h3>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                  Join our newsletter — no spam, unsubscribe anytime.
                </p>
              </div>
            </div>
            <form
              onSubmit={onSubscribe}
              className="flex w-full max-w-md items-center gap-2 sm:w-auto"
            >
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="focus-premium h-11 border-emerald-200 bg-white shadow-premium-sm"
                aria-label="Email address"
              />
              <Button
                type="submit"
                disabled={subscribing}
                className="btn-premium h-11 shrink-0 gap-1.5 bg-emerald-600 text-white shadow-premium-sm hover:bg-emerald-700"
              >
                {subscribing ? "Subscribing…" : "Subscribe"}
              </Button>
            </form>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 md:grid-cols-3 lg:grid-cols-5">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 font-bold">
              <img
                src={s.logo || "/logo.png"}
                alt={s.name || "PMS"}
                loading="lazy"
                className="size-9 rounded-lg object-cover"
              />
              <div className="flex flex-col leading-none">
                <span className="text-base">{s.name}</span>
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Online Pharmacy
                </span>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{s.tagline}</p>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-4 text-emerald-600" />
              Licensed Pharmacy • {s.licenseNumber}
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-foreground">Shop</h4>
            <ul className="space-y-2.5 text-xs text-muted-foreground">
              <li>
                <button onClick={() => navigate({ name: "shop" })} className="border-l-2 border-transparent pl-2 transition-all duration-200 hover:border-primary hover:text-primary hover:translate-x-1">
                  All Products
                </button>
              </li>
              <li>
                <button onClick={() => navigate({ name: "shop" })} className="border-l-2 border-transparent pl-2 transition-all duration-200 hover:border-primary hover:text-primary hover:translate-x-1">
                  Best Sellers
                </button>
              </li>
              <li>
                <button onClick={() => navigate({ name: "prescription" })} className="border-l-2 border-transparent pl-2 transition-all duration-200 hover:border-primary hover:text-primary hover:translate-x-1">
                  Upload Prescription
                </button>
              </li>
              <li>
                <button onClick={() => navigate({ name: "manual-request" })} className="border-l-2 border-transparent pl-2 transition-all duration-200 hover:border-primary hover:text-primary hover:translate-x-1">
                  Request Medicines
                </button>
              </li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-foreground">Account</h4>
            <ul className="space-y-2.5 text-xs text-muted-foreground">
              <li>
                <button onClick={() => navigate({ name: "orders" })} className="border-l-2 border-transparent pl-2 transition-all duration-200 hover:border-primary hover:text-primary hover:translate-x-1">
                  My Orders
                </button>
              </li>
              <li>
                <button onClick={() => navigate({ name: "addresses" })} className="border-l-2 border-transparent pl-2 transition-all duration-200 hover:border-primary hover:text-primary hover:translate-x-1">
                  Addresses
                </button>
              </li>
              <li>
                <button onClick={() => navigate({ name: "profile" })} className="border-l-2 border-transparent pl-2 transition-all duration-200 hover:border-primary hover:text-primary hover:translate-x-1">
                  Profile
                </button>
              </li>
              <li>
                <button onClick={() => navigate({ name: "contact" })} className="border-l-2 border-transparent pl-2 transition-all duration-200 hover:border-primary hover:text-primary hover:translate-x-1">
                  Contact Us
                </button>
              </li>
            </ul>
          </div>

          {/* Help & Info */}
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-foreground">Help &amp; Info</h4>
            <ul className="space-y-2.5 text-xs text-muted-foreground">
              <li>
                <button onClick={() => navigate({ name: "about" })} className="border-l-2 border-transparent pl-2 transition-all duration-200 hover:border-primary hover:text-primary hover:translate-x-1">
                  About Us
                </button>
              </li>
              <li>
                <button onClick={() => navigate({ name: "terms" })} className="flex items-center gap-1 border-l-2 border-transparent pl-2 transition-all duration-200 hover:border-primary hover:text-primary hover:translate-x-1">
                  <FileText className="size-3" /> Terms &amp; Conditions
                </button>
              </li>
              <li>
                <button onClick={() => navigate({ name: "refund-policy" })} className="flex items-center gap-1 border-l-2 border-transparent pl-2 transition-all duration-200 hover:border-primary hover:text-primary hover:translate-x-1">
                  <RotateCcw className="size-3" /> Refund Policy
                </button>
              </li>
              <li>
                <button onClick={() => navigate({ name: "contact" })} className="flex items-center gap-1 border-l-2 border-transparent pl-2 transition-all duration-200 hover:border-primary hover:text-primary hover:translate-x-1">
                  <BookOpen className="size-3" /> FAQ
                </button>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className="col-span-2 md:col-span-1">
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-foreground">Contact</h4>
            <ul className="space-y-2.5 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                <span>{s.address}</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="size-3.5 shrink-0 text-emerald-600" />
                <a href={`tel:${s.phone}`} className="hover:text-primary">{s.phone}</a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="size-3.5 shrink-0 text-emerald-600" />
                <a href={`mailto:${s.email}`} className="hover:text-primary">{s.email}</a>
              </li>
              <li className="flex items-center gap-2">
                <Clock className="size-3.5 shrink-0 text-emerald-600" />
                <span>{s.openTime} - {s.closeTime}</span>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        {/* Trust badges — full variant placed above the payment methods row
            so customers see pharmacy credibility before the copyright/payment
            strip. Emerald/teal/amber palette (NO indigo/blue). */}
        <TrustBadges variant="full" className="mb-6" />

        <div className="flex flex-col items-center justify-between gap-4 text-xs text-muted-foreground sm:flex-row">
          <div className="flex flex-wrap items-center gap-4">
            <span>© {new Date().getFullYear()} {s.name}. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Truck className="size-3.5 text-emerald-600" /> Fast delivery in Mathura
            </span>
            <span className="flex items-center gap-1">
              <FileText className="size-3.5 text-emerald-600" /> GST Invoice
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
