// ============================================================================
// File: src/components/admin/AdminLogin.tsx
// Purpose: Centered emerald-branded login card. On success, calls onLoggedIn
//          so the parent can swap to the dashboard.
// ============================================================================

"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, LogIn } from "lucide-react";
import { api, run } from "./api";

export function AdminLogin({ onLoggedIn }: { onLoggedIn: (admin: any) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Fetch public settings to display the dynamic store logo (with a static
  // /logo.png fallback in case settings haven't loaded yet or the admin
  // hasn't uploaded a custom logo).
  const { data: settings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: () => api<{ store?: { logo?: string; name?: string } }>("/api/settings/public"),
    staleTime: 60 * 1000,
  });
  const logoSrc = settings?.store?.logo || "/logo.png";
  const storeName = settings?.store?.name || "Pradeep Medical Store";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const admin = await run(() => api.post("/api/admin-auth/login", { email, password }), {
      success: "Welcome back!",
      error: "Login failed",
    });
    setLoading(false);
    if (admin) onLoggedIn(admin);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-emerald-50 via-background to-teal-50 p-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="flex flex-col items-center mb-6">
          <img
            src={logoSrc}
            alt={storeName}
            className="size-14 rounded-2xl object-cover shadow-lg mb-3"
          />
          <h1 className="text-2xl font-semibold text-foreground">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">PMS — v1.0</p>
        </div>

        <Card className="border-border/60 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ShieldCheck className="size-5 text-primary" />
              Admin Login
            </CardTitle>
            <CardDescription>Sign in to manage the pharmacy platform.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@pradeepmedical.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full" size="lg">
                {loading ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          PMS — Secure administration console.
        </p>
      </div>
    </div>
  );
}
