// ============================================================================
// File: src/lib/providers.tsx
// Purpose: Client-side React providers (React Query, theme) wrapping the app.
// Role: Mounted once in the root layout so all client components share the
//       same query client and theme context.
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
            staleTime: 30 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
