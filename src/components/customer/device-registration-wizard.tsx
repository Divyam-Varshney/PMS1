// ============================================================================
// File: src/components/customer/device-registration-wizard.tsx
// Purpose: New Device Registration Wizard (Phase 40). Replaces the old
//          `notification-onboarding.tsx` with a 4-step guided flow inspired
//          by Amazon / Flipkart / Blinkit / Swiggy onboarding.
//
//  Steps:
//    1. WELCOME       — explain benefits, two buttons: "Turn On" / "Skip"
//    2. PERMISSION    — request browser permission, handle deny gracefully
//    3. REGISTERING   — show progress as we register SW + create subscription
//                       + POST to backend + send welcome push
//    4. TEST_RESULT   — show whether the welcome push was delivered
//    5. DONE          — "You're All Set!" success screen
//
//  When the wizard should NOT appear (checked on mount + on auth change):
//    • Not authenticated
//    • Push API not supported by the browser
//    • POST /api/device-registrations/validate returns shouldShowWizard=false
//
//  When the wizard SHOULD appear:
//    • New device (no DeviceRegistration row)
//    • status="pending" (started but not completed)
//    • status="completed" but permission revoked / subscription expired
//
//  Skip behaviour:
//    • POST /api/device-registrations/skip with the device info.
//    • Wizard never re-appears on this device (status="skipped").
//    • Customer can still enable from Profile → Settings → App Notifications.
//
//  The existing App Notification Center + automatic notification system are
//  untouched. This wizard ONLY orchestrates the onboarding UX.
// ============================================================================

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Bell,
  BellRing,
  BellOff,
  Truck,
  Package,
  FileText,
  Tag,
  Megaphone,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  XCircle,
  X,
  Sparkles,
  Smartphone,
  Send,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { getDeviceInfo } from "@/lib/device-utils";

type WizardStep = "welcome" | "permission" | "registering" | "registering_failed" | "test_result" | "done" | "denied";

interface StepProgress {
  step: string;
  label: string;
  status: "pending" | "active" | "done" | "failed";
}

const BENEFITS = [
  { icon: Package, title: "Order Updates" },
  { icon: Truck, title: "Delivery Tracking" },
  { icon: FileText, title: "Medicine Request Updates" },
  { icon: Tag, title: "Exclusive Offers" },
];

