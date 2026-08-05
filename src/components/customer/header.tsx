// ============================================================================
// File: src/components/customer/header.tsx
// Purpose: Sticky site header — logo, search bar (desktop), nav links,
//          account menu, cart icon with live count, store-open pill.
// Role: Top navigation for the customer site on desktop and mobile.
// ============================================================================

"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart,
  User,
  UserCircle,
  Search,
  Pill,
  Menu,
  LogOut,
  Package,
  MapPin,
  Heart,
  Info,
  Phone,
} from "lucide-react";
import { useUI } from "@/lib/store";
import { useCustomer } from "./use-customer";
import { usePublicSettings } from "./use-public-settings";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, qk, Cart } from "./api";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/format";
import { motion } from "framer-motion";

export function Header() {
  const navigate = useUI((s) => s.navigate);
  const setCartOpen = useUI((s) => s.setCartOpen);
  const setSearchOpen = useUI((s) => s.setSearchOpen);
  const setMenuOpen = useUI((s) => s.setMenuOpen);
  const view = useUI((s) => s.view);
  const qc = useQueryClient();
  const { customer } = useCustomer();
  const { settings, isStoreOpen } = usePublicSettings();

  // Cart count
  const { data: cart } = useQuery({
    queryKey: qk.cart,
    queryFn: () => api<Cart>("/api/cart"),
    staleTime: 30 * 1000,
  });
  const cartCount = cart?.items?.length ?? 0;

  const onLogout = async () => {
    await api.post("/api/auth/logout");
    qc.invalidateQueries({ queryKey: qk.me });
    qc.invalidateQueries({ queryKey: qk.cart });
    navigate({ name: "home" });
  };

  const navItems: { label: string; view: Parameters<typeof navigate>[0]; icon: typeof Pill }[] = [
    { label: "Home", view: { name: "home" }, icon: Pill },
    { label: "Shop", view: { name: "shop" }, icon: ShoppingCart },
    { label: "About", view: { name: "about" }, icon: Info },
    { label: "Contact", view: { name: "contact" }, icon: Phone },
  ];

  const isActive = (label: string) => {
    if (label === "Home") return view.name === "home";
    if (label === "Shop")
      return ["shop", "product"].includes(view.name);
    if (label === "About") return view.name === "about";
    if (label === "Contact") return view.name === "contact";
    return false;
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/50 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/85 shadow-premium-sm">
      {/* Top store banner */}
      <div className={`h-0.5 w-full ${isStoreOpen ? "bg-emerald-500" : "bg-amber-500"}`} />

      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:h-16 sm:gap-4">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </Button>

        {/* Logo */}
        <button
          onClick={() => navigate({ name: "home" })}
          className="flex items-center gap-2 font-bold text-foreground"
        >
          <img
            src={settings?.store?.logo || "/logo.png"}
            alt="PMS"
            className="size-9 rounded-lg object-cover shadow-sm"
          />
          <div className="hidden flex-col items-start leading-none sm:flex">
            <span className="text-base font-bold">{settings?.store.name ?? "PMS"}</span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Online Pharmacy
            </span>
          </div>
        </button>

        {/* Desktop nav */}
        <nav className="ml-4 hidden items-center gap-0.5 lg:flex">
          {navItems.map((item) => (
            <Button
              key={item.label}
              variant="ghost"
              size="sm"
              onClick={() => navigate(item.view)}
              className={
                isActive(item.label)
                  ? "bg-accent/80 text-accent-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/40 font-medium"
              }
            >
              {item.label}
            </Button>
          ))}
        </nav>

        {/* Search (desktop) */}
        <div className="ml-auto hidden flex-1 max-w-md lg:block">
          <button
            onClick={() => setSearchOpen(true)}
            className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-accent/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-accent/60"
          >
            <Search className="size-4" />
            <span>Search medicines, brands...</span>
          </button>
        </div>

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-1 lg:ml-2">
          {/* Search icon (mobile) */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
          >
            <Search className="size-5" />
          </Button>

          {/* Store open pill (desktop) */}
          <Badge
            variant="outline"
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium transition-all duration-300 ${
              isStoreOpen
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-200/50"
                : "border-amber-300 bg-amber-50 text-amber-700 shadow-sm shadow-amber-200/50"
            }`}
          >
            <span className="relative flex size-2">
              <span
                className={`absolute inset-0 rounded-full ${
                  isStoreOpen ? "bg-emerald-400 animate-ping opacity-75" : "bg-amber-400 animate-ping opacity-75"
                }`}
              />
              <span
                className={`relative inline-flex size-2 rounded-full ${
                  isStoreOpen ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />
            </span>
            {isStoreOpen ? "Open now" : "Closed"}
            {settings?.store?.openTime && settings?.store?.closeTime && (
              <span className="hidden text-[10px] font-normal text-muted-foreground sm:inline">
                {settings.store.openTime}–{settings.store.closeTime}
              </span>
            )}
          </Badge>

          {/* Cart */}
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={() => setCartOpen(true)}
            aria-label="Open cart"
          >
            <ShoppingCart className="size-5" />
            {cartCount > 0 && (
              <motion.span
                key={cartCount}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -right-1 -top-1 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground"
              >
                {cartCount}
              </motion.span>
            )}
          </Button>

          {/* Account */}
          {customer ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {getInitials(customer.name)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">{customer.name}</span>
                    <span className="text-xs font-normal text-muted-foreground">{customer.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ name: "account" })}>
                  <User className="size-4" /> My Account
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ name: "orders" })}>
                  <Package className="size-4" /> My Orders
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ name: "wishlist" })}>
                  <Heart className="size-4" /> My Wishlist
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ name: "addresses" })}>
                  <MapPin className="size-4" /> Addresses
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ name: "profile" })}>
                  <UserCircle className="size-4" /> Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="size-4" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              size="sm"
              onClick={() => navigate({ name: "auth", mode: "login" })}
              className="hidden sm:inline-flex"
            >
              <User className="size-4" />
              Login
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
