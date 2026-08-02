// ============================================================================
// File: src/components/shared/trust-badges.tsx
// Purpose: Reusable trust badges component with two variants:
//          - "compact" — single row of small badges for product cards/detail.
//          - "full"    — larger cards with icon + title + description (footer).
// Role: Reassures customers that PMS is a licensed, secure pharmacy with fast
//       delivery. Used on product detail (above add-to-cart) and in the footer.
// ============================================================================

import { ShieldCheck, Lock, Truck, Pill } from "lucide-react";
import { cn } from "@/lib/utils";

// Static badge definitions — shared by both variants so visual identity is
// consistent. Each badge has an emerald/teal tint for the pharmacy theme.
const BADGES = [
  {
    key: "authentic",
    icon: ShieldCheck,
    title: "Authentic Medicines",
    description: "Sourced directly from licensed manufacturers",
    tint: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-100 dark:border-emerald-900/40",
  },
  {
    key: "secure",
    icon: Lock,
    title: "100% Secure",
    description: "Encrypted payments & data protection",
    tint: "text-teal-600 dark:text-teal-400",
    bg: "bg-teal-50 dark:bg-teal-950/30",
    border: "border-teal-100 dark:border-teal-900/40",
  },
  {
    key: "delivery",
    icon: Truck,
    title: "Fast Delivery",
    description: "Same-day delivery in Mathura, 2–3 days nationwide",
    tint: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-100 dark:border-amber-900/40",
  },
  {
    key: "pharmacy",
    icon: Pill,
    title: "Licensed Pharmacy",
    description: "Verified pharmacists review every Rx order",
    tint: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-100 dark:border-emerald-900/40",
  },
] as const;

interface TrustBadgesProps {
  variant?: "compact" | "full";
  className?: string;
}

/**
 * TrustBadges — pharmacy trust indicators.
 *
 * @param variant
 *   - "compact" (default): small inline pills with icon + label, used on
 *     product cards / detail pages where vertical space is tight.
 *   - "full": larger cards with icon + title + description, used in the
 *     footer or checkout summary where there's room to breathe.
 */
export function TrustBadges({ variant = "compact", className }: TrustBadgesProps) {
  if (variant === "compact") {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] font-medium text-muted-foreground",
          className
        )}
      >
        {BADGES.map((b) => {
          const Icon = b.icon;
          return (
            <span
              key={b.key}
              className="inline-flex items-center gap-1"
              title={b.description}
            >
              <Icon className={cn("size-3.5", b.tint)} />
              {b.title}
            </span>
          );
        })}
      </div>
    );
  }

  // Full variant — 4 cards in a responsive grid.
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4",
        className
      )}
    >
      {BADGES.map((b) => {
        const Icon = b.icon;
        return (
          <div
            key={b.key}
            className={cn(
              "flex flex-col items-start gap-1.5 rounded-xl border p-3",
              b.bg,
              b.border
            )}
          >
            <div
              className={cn(
                "flex size-9 items-center justify-center rounded-lg bg-background/80 shadow-sm",
                b.tint
              )}
            >
              <Icon className="size-5" />
            </div>
            <p className="text-xs font-bold text-foreground">{b.title}</p>
            <p className="text-[10px] leading-snug text-muted-foreground">
              {b.description}
            </p>
          </div>
        );
      })}
    </div>
  );
}
