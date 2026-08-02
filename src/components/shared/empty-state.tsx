// ============================================================================
// File: src/components/shared/empty-state.tsx
// Purpose: Reusable empty-state component with an icon, title, description,
//          and optional CTA button. Used across cart, orders, addresses, etc.
// Role: Consistent UX for "no data" screens — premium look + feel.
// ============================================================================

"use client";

import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden text-center py-20 px-4",
        className
      )}
    >
      {/* Decorative gradient background — subtle radial emerald wash */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(circle at 50% 30%, rgba(16,185,129,0.10) 0%, rgba(255,255,255,0) 60%)",
        }}
      />
      {/* Decorative dotted pattern overlay */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(16,185,129,0.35) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
          maskImage:
            "radial-gradient(circle at 50% 40%, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 70%)",
          WebkitMaskImage:
            "radial-gradient(circle at 50% 40%, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 70%)",
        }}
      />

      {/* Icon — larger, with pulse halo */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative mb-5 flex size-24 items-center justify-center"
      >
        {/* Soft pulsing halo */}
        <span className="absolute inset-0 rounded-full bg-emerald-400/15 animate-ping" />
        <span className="absolute inset-2 rounded-full bg-emerald-400/10" />
        {/* Icon circle */}
        <div className="relative flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30">
          <Icon className="size-10" strokeWidth={1.75} />
        </div>
      </motion.div>

      {/* Title — larger, bolder */}
      <motion.h3
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="text-xl font-bold tracking-tight text-foreground sm:text-2xl"
      >
        {title}
      </motion.h3>

      {/* Description — better readability */}
      {description && (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base"
        >
          {description}
        </motion.p>
      )}

      {/* Action — prominent, animated entrance */}
      {action && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="mt-7"
        >
          {action}
        </motion.div>
      )}
    </div>
  );
}
