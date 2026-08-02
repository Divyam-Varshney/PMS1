// ============================================================================
// File: src/components/customer/bottom-nav.tsx
// Purpose: Fixed bottom navigation bar on mobile (5 items: Home, Shop, Cart,
//          Account, Menu). Touch-friendly with safe-area padding.
// Role: Mobile-first PWA-style navigation. Hidden on desktop (lg breakpoint).
// ============================================================================

"use client";

import { Home, Store, ShoppingCart, User, Menu } from "lucide-react";
import { useUI } from "@/lib/store";
import { useQuery } from "@tanstack/react-query";
import { api, qk, Cart } from "./api";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const view = useUI((s) => s.view);
  const navigate = useUI((s) => s.navigate);
  const setCartOpen = useUI((s) => s.setCartOpen);
  const setMenuOpen = useUI((s) => s.setMenuOpen);

  const { data: cart } = useQuery({
    queryKey: qk.cart,
    queryFn: () => api<Cart>("/api/cart"),
    staleTime: 30 * 1000,
  });
  const cartCount = cart?.items?.length ?? 0;

  const items = [
    {
      key: "home",
      label: "Home",
      icon: Home,
      active: view.name === "home",
      onClick: () => navigate({ name: "home" }),
    },
    {
      key: "shop",
      label: "Shop",
      icon: Store,
      active: ["shop", "product"].includes(view.name),
      onClick: () => navigate({ name: "shop" }),
    },
    {
      key: "cart",
      label: "Cart",
      icon: ShoppingCart,
      active: view.name === "cart" || view.name === "checkout",
      badge: cartCount,
      onClick: () => setCartOpen(true),
    },
    {
      key: "account",
      label: "Account",
      icon: User,
      active: ["account", "orders", "addresses", "profile", "auth"].includes(view.name),
      onClick: () => navigate({ name: "account" }),
    },
    {
      key: "menu",
      label: "Menu",
      icon: Menu,
      active: false,
      onClick: () => setMenuOpen(true),
    },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/50 bg-background/95 pb-safe backdrop-blur-md supports-[backdrop-filter]:bg-background/85 shadow-premium lg:hidden"
      aria-label="Primary mobile navigation"
    >
      <div className="mx-auto grid max-w-md grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={item.onClick}
              className={cn(
                "relative flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-all",
                item.active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="relative">
                <Icon className="size-5" />
                {item.badge && item.badge > 0 ? (
                  <motion.span
                    key={item.badge}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -right-2 -top-1.5 flex min-h-[14px] min-w-[14px] items-center justify-center rounded-full bg-primary px-1 text-[8px] font-bold text-primary-foreground"
                  >
                    {item.badge}
                  </motion.span>
                ) : null}
              </span>
              <span>{item.label}</span>
              {item.active && (
                <motion.span
                  layoutId="bottom-nav-indicator"
                  className="absolute -top-px h-0.5 w-8 rounded-full bg-primary"
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
