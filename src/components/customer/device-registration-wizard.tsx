// ============================================================================
// File: src/components/customer/device-registration-wizard.tsx
// Purpose: Orchestrates the notification onboarding flow (Phase 40.2).
//          Instead of showing a popup dialog, this component now NAVIGATES
//          the customer to the dedicated NotificationPermissionView page
//          when onboarding is needed.
//
//  When the wizard should trigger:
//    • New device (no DeviceRegistration row)
//    • status="pending" (started but not completed)
//    • status="completed" but permission revoked / subscription expired
//
//  When it should NOT trigger:
//    • Not authenticated
//    • Push API not supported
//    • status="skipped" (customer dismissed — never nag)
//    • status="completed" + everything healthy
//
//  The actual onboarding UI lives in notification-permission-view.tsx.
//  This component is invisible — it just runs the validation check on mount
//  and navigates if needed.
// ============================================================================

"use client";

import { useEffect, useRef } from "react";
import { useUI } from "@/lib/store";
import { getDeviceInfo } from "@/lib/device-utils";

export function DeviceRegistrationWizard({
  isAuthenticated,
}: {
  isAuthenticated: boolean;
}) {
  const navigate = useUI((s) => s.navigate);
  const view = useUI((s) => s.view);
  const validatedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isAuthenticated) return;

    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    if (!supported) return;

    // Don't re-trigger if the customer is already on the permission page.
    if (view.name === "notification-permission") return;

    if (validatedRef.current) return;
    validatedRef.current = true;

    let cancelled = false;
    const check = async () => {
      try {
        const info = getDeviceInfo();

        // Check browser permission + local subscription state.
        const hasBrowserPermission = Notification.permission === "granted";
        let hasLocalSubscription = false;
        if (hasBrowserPermission && typeof window.__ensurePushReady === "function") {
          try {
            const reg = await window.__ensurePushReady();
            if (reg) {
              const sub = await reg.pushManager.getSubscription();
              hasLocalSubscription = !!sub;
            }
          } catch {}
        }

        // POST /api/device-registrations/validate
        const res = await fetch("/api/device-registrations/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId: info.deviceId,
            hasBrowserPermission,
            hasLocalSubscription,
          }),
        });
        if (!res.ok) return;
        const json = await res.json();
        const data = json.data;
        if (!data) return;

        if (data.shouldShowWizard && !cancelled) {
          // Navigate to the dedicated notification permission page.
          // Delay slightly so the customer sees the home page first.
          setTimeout(() => {
            if (!cancelled) {
              navigate({ name: "notification-permission" });
            }
          }, 1500);
        }
      } catch {
        // Best-effort — if anything fails, just don't navigate.
      }
    };

    check();
    return () => { cancelled = true; };
  }, [isAuthenticated, view.name, navigate]);

  // This component renders nothing — it's a pure side-effect orchestrator.
  return null;
}
