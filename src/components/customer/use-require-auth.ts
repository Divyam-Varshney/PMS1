// ============================================================================
// File: src/components/customer/use-require-auth.ts
// Purpose: Guard hook for customer views that require a logged-in customer.
//          Redirects to the auth screen via navigate() IN AN EFFECT (never
//          during render) when the customer is missing. This avoids the
//          React error "Cannot update a component while rendering a different
//          component" that inline navigate() calls during render cause.
// ============================================================================

"use client";

import { useEffect } from "react";
import { useUI } from "@/lib/store";
import { useCustomer } from "./use-customer";

export function useRequireAuth() {
  const { customer, isLoading } = useCustomer();
  const navigate = useUI((s) => s.navigate);

  useEffect(() => {
    if (!isLoading && !customer) {
      navigate({ name: "auth", mode: "login" });
    }
  }, [isLoading, customer, navigate]);

  return { customer, isLoading };
}
