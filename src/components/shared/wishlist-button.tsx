// ============================================================================
// File: src/components/shared/wishlist-button.tsx
// Purpose: Clean wishlist toggle button. Adds/removes products from the
//          customer's wishlist. Uses optimistic updates with proper state
//          tracking to ensure correct toast messages.
// ============================================================================

"use client";

import { Heart, Loader2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, qk } from "@/components/customer/api";
import { useCustomer } from "@/components/customer/use-customer";
import { useUI } from "@/lib/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface WishlistButtonProps {
  productId: string;
  variant?: "icon" | "pill";
  className?: string;
}

export function WishlistButton({
  productId,
  variant = "icon",
  className,
}: WishlistButtonProps) {
  const { customer } = useCustomer();
  const navigate = useUI((s) => s.navigate);
  const qc = useQueryClient();

  // Fetch wishlist — shared query, cached by TanStack Query
  const { data: wishlist } = useQuery({
    queryKey: qk.wishlist,
    queryFn: () => api<{ items: { id: string }[] } | null>("/api/wishlist").catch(() => null),
    enabled: !!customer,
  });

  // Check if this product is in the wishlist
  const isWished = !!wishlist?.items?.some((i) => i.id === productId);

  // Toggle mutation — add or remove based on current state
  const toggleMutation = useMutation({
    mutationFn: async () => {
      if (isWished) {
        await api.del(`/api/wishlist/${productId}`);
      } else {
        await api.post("/api/wishlist", { productId });
      }
    },
    onMutate: () => {
      // Optimistic update — flip the state immediately for instant UI feedback
      const wasWished = isWished;
      qc.setQueryData<{ items: { id: string }[] } | null>(qk.wishlist, (old) => {
        if (!old) return { items: [{ id: productId }] };
        return {
          ...old,
          items: wasWished
            ? old.items.filter((i) => i.id !== productId)
            : [...old.items, { id: productId }],
        };
      });
      return { wasWished };
    },
    onSuccess: (_data, _vars, context) => {
      // Use the context from onMutate to get the CORRECT previous state
      const wasWished = context?.wasWished ?? false;
      toast.success(wasWished ? "Removed from wishlist" : "Added to wishlist");
      // Refetch to get the full product data (not just { id })
      qc.invalidateQueries({ queryKey: qk.wishlist });
    },
    onError: (_e, _vars, context) => {
      // Revert optimistic update
      const wasWished = context?.wasWished ?? false;
      qc.setQueryData<{ items: { id: string }[] } | null>(qk.wishlist, (old) => {
        if (!old) return old;
        return {
          ...old,
          items: wasWished
            ? [...old.items, { id: productId }]
            : old.items.filter((i) => i.id !== productId),
        };
      });
      toast.error("Could not update wishlist");
    },
  });

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!customer) {
      toast.info("Please login to save items to your wishlist");
      navigate({ name: "auth", mode: "login" });
      return;
    }
    toggleMutation.mutate();
  };

  // ── Pill variant — for product detail pages ──
  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={toggleMutation.isPending}
        className={cn(
          "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all active:scale-95",
          isWished
            ? "border-rose-300 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
            : "border-border/60 bg-card text-foreground hover:border-primary/30 hover:bg-accent/50",
          className
        )}
        aria-pressed={isWished}
        aria-label={isWished ? "Remove from wishlist" : "Add to wishlist"}
      >
        <AnimatePresence mode="wait">
          {toggleMutation.isPending ? (
            <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Loader2 className="size-4 animate-spin" />
            </motion.span>
          ) : (
            <motion.span
              key={isWished ? "wished" : "not-wished"}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <Heart className={cn("size-4", isWished ? "fill-rose-500 text-rose-500" : "text-foreground")} />
            </motion.span>
          )}
        </AnimatePresence>
        <span>{isWished ? "Wishlisted" : "Add to wishlist"}</span>
      </button>
    );
  }

  // ── Icon variant — for product cards ──
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={toggleMutation.isPending}
      className={cn(
        "flex size-8 items-center justify-center rounded-full transition-all active:scale-90",
        "bg-white/90 shadow-sm backdrop-blur-md ring-1 ring-black/5",
        "hover:bg-white hover:shadow-md hover:ring-black/10",
        "dark:bg-black/60 dark:ring-white/10 dark:hover:bg-black/80",
        isWished && "bg-rose-50 ring-rose-200 dark:bg-rose-950/50 dark:ring-rose-800",
        className
      )}
      aria-pressed={isWished}
      aria-label={isWished ? "Remove from wishlist" : "Add to wishlist"}
    >
      <AnimatePresence mode="wait">
        {toggleMutation.isPending ? (
          <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </motion.span>
        ) : (
          <motion.span
            key={isWished ? "wished" : "not-wished"}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <Heart
              className={cn(
                "size-4 transition-colors",
                isWished
                  ? "fill-rose-500 text-rose-500"
                  : "text-foreground/70 hover:text-foreground"
              )}
            />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
