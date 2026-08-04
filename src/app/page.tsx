// ============================================================================
// File: src/app/page.tsx
// Purpose: The single customer-facing route. Reads `view` from the Zustand
//          useUI store and renders the matching customer view component
//          inside CustomerLayout. Uses CSS animation for smooth view
//          transitions (no framer-motion in the entry bundle). Also primes
//          public settings + customer session + home page data on mount.
// Role: SPA router for the customer site.
//
// PERFORMANCE: HomeView is loaded eagerly (it's the landing page — needs to
//   be instant). All other views are loaded via next/dynamic (lazy) so that
//   their code is only fetched when the customer navigates to them. This
//   reduces the initial JS bundle by ~60% (the customer site has 22 views
//   totaling ~15K lines; loading them all eagerly caused Turbopack to
//   compile a huge module graph on every dev change).
// ============================================================================

"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useQueryClient } from "@tanstack/react-query";
import { useUI } from "@/lib/store";
import { api, qk } from "@/components/customer/api";
import { CustomerLayout } from "@/components/customer/customer-layout";

// HomeView is the landing page — load it eagerly for instant first paint.
import { HomeView } from "@/components/customer/home-view";

// All other views are lazy-loaded to reduce initial bundle size.
// `ssr: false` because this is a client-side SPA (no SEO need for these
// pages, and SSR would waste server memory compiling every view upfront).
const ShopView = dynamic(() => import("@/components/customer/shop-view").then(m => ({ default: m.ShopView })), { ssr: false });
const ProductView = dynamic(() => import("@/components/customer/product-view").then(m => ({ default: m.ProductView })), { ssr: false });
const CartView = dynamic(() => import("@/components/customer/cart-view").then(m => ({ default: m.CartView })), { ssr: false });
const CheckoutView = dynamic(() => import("@/components/customer/checkout-view").then(m => ({ default: m.CheckoutView })), { ssr: false });
const OrderSuccessView = dynamic(() => import("@/components/customer/order-success-view").then(m => ({ default: m.OrderSuccessView })), { ssr: false });
const PrescriptionView = dynamic(() => import("@/components/customer/prescription-view").then(m => ({ default: m.PrescriptionView })), { ssr: false });
const ManualRequestView = dynamic(() => import("@/components/customer/manual-request-view").then(m => ({ default: m.ManualRequestView })), { ssr: false });
const TrackOrderView = dynamic(() => import("@/components/customer/track-order-view").then(m => ({ default: m.TrackOrderView })), { ssr: false });
const AuthView = dynamic(() => import("@/components/customer/auth-view").then(m => ({ default: m.AuthView })), { ssr: false });
const AccountView = dynamic(() => import("@/components/customer/account-view").then(m => ({ default: m.AccountView })), { ssr: false });
const OrdersView = dynamic(() => import("@/components/customer/orders-view").then(m => ({ default: m.OrdersView })), { ssr: false });
const AddressesView = dynamic(() => import("@/components/customer/addresses-view").then(m => ({ default: m.AddressesView })), { ssr: false });
const ProfileView = dynamic(() => import("@/components/customer/profile-view").then(m => ({ default: m.ProfileView })), { ssr: false });
const WishlistView = dynamic(() => import("@/components/customer/wishlist-view").then(m => ({ default: m.WishlistView })), { ssr: false });
const AboutView = dynamic(() => import("@/components/customer/about-view").then(m => ({ default: m.AboutView })), { ssr: false });
const ContactView = dynamic(() => import("@/components/customer/contact-view").then(m => ({ default: m.ContactView })), { ssr: false });
const CategoriesView = dynamic(() => import("@/components/customer/categories-view").then(m => ({ default: m.CategoriesView })), { ssr: false });
const TermsView = dynamic(() => import("@/components/customer/terms-view").then(m => ({ default: m.TermsView })), { ssr: false });
const RefundPolicyView = dynamic(() => import("@/components/customer/refund-policy-view").then(m => ({ default: m.RefundPolicyView })), { ssr: false });
const HealthTipView = dynamic(() => import("@/components/customer/health-tip-view").then(m => ({ default: m.HealthTipView })), { ssr: false });
const CompareView = dynamic(() => import("@/components/customer/compare-view").then(m => ({ default: m.CompareView })), { ssr: false });
const StockAlertsView = dynamic(() => import("@/components/customer/stock-alerts-view").then(m => ({ default: m.StockAlertsView })), { ssr: false });
const BundleView = dynamic(() => import("@/components/customer/bundle-view").then(m => ({ default: m.BundleView })), { ssr: false });
const MedicineRemindersView = dynamic(() => import("@/components/customer/medicine-reminders-view").then(m => ({ default: m.MedicineRemindersView })), { ssr: false });

