// ============================================================================
// File: src/components/admin/views/SettingsView.tsx
// Purpose: Settings — tabbed forms for each settings category. Sensitive
//          fields (passwords, secrets) use password inputs with show/hide.
// ============================================================================

"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, run } from "../api";
import { PageHeader } from "../ui";
import { HeroSettingsPanel } from "../hero-settings-panel";
import { StorageSettingsPanel } from "../storage-settings-panel";
import { AiProviderPanel } from "../ai-provider-panel";
import { BrandingPanel } from "../branding-panel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Save, Loader2, Eye, EyeOff, Store, Mail, Percent, FileText, Search, Palette, ShieldCheck, Clock, Sparkles, Bell, Cloud, Brain } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export function SettingsView({ initialSection }: { initialSection?: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => api.get<{ settings: Record<string, any>; grouped: Record<string, Record<string, any>> }>("/api/admin/settings"),
  });

  const [section, setSection] = useState(initialSection || "store");

  // Local working copy. We use the query data as initial state via a remount
  // key on the inner form, but for simplicity we sync here. The disable below
  // is intentional: we only want to refresh the form when fresh settings load.
  const [form, setForm] = useState<Record<string, any>>({});
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const dataKey = data ? JSON.stringify(data.settings) : null;
  useEffect(() => {
    if (dataKey && dataKey !== loadedKey) {
       
      setForm({ ...data!.settings });
      setLoadedKey(dataKey);
    }
  }, [dataKey, loadedKey, data]);

  async function save(keys: string[]) {
    const patch: Record<string, any> = {};
    for (const k of keys) patch[k] = form[k];
    const r = await run(() => api.put("/api/admin/settings", { settings: patch }), {
      success: "Settings saved",
      error: "Save failed",
    });
    if (r) qc.invalidateQueries({ queryKey: ["admin-settings"] });
  }

  function set(k: string, v: any) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  if (isLoading || !data) {
    return (
      <div>
        <PageHeader title="Settings" />
        <Card className="admin-card"><CardContent className="pt-6 h-64 skeleton-premium rounded-xl" /></Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Settings" description="Configure every aspect of your pharmacy platform." />

      <Tabs value={section} onValueChange={setSection}>
        {/* Sidebar navigation on lg+, horizontal scrollable tabs on mobile */}
        <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-6">
          <div className="mb-4 lg:mb-0">
            <TabsList className="lg:flex-col lg:h-auto lg:items-stretch lg:gap-1 lg:p-2 lg:rounded-xl lg:border lg:border-border/70 lg:bg-card lg:shadow-premium-sm lg:sticky lg:top-20 flex w-full overflow-x-auto h-auto gap-1">
              <TabsTrigger value="store" className="lg:w-full lg:justify-start gap-1.5 btn-premium"><Store className="size-3.5" /> Store</TabsTrigger>
              <TabsTrigger value="store-status" className="lg:w-full lg:justify-start gap-1.5 btn-premium"><Clock className="size-3.5" /> Store Status</TabsTrigger>
              <TabsTrigger value="smtp" className="lg:w-full lg:justify-start gap-1.5 btn-premium"><Mail className="size-3.5" /> SMTP</TabsTrigger>
              <TabsTrigger value="notifications" className="lg:w-full lg:justify-start gap-1.5 btn-premium"><Bell className="size-3.5" /> Notifications</TabsTrigger>
              <TabsTrigger value="discount" className="lg:w-full lg:justify-start gap-1.5 btn-premium"><Percent className="size-3.5" /> Discount</TabsTrigger>
              <TabsTrigger value="invoice" className="lg:w-full lg:justify-start gap-1.5 btn-premium"><FileText className="size-3.5" /> Invoice</TabsTrigger>
              <TabsTrigger value="seo" className="lg:w-full lg:justify-start gap-1.5 btn-premium"><Search className="size-3.5" /> SEO</TabsTrigger>
              <TabsTrigger value="theme" className="lg:w-full lg:justify-start gap-1.5 btn-premium"><Palette className="size-3.5" /> Theme</TabsTrigger>
              <TabsTrigger value="hero" className="lg:w-full lg:justify-start gap-1.5 btn-premium"><Sparkles className="size-3.5" /> Hero</TabsTrigger>
              <TabsTrigger value="general" className="lg:w-full lg:justify-start gap-1.5 btn-premium"><ShieldCheck className="size-3.5" /> Auth</TabsTrigger>
              <TabsTrigger value="storage" className="lg:w-full lg:justify-start gap-1.5 btn-premium"><Cloud className="size-3.5" /> Storage</TabsTrigger>
              <TabsTrigger value="ai" className="lg:w-full lg:justify-start gap-1.5 btn-premium"><Brain className="size-3.5" /> AI</TabsTrigger>
            </TabsList>
          </div>

          <div className="min-w-0">

        {/* Store Info */}
        <TabsContent value="store">
          <Card className="admin-card">
            <CardHeader>
              <CardTitle className="text-base">Store Information</CardTitle>
              <CardDescription>Basic details about your pharmacy.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Website Logo — single master logo */}
              <div className="rounded-lg border border-border/40 p-4">
                <BrandingPanel />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Store Name"><Input value={form["store.name"] || ""} onChange={(e) => set("store.name", e.target.value)} /></Field>
                <Field label="Tagline"><Input value={form["store.tagline"] || ""} onChange={(e) => set("store.tagline", e.target.value)} /></Field>
                <Field label="Email"><Input value={form["store.email"] || ""} onChange={(e) => set("store.email", e.target.value)} /></Field>
                <Field label="Phone"><Input value={form["store.phone"] || ""} onChange={(e) => set("store.phone", e.target.value)} /></Field>
                <Field label="GST Number"><Input value={form["store.gstNumber"] || ""} onChange={(e) => set("store.gstNumber", e.target.value)} /></Field>
                <Field label="License Number"><Input value={form["store.licenseNumber"] || ""} onChange={(e) => set("store.licenseNumber", e.target.value)} /></Field>
                <div className="md:col-span-2">
                  <Field label="Address"><Textarea rows={2} value={form["store.address"] || ""} onChange={(e) => set("store.address", e.target.value)} /></Field>
                </div>
              </div>
            </CardContent>
            <SaveBar onSave={() => save(["store.name", "store.tagline", "store.email", "store.phone", "store.gstNumber", "store.licenseNumber", "store.address"])} />
          </Card>
        </TabsContent>

        {/* Store Status */}
        <TabsContent value="store-status">
          <Card className="admin-card">
            <CardHeader>
              <CardTitle className="text-base">Store Open / Close</CardTitle>
              <CardDescription>Toggle whether customers can place orders. Closing blocks checkout.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ToggleRow
                label="Store is Open"
                description="When off, customers can browse but cannot checkout."
                checked={!!form["store.openStatus"]}
                onChange={(v) => set("store.openStatus", v)}
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Default Open Time (fallback)"><Input type="time" value={form["store.openTime"] || ""} onChange={(e) => set("store.openTime", e.target.value)} /></Field>
                <Field label="Default Close Time (fallback)"><Input type="time" value={form["store.closeTime"] || ""} onChange={(e) => set("store.closeTime", e.target.value)} /></Field>
              </div>

              {/* Weekly Schedule */}
              <div className="pt-3 border-t">
                <p className="text-sm font-semibold mb-1">Weekly Schedule</p>
                <p className="text-xs text-muted-foreground mb-3">Set different opening hours for each day. Times are in IST (Indian Standard Time).</p>
                <div className="space-y-2">
                  {["mon","tue","wed","thu","fri","sat","sun"].map((day) => {
                    const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
                    const schedule = form["store.weeklySchedule"]?.[day] || { open: "09:00", close: "20:00", closed: false };
                    return (
                      <div key={day} className="flex flex-wrap items-center gap-3 rounded-lg border p-2">
                        <span className="w-12 text-sm font-medium">{dayLabel}</span>
                        <Switch
                          checked={!schedule.closed}
                          onCheckedChange={(v) => {
                            const ws = { ...(form["store.weeklySchedule"] || {}) };
                            ws[day] = { ...schedule, closed: !v };
                            set("store.weeklySchedule", ws);
                          }}
                        />
                        <span className="text-xs text-muted-foreground">{schedule.closed ? "Closed" : "Open"}</span>
                        {!schedule.closed && (
                          <>
                            <Input type="time" value={schedule.open || "09:00"} onChange={(e) => {
                              const ws = { ...(form["store.weeklySchedule"] || {}) };
                              ws[day] = { ...schedule, open: e.target.value };
                              set("store.weeklySchedule", ws);
                            }} className="w-32" />
                            <span className="text-xs text-muted-foreground">to</span>
                            <Input type="time" value={schedule.close || "20:00"} onChange={(e) => {
                              const ws = { ...(form["store.weeklySchedule"] || {}) };
                              ws[day] = { ...schedule, close: e.target.value };
                              set("store.weeklySchedule", ws);
                            }} className="w-32" />
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Holidays */}
              <div className="pt-3 border-t">
                <p className="text-sm font-semibold mb-1">Holidays / Custom Closed Dates</p>
                <p className="text-xs text-muted-foreground mb-3">Add dates when the store will be closed (national holidays, festivals, maintenance).</p>
                <div className="flex gap-2 mb-2">
                  <Input
                    type="date"
                    id="holiday-date"
                    className="w-40"
                  />
                  <Input
                    type="text"
                    id="holiday-name"
                    placeholder="Holiday name (e.g. Independence Day)"
                    className="flex-1"
                  />
                  <Button size="sm" onClick={() => {
                    const dateInput = document.getElementById("holiday-date") as HTMLInputElement;
                    const nameInput = document.getElementById("holiday-name") as HTMLInputElement;
                    if (!dateInput?.value) return;
                    const holidays = [...(form["store.holidays"] || [])];
                    holidays.push({ date: dateInput.value, name: nameInput?.value || "Holiday" });
                    set("store.holidays", holidays);
                    dateInput.value = "";
                    if (nameInput) nameInput.value = "";
                  }}>Add</Button>
                </div>
                {form["store.holidays"]?.length > 0 && (
                  <div className="space-y-1">
                    {form["store.holidays"].map((h: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                        <span className="font-medium">{h.date}</span>
                        <span className="text-muted-foreground">{h.name}</span>
                        <Button size="sm" variant="ghost" className="ml-auto text-destructive" onClick={() => {
                          const holidays = [...(form["store.holidays"] || [])];
                          holidays.splice(i, 1);
                          set("store.holidays", holidays);
                        }}>Remove</Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Field label="Closed Message (fallback)">
                <Textarea rows={2} value={form["store.closedMessage"] || ""} onChange={(e) => set("store.closedMessage", e.target.value)} />
              </Field>
            </CardContent>
            <SaveBar onSave={() => save(["store.openStatus", "store.openTime", "store.closeTime", "store.closedMessage", "store.weeklySchedule", "store.holidays"])} />
          </Card>
        </TabsContent>

        {/* SMTP */}
        <TabsContent value="smtp">
          <Card className="admin-card">
            <CardHeader>
              <CardTitle className="text-base">SMTP / Email</CardTitle>
              <CardDescription>Configure your transactional email gateway.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ToggleRow
                label="Enable SMTP"
                description="When off, notifications are still logged but not actually sent."
                checked={!!form["smtp.enabled"]}
                onChange={(v) => set("smtp.enabled", v)}
              />

              {/* SMTP Provider Presets */}
              <Field label="Quick Setup (Provider Presets)">
                <Select
                  value=""
                  onValueChange={(v) => {
                    const presets: Record<string, any> = {
                      gmail: { host: "smtp.gmail.com", port: 587, username: "" },
                      resend: { host: "smtp.resend.com", port: 465, username: "resend" },
                      sendgrid: { host: "smtp.sendgrid.net", port: 587, username: "apikey" },
                      mailgun: { host: "smtp.mailgun.org", port: 587, username: "" },
                      amazon: { host: "email-smtp.us-east-1.amazonaws.com", port: 587, username: "" },
                      zoho: { host: "smtp.zoho.com", port: 465, username: "" },
                    };
                    const preset = presets[v];
                    if (preset) {
                      set("smtp.host", preset.host);
                      set("smtp.port", preset.port);
                      set("smtp.username", preset.username);
                      toast.success(`${v.charAt(0).toUpperCase() + v.slice(1)} preset applied — enter your password and sender email`);
                    }
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select a provider to auto-fill..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gmail">Gmail (smtp.gmail.com:587)</SelectItem>
                    <SelectItem value="resend">Resend (smtp.resend.com:465)</SelectItem>
                    <SelectItem value="sendgrid">SendGrid (smtp.sendgrid.net:587)</SelectItem>
                    <SelectItem value="mailgun">Mailgun (smtp.mailgun.org:587)</SelectItem>
                    <SelectItem value="amazon">Amazon SES (email-smtp.amazonaws.com:587)</SelectItem>
                    <SelectItem value="zoho">Zoho Mail (smtp.zoho.com:465)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Host"><Input value={form["smtp.host"] || ""} onChange={(e) => set("smtp.host", e.target.value)} placeholder="smtp.resend.com" /></Field>
                <Field label="Port"><Input type="number" value={form["smtp.port"] ?? 587} onChange={(e) => set("smtp.port", parseInt(e.target.value) || 587)} placeholder="465 or 587" /></Field>
                <Field label="Username"><Input value={form["smtp.username"] || ""} onChange={(e) => set("smtp.username", e.target.value)} placeholder="resend (for Resend) or your email (for Gmail)" /></Field>
                <SecretField label="Password / API Key" value={form["smtp.password"] || ""} onChange={(v) => set("smtp.password", v)} />
                <Field label="Sender Name"><Input value={form["smtp.senderName"] || ""} onChange={(e) => set("smtp.senderName", e.target.value)} placeholder="Pradeep Medical Store" /></Field>
                <Field label="Sender Email (REQUIRED)">
                  <Input
                    type="email"
                    value={form["smtp.senderEmail"] || ""}
                    onChange={(e) => set("smtp.senderEmail", e.target.value)}
                    placeholder="onboarding@resend.dev (testing) or care@yourdomain.com (production)"
                  />
                </Field>
              </div>

              {/* Sender Email explanation */}
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <p className="font-semibold">⚠️ Sender Email is required for all providers</p>
                <ul className="mt-1 space-y-0.5 list-disc list-inside">
                  <li><strong>Gmail:</strong> Use your Gmail address (e.g. yourname@gmail.com)</li>
                  <li><strong>Resend:</strong> Use a verified sender email. For testing, use <code>onboarding@resend.dev</code>. For production, use your verified domain (e.g. <code>care@pradeepmedical.com</code>)</li>
                  <li><strong>SendGrid/Mailgun/SES:</strong> Use your verified sender email</li>
                </ul>
                <p className="mt-1">The "Sender Name" is the display name shown to recipients (e.g. "Pradeep Medical Store").</p>
              </div>

              {/* Test Connection button */}
              <div className="flex items-center gap-3 pt-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={testingSmtp || savingSmtp}
                  onClick={async () => {
                    // Save first, then test
                    setSavingSmtp(true);
                    try {
                      await api.put("/api/admin/settings", {
                        settings: {
                          "smtp.enabled": form["smtp.enabled"],
                          "smtp.host": form["smtp.host"],
                          "smtp.port": form["smtp.port"],
                          "smtp.username": form["smtp.username"],
                          "smtp.password": form["smtp.password"],
                          "smtp.senderName": form["smtp.senderName"],
                          "smtp.senderEmail": form["smtp.senderEmail"],
                        },
                      });
                      qc.invalidateQueries({ queryKey: ["admin-settings"] });
                      toast.success("Settings saved. Testing connection...");
                    } catch (e: any) {
                      toast.error("Save failed: " + e.message);
                      setSavingSmtp(false);
                      return;
                    }
                    setSavingSmtp(false);
                    // Now test
                    setTestingSmtp(true);
                    try {
                      const res = await fetch("/api/admin/settings/smtp-test", { method: "POST", credentials: "include" });
                      const data = await res.json();
                      if (data.ok) {
                        toast.success("✅ SMTP connection verified! Credentials are correct.");
                      } else {
                        toast.error("❌ SMTP test failed: " + (data.error || "Unknown error"));
                      }
                    } catch (e: any) {
                      toast.error("❌ SMTP test failed: " + e.message);
                    }
                    setTestingSmtp(false);
                  }}
                >
                  {testingSmtp ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
                  {testingSmtp ? "Testing..." : "Test Connection"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  Saves settings first, then verifies SMTP credentials without sending an email.
                </span>
              </div>
            </CardContent>
            <SaveBar onSave={() => save(["smtp.enabled", "smtp.host", "smtp.port", "smtp.username", "smtp.password", "smtp.senderName", "smtp.senderEmail"])} />
          </Card>
        </TabsContent>

        {/* Discount — margin-protected model */}
        <TabsContent value="discount">
          <Card className="admin-card">
            <CardHeader>
              <CardTitle className="text-base">Discount Settings</CardTitle>
              <CardDescription>
                Configure the cart-value threshold that releases reserve margin.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                <p className="font-medium">✓ Margin-Protected Discount Model</p>
                <p className="mt-1 text-emerald-700">
                  Each product has a <strong>Base Discount %</strong> (shown to
                  customer) and a <strong>Max Discount %</strong> (hard ceiling).
                  When the cart subtotal reaches the threshold below, eligible
                  products are automatically upgraded from Base to Max — releasing
                  your reserve margin without any coupon code.
                </p>
                <p className="mt-2 text-xs text-emerald-600">
                  Configure per-product discounts in <strong>Admin → Products →
                  Edit → Pricing</strong>. Vouchers (flat-amount deductions) are
                  managed in <strong>Admin → Vouchers</strong>.
                </p>
              </div>
              <Field label="Cart Subtotal Threshold for Discount Upgrade (Rs.)">
                <Input
                  type="number"
                  step="0.01"
                  value={form["discount.cartThresholdForUpgrade"] ?? 0}
                  onChange={(e) => set("discount.cartThresholdForUpgrade", parseFloat(e.target.value) || 0)}
                />
              </Field>
              <p className="text-xs text-muted-foreground">
                Set to 0 to disable the upgrade feature (products always stay at
                their Base Discount %). Example: set to 1500 → when cart subtotal
                reaches Rs. 1500, products with Max &gt; Base get upgraded to Max.
              </p>
            </CardContent>
            <SaveBar onSave={() => save(["discount.cartThresholdForUpgrade"])} />
          </Card>
        </TabsContent>

        {/* Invoice */}
        <TabsContent value="invoice">
          <Card className="admin-card">
            <CardHeader>
              <CardTitle className="text-base">Invoice</CardTitle>
              <CardDescription>Customize PDF invoice output.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field label="Invoice Prefix"><Input value={form["invoice.prefix"] || ""} onChange={(e) => set("invoice.prefix", e.target.value)} /></Field>
              <ToggleRow label="Show GST Number" checked={!!form["invoice.showGst"]} onChange={(v) => set("invoice.showGst", v)} />
              <Field label="Footer Note"><Textarea rows={3} value={form["invoice.footerNote"] || ""} onChange={(e) => set("invoice.footerNote", e.target.value)} /></Field>
            </CardContent>
            <SaveBar onSave={() => save(["invoice.prefix", "invoice.showGst", "invoice.footerNote"])} />
          </Card>
        </TabsContent>

        {/* SEO */}
        <TabsContent value="seo">
          <Card className="admin-card">
            <CardHeader>
              <CardTitle className="text-base">SEO / Meta</CardTitle>
              <CardDescription>Search engine and social share metadata.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field label="Title"><Input value={form["seo.title"] || ""} onChange={(e) => set("seo.title", e.target.value)} /></Field>
              <Field label="Description"><Textarea rows={3} value={form["seo.description"] || ""} onChange={(e) => set("seo.description", e.target.value)} /></Field>
              <Field label="Keywords (comma separated)"><Input value={form["seo.keywords"] || ""} onChange={(e) => set("seo.keywords", e.target.value)} /></Field>
            </CardContent>
            <SaveBar onSave={() => save(["seo.title", "seo.description", "seo.keywords"])} />
          </Card>
        </TabsContent>

        {/* Theme */}
        <TabsContent value="theme">
          <Card className="admin-card">
            <CardHeader>
              <CardTitle className="text-base">Theme</CardTitle>
              <CardDescription>Brand colors. (Theme recompile required to take full effect.)</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Primary Color">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form["theme.primaryColor"] || "#059669"}
                    onChange={(e) => set("theme.primaryColor", e.target.value)}
                    className="size-9 rounded border cursor-pointer"
                  />
                  <Input value={form["theme.primaryColor"] || ""} onChange={(e) => set("theme.primaryColor", e.target.value)} />
                </div>
              </Field>
              <Field label="Accent Color">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form["theme.accentColor"] || "#0d9488"}
                    onChange={(e) => set("theme.accentColor", e.target.value)}
                    className="size-9 rounded border cursor-pointer"
                  />
                  <Input value={form["theme.accentColor"] || ""} onChange={(e) => set("theme.accentColor", e.target.value)} />
                </div>
              </Field>
            </CardContent>
            <SaveBar onSave={() => save(["theme.primaryColor", "theme.accentColor"])} />
          </Card>
        </TabsContent>

        {/* Hero — comprehensive, fully-configurable hero section. */}
        <TabsContent value="hero">
          <HeroSettingsPanel
            value={form["hero.config"]}
            onChange={(v) => set("hero.config", v)}
          />
        </TabsContent>

        {/* Auth */}
        <TabsContent value="general">
          <Card className="admin-card">
            <CardHeader>
              <CardTitle className="text-base">Authentication</CardTitle>
              <CardDescription>OTP & verification rules.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field label="OTP Expiry (minutes)"><Input type="number" value={form["auth.otpExpiryMinutes"] ?? 10} onChange={(e) => set("auth.otpExpiryMinutes", parseInt(e.target.value) || 10)} /></Field>
              <ToggleRow
                label="Require OTP on Registration"
                checked={!!form["auth.requireOtpOnRegister"]}
                onChange={(v) => set("auth.requireOtpOnRegister", v)}
              />
              <ToggleRow
                label="Require OTP on Login"
                checked={!!form["auth.requireOtpOnLogin"]}
                onChange={(v) => set("auth.requireOtpOnLogin", v)}
              />
            </CardContent>
            <SaveBar onSave={() => save([
              "auth.otpExpiryMinutes", "auth.requireOtpOnRegister", "auth.requireOtpOnLogin",
            ])} />
          </Card>
        </TabsContent>

        {/* Notifications — Global Admin Email + alert toggles */}
        <TabsContent value="notifications">
          <Card className="admin-card">
            <CardHeader>
              <CardTitle className="text-base">Notification Settings</CardTitle>
              <CardDescription>
                Configure the Global Admin Email that receives all administrative notifications.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Global Admin Email */}
              <Field label="Global Admin Email">
                <Input
                  type="email"
                  placeholder="admin@pradeepmedical.com"
                  value={form["admin.notificationEmail"] || ""}
                  onChange={(e) => set("admin.notificationEmail", e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  All admin notifications (orders, prescriptions, manual requests, payment updates, system alerts)
                  are sent to this email. Use commas to send to multiple addresses.
                  {form["admin.notificationEmail"]
                    ? ""
                    : ` If empty, falls back to store email (${form["store.email"] || "not set"}).`}
                </p>
              </Field>

              {/* Master toggle */}
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <ToggleRow
                  label="Enable Email Alerts"
                  description="Master toggle — when off, no admin emails are sent (in-app bell still works)."
                  checked={!!form["admin.emailAlertsEnabled"]}
                  onChange={(v) => set("admin.emailAlertsEnabled", v)}
                />
              </div>

              {/* Per-type toggles */}
              <div className="space-y-2 pt-2 border-t">
                <p className="text-sm font-semibold">Alert Types</p>
                <ToggleRow
                  label="New Orders"
                  description="Email when a customer places a new order."
                  checked={!!form["admin.alertOnNewOrder"]}
                  onChange={(v) => set("admin.alertOnNewOrder", v)}
                />
                <ToggleRow
                  label="New Prescriptions"
                  description="Email when a customer uploads a prescription."
                  checked={!!form["admin.alertOnNewPrescription"]}
                  onChange={(v) => set("admin.alertOnNewPrescription", v)}
                />
                <ToggleRow
                  label="New Manual Requests"
                  description="Email when a customer submits a manual medicine request."
                  checked={!!form["admin.alertOnNewManualRequest"]}
                  onChange={(v) => set("admin.alertOnNewManualRequest", v)}
                />
                <ToggleRow
                  label="Order Status Updates"
                  description="Email when an order status is updated (confirmed, packed, delivered, etc.)."
                  checked={!!form["admin.alertOnOrderStatusUpdate"]}
                  onChange={(v) => set("admin.alertOnOrderStatusUpdate", v)}
                />
                <ToggleRow
                  label="Payment Updates"
                  description="Email when payment status changes (paid, failed, refunded)."
                  checked={!!form["admin.alertOnPaymentUpdate"]}
                  onChange={(v) => set("admin.alertOnPaymentUpdate", v)}
                />
                <ToggleRow
                  label="System Alerts"
                  description="Email on critical system errors and security alerts."
                  checked={!!form["admin.alertOnSystemAlert"]}
                  onChange={(v) => set("admin.alertOnSystemAlert", v)}
                />
              </div>

              {/* SMTP status indicator */}
              <div className="rounded-lg border p-3 text-sm">
                <p className="font-semibold mb-1">SMTP Status</p>
                {form["smtp.enabled"] && form["smtp.host"] && form["smtp.username"] ? (
                  <p className="text-emerald-700 flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    Configured — emails will be sent via {form["smtp.host"]} ({form["smtp.username"]})
                  </p>
                ) : (
                  <p className="text-amber-700 flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-amber-500" />
                    Not configured — notifications will be logged only (no emails sent).
                    Configure SMTP in the SMTP tab.
                  </p>
                )}
              </div>
            </CardContent>
            <SaveBar onSave={() => save([
              "admin.notificationEmail", "admin.emailAlertsEnabled",
              "admin.alertOnNewOrder", "admin.alertOnNewPrescription", "admin.alertOnNewManualRequest",
              "admin.alertOnOrderStatusUpdate", "admin.alertOnPaymentUpdate", "admin.alertOnSystemAlert",
            ])} />
          </Card>
        </TabsContent>

        {/* — Storage — provider-agnostic cloud storage configuration — */}
        <TabsContent value="storage">
          <StorageSettingsPanel />
        </TabsContent>

        {/* — AI — AI provider configuration — */}
        <TabsContent value="ai">
          <AiProviderPanel />
        </TabsContent>

          </div>
        </div>
      </Tabs>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}

function SecretField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      <div className="flex gap-2">
        <Input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
        />
        <Button type="button" variant="outline" size="icon" onClick={() => setShow((s) => !s)}>
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
      </div>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/70 bg-muted/30 dark:bg-muted/20 transition-colors hover:border-border">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {description && <div className="text-xs text-muted-foreground mt-0.5">{description}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function SaveBar({ onSave }: { onSave: () => void }) {
  const [saving, setSaving] = useState(false);
  async function handle() {
    setSaving(true);
    await onSave();
    setSaving(false);
  }
  return (
    <div className="border-t border-border/70 p-4 flex justify-end">
      <Button onClick={handle} disabled={saving} className="btn-premium">
        {saving ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Save className="size-4 mr-1" />}
        {saving ? "Saving..." : "Save Changes"}
      </Button>
    </div>
  );
}
