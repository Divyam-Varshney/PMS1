// ============================================================================
// File: src/app/admin/page.tsx
// Purpose: Admin SPA entry. Fetches /me — if not logged in, shows AdminLogin.
//          Once logged in, mounts AdminLayout and switches the main content
//          based on the admin-store view (dashboard, products, orders, ...).
//
// PERFORMANCE: All admin views are loaded via next/dynamic (lazy) so that
//   only the currently-active view's code is compiled and held in memory.
//   This dramatically reduces the initial JS bundle and dev-server memory
//   usage — the admin panel has 25+ views totaling ~14K lines, and loading
//   them all eagerly caused the Turbopack dev server to OOM on a 4GB sandbox.
//   With dynamic imports, only the DashboardView is loaded on first visit;
//   other views are fetched on-demand when the admin navigates to them.
// ============================================================================

"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { api } from "@/components/admin/api";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { AdminLayout, doLogout } from "@/components/admin/AdminLayout";
import { useAdminStore } from "@/components/admin/admin-store";

// Lazy-load every admin view. `ssr: false` because the admin panel is a
// client-side SPA — there's no SEO benefit to server-rendering these views
// and doing so would waste server memory.
const DashboardView = dynamic(() => import("@/components/admin/views/DashboardView").then(m => ({ default: m.DashboardView })), { ssr: false });
const ProductsView = dynamic(() => import("@/components/admin/views/ProductsView").then(m => ({ default: m.ProductsView })), { ssr: false });
const ProductEditView = dynamic(() => import("@/components/admin/views/ProductEditView").then(m => ({ default: m.ProductEditView })), { ssr: false });
const BrandsView = dynamic(() => import("@/components/admin/views/BrandsView").then(m => ({ default: m.BrandsView })), { ssr: false });
const CategoriesView = dynamic(() => import("@/components/admin/views/CategoriesView").then(m => ({ default: m.CategoriesView })), { ssr: false });
const OrdersView = dynamic(() => import("@/components/admin/views/OrdersView").then(m => ({ default: m.OrdersView })), { ssr: false });
const OrderDetailView = dynamic(() => import("@/components/admin/views/OrderDetailView").then(m => ({ default: m.OrderDetailView })), { ssr: false });
const PrescriptionsView = dynamic(() => import("@/components/admin/views/PrescriptionsView").then(m => ({ default: m.PrescriptionsView })), { ssr: false });
const PrescriptionDetailView = dynamic(() => import("@/components/admin/views/PrescriptionsView").then(m => ({ default: m.PrescriptionDetailView })), { ssr: false });
const ManualRequestsView = dynamic(() => import("@/components/admin/views/ManualRequestsView").then(m => ({ default: m.ManualRequestsView })), { ssr: false });
const ManualRequestDetailView = dynamic(() => import("@/components/admin/views/ManualRequestsView").then(m => ({ default: m.ManualRequestDetailView })), { ssr: false });
const CustomersView = dynamic(() => import("@/components/admin/views/CustomersView").then(m => ({ default: m.CustomersView })), { ssr: false });
const CustomerDetailView = dynamic(() => import("@/components/admin/views/CustomersView").then(m => ({ default: m.CustomerDetailView })), { ssr: false });
const VouchersView = dynamic(() => import("@/components/admin/views/VouchersView").then(m => ({ default: m.VouchersView })), { ssr: false });
const DeliveryZonesView = dynamic(() => import("@/components/admin/views/DeliveryZonesView").then(m => ({ default: m.DeliveryZonesView })), { ssr: false });
const PaymentMethodsView = dynamic(() => import("@/components/admin/views/PaymentMethodsView").then(m => ({ default: m.PaymentMethodsView })), { ssr: false });
const ReviewsView = dynamic(() => import("@/components/admin/views/ReviewsView").then(m => ({ default: m.ReviewsView })), { ssr: false });
const NotificationTemplatesView = dynamic(() => import("@/components/admin/views/NotificationTemplatesView").then(m => ({ default: m.NotificationTemplatesView })), { ssr: false });
const SettingsView = dynamic(() => import("@/components/admin/views/SettingsView").then(m => ({ default: m.SettingsView })), { ssr: false });
const AdminsView = dynamic(() => import("@/components/admin/views/AdminsView").then(m => ({ default: m.AdminsView })), { ssr: false });
const ReportsView = dynamic(() => import("@/components/admin/views/ReportsView").then(m => ({ default: m.ReportsView })), { ssr: false });
const OffersView = dynamic(() => import("@/components/admin/views/OffersView").then(m => ({ default: m.OffersView })), { ssr: false });
const NewsletterView = dynamic(() => import("@/components/admin/views/NewsletterView").then(m => ({ default: m.NewsletterView })), { ssr: false });
const DealsView = dynamic(() => import("@/components/admin/views/DealsView").then(m => ({ default: m.DealsView })), { ssr: false });
const NotificationsView = dynamic(() => import("@/components/admin/views/NotificationsView").then(m => ({ default: m.NotificationsView })), { ssr: false });
const BackupsView = dynamic(() => import("@/components/admin/views/BackupsView").then(m => ({ default: m.BackupsView })), { ssr: false });
const DatabaseView = dynamic(() => import("@/components/admin/views/DatabaseView").then(m => ({ default: m.DatabaseView })), { ssr: false });
const CampaignsView = dynamic(() => import("@/components/admin/views/CampaignsView").then(m => ({ default: m.CampaignsView })), { ssr: false });
const ErrorLogsView = dynamic(() => import("@/components/admin/views/ErrorLogsView").then(m => ({ default: m.ErrorLogsView })), { ssr: false });
const AiMarketingView = dynamic(() => import("@/components/admin/views/AiMarketingView").then(m => ({ default: m.AiMarketingView })), { ssr: false });
const AppNotificationCenterView = dynamic(() => import("@/components/admin/views/AppNotificationCenterView").then(m => ({ default: m.AppNotificationCenterView })), { ssr: false });

