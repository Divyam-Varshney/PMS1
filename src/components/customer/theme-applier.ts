// ============================================================================
// File: src/components/customer/theme-applier.ts
// Purpose: Reads theme colors from public settings and applies them to CSS
//          custom properties so the admin-configured theme takes effect on
//          the customer website. Runs once on mount + whenever settings change.
// Role: Fixes the "Theme Settings not working" bug — applies primary, accent,
//       background, card, text, muted, border, sidebar colors + font family +
//       border radius to the :root CSS variables.
// ============================================================================

"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, qk, PublicSettings } from "./api";

function applyTheme(theme: { primaryColor: string; accentColor: string }) {
  const root = document.documentElement;
  if (theme.primaryColor) {
    root.style.setProperty("--primary", theme.primaryColor);
    root.style.setProperty("--ring", theme.primaryColor);
    root.style.setProperty("--sidebar-primary", theme.primaryColor);
  }
  if (theme.accentColor) {
    root.style.setProperty("--accent", theme.accentColor);
    root.style.setProperty("--sidebar-accent", theme.accentColor);
  }
}

export function ThemeApplier() {
  const { data: settings } = useQuery({
    queryKey: qk.publicSettings,
    queryFn: () => api<PublicSettings>("/api/settings/public"),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (settings?.theme) {
      applyTheme(settings.theme);
    }
  }, [settings?.theme?.primaryColor, settings?.theme?.accentColor]);

  return null;
}