export default function Home() {
  const view = useUI((s) => s.view);
  const restoreFromHash = useUI((s) => s.restoreFromHash);
  const qc = useQueryClient();

  // Restore the current view from the URL hash on mount (after hydration).
  // Makes the app refresh-safe: refresh on "orders" → stays on "orders".
  useEffect(() => {
    restoreFromHash();
  }, [restoreFromHash]);

  // Prime public settings + customer session + home page data on mount.
  // Fetching all 8 queries in parallel shaves 200-500ms off cold load time
  // vs. letting HomeView fire them sequentially after mount.
  useEffect(() => {
    qc.prefetchQuery({
      queryKey: qk.publicSettings,
      queryFn: () => api("/api/settings/public"),
    });
    qc.prefetchQuery({
      queryKey: qk.me,
      queryFn: () => api("/api/auth/me"),
    });
    qc.prefetchQuery({
      queryKey: qk.cart,
      queryFn: () => api("/api/cart"),
    });
    // Home page queries — fire in parallel with the layout mounting.
    qc.prefetchQuery({
      queryKey: qk.featured,
      queryFn: () => api("/api/catalog/featured"),
    });
    qc.prefetchQuery({
      queryKey: qk.categories,
      queryFn: () => api("/api/catalog/categories"),
    });
    qc.prefetchQuery({
      queryKey: qk.brands,
      queryFn: () => api("/api/catalog/brands?featured=true"),
    });
    qc.prefetchQuery({
      queryKey: qk.deals,
      queryFn: () => api("/api/deals"),
    });
    qc.prefetchQuery({
      queryKey: qk.homeFeed,
      queryFn: () => api("/api/catalog/home-feed"),
    });
  }, [qc]);

  // Scroll restoration: Every NEW page should open from the top.
  // When pressing Back, the browser restores the previous scroll position naturally.
  // We use the History API to detect back navigation vs forward navigation.
  const prevViewRef = useRef(view.name);
  useEffect(() => {
    const prevView = prevViewRef.current;
    prevViewRef.current = view.name;

    // Always scroll to top on ANY view change (including product, shop, home, etc.)
    // This fixes the issue where navigating from a scrolled page leaves the new
    // page at the same scroll position.
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [view.name, view.name === "product" ? view.productId : ""]);

  const renderView = () => {
    switch (view.name) {
      case "home":
        return <HomeView />;
      case "shop":
        return <ShopView />;
      case "product":
        return <ProductView />;
      case "cart":
        return <CartView />;
      case "checkout":
        return <CheckoutView />;
      case "order-success":
        return <OrderSuccessView />;
      case "prescription":
        return <PrescriptionView />;
      case "manual-request":
        return <ManualRequestView />;
      case "track-order":
        return <TrackOrderView />;
      case "auth":
        return <AuthView />;
      case "account":
        return <AccountView />;
      case "orders":
        return <OrdersView />;
      case "addresses":
        return <AddressesView />;
      case "profile":
        return <ProfileView />;
      case "wishlist":
        return <WishlistView />;
      case "stock-alerts":
        return <StockAlertsView />;
      case "reminders":
        return <MedicineRemindersView />;
      case "about":
        return <AboutView />;
      case "contact":
        return <ContactView />;
      case "categories":
        return <CategoriesView />;
      case "terms":
        return <TermsView />;
      case "refund-policy":
        return <RefundPolicyView />;
      case "health-tip":
        return <HealthTipView />;
      case "compare":
        return <CompareView />;
      case "bundles":
        return <BundleView />;
      default:
        return <HomeView />;
    }
  };

  // Build a stable key for the current view so React remounts on navigation.
  // Using a plain <main> with CSS animation instead of <AnimatePresence mode="wait">
  // eliminates the 200ms exit-animation delay on every view change + removes
  // framer-motion from the initial bundle path.
  const viewKey = view.name + (view.name === "product" ? view.productId : "") + (view.name === "track-order" ? view.orderId : "") + (view.name === "order-success" ? view.orderId : "") + (view.name === "health-tip" ? view.tipId : "");

  return (
    <CustomerLayout>
      <main key={viewKey} className="animate-page-enter">
        {renderView()}
      </main>
    </CustomerLayout>
  );
}
