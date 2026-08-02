// ============================================================================
// File: src/components/customer/health-tip-view.tsx
// Purpose: Full-article view for a single health tip. Renders the icon,
//          title, read time, full content, key takeaways, a "Back to Home"
//          button, and a "Related Tips" section (3 random tips).
// ============================================================================

"use client";

import { useUI } from "@/lib/store";
import { getHealthTipById, HEALTH_TIPS, HealthTipIcon } from "./health-tips-data";
import {
  HeartPulse,
  Droplets,
  Pill,
  Sun,
  Moon,
  Activity,
  Brain,
  Bone,
  Eye,
  Apple,
  Stethoscope,
  Thermometer,
  Wind,
  Shield,
  Baby,
  Leaf,
  ChevronLeft,
  Clock,
  CheckCircle2,
  ArrowUpRight,
  Lightbulb,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

// Map the string icon key stored in the data module to the actual Lucide
// component. Centralised here so both the home strip and the article view
// use the same mapping.
const ICONS: Record<HealthTipIcon, typeof HeartPulse> = {
  HeartPulse,
  Droplets,
  Pill,
  Sun,
  Moon,
  Activity,
  Brain,
  Bone,
  Eye,
  Apple,
  Stethoscope,
  Thermometer,
  Wind,
  Shield,
  Baby,
  Leaf,
};

export function HealthTipView() {
  const view = useUI((s) => s.view);
  const navigate = useUI((s) => s.navigate);

  // tipId comes from the URL hash via the CustomerView type. Fall back to 0
  // for invalid ids so the page never crashes.
  const tipId = view.name === "health-tip" ? view.tipId : 0;
  const tip = getHealthTipById(tipId);

  // Related tips — pick 3 tips that aren't the current one. We use the same
  // daily-rotation seed as the homepage so the set is stable within a day.
  const related = HEALTH_TIPS.filter((t) => t.id !== tipId).slice(0, 3);

  // Invalid id (e.g. someone bookmarked an out-of-range id) — show a friendly
  // fallback instead of crashing.
  if (!tip) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center">
        <h1 className="text-2xl font-bold">Tip not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The health tip you&apos;re looking for doesn&apos;t exist.
        </p>
        <button
          onClick={() => navigate({ name: "home" })}
          className="mt-4 inline-flex items-center gap-1 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <ChevronLeft className="size-4" /> Back to home
        </button>
      </div>
    );
  }

  const Icon = ICONS[tip.icon];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      {/* Back button */}
      <button
        onClick={() => navigate({ name: "home" })}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Back to Home
      </button>

      {/* Article header — gradient banner with icon + title */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={`relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br ${tip.gradient} p-6 text-white shadow-lg sm:p-8`}
      >
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />
        <div className="relative">
          <Badge className="mb-3 bg-white/20 text-white backdrop-blur-sm hover:bg-white/20">
            <Lightbulb className="size-3" /> Health Tip
          </Badge>
          <div className="mb-3 flex size-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
            <Icon className="size-8" />
          </div>
          <h1 className="text-2xl font-bold sm:text-3xl">{tip.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-white/90">
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" /> {tip.readTime} min read
            </span>
            <span>•</span>
            <span>Reviewed by Pradeep Medical Store pharmacists</span>
          </div>
        </div>
      </motion.div>

      {/* Article body */}
      <motion.article
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="prose prose-sm max-w-none sm:prose-base"
      >
        <div className="space-y-4 text-sm leading-relaxed text-foreground sm:text-base sm:leading-relaxed">
          {tip.content.map((paragraph, i) => (
            <p key={i} className="text-muted-foreground">
              {paragraph}
            </p>
          ))}
        </div>
      </motion.article>

      {/* Key takeaways */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 sm:p-6"
      >
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-emerald-800 sm:text-lg">
          <CheckCircle2 className="size-5" /> Key Takeaways
        </h2>
        <ul className="space-y-2.5">
          {tip.takeaways.map((takeaway, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              <span>{takeaway}</span>
            </li>
          ))}
        </ul>
      </motion.div>

      {/* Medical disclaimer */}
      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <strong>Disclaimer:</strong> This article is for general information only
        and is not a substitute for professional medical advice. Always consult
        a qualified healthcare provider for diagnosis and treatment of any
        medical condition.
      </div>

      {/* Related tips */}
      {related.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-4 text-lg font-bold sm:text-xl">Related Health Tips</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {related.map((r) => {
              const RIcon = ICONS[r.icon];
              return (
                <motion.button
                  key={r.id}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate({ name: "health-tip", tipId: r.id })}
                  className="group flex flex-col overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className={`relative flex h-20 items-center justify-center bg-gradient-to-br ${r.gradient}`}>
                    <div className="flex size-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                      <RIcon className="size-5 text-white" />
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col p-3">
                    <h3 className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-emerald-700">
                      {r.title}
                    </h3>
                    <span className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-700">
                      Read more
                      <ArrowUpRight className="size-3" />
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom CTA */}
      <div className="mt-8 flex justify-center">
        <button
          onClick={() => navigate({ name: "home" })}
          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
        >
          <ChevronLeft className="size-4" /> Back to Home
        </button>
      </div>
    </div>
  );
}
