// ============================================================================
// File: src/components/customer/mobile-menu.tsx
// Purpose: Premium slide-in left drawer with full nav menu for mobile
//          (Phase 32.6 redesign).
//
// Layout:
//   ┌─────────────────────────────┐
//   │  HEADER (gradient)          │
//   │  ┌──┐                       │
//   │  │AV│  Customer Name        │  ← profile section
//   │  └──┘  customer@email       │
//   │       [View Account →]      │
//   ├─────────────────────────────┤
//   │  Shop                       │  ← section label
//   │   ▸ All Products            │  ← nav items with icons
//   │   ▸ Categories              │
//   │   ▸ Brands                  │
//   │   ▸ Search                  │
//   ├─────────────────────────────┤
//   │  Pharmacy                   │
//   │   ▸ Upload Prescription     │
//   │   ▸ Request Medicines       │
//   │   ▸ Track Order             │
//   ├─────────────────────────────┤
//   │  Account                    │
//   │   ▸ My Orders               │
//   │   ▸ Wishlist                │
//   │   ▸ Addresses               │
//   │   ▸ Profile                 │
//   ├─────────────────────────────┤
//   │  Support                    │
//   │   ▸ Help / Chat             │
//   │   ▸ Contact Us              │
//   │   ▸ About Us                │
//   └─────────────────────────────┘
//   [ Login / Register ]  or  [ Logout ]
//
// Features:
//   • Premium slide-in from left (built into shadcn Sheet side="left").
//   • User profile section at top with avatar + name + email + "View Account".
//   • Organized navigation sections (Shop / Pharmacy / Account / Support).
//   • Each item has a Lucide icon + label.
//   • Active state indicator — emerald background tint + left border accent.
//   • Close button + backdrop tap to close (built into Sheet).
//   • Smooth animations via Framer Motion (staggered entrance).
//   • Proper safe-area handling for iOS (env(safe-area-inset-bottom)).
//
// Role: Mobile navigation fallback for non-primary destinations.
// ============================================================================

"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Home,
  Store,
  Search,
  LayoutGrid,
  Tag,
  FileText,
  ClipboardList,
  Truck,
  Package,
  Heart,
  MapPin,
  User,
  MessageCircle,
  Phone,
  Info,
  LogOut,
  ChevronRight,
  Pill,
  Sparkles,
  ShieldCheck,
  HelpCircle,
} from "lucide-react";
import { useUI, CustomerView } from "@/lib/store";
import { useCustomer } from "./use-customer";
import { useQueryClient } from "@tanstack/react-query";
import { api, qk } from "./api";
import { usePublicSettings } from "./use-public-settings";
import { getInitials } from "@/lib/format";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Nav section config — declared OUTSIDE the component for stable refs.
// Each section has a label, an icon for the section header, and items.
// `authRequired` controls whether the customer must be logged in (otherwise
// we redirect to the auth view).
// `activeCheck` is a function that returns true when the corresponding view
// is currently active — used to highlight the active item with an emerald tint.
// ---------------------------------------------------------------------------
interface NavItem {
  label: string;
  icon: typeof Home;
  view: CustomerView;
  authRequired?: boolean;
  /** Optional special action — overrides navigation. */
  action?: "search" | "assistant" | "cart";
}

interface NavSection {
  label: string;
  icon: typeof Home;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    label: "Shop",
    icon: Store,
    items: [
      { label: "Home", icon: Home, view: { name: "home" } },
      { label: "All Products", icon: Store, view: { name: "shop" } },
      { label: "Categories", icon: LayoutGrid, view: { name: "categories" } },
      { label: "Medical Bundles", icon: Sparkles, view: { name: "bundles" } },
      { label: "Compare", icon: Tag, view: { name: "compare" } },
      { label: "Search", icon: Search, view: { name: "shop" }, action: "search" },
    ],
  },
  {
    label: "Pharmacy",
    icon: Pill,
    items: [
      { label: "Upload Prescription", icon: FileText, view: { name: "prescription" }, authRequired: true },
      { label: "Request Medicines", icon: ClipboardList, view: { name: "manual-request" }, authRequired: true },
      { label: "Track Order", icon: Truck, view: { name: "orders" }, authRequired: true },
    ],
  },
  {
    label: "Account",
    icon: User,
    items: [
      { label: "My Orders", icon: Package, view: { name: "orders" }, authRequired: true },
      { label: "Wishlist", icon: Heart, view: { name: "wishlist" }, authRequired: true },
      { label: "Addresses", icon: MapPin, view: { name: "addresses" }, authRequired: true },
      { label: "Stock Alerts", icon: ShieldCheck, view: { name: "stock-alerts" }, authRequired: true },
      { label: "Profile", icon: User, view: { name: "profile" }, authRequired: true },
    ],
  },
  {
    label: "Support",
    icon: HelpCircle,
    items: [
      { label: "Help / Chat", icon: MessageCircle, view: { name: "home" }, action: "assistant" },
      { label: "Contact Us", icon: Phone, view: { name: "contact" } },
      { label: "About Us", icon: Info, view: { name: "about" } },
    ],
  },
];

