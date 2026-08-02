// ============================================================================
// File: src/components/customer/use-customer.ts
// Purpose: React Query hook that fetches the current customer on mount and
//          exposes a stable `customer` reference. Used across all views that
//          need to know if the user is logged in.
// Role: Single source of truth for "is the customer logged in?" on the client.
// ============================================================================

"use client";

import { useQuery } from "@tanstack/react-query";
import { api, qk, CustomerMe } from "./api";

export function useCustomer() {
  const query = useQuery({
    queryKey: qk.me,
    queryFn: () => api<CustomerMe | null>("/api/auth/me"),
    staleTime: 60 * 1000,
    retry: false,
  });
  return {
    customer: query.data ?? null,
    isLoading: query.isLoading,
    isAuthenticated: !!query.data,
    refetch: query.refetch,
  };
}
