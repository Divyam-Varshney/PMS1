// ============================================================================
// File: src/components/customer/back-in-stock-button.tsx
// Purpose: "Notify me when available" button shown on out-of-stock product
//          detail pages. Uses the StockSubscription API. Handles auth check
//          (prompts login if not authenticated), success state, and errors.
// Role: Premium e-commerce UX — lets customers opt into restock alerts so
//       they don't have to keep checking back.
// ============================================================================

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, BellRing, Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api, qk } from "./api";
import { useUI } from "@/lib/store";
import { toast } from "sonner";

interface Props {
  productId: string;
  productName: string;
  className?: string;
}

export function BackInStockButton({ productId, productName, className }: Props) {
  const navigate = useUI((s) => s.navigate);
  const qc = useQueryClient();
  const [subscribed, setSubscribed] = useState(false);

  const mutation = useMutation({
    mutationFn: () => api.post("/api/stock-subscriptions", { productId }),
    onSuccess: () => {
      setSubscribed(true);
      qc.invalidateQueries({ queryKey: qk.me });
      toast.success("You're subscribed!", {
        description: `We'll email you as soon as "${productName}" is back in stock.`,
      });
    },
    onError: (e: Error) => {
      if (e.message.toLowerCase().includes("unauthorized") || e.message.toLowerCase().includes("login")) {
        toast.info("Please login to subscribe to stock alerts");
        navigate({ name: "auth", mode: "login" });
        return;
      }
      toast.error(e.message || "Failed to subscribe. Please try again.");
    },
  });

  const onClick = async () => {
    const me = qc.getQueryData<{ id: string } | null>(qk.me);
    if (!me) {
      toast.info("Please login to subscribe to stock alerts");
      navigate({ name: "auth", mode: "login" });
      return;
    }
    mutation.mutate();
  };

  if (subscribed) {
    return (
      <div
        className={`flex w-full items-center justify-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 ${className ?? ""}`}
      >
        <Check className="size-4" />
        Subscribed — we&apos;ll email you when it&apos;s back
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      onClick={onClick}
      disabled={mutation.isPending}
      className={`w-full gap-2 border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:text-amber-900 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-900/40 ${className ?? ""}`}
    >
      {mutation.isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <BellRing className="size-4" />
      )}
      Notify me when available
    </Button>
  );
}

/** Compact pill variant for use on product cards or in lists. */
export function BackInStockPill({ productId }: { productId: string }) {
  const navigate = useUI((s) => s.navigate);
  const qc = useQueryClient();
  const [subscribed, setSubscribed] = useState(false);

  const mutation = useMutation({
    mutationFn: () => api.post("/api/stock-subscriptions", { productId }),
    onSuccess: () => {
      setSubscribed(true);
      qc.invalidateQueries({ queryKey: qk.me });
      toast.success("Subscribed to restock alert");
    },
    onError: () => {
      toast.info("Please login to subscribe");
      navigate({ name: "auth", mode: "login" });
    },
  });

  if (subscribed) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
        <Check className="size-3" /> Subscribed
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        mutation.mutate();
      }}
      disabled={mutation.isPending}
      className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 transition-colors hover:bg-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-900/40"
      aria-label="Notify me when this product is back in stock"
    >
      <Bell className="size-3" /> Notify me
    </button>
  );
}