export function MobileMenu() {
  const menuOpen = useUI((s) => s.menuOpen);
  const setMenuOpen = useUI((s) => s.setMenuOpen);
  const navigate = useUI((s) => s.navigate);
  const setCartOpen = useUI((s) => s.setCartOpen);
  const setSearchOpen = useUI((s) => s.setSearchOpen);
  const view = useUI((s) => s.view);
  const qc = useQueryClient();
  const { customer } = useCustomer();
  const { isStoreOpen, settings } = usePublicSettings();

  const go = (v: CustomerView) => {
    setMenuOpen(false);
    navigate(v);
  };

  const onLogout = async () => {
    await api.post("/api/auth/logout");
    qc.invalidateQueries({ queryKey: qk.me });
    qc.invalidateQueries({ queryKey: qk.cart });
    setMenuOpen(false);
    navigate({ name: "home" });
  };

  // Active-state check — returns true if the given view name matches the
  // currently active view (ignoring params). Used to highlight the active
  // nav item with an emerald background tint.
  const isActive = (item: NavItem): boolean => {
    if (item.action === "search") return false;
    if (item.action === "assistant") return false;
    if (item.action === "cart") return false;
    return view.name === item.view.name;
  };

  const onClickItem = (item: NavItem) => {
    if (item.action === "search") {
      setMenuOpen(false);
      // Slight delay so the sheet close animation finishes first.
      setTimeout(() => setSearchOpen(true), 250);
      return;
    }
    if (item.action === "assistant") {
      setMenuOpen(false);
      // The HealthAssistantWidget listens for this event and opens its panel.
      window.dispatchEvent(new CustomEvent("pms:assistant-open-request"));
      return;
    }
    if (item.action === "cart") {
      setMenuOpen(false);
      setCartOpen(true);
      return;
    }
    if (item.authRequired && !customer) {
      go({ name: "auth", mode: "login" });
      return;
    }
    if (item.view.name === "cart") {
      setMenuOpen(false);
      setCartOpen(true);
      return;
    }
    go(item.view);
  };

  const storeName = settings?.store?.name || "Pradeep Medical Store";

  return (
    <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
      <SheetContent
        side="left"
        // The SheetContent renders a built-in close button as its last child
        // (`<SheetPrimitive.Close>` from shadcn/ui). On this dark gradient
        // header it would otherwise be (a) nearly invisible because it
        // inherits `text-foreground`, and (b) overlapping the "Open now"
        // pill in the top bar. We override its styles via a `[&>button:last-child]`
        // selector so it becomes a proper glassy white chip with a 36px touch
        // target, precisely positioned at `top-3 right-3` so it is vertically
        // centered in the header top bar and right-aligned with adequate
        // spacing from the "Open now" pill. The top bar below also reserves
        // right padding (`pr-14`) so the pill never sits under the close button.
        className="w-80 max-w-[88vw] gap-0 p-0 [&>button:last-child]:top-3 [&>button:last-child]:right-3 [&>button:last-child]:size-9 [&>button:last-child]:rounded-lg [&>button:last-child]:border [&>button:last-child]:border-white/20 [&>button:last-child]:bg-white/10 [&>button:last-child]:text-white [&>button:last-child]:opacity-100 [&>button:last-child]:backdrop-blur-sm [&>button:last-child]:transition-colors [&>button:last-child]:data-[state=open]:bg-white/10 hover:[&>button:last-child]:bg-white/20 [&>button:last-child]:focus:ring-white/40"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* ---------------------------------------------------------------
            HEADER — premium gradient with logo, store name, and open/closed
            status pill. Profile section (avatar + name + email + View Account)
            is part of the header so it's always visible.
        --------------------------------------------------------------- */}
        <SheetHeader className="gap-0 space-y-0 border-b-0 bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 p-0 text-primary-foreground">
          {/* Top bar — logo + store name + open/closed pill.
              `pr-14` reserves room for the close button (top-right) so the
              "Open now" badge and the X button never visually overlap, even
              on a 375px viewport. `justify-between` ensures the logo and pill
              sit at opposite edges with adequate spacing in between. */}
          <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4 pr-14">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
                <Pill className="size-5" />
              </div>
              <div className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-sm font-bold">{storeName}</span>
                <span className="truncate text-[10px] font-normal opacity-90">
                  Licensed Pharmacy · Mathura
                </span>
              </div>
            </div>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur-sm",
                isStoreOpen
                  ? "bg-emerald-300/30 text-white"
                  : "bg-rose-500/30 text-white"
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  isStoreOpen ? "bg-emerald-200 animate-pulse" : "bg-rose-300"
                )}
              />
              {isStoreOpen ? "Open now" : "Closed"}
            </span>
          </div>

          {/* Profile section — avatar + name + email + View Account link.
              Shows a "Login / Register" prompt instead when logged out. */}
          {customer ? (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="flex items-center gap-3 border-t border-white/15 px-4 py-3"
            >
              <Avatar className="size-11 ring-2 ring-white/30">
                <AvatarFallback className="bg-white/20 text-sm font-bold text-white">
                  {getInitials(customer.name || "Customer")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {customer.name}
                </p>
                <p className="truncate text-xs text-white/80">{customer.email}</p>
                <button
                  onClick={() => go({ name: "account" })}
                  className="mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-medium text-white/90 underline-offset-2 hover:underline"
                >
                  View Account <ChevronRight className="size-3" />
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="border-t border-white/15 px-4 py-3">
              <Button
                onClick={() => go({ name: "auth", mode: "login" })}
                className="w-full gap-2 bg-white text-emerald-700 shadow hover:bg-white/90"
              >
                <User className="size-4" /> Login / Register
              </Button>
            </div>
          )}

          <SheetDescription className="sr-only">
            Site navigation menu
          </SheetDescription>
        </SheetHeader>

        {/* ---------------------------------------------------------------
            SCROLLABLE NAV SECTIONS
        --------------------------------------------------------------- */}
        <SheetTitle className="sr-only">{storeName} navigation</SheetTitle>
        <nav
          aria-label="Main navigation"
          className="scrollbar-thin flex-1 overflow-y-auto px-2 py-3"
        >
          {SECTIONS.map((section, sIdx) => {
            const SectionIcon = section.icon;
            return (
              <motion.div
                key={section.label}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.3,
                  delay: 0.05 + sIdx * 0.06,
                  ease: "easeOut",
                }}
                className="mb-4"
              >
                {/* Section label — small uppercase with icon */}
                <div className="mb-1 flex items-center gap-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <SectionIcon className="size-3 text-emerald-600 dark:text-emerald-400" />
                  {section.label}
                </div>
                {/* Items */}
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item);
                    return (
                      <button
                        key={item.label}
                        onClick={() => onClickItem(item)}
                        className={cn(
                          "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                          active
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "text-foreground hover:bg-accent hover:text-foreground"
                        )}
                        aria-current={active ? "page" : undefined}
                      >
                        {/* Active left border indicator */}
                        <span
                          className={cn(
                            "absolute left-0 h-6 w-1 rounded-r-full bg-emerald-600 transition-opacity dark:bg-emerald-400",
                            active ? "opacity-100" : "opacity-0"
                          )}
                          aria-hidden
                        />
                        <span
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-md transition-colors",
                            active
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300"
                              : "bg-muted/50 text-muted-foreground group-hover:bg-accent group-hover:text-foreground"
                          )}
                        >
                          <Icon className="size-4" />
                        </span>
                        <span className="flex-1 truncate text-left">{item.label}</span>
                        {item.authRequired && !customer && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                            Login
                          </span>
                        )}
                        {!active && (
                          <ChevronRight className="size-3.5 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}

          {/* Quick CTA — Browse Catalog (links to shop view) */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3, ease: "easeOut" }}
            className="mx-2 mt-2"
          >
            <Button
              onClick={() => go({ name: "shop" })}
              className="w-full gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/20 hover:from-emerald-700 hover:to-teal-700"
            >
              <Store className="size-4" /> Browse Catalog
            </Button>
          </motion.div>
        </nav>

        {/* ---------------------------------------------------------------
            FOOTER — logout (when logged in) + quick info
        --------------------------------------------------------------- */}
        {customer && (
          <div
            className="border-t border-border bg-muted/30 p-3"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}
          >
            <Button
              onClick={onLogout}
              variant="outline"
              className="w-full gap-2 border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-900/40"
            >
              <LogOut className="size-4" /> Logout
            </Button>
            <p className="mt-2 text-center text-[10px] text-muted-foreground">
              {storeName} · Licensed Pharmacy in Mathura
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