export function DeviceRegistrationWizard({
  isAuthenticated,
}: {
  isAuthenticated: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<WizardStep>("welcome");
  const [busy, setBusy] = useState(false);
  const [pushSupported, setPushSupported] = useState(true);
  const [testPushSent, setTestPushSent] = useState(false);
  const [deviceLabel, setDeviceLabel] = useState<string>("");
  const [steps, setSteps] = useState<StepProgress[]>([]);
  const validatedRef = useRef(false);

  // ─── Mount: detect Push API support ────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setPushSupported(supported);
  }, []);

  // ─── Auth change: check whether the wizard should appear ────────────────
  useEffect(() => {
    if (!isAuthenticated || !pushSupported) return;
    if (validatedRef.current) return;
    validatedRef.current = true;

    let cancelled = false;
    const check = async () => {
      try {
        const deviceInfo = getDeviceInfo();
        setDeviceLabel(deviceInfo.deviceLabel);

        // Check whether the browser still has permission + a local subscription.
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
            deviceId: deviceInfo.deviceId,
            hasBrowserPermission,
            hasLocalSubscription,
          }),
        });
        if (!res.ok) return;
        const json = await res.json();
        const data = json.data;
        if (!data) return;

        if (data.shouldShowWizard && !cancelled) {
          // Delay so it doesn't appear instantly on page load — gives the
          // page time to settle.
          setTimeout(() => {
            if (!cancelled) {
              setStep(data.reason === "incomplete" ? "welcome" : "welcome");
              setOpen(true);
            }
          }, 2000);
        }
      } catch {
        // Best-effort — if anything fails, just don't show the wizard.
      }
    };

    check();
    return () => { cancelled = true; };
  }, [isAuthenticated, pushSupported]);

  // ─── Skip handler ───────────────────────────────────────────────────────
  const handleSkip = useCallback(async () => {
    setBusy(true);
    try {
      const info = getDeviceInfo();
      await fetch("/api/device-registrations/skip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: info.deviceId,
          deviceLabel: info.deviceLabel,
          browserName: info.browserName,
          osName: info.osName,
          deviceType: info.deviceType,
        }),
      });
    } catch {}
    setOpen(false);
    setBusy(false);
  }, []);

  // ─── Start the wizard: request permission ───────────────────────────────
  const handleStart = useCallback(async () => {
    setBusy(true);
    setStep("permission");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStep("denied");
        setBusy(false);
        return;
      }
      // Permission granted — proceed to registration.
      await runRegistration();
    } catch (e) {
      console.error("[wizard] permission request failed:", e);
      setStep("denied");
      setBusy(false);
    }
  }, []);

  // ─── Registration: SW + subscription + backend + welcome push ───────────
  const runRegistration = useCallback(async () => {
    setBusy(true);
    setStep("registering");

    const info = getDeviceInfo();
    const stepList: StepProgress[] = [
      { step: "sw", label: "Activating Service Worker", status: "pending" },
      { step: "subscription", label: "Creating Push Subscription", status: "pending" },
      { step: "backend", label: "Registering Device on Server", status: "pending" },
      { step: "test", label: "Sending Welcome Notification", status: "pending" },
    ];
    setSteps(stepList);

    try {
      // Step 1: ensure SW is registered + active.
      stepList[0].status = "active";
      setSteps([...stepList]);

      let reg: ServiceWorkerRegistration | null = null;
      if (typeof window.__ensurePushReady === "function") {
        reg = await window.__ensurePushReady();
      } else {
        reg = await navigator.serviceWorker.ready;
      }
      if (!reg) throw new Error("Service Worker activation failed");
      stepList[0].status = "done";
      setSteps([...stepList]);

      // Step 2: create push subscription (or reuse existing).
      stepList[1].status = "active";
      setSteps([...stepList]);

      let subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        const vapidRes = await fetch("/api/push/vapid-public");
        const vapidJson = await vapidRes.json();
        if (!vapidJson.data?.publicKey) {
          throw new Error("Push notifications are not configured on the server.");
        }
        const applicationServerKey = urlBase64ToUint8Array(vapidJson.data.publicKey);
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as BufferSource,
        });
      }
      stepList[1].status = "done";
      setSteps([...stepList]);

      // Step 3: POST subscription to backend (saves PushSubscription + ensures
      // AppNotifPreference exists).
      stepList[2].status = "active";
      setSteps([...stepList]);

      const sub = subscription.toJSON();
      const subscribeRes = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: sub.keys,
          userAgent: info.userAgent.slice(0, 500),
        }),
      });
      if (!subscribeRes.ok) {
        const errData = await subscribeRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to save subscription");
      }
      stepList[2].status = "done";
      setSteps([...stepList]);

      // Step 4: register the device + send welcome push via the dedicated endpoint.
      stepList[3].status = "active";
      setSteps([...stepList]);

      const registerRes = await fetch("/api/device-registrations/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: info.deviceId,
          deviceLabel: info.deviceLabel,
          browserName: info.browserName,
          osName: info.osName,
          deviceType: info.deviceType,
          pushEndpoint: sub.endpoint,
        }),
      });
      if (!registerRes.ok) {
        const errData = await registerRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to register device");
      }
      const regJson = await registerRes.json();
      const regData = regJson.data;
      const welcomed = regData?.welcomed === true;
      setTestPushSent(welcomed);
      stepList[3].status = welcomed ? "done" : "failed";
      setSteps([...stepList]);

      // Invalidate preferences query so the toggle in settings reflects the
      // new "enabled" state.
      qc.invalidateQueries({ queryKey: ["customer", "app-notif-prefs"] });

      // Move to the test result step.
      setStep("test_result");
      setBusy(false);
    } catch (e: any) {
      console.error("[wizard] registration failed:", e);
      // Mark any active step as failed.
      setSteps((prev) =>
        prev.map((s) =>
          s.status === "active" ? { ...s, status: "failed" } : s
        )
      );
      // Move to the failed step — shows retry + skip options.
      setStep("registering_failed");
      setBusy(false);
    }
  }, [qc]);

  // ─── Done handler ───────────────────────────────────────────────────────
  const handleDone = useCallback(() => {
    setOpen(false);
    // Reset to welcome in case the wizard is ever re-opened.
    setTimeout(() => setStep("welcome"), 300);
  }, []);

  // ─── Retry handler ──────────────────────────────────────────────────────
  const handleRetry = useCallback(async () => {
    await runRegistration();
  }, [runRegistration]);

  if (!isAuthenticated || !pushSupported) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        // Prevent closing while busy (registration in progress) — the user
        // must wait for the async flow to finish or fail.
        if (!o && busy) return;
        if (!o) handleSkip();
      }}
    >
      <DialogContent
        className="max-w-md overflow-hidden p-0 sm:rounded-2xl"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          // Only allow escape when not busy + on the welcome/denied/done steps.
          if (busy || step === "registering" || step === "permission") {
            e.preventDefault();
          }
        }}
      >
        {/* ── Step: WELCOME ─────────────────────────────────────────────── */}
        {step === "welcome" && (
          <WelcomeStep
            deviceLabel={deviceLabel}
            onTurnOn={handleStart}
            onSkip={handleSkip}
            busy={busy}
          />
        )}

        {/* ── Step: PERMISSION (waiting on browser prompt) ──────────────── */}
        {step === "permission" && (
          <CenteredMessage
            icon={<Bell className="size-8" />}
            title="Waiting for permission"
            message="Your browser is asking for permission to send notifications. Click 'Allow' to continue."
            spinner
          />
        )}

        {/* ── Step: REGISTERING (progress) ──────────────────────────────── */}
        {step === "registering" && (
          <RegisteringStep steps={steps} />
        )}

        {/* ── Step: REGISTERING FAILED ──────────────────────────────────── */}
        {step === "registering_failed" && (
          <RegisteringFailedStep
            steps={steps}
            onRetry={handleRetry}
            onSkip={handleSkip}
            busy={busy}
          />
        )}

        {/* ── Step: TEST_RESULT ─────────────────────────────────────────── */}
        {step === "test_result" && (
          <TestResultStep
            sent={testPushSent}
            onContinue={() => setStep("done")}
            onRetry={handleRetry}
            busy={busy}
          />
        )}

        {/* ── Step: DENIED (permission blocked) ─────────────────────────── */}
        {step === "denied" && (
          <DeniedStep onSkip={handleSkip} onRetry={handleStart} />
        )}

        {/* ── Step: DONE ────────────────────────────────────────────────── */}
        {step === "done" && (
          <DoneStep onDone={handleDone} deviceLabel={deviceLabel} />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ===========================================================================
// Step components
// ===========================================================================

function WelcomeStep({
  deviceLabel,
  onTurnOn,
  onSkip,
  busy,
}: {
  deviceLabel: string;
  onTurnOn: () => void;
  onSkip: () => void;
  busy: boolean;
}) {
  return (
    <>
      {/* Minimal header — no logo, just title + close */}
      <div className="relative px-6 pt-6 pb-4">
        <button
          onClick={onSkip}
          className="absolute right-4 top-4 rounded-full bg-muted p-1.5 transition hover:bg-muted/80"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
        <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
          <BellRing className="size-6" />
        </div>
        <h2 className="text-lg font-bold leading-tight">Stay Updated</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Get instant alerts for your orders, deliveries, and exclusive offers.
        </p>
      </div>

      {/* Benefits — clean 2x2 grid, no descriptions */}
      <div className="grid grid-cols-2 gap-2 px-6 pb-4">
        {BENEFITS.map((b) => {
          const Icon = b.icon;
          return (
            <div key={b.title} className="flex items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2.5">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                <Icon className="size-3.5" />
              </div>
              <p className="text-xs font-medium text-foreground">{b.title}</p>
            </div>
          );
        })}
      </div>

      {/* Buttons */}
      <div className="border-t bg-muted/30 px-6 py-4">
        <div className="flex flex-col gap-2">
          <Button
            onClick={onTurnOn}
            disabled={busy}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {busy ? (
              <><Loader2 className="size-4 mr-1.5 animate-spin" /> Setting up...</>
            ) : (
              <><BellRing className="size-4 mr-1.5" /> Turn On Notifications</>
            )}
          </Button>
          <Button
            onClick={onSkip}
            disabled={busy}
            variant="ghost"
            className="w-full text-muted-foreground"
          >
            Skip for Now
          </Button>
        </div>
      </div>
    </>
  );
}

function RegisteringStep({ steps }: { steps: StepProgress[] }) {
  return (
    <>
      <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-700 px-6 pb-6 pt-7 text-white">
        <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/30">
          <Loader2 className="size-7 animate-spin" />
        </div>
        <h2 className="text-xl font-bold leading-tight">Setting up notifications</h2>
        <p className="mt-1.5 text-sm text-emerald-50/90">
          We're registering this device. This only takes a few seconds.
        </p>
      </div>
      <div className="space-y-3 px-6 py-5">
        {steps.map((s) => (
          <div key={s.step} className="flex items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full">
              {s.status === "done" ? (
                <CheckCircle2 className="size-5 text-emerald-600" />
              ) : s.status === "active" ? (
                <Loader2 className="size-5 animate-spin text-emerald-600" />
              ) : s.status === "failed" ? (
                <XCircle className="size-5 text-rose-500" />
              ) : (
                <div className="size-5 rounded-full border-2 border-muted" />
              )}
            </div>
            <p className={`text-sm ${s.status === "done" ? "font-medium text-foreground" : s.status === "active" ? "font-medium text-foreground" : "text-muted-foreground"}`}>
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </>
  );
}

function RegisteringFailedStep({
  steps,
  onRetry,
  onSkip,
  busy,
}: {
  steps: StepProgress[];
  onRetry: () => void;
  onSkip: () => void;
  busy: boolean;
}) {
  return (
    <>
      <div className="bg-gradient-to-br from-amber-500 to-orange-600 px-6 pb-6 pt-7 text-white">
        <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/30">
          <AlertCircle className="size-7" />
        </div>
        <h2 className="text-xl font-bold leading-tight">Setup incomplete</h2>
        <p className="mt-1.5 text-sm text-amber-50/90">
          We couldn't finish setting up notifications on this device. This is usually temporary.
        </p>
      </div>
      <div className="space-y-3 px-6 py-5">
        {steps.map((s) => (
          <div key={s.step} className="flex items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full">
              {s.status === "done" ? (
                <CheckCircle2 className="size-5 text-emerald-600" />
              ) : s.status === "failed" ? (
                <XCircle className="size-5 text-rose-500" />
              ) : (
                <div className="size-5 rounded-full border-2 border-muted" />
              )}
            </div>
            <p className={`text-sm ${s.status === "failed" ? "font-medium text-rose-600 dark:text-rose-400" : "text-muted-foreground"}`}>
              {s.label}
            </p>
          </div>
        ))}
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          <p>
            You can try again, or skip for now — we'll ask again next time you log in from this device.
          </p>
        </div>
      </div>
      <div className="border-t bg-muted/30 px-6 py-4 space-y-2">
        <Button onClick={onRetry} disabled={busy} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
          {busy ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <RefreshCw className="size-4 mr-1.5" />}
          Try Again
        </Button>
        <Button onClick={onSkip} disabled={busy} variant="ghost" className="w-full text-muted-foreground">
          Skip for Now
        </Button>
      </div>
    </>
  );
}

function TestResultStep({
  sent,
  onContinue,
  onRetry,
  busy,
}: {
  sent: boolean;
  onContinue: () => void;
  onRetry: () => void;
  busy: boolean;
}) {
  if (sent) {
    return (
      <>
        <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-700 px-6 pb-6 pt-7 text-white">
          <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/30">
            <Send className="size-7" />
          </div>
          <h2 className="text-xl font-bold leading-tight">Test notification sent!</h2>
          <p className="mt-1.5 text-sm text-emerald-50/90">
            We sent a welcome notification to this device. Did you see it?
          </p>
        </div>
        <div className="space-y-3 px-6 py-5">
          <p className="text-sm text-muted-foreground">
            If you didn't see the notification, check your system notification settings and make sure browser notifications aren't muted.
          </p>
        </div>
        <div className="border-t bg-muted/30 px-6 py-4">
          <Button onClick={onContinue} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
            <CheckCircle2 className="size-4 mr-1.5" /> Continue
          </Button>
        </div>
      </>
    );
  }

  // Test push failed — still allow continuing, but offer retry.
  return (
    <>
      <div className="bg-gradient-to-br from-amber-500 to-orange-600 px-6 pb-6 pt-7 text-white">
        <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/30">
          <XCircle className="size-7" />
        </div>
        <h2 className="text-xl font-bold leading-tight">Almost there</h2>
        <p className="mt-1.5 text-sm text-amber-50/90">
          Your device is registered, but we couldn't confirm the test notification was delivered.
        </p>
      </div>
      <div className="space-y-3 px-6 py-5">
        <p className="text-sm text-muted-foreground">
          This sometimes happens when the device is offline or the push service is busy. Don't worry — your registration is saved, and you can send another test from <span className="font-medium">Profile → Settings</span> later.
        </p>
      </div>
      <div className="border-t bg-muted/30 px-6 py-4 space-y-2">
        <Button onClick={onRetry} disabled={busy} className="w-full" variant="outline">
          {busy ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Send className="size-4 mr-1.5" />}
          Send Test Again
        </Button>
        <Button onClick={onContinue} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
          Continue Anyway
        </Button>
      </div>
    </>
  );
}

function DeniedStep({
  onSkip,
  onRetry,
}: {
  onSkip: () => void;
  onRetry: () => void;
}) {
  return (
    <>
      <div className="bg-gradient-to-br from-stone-600 to-stone-800 px-6 pb-6 pt-7 text-white">
        <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/30">
          <BellOff className="size-7" />
        </div>
        <h2 className="text-xl font-bold leading-tight">Notifications are off</h2>
        <p className="mt-1.5 text-sm text-stone-50/90">
          You chose not to enable notifications right now.
        </p>
      </div>
      <div className="space-y-3 px-6 py-5">
        <p className="text-sm text-muted-foreground">
          No worries — you can enable notifications anytime from your browser settings or from:
        </p>
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
          <p className="font-medium text-foreground">Profile → Settings → App Notifications</p>
          <p className="mt-1 text-muted-foreground">
            We'll never show this popup again unless you sign in from a new device.
          </p>
        </div>
      </div>
      <div className="border-t bg-muted/30 px-6 py-4 space-y-2">
        <Button onClick={onRetry} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
          <BellRing className="size-4 mr-1.5" /> Try Again
        </Button>
        <Button onClick={onSkip} variant="ghost" className="w-full text-muted-foreground">
          Skip for Now
        </Button>
      </div>
    </>
  );
}

function DoneStep({
  onDone,
  deviceLabel,
}: {
  onDone: () => void;
  deviceLabel: string;
}) {
  return (
    <>
      <div className="relative bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 px-6 pb-7 pt-8 text-white">
        <div className="mb-4 flex size-20 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm ring-2 ring-white/40">
          <CheckCircle2 className="size-12" />
        </div>
        <h2 className="text-2xl font-bold leading-tight">You're All Set!</h2>
        <p className="mt-2 text-sm text-emerald-50/90">
          App Notifications have been enabled successfully on this device.
        </p>
        {deviceLabel && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium text-emerald-50 backdrop-blur-sm">
            <Smartphone className="size-3" />
            {deviceLabel}
          </div>
        )}
      </div>
      <div className="space-y-3 px-6 py-5">
        <div className="space-y-2">
          {BENEFITS.slice(0, 4).map((b) => {
            const Icon = b.icon;
            return (
              <div key={b.title} className="flex items-center gap-2 text-xs">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                <span className="text-muted-foreground">{b.title}</span>
              </div>
            );
          })}
        </div>
        <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 text-xs text-emerald-900 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-200">
          <p className="flex items-start gap-2">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>
              You'll receive order updates, delivery notifications, medicine request updates, and exclusive offers on this device.
            </span>
          </p>
        </div>
      </div>
      <div className="border-t bg-muted/30 px-6 py-4">
        <Button onClick={onDone} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
          Done
        </Button>
      </div>
    </>
  );
}

// ===========================================================================
// Helpers
// ===========================================================================

function CenteredMessage({
  icon,
  title,
  message,
  spinner,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
  spinner?: boolean;
}) {
  return (
    <div className="px-6 py-12 text-center">
      <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
        {spinner ? <Loader2 className="size-8 animate-spin" /> : icon}
      </div>
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    arr[i] = raw.charCodeAt(i);
  }
  return arr;
}
