// ============================================================================
// File: src/app/admin/layout.tsx
// Purpose: Admin route layout — transparent passthrough that also overrides
//          the document <title> for the entire /admin subtree. The admin SPA
//          shell (AdminLayout) is mounted inside the page so it can switch
//          between login & dashboard states without server navigation.
//
// Title override: the customer-facing site keeps its "Pradeep Medical Store -
// Online Pharmacy in Mathura" title (defined in src/app/layout.tsx), but
// every admin page renders with "PMS - Admin Panel" instead. This is a
// Next.js metadata override scoped to the /admin route group.
// ============================================================================

import type { Metadata } from "next";
import { ReactNode } from "react";

export const metadata: Metadata = {
  title: "PMS - Admin Panel",
  description: "Admin Panel — secure administration console.",
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
