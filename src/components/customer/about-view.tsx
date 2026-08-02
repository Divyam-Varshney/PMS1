// ============================================================================
// File: src/components/customer/about-view.tsx
// Purpose: Premium "About Us" page — brand story, mission, values, trust.
// Role: Builds trust with first-time customers through authentic storytelling.
// ============================================================================

"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pill, ShieldCheck, Truck, Heart, Award, Users, Clock, MapPin, Sparkles, Stethoscope, Package } from "lucide-react";
import { usePublicSettings } from "./use-public-settings";
import { motion } from "framer-motion";

export function AboutView() {
  const { settings } = usePublicSettings();
  const storeName = settings?.store.name ?? "Pradeep Medical Store";

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-700 p-8 text-center text-white shadow-xl sm:p-12"
      >
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur ring-1 ring-white/20">
          <Pill className="size-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">{storeName}</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm text-emerald-50/90 sm:text-base">
          Serving Mathura with trusted healthcare since 1995. Now bringing the same
          commitment online — genuine medicines, fast delivery, and pharmacist-verified care.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Badge className="border border-white/20 bg-white/10 text-white backdrop-blur">
            <Clock className="mr-1 size-3" /> Est. 1995
          </Badge>
          <Badge className="border border-white/20 bg-white/10 text-white backdrop-blur">
            <MapPin className="mr-1 size-3" /> Mathura, UP
          </Badge>
          <Badge className="border border-white/20 bg-white/10 text-white backdrop-blur">
            <ShieldCheck className="mr-1 size-3" /> Licensed Pharmacy
          </Badge>
        </div>
      </motion.section>

      {/* Brand Story */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
      >
        <Card className="mb-6 gap-4 p-6 sm:p-8">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Our Story</h2>

          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            <p>
              In <strong className="text-foreground">1995</strong>, <strong className="text-foreground">Pradeep Varshney</strong> opened
              a small pharmacy in the heart of <strong className="text-foreground">Mathura</strong> with a simple
              mission — to serve his community with honest advice, genuine medicines, and the kind of
              personal care that only a neighborhood pharmacist can provide.
            </p>

            <p>
              What began as a single counter grew into <strong className="text-foreground">{storeName}</strong>, a
              name that became synonymous with trust in Mathura. Over three decades, Pradeep built
              relationships with thousands of families — knowing their prescriptions by heart,
              remembering their children's allergies, and being available at all hours when
              someone needed medicine urgently.
            </p>

            <p>
              The pharmacy earned its reputation the hard way — not through advertising, but through
              word of mouth. One satisfied customer told another. A mother who received medicine at
              midnight told her neighbors. A doctor who saw consistent, genuine products recommended
              the store to patients. Year after year, the trust grew.
            </p>

            <p>
              Today, <strong className="text-foreground">{storeName}</strong> is taking the next step in its journey —
              bringing the same commitment to quality healthcare into the digital world. Our online
              platform allows customers to order medicines from the comfort of their homes, upload
              prescriptions for pharmacist review, request hard-to-find medicines, and track
              deliveries in real-time.
            </p>

            <p>
              But some things haven't changed. Every order is still reviewed by a licensed pharmacist.
              Every medicine is still sourced directly from authorized distributors. And every customer
              is still treated with the same personal care that Pradeep started with in 1995.
            </p>

            <p className="border-l-4 border-emerald-500 pl-4 text-base font-medium italic text-foreground">
              "Healthcare is not a business — it's a responsibility. Every medicine that leaves our
              store carries our family's name and our community's trust."
            </p>
            <p className="text-right text-sm text-muted-foreground">— Pradeep Varshney, Founder</p>
          </div>
        </Card>
      </motion.div>

      {/* Mission & Vision */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <motion.div initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.3 }}>
          <Card className="gap-3 p-6">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              <Heart className="size-5" />
            </div>
            <h3 className="text-base font-semibold">Our Mission</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              To make genuine medicines and healthcare products accessible to every family in Mathura
              and beyond — with the speed of modern technology and the care of a trusted local pharmacist.
            </p>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.3 }}>
          <Card className="gap-3 p-6">
            <div className="flex size-10 items-center justify-center rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
              <Sparkles className="size-5" />
            </div>
            <h3 className="text-base font-semibold">Our Vision</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              To be the most trusted online pharmacy in the region — where technology meets compassion,
              and where every customer feels cared for, not just served.
            </p>
          </Card>
        </motion.div>
      </div>

      {/* Values */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <h2 className="mb-4 text-xl font-bold tracking-tight sm:text-2xl">What We Stand For</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: ShieldCheck, title: "Authenticity", desc: "100% genuine medicines sourced from licensed manufacturers only." },
            { icon: Truck, title: "Speed", desc: "Same-day delivery in Mathura, often within 30–60 minutes." },
            { icon: Stethoscope, title: "Expertise", desc: "Licensed pharmacists review every prescription and order." },
            { icon: Heart, title: "Care", desc: "Personal guidance and support — we treat you like family." },
          ].map((v) => {
            const Icon = v.icon;
            return (
              <Card key={v.title} className="gap-2 p-5 text-center">
                <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  <Icon className="size-5" />
                </div>
                <h4 className="text-sm font-semibold">{v.title}</h4>
                <p className="text-xs leading-relaxed text-muted-foreground">{v.desc}</p>
              </Card>
            );
          })}
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <Card className="gap-0 p-6 sm:p-8">
          <div className="grid grid-cols-2 gap-6 text-center sm:grid-cols-4">
            <div>
              <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">30+</p>
              <p className="mt-1 text-xs text-muted-foreground">Years of Service</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">10K+</p>
              <p className="mt-1 text-xs text-muted-foreground">Happy Customers</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">300+</p>
              <p className="mt-1 text-xs text-muted-foreground">Products Available</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">100%</p>
              <p className="mt-1 text-xs text-muted-foreground">Genuine Medicines</p>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
        className="rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-700 p-8 text-center text-white shadow-xl"
      >
        <Package className="mx-auto mb-3 size-10 text-emerald-100" />
        <h2 className="text-xl font-bold sm:text-2xl">Ready to order?</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-emerald-50/90">
          Browse our catalog of genuine medicines, upload your prescription, or request a medicine
          you can't find. We're here to help.
        </p>
      </motion.div>
    </div>
  );
}
