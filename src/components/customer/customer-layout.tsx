// ============================================================================
// File: src/components/customer/customer-layout.tsx
// Purpose: Wraps every customer view with the sticky header, mobile bottom
//          nav, footer, cart sheet, search dialog, mobile menu, theme applier,
//          and promotional offer banners (top-banner / custom positions).
//          Hero + mid-banner offers are rendered inside HomeView.
// Role: Layout shell for the entire customer SPA at "/".
// ============================================================================

"use client";

import { ReactNode } from "react";
import { Header } from "./header";
import { Footer } from "./footer";
import { BottomNav } from "./bottom-nav";
import { CartSheet } from "./cart-sheet";
import { sanitizeHtml } from "@/lib/sanitize";
import { SearchDialog } from "./search-dialog";
import { MobileMenu } from "./mobile-menu";
import { ThemeApplier } from "./theme-applier";
import { BackToTop } from "./back-to-top";
import { CompareBar } from "./compare-bar";
import { HealthAssistantWidget } from "./health-assistant-widget";
import { WelcomePopup } from "./welcome-popup";
import { DeviceRegistrationWizard } from "./device-registration-wizard";
import { usePublicSettings } from "./use-public-settings";
import { useCustomer } from "./use-customer";
import { useUI } from "@/lib/store";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Lock, X } from "lucide-react";
import { useState } from "react";

export function CustomerLayout({ children }: { children: ReactNode }) {
  const { settings, isStoreOpen, storeStatusMessage } = usePublicSettings();
  const { isAuthenticated } = useCustomer();
  const navigate = useUI((s) => s.navigate);
  const [dismissedBanner, setDismissedBanner] = useState(false);

  // Top-banner + custom offers render here in the layout (hero + mid-banner
  // are rendered inside HomeView so they can replace/insert into the page).
  // NOTE: the hero announcement bar (managed via Settings → Hero → Announcement
  // Bar) is the newer, more configurable equivalent of the top-banner offer.
  // The hero announcement bar always takes precedence on the homepage — when
  // it is enabled we suppress the legacy top-banner to avoid duplicates. When
  // it is disabled, the legacy top-banner still shows (so admins who only use
  // the Offers system keep their banner).
  const heroAnnouncementEnabled = settings?.hero?.announcementEnabled && !!settings?.hero?.announcementText?.trim();
  const topBanner = heroAnnouncementEnabled
    ? undefined
    : settings?.offers?.find((o) => o.position === "top-banner");
  const customOffers = settings?.offers?.filter((o) => o.position === "custom") ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <ThemeApplier />

      {/* Promotional top-banner offer */}
      {topBanner && (
        <div
          className="flex items-center justify-center gap-3 px-4 py-1.5 text-center text-xs font-medium"
          style={{ backgroundColor: topBanner.bgColor, color: topBanner.textColor }}
        >
          <span className="flex-1 truncate">
            {topBanner.title}
            {topBanner.subtitle && <span className="ml-1.5 opacity-80">{topBanner.subtitle}</span>}
          </span>
          {topBanner.ctaText && (
            <button
              onClick={() => navigate({ name: (topBanner.ctaView as any) || "shop" } as any)}
              className="shrink-0 rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-semibold backdrop-blur-sm hover:bg-white/30"
            >
              {topBanner.ctaText}
            </button>
          )}
        </div>
      )}

      {/* Custom HTML offers (rendered above header, full-width) */}
      {customOffers.map((offer) => (
        <div key={offer.id} dangerouslySetInnerHTML={{ __html: sanitizeHtml(offer.customHtml || "") }} />
      ))}

      <Header />

      {/* Closed-store banner — shows dynamic message (reopen time / holiday) */}
      {!isStoreOpen && settings && !dismissedBanner && (
        <Alert className="mx-3 mt-3 border-amber-200 bg-amber-50 text-amber-900 sm:mx-6 lg:mx-auto lg:max-w-7xl">
          <Lock className="size-4" />
          <AlertTitle className="text-sm font-semibold">Store is currently closed</AlertTitle>
          <AlertDescription className="text-xs">
            {storeStatusMessage || settings.store.closedMessage}
          </AlertDescription>
          <button
            onClick={() => setDismissedBanner(true)}
            className="absolute right-2 top-2 rounded p-1 hover:bg-amber-100"
            aria-label="Dismiss banner"
          >
            <X className="size-3.5" />
          </button>
        </Alert>
      )}

      <main className="flex-1 pb-16 lg:pb-0">{children}</main>

      <Footer />
      <BottomNav />
      <CartSheet />
      <SearchDialog />
      <MobileMenu />
      <CompareBar />
      <BackToTop />
      <HealthAssistantWidget />
      <WelcomePopup />
      <DeviceRegistrationWizard isAuthenticated={isAuthenticated} />
    </div>
  );
}
