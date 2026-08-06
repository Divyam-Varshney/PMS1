// ============================================================================
// File: src/lib/providers.tsx
// Purpose: Client-side React providers (React Query, theme) wrapping the app.
// Role: Mounted once in the root layout so all client components share the
//       same query client and theme context.
//
// Phase 43.6 — MEMORY OPTIMIZATION:
//   - gcTime added (5 min) — React Query caches old data indefinitely by
//     default, which accumulates memory. 5 min is a good balance between
//     UX (fast back-navigation) and memory.
//   - staleTime increased to 60s (was 30s) — reduces refetch frequency,
//     lowering CPU + memory churn.
// ============================================================================

"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 60s — was 30s
            gcTime: 5 * 60 * 1000, // 5 min — garbage-collect inactive queries
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