interface AdminInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string | null;
  // JSON-encoded array of enabled permission keys (null = super_admin / all).
  // Optional because older /me responses (pre-permissions) may not include it.
  permissions?: string | null;
}

export default function AdminPage() {
  const [admin, setAdmin] = useState<AdminInfo | null>(null);
  const [booted, setBooted] = useState(false);

  const checkSession = useCallback(async () => {
    try {
      const a = await api.get<AdminInfo>("/api/admin-auth/me");
      setAdmin(a);
    } catch {
      setAdmin(null);
    } finally {
      setBooted(true);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  if (!booted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!admin) {
    return <AdminLogin onLoggedIn={(a) => setAdmin(a)} />;
  }

  return (
    <AdminLayout admin={admin} onLogout={async () => { await doLogout(); setAdmin(null); }}>
      <AdminContent admin={admin} />
    </AdminLayout>
  );
}

function AdminContent({ admin }: { admin: AdminInfo }) {
  const view = useAdminStore((s) => s.view);

  switch (view.name) {
    case "dashboard":
      return <DashboardView />;
    case "products":
      return <ProductsView />;
    case "product-edit":
      return <ProductEditView id={view.id} />;
    case "brands":
      return <BrandsView />;
    case "categories":
      return <CategoriesView />;
    case "orders":
      return <OrdersView />;
    case "order-detail":
      return <OrderDetailView id={view.id} />;
    case "prescriptions":
      return <PrescriptionsView />;
    case "prescription-detail":
      return <PrescriptionDetailView id={view.id} />;
    case "manual-requests":
      return <ManualRequestsView />;
    case "manual-request-detail":
      return <ManualRequestDetailView id={view.id} />;
    case "customers":
      return <CustomersView />;
    case "customer-detail":
      return <CustomerDetailView id={view.id} />;
    case "vouchers":
      return <VouchersView />;
    case "delivery-zones":
      return <DeliveryZonesView />;
    case "payment-methods":
      return <PaymentMethodsView />;
    case "reviews":
      return <ReviewsView />;
    case "notification-templates":
      return <NotificationTemplatesView />;
    case "settings":
      return <SettingsView initialSection={view.section} />;
    case "admins":
      return <AdminsView currentAdmin={admin} />;
    case "reports":
      return <ReportsView />;
    case "offers":
      return <OffersView />;
    case "deals":
      return <DealsView />;
    case "newsletter":
      return <NewsletterView />;
    case "notifications":
      return <NotificationsView />;
    case "backups":
      return <BackupsView />;
    case "database":
      return <DatabaseView />;
    case "campaigns":
      return <CampaignsView />;
    case "error-logs":
      return <ErrorLogsView />;
    case "ai-marketing":
      return <AiMarketingView />;
    case "app-notification-center":
      return <AppNotificationCenterView />;
    default:
      return <DashboardView />;
  }
}
