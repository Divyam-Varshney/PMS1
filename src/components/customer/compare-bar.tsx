// ============================================================================
// File: src/components/customer/compare-bar.tsx
// Purpose: Sticky bottom tray that shows products the customer has added to
//          the comparison list. Appears only when there are 1+ items and the
//          user is not already on the compare page. Provides "Compare Now"
//          and "Clear" actions.
// Role: Persistent entry point to the comparison feature.
// ============================================================================

"use client";

import { useUI } from "@/lib/store";
import { useCompare } from "./use-compare";
import { Button } from "@/components/ui/button";
import { ProductImage } from "@/components/shared/product-image";
import { GitCompare, X, Trash2, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function CompareBar() {
  const navigate = useUI((s) => s.navigate);
  const view = useUI((s) => s.view);
  const { items, remove, clear, mounted } = useCompare();

  // Don't render during SSR (mounted check), when empty, or when already on
  // the compare page (the page itself shows the comparison).
  if (!mounted || items.length === 0 || view.name === "compare") return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed inset-x-0 bottom-0 z-40 lg:bottom-0"
      >
        <div className="mx-auto max-w-7xl px-3 pb-3 sm:px-6 sm:pb-4">
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-card/95 p-3 shadow-2xl backdrop-blur-lg sm:p-4">
            {/* Icon + count */}
            <div className="hidden shrink-0 items-center gap-2 border-r pr-3 sm:flex">
              <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
                <GitCompare className="size-5" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-foreground">{items.length}/4</p>
                <p className="text-muted-foreground">Compare</p>
              </div>
            </div>

            {/* Product thumbnails (mobile: show count badge instead) */}
            <div className="flex flex-1 items-center gap-2 overflow-x-auto no-scrollbar">
              {items.map((p) => (
                <div key={p.id} className="group relative shrink-0">
                  <div className="size-12 overflow-hidden rounded-lg border bg-accent/20 sm:size-14">
                    <ProductImage
                      name={p.name}
                      brandName={p.brandName}
                      primaryImage={p.primaryImage}
                      size="sm"
                      className="!h-full !w-full"
                    />
                  </div>
                  <button
                    onClick={() => remove(p.id)}
                    className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-white shadow-sm transition-transform hover:scale-110"
                    aria-label={`Remove ${p.name} from compare`}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              {/* Empty slots */}
              {Array.from({ length: Math.max(0, 4 - items.length) }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="hidden size-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-muted-foreground/30 text-muted-foreground/40 sm:flex sm:size-14"
                >
                  <GitCompare className="size-4" />
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={clear}
                className="hidden gap-1 text-muted-foreground hover:text-destructive sm:flex"
              >
                <Trash2 className="size-4" /> Clear
              </Button>
              <Button
                size="sm"
                onClick={() => navigate({ name: "compare" })}
                className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Compare
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
