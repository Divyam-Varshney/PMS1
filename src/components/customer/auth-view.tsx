// ============================================================================
// File: src/components/customer/auth-view.tsx
// Purpose: Login + Register + Forgot Password + OTP verification screens.
//          Premium split-screen layout: left branding panel (desktop only)
//          with feature bullets + testimonial, right form panel. Mobile shows
//          a compact logo + form. Includes T&C checkbox (required) in the
//          register form and a Locality dropdown sourced from active
//          delivery zones. Framer-motion transitions between form and OTP.
// ============================================================================

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, qk } from "./api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";
import {
  Mail,
  Lock,
  User,
  Phone,
  MapPin,
  Loader2,
  ArrowRight,
  ChevronLeft,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  Truck,
  Award,
  HeartPulse,
  Star,
  BadgeCheck,
  FileText,
} from "lucide-react";
import { useUI } from "@/lib/store";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePublicSettings } from "./use-public-settings";

type Step = "form" | "otp" | "forgot" | "reset";
type Mode = "login" | "register";
type OtpPurpose = "register" | "login" | "reset";

export function AuthView() {
  const view = useUI((s) => s.view);
  const navigate = useUI((s) => s.navigate);
  const qc = useQueryClient();
  const { settings } = usePublicSettings();
  const initialMode: Mode = view.name === "auth" ? view.mode : "login";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [step, setStep] = useState<Step>("form");
  const [otpPurpose, setOtpPurpose] = useState<OtpPurpose>("register");
  const [pendingEmail, setPendingEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState(false);

  // Register form state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regLine1, setRegLine1] = useState("");
  const [regPincode, setRegPincode] = useState("");
  const [regLocality, setRegLocality] = useState("");
  // T&C agreement — required to enable the Register button.
  const [agreeTc, setAgreeTc] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [remember, setRemember] = useState(false);

  // Forgot password form state
  const [forgotEmail, setForgotEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPass, setShowNewPass] = useState(false);

  // Fetch the list of localities from active delivery zones — powers the
  // Locality / Area dropdown in the registration form. Delivery charges
  // depend on this value.
  const { data: localitiesData } = useQuery({
    queryKey: ["customer", "delivery-localities"],
    queryFn: () => api<{ localities: string[] }>("/api/delivery/localities"),
  });
  const localities = localitiesData?.localities ?? [];

  // ---- Mutations ---------------------------------------------------------

  const registerMutation = useMutation({
    mutationFn: () =>
      api.post<{ email: string; name: string }>(
        "/api/auth/register",
        {
          name: regName,
          email: regEmail,
          phone: regPhone,
          password: regPassword,
          address: {
            line1: regLine1,
            pincode: regPincode,
            locality: regLocality,
          },
        }
      ),
    onSuccess: () => {
      setPendingEmail(regEmail.toLowerCase());
      setOtpPurpose("register");
      setStep("otp");
      toast.success("OTP sent to your email. Check your inbox (and spam folder).");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const loginMutation = useMutation({
    mutationFn: () =>
      api.post<{ otpRequired: boolean; remember?: boolean; customer?: { id: string; email: string; name: string; phone?: string; isEmailVerified?: boolean } }>(
        "/api/auth/login",
        { email: loginEmail, password: loginPassword, remember }
      ),
    onSuccess: (data) => {
      if (data.otpRequired) {
        setPendingEmail(loginEmail.toLowerCase());
        setOtpPurpose("login");
        setStep("otp");
        toast.success("OTP sent to your email. Check your inbox (and spam folder).");
      } else if (data.customer) {
        // CRITICAL FIX: Set the me query data IMMEDIATELY from the login response.
        // This ensures the user is shown as logged-in right away, without waiting
        // for the /api/auth/me refetch. If we only invalidate (which triggers a
        // background refetch), the me query data stays `null` (the pre-login value)
        // until the refetch completes — and if the refetch hits a cached null
        // response, the user gets auto-logged-out within seconds.
        qc.setQueryData(qk.me, {
          id: data.customer.id,
          name: data.customer.name,
          email: data.customer.email,
          phone: data.customer.phone ?? "",
          isEmailVerified: data.customer.isEmailVerified ?? true,
          addresses: [],
          _count: { orders: 0, prescriptions: 0 },
        });
        // Invalidate to trigger a background refetch with the full customer object
        // (including addresses, _count, etc.). The setQueryData above ensures the
        // user sees the logged-in state immediately, even before the refetch completes.
        qc.invalidateQueries({ queryKey: qk.me });
        qc.invalidateQueries({ queryKey: qk.cart });
        toast.success(`Welcome back, ${data.customer.name}!`);
        navigate({ name: "home" });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const forgotMutation = useMutation({
    mutationFn: () =>
      api.post<{ sent: boolean; rateLimited?: boolean }>("/api/auth/forgot-password", {
        email: forgotEmail,
      }),
    onSuccess: (data) => {
      setPendingEmail(forgotEmail.toLowerCase());
      setOtpPurpose("reset");
      setStep("otp");
      if (data.rateLimited) {
        toast.success("A reset OTP was sent recently. Please wait a minute before resending.");
      } else {
        toast.success("If that email is registered, a reset OTP has been sent.");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resendOtpMutation = useMutation({
    mutationFn: () =>
      api.post<{ sent: boolean }>("/api/auth/resend-otp", {
        email: pendingEmail,
        purpose: otpPurpose,
      }),
    onSuccess: () => toast.success("A new OTP has been sent to your email."),
    onError: (e: Error) => toast.error(e.message),
  });

  const verifyOtpMutation = useMutation({
    mutationFn: () => {
      if (otpPurpose === "register") {
        return api.post<{ id: string; name: string; email: string }>(
          "/api/auth/verify-otp",
          { email: pendingEmail, code: otp }
        );
      }
      if (otpPurpose === "login") {
        return api.post<{ id: string; name: string; email: string }>(
          "/api/auth/login-verify",
          { email: pendingEmail, code: otp, remember }
        );
      }
      return api.post<{ reset: boolean }>("/api/auth/reset-password", {
        email: pendingEmail,
        code: otp,
        password: newPassword,
      });
    },
    onSuccess: (data) => {
      if (otpPurpose === "reset") {
        toast.success("Password reset successfully! Please log in with your new password.");
        setOtp("");
        setNewPassword("");
        setForgotEmail("");
        setMode("login");
        setLoginEmail(pendingEmail);
        setStep("form");
        return;
      }
      // CRITICAL FIX: Set the me query data IMMEDIATELY from the verify response.
      // Same rationale as loginMutation — don't leave the me query as null while
      // a background refetch is in-flight.
      const verified = data as { id: string; name: string; email: string; phone?: string; isEmailVerified?: boolean };
      qc.setQueryData(qk.me, {
        id: verified.id,
        name: verified.name,
        email: verified.email,
        phone: verified.phone ?? "",
        isEmailVerified: verified.isEmailVerified ?? true,
        addresses: [],
        _count: { orders: 0, prescriptions: 0 },
      });
      qc.invalidateQueries({ queryKey: qk.me });
      qc.invalidateQueries({ queryKey: qk.cart });
      toast.success(`Welcome, ${verified.name}!`);
      navigate({ name: "home" });
    },
    onError: (e: Error) => {
      setOtpError(true);
      toast.error(e.message);
      // Clear the OTP after a failed attempt so the user can re-enter
      setTimeout(() => { setOtp(""); setOtpError(false); }, 600);
    },
  });

  const onRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regEmail || !regPhone || !regPassword) {
      toast.error("All fields are required");
      return;
    }
    if (!regLine1 || !regLine1.trim()) {
      toast.error("Delivery address is required");
      return;
    }
    if (!regPincode || !regPincode.trim()) {
      toast.error("Pincode is required");
      return;
    }
    if (regPincode.trim().length < 6) {
      toast.error("Please enter a valid 6-digit pincode");
      return;
    }
    if (!regLocality) {
      toast.error("Please select your area / locality");
      return;
    }
    if (regPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    // T&C agreement — required before registration proceeds.
    if (!agreeTc) {
      toast.error("Please accept the Terms & Conditions");
      return;
    }
    registerMutation.mutate();
  };

  const onLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      toast.error("Email and password are required");
      return;
    }
    loginMutation.mutate();
  };

  const onForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      toast.error("Please enter your registered email");
      return;
    }
    forgotMutation.mutate();
  };

  const onVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast.error("Please enter the 6-digit OTP");
      setOtpError(true);
      setTimeout(() => setOtpError(false), 600);
      return;
    }
    if (otpPurpose === "reset" && newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    verifyOtpMutation.mutate();
  };

  // Auto-verify when OTP is complete (6 digits)
  useEffect(() => {
    if (otp.length === 6 && !verifyOtpMutation.isPending) {
      if (otpPurpose !== "reset" || newPassword.length >= 6) {
        verifyOtpMutation.mutate();
      }
    }
  }, [otp]);

  const resetToForm = () => {
    setStep("form");
    setOtp("");
    setNewPassword("");
  };

  // ---- Render ------------------------------------------------------------

  // Branding panel — shown on the left for desktop only. Reused across all
  // steps (form / otp / forgot) so the layout stays consistent.
  const BrandingPanel = (
    <div className="relative hidden overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-8 text-white lg:flex lg:flex-col lg:justify-between lg:p-10">
      {/* Decorative dotted overlay + blobs */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />
      <div className="absolute -right-16 -top-16 size-56 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-20 -left-12 size-64 rounded-full bg-teal-300/20 blur-3xl" />

      {/* Logo + tagline */}
      <div className="relative">
        <div className="flex items-center gap-2.5">
          <img
            src={settings?.store?.logo || "/logo.png"}
            alt={settings?.store?.name || "Pradeep Medical Store"}
            className="size-11 rounded-xl object-cover shadow-md ring-2 ring-white/30"
          />
          <div>
            <p className="text-base font-bold leading-tight">{settings?.store?.name || "Pradeep Medical Store"}</p>
            <p className="text-[11px] uppercase tracking-wider text-white/80">Online Pharmacy</p>
          </div>
        </div>
      </div>

      {/* Hero copy + feature bullets */}
      <div className="relative space-y-5">
        <div>
          <h2 className="text-3xl font-bold leading-tight">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="mt-1.5 text-sm text-white/90">
            {mode === "login"
              ? "Sign in to manage orders, prescriptions, and addresses."
              : "Join 2,000+ customers who trust us with their healthcare needs."}
          </p>
        </div>

        {/* Feature bullets */}
        <ul className="space-y-3">
          <Feature icon={ShieldCheck} title="100% Genuine Medicines" desc="Sourced from licensed manufacturers only." />
          <Feature icon={Truck} title="Fast Delivery in Mathura" desc="Same-day delivery, often within 30-40 minutes." />
          <Feature icon={Award} title="Licensed Pharmacy" desc="Operated by qualified, registered pharmacists." />
          <Feature icon={HeartPulse} title="Health Tips & Articles" desc="Daily insights from our pharmacy team." />
        </ul>
      </div>

      {/* Testimonial */}
      <div className="relative rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
        <div className="mb-2 flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="size-3.5 fill-amber-300 text-amber-300" />
          ))}
        </div>
        <p className="text-sm italic text-white/95">
          &ldquo;Ordered late at night and got my medicines by morning. The
          pharmacists even called to check on dosage. Truly caring service!&rdquo;
        </p>
        <div className="mt-3 flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
            RK
          </div>
          <div className="leading-tight">
            <p className="text-xs font-semibold">Rajesh Kumar</p>
            <p className="text-[10px] text-white/80 flex items-center gap-0.5">
              <BadgeCheck className="size-2.5" /> Verified customer · Mathura
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col px-0 py-0 sm:py-6 lg:flex-row lg:items-stretch lg:gap-0 lg:px-4 lg:py-10">
      {/* Card container — splits into branding + form on desktop, stacks on mobile */}
      <Card className="grid overflow-hidden p-0 lg:grid-cols-2 lg:shadow-xl">
        {BrandingPanel}

        {/* Form side */}
        <div className="flex flex-col bg-card p-5 sm:p-8">
          {/* Mobile logo — only shown on small screens (desktop uses the branding panel) */}
          <div className="mb-5 flex flex-col items-center text-center lg:hidden">
            <img
              src={settings?.store?.logo || "/logo.png"}
              alt={settings?.store?.name || "Pradeep Medical Store"}
              className="mb-2 size-12 rounded-xl object-cover shadow-md"
            />
            <h1 className="text-lg font-bold">{settings?.store?.name || "Pradeep Medical Store"}</h1>
            <p className="text-xs text-muted-foreground">Your trusted online pharmacy</p>
          </div>

          <AnimatePresence mode="wait">
            {step === "otp" ? (
              <motion.div
                key="otp"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="flex flex-1 flex-col"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <KeyRound className="size-6" />
                  </div>
                  <h2 className="text-xl font-bold">
                    {otpPurpose === "reset" ? "Reset your password" : "Enter verification code"}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    We sent a 6-digit code to
                    <br />
                    <span className="font-medium text-foreground">{pendingEmail}</span>
                  </p>
                </div>

                <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center text-xs text-emerald-800">
                  <p className="flex items-center justify-center gap-1.5 font-medium">
                    <ShieldCheck className="size-3.5" />
                    Check your email for the 6-digit code
                  </p>
                  <p className="mt-1 text-[10px] opacity-80">
                    The code expires in 10 minutes. Don&apos;t forget to check your spam folder.
                  </p>
                </div>

                <form onSubmit={onVerifyOtp} className="mt-5 flex flex-1 flex-col items-center gap-4">
                  <motion.div
                    animate={otpError ? { x: [0, -8, 8, -6, 6, -3, 3, 0] } : {}}
                    transition={{ duration: 0.4 }}
                  >
                  <InputOTP maxLength={6} value={otp} onChange={(v) => setOtp(v)} className="gap-1">
                    <InputOTPGroup>
                      <InputOTPSlot index={0} className={otpError ? "size-11 text-base border-destructive" : "size-11 text-base"} />
                      <InputOTPSlot index={1} className={otpError ? "size-11 text-base border-destructive" : "size-11 text-base"} />
                      <InputOTPSlot index={2} className={otpError ? "size-11 text-base border-destructive" : "size-11 text-base"} />
                    </InputOTPGroup>
                    <InputOTPSeparator />
                    <InputOTPGroup>
                      <InputOTPSlot index={3} className={otpError ? "size-11 text-base border-destructive" : "size-11 text-base"} />
                      <InputOTPSlot index={4} className={otpError ? "size-11 text-base border-destructive" : "size-11 text-base"} />
                      <InputOTPSlot index={5} className={otpError ? "size-11 text-base border-destructive" : "size-11 text-base"} />
                    </InputOTPGroup>
                  </InputOTP>
                  </motion.div>

                  {/* New password field — only shown for the reset flow. */}
                  {otpPurpose === "reset" && (
                    <div className="w-full">
                      <Label htmlFor="new-pass" className="text-xs">
                        New password <span className="text-muted-foreground">(min 6 chars)</span>
                      </Label>
                      <div className="relative mt-1">
                        <Lock className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="new-pass"
                          type={showNewPass ? "text" : "password"}
                          placeholder="••••••"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="pl-8 pr-9"
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPass((s) => !s)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          aria-label={showNewPass ? "Hide password" : "Show password"}
                        >
                          {showNewPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
                    disabled={otp.length !== 6 || verifyOtpMutation.isPending}
                  >
                    {verifyOtpMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        {otpPurpose === "reset" ? "Reset password" : "Verify & continue"}{" "}
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>

                  {/* Resend OTP — calls the dedicated rate-limited endpoint. */}
                  <button
                    type="button"
                    onClick={() => {
                      setOtp("");
                      resendOtpMutation.mutate();
                    }}
                    disabled={resendOtpMutation.isPending}
                    className="text-center text-xs text-muted-foreground hover:text-primary disabled:opacity-50"
                  >
                    {resendOtpMutation.isPending ? (
                      <span className="flex items-center justify-center gap-1">
                        <Loader2 className="size-3 animate-spin" /> Sending…
                      </span>
                    ) : (
                      <>
                        Didn&apos;t receive the code?{" "}
                        <span className="font-medium text-primary">Resend OTP</span>
                      </>
                    )}
                  </button>
                </form>

                <button
                  onClick={resetToForm}
                  className="mt-4 flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft className="size-4" /> Back
                </button>
              </motion.div>
            ) : step === "forgot" ? (
              <motion.div
                key="forgot"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="flex flex-1 flex-col"
              >
                <div className="mb-4 flex flex-col items-center text-center">
                  <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                    <KeyRound className="size-6" />
                  </div>
                  <h2 className="text-xl font-bold">Forgot Password?</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Enter your registered email and we&apos;ll send you a verification code to reset
                    your password.
                  </p>
                </div>
                <form onSubmit={onForgotSubmit} className="space-y-3">
                  <div>
                    <Label htmlFor="forgot-email" className="text-xs">Email</Label>
                    <div className="relative mt-1">
                      <Mail className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="forgot-email"
                        type="email"
                        placeholder="you@example.com"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="pl-8"
                        autoComplete="email"
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
                    disabled={forgotMutation.isPending}
                  >
                    {forgotMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        Send reset code <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>
                </form>
                <button
                  onClick={() => setStep("form")}
                  className="mt-4 flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft className="size-4" /> Back to login
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="flex flex-1 flex-col"
              >
                <div className="mb-4 hidden text-center lg:block">
                  <h1 className="text-2xl font-bold">
                    {mode === "login" ? "Sign in to your account" : "Create your account"}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {mode === "login"
                      ? "Welcome back! Please enter your details."
                      : "Get started with Pradeep Medical Store today."}
                  </p>
                </div>

                <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} className="flex flex-1 flex-col">
                  <TabsList className="w-full">
                    <TabsTrigger value="login" className="flex-1">Login</TabsTrigger>
                    <TabsTrigger value="register" className="flex-1">Register</TabsTrigger>
                  </TabsList>

                  {/* Login */}
                  <TabsContent value="login" className="mt-4 flex-1">
                    <form onSubmit={onLoginSubmit} className="space-y-3">
                      <div>
                        <Label htmlFor="login-email" className="text-xs">Email</Label>
                        <div className="relative mt-1">
                          <Mail className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="login-email"
                            type="email"
                            placeholder="you@example.com"
                            value={loginEmail}
                            onChange={(e) => setLoginEmail(e.target.value)}
                            className="pl-8"
                            autoComplete="email"
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="login-pass" className="text-xs">Password</Label>
                          <button
                            type="button"
                            onClick={() => setStep("forgot")}
                            className="text-[11px] font-medium text-primary hover:underline"
                          >
                            Forgot password?
                          </button>
                        </div>
                        <div className="relative mt-1">
                          <Lock className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="login-pass"
                            type={showLoginPass ? "text" : "password"}
                            placeholder="••••••"
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            className="pl-8 pr-9"
                            autoComplete="current-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowLoginPass((s) => !s)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            aria-label={showLoginPass ? "Hide password" : "Show password"}
                          >
                            {showLoginPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          </button>
                        </div>
                      </div>
                      {/* Remember Me */}
                      <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={remember}
                          onChange={(e) => setRemember(e.target.checked)}
                          className="size-4 rounded border-input accent-emerald-600"
                        />
                        <span>Remember me on this device (30 days)</span>
                      </label>
                      <Button
                        type="submit"
                        size="lg"
                        className="w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
                        disabled={loginMutation.isPending}
                      >
                        {loginMutation.isPending ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <>
                            Login <ArrowRight className="size-4" />
                          </>
                        )}
                      </Button>
                    </form>

                    <p className="mt-4 text-center text-xs text-muted-foreground">
                      Don&apos;t have an account?{" "}
                      <button
                        type="button"
                        onClick={() => setMode("register")}
                        className="font-medium text-primary hover:underline"
                      >
                        Register here
                      </button>
                    </p>
                  </TabsContent>

                  {/* Register */}
                  <TabsContent value="register" className="mt-4 flex-1">
                    <form onSubmit={onRegisterSubmit} className="space-y-3">
                      <div>
                        <Label htmlFor="reg-name" className="text-xs">Full name *</Label>
                        <div className="relative mt-1">
                          <User className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="reg-name"
                            placeholder="John Doe"
                            value={regName}
                            onChange={(e) => setRegName(e.target.value)}
                            className="pl-8"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="reg-email" className="text-xs">Email *</Label>
                          <div className="relative mt-1">
                            <Mail className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              id="reg-email"
                              type="email"
                              placeholder="you@example.com"
                              value={regEmail}
                              onChange={(e) => setRegEmail(e.target.value)}
                              className="pl-8"
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="reg-phone" className="text-xs">Phone *</Label>
                          <div className="relative mt-1">
                            <Phone className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              id="reg-phone"
                              placeholder="+91 99999 99999"
                              value={regPhone}
                              onChange={(e) => setRegPhone(e.target.value)}
                              className="pl-8"
                            />
                          </div>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="reg-pass" className="text-xs">Password * <span className="font-normal text-muted-foreground">(min 6 chars)</span></Label>
                        <div className="relative mt-1">
                          <Lock className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="reg-pass"
                            type="password"
                            placeholder="••••••"
                            value={regPassword}
                            onChange={(e) => setRegPassword(e.target.value)}
                            className="pl-8"
                          />
                        </div>
                      </div>
                      <div className="rounded-lg border border-dashed p-3">
                        <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                          <MapPin className="size-3.5" /> Delivery address <span className="text-destructive">*</span>
                        </p>
                        <div className="space-y-2">
                          <Input
                            placeholder="House no, street, area *"
                            value={regLine1}
                            onChange={(e) => setRegLine1(e.target.value)}
                            required
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              placeholder="Pincode (e.g. 281001) *"
                              value={regPincode}
                              onChange={(e) => setRegPincode(e.target.value)}
                              required
                              maxLength={6}
                              pattern="[0-9]{6}"
                            />
                            {/* Locality dropdown — fetched from active delivery zones. */}
                            <Select value={regLocality} onValueChange={setRegLocality}>
                              <SelectTrigger>
                                <SelectValue placeholder="Locality *" />
                              </SelectTrigger>
                              <SelectContent>
                                {localities.length === 0 ? (
                                  <SelectItem value="__none__" disabled>No areas configured</SelectItem>
                                ) : (
                                  localities.map((loc) => (
                                    <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Required — used to calculate accurate delivery charges.
                          </p>
                        </div>
                      </div>

                      {/* T&C agreement — required to enable the Register button. */}
                      <label className="flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={agreeTc}
                          onChange={(e) => setAgreeTc(e.target.checked)}
                          className="mt-0.5 size-4 rounded border-input accent-emerald-600"
                        />
                        <span>
                          I agree to the{" "}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              navigate({ name: "terms" });
                            }}
                            className="font-medium text-emerald-700 hover:underline"
                          >
                            Terms &amp; Conditions
                          </button>
                          .
                        </span>
                      </label>

                      <Button
                        type="submit"
                        size="lg"
                        className="w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                        disabled={registerMutation.isPending || !agreeTc}
                      >
                        {registerMutation.isPending ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <>
                            Create account <ArrowRight className="size-4" />
                          </>
                        )}
                      </Button>
                    </form>
                    <p className="mt-3 flex items-center justify-center gap-1 text-center text-[11px] text-muted-foreground">
                      <FileText className="size-3" />
                      By registering, you also agree to our Refund &amp; Return Policy.
                    </p>
                    <p className="mt-3 text-center text-xs text-muted-foreground">
                      Already have an account?{" "}
                      <button
                        type="button"
                        onClick={() => setMode("login")}
                        className="font-medium text-primary hover:underline"
                      >
                        Login here
                      </button>
                    </p>
                  </TabsContent>
                </Tabs>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Branding-panel feature bullet
// ---------------------------------------------------------------------------
function Feature({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof ShieldCheck;
  title: string;
  desc: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
        <Icon className="size-5 text-white" />
      </div>
      <div>
        <p className="text-sm font-semibold leading-tight">{title}</p>
        <p className="text-xs text-white/80">{desc}</p>
      </div>
    </li>
  );
}
