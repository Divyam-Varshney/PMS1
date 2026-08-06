// ============================================================================
// File: src/components/admin/ai-provider-panel.tsx
// Purpose: AI Provider settings panel — embedded in Admin → Settings → AI tab.
//          Lets admin select AI provider, enter API key, test connection, and
//          save configuration. All AI features use the selected provider.
// ============================================================================

"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, run } from "./api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Brain, Save, Loader2, CheckCircle2, XCircle, Eye, EyeOff, Zap, Key, Globe } from "lucide-react";
import { toast } from "sonner";

interface AIConfig {
  provider: string;
  providerId: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
}

interface ProviderOption {
  providerId: string;
  label: string;
  provider: string;
  needsKey: boolean;
  needsBaseUrl: boolean;
  defaultModel: string;
  defaultBaseUrl: string;
}

const PROVIDERS: ProviderOption[] = [
  { providerId: "z-ai-sdk", label: "Z.AI SDK (Default — no API key needed)", provider: "z-ai-sdk", needsKey: false, needsBaseUrl: false, defaultModel: "", defaultBaseUrl: "" },
  { providerId: "openai", label: "OpenAI", provider: "openai-compatible", needsKey: true, needsBaseUrl: false, defaultModel: "gpt-4o-mini", defaultBaseUrl: "https://api.openai.com/v1" },
  { providerId: "gemini", label: "Google Gemini", provider: "openai-compatible", needsKey: true, needsBaseUrl: true, defaultModel: "gemini-1.5-flash", defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai" },
  { providerId: "claude", label: "Anthropic Claude", provider: "openai-compatible", needsKey: true, needsBaseUrl: true, defaultModel: "claude-3-haiku-20240307", defaultBaseUrl: "https://api.anthropic.com/v1" },
  { providerId: "groq", label: "Groq", provider: "openai-compatible", needsKey: true, needsBaseUrl: true, defaultModel: "llama-3.1-8b-instant", defaultBaseUrl: "https://api.groq.com/openai/v1" },
  { providerId: "openrouter", label: "OpenRouter", provider: "openai-compatible", needsKey: true, needsBaseUrl: true, defaultModel: "openai/gpt-4o-mini", defaultBaseUrl: "https://openrouter.ai/api/v1" },
  { providerId: "deepseek", label: "DeepSeek", provider: "openai-compatible", needsKey: true, needsBaseUrl: true, defaultModel: "deepseek-chat", defaultBaseUrl: "https://api.deepseek.com/v1" },
  { providerId: "mistral", label: "Mistral", provider: "openai-compatible", needsKey: true, needsBaseUrl: true, defaultModel: "mistral-tiny", defaultBaseUrl: "https://api.mistral.ai/v1" },
  { providerId: "ollama", label: "Ollama (self-hosted)", provider: "openai-compatible", needsKey: false, needsBaseUrl: true, defaultModel: "llama3", defaultBaseUrl: "http://localhost:11434/v1" },
  { providerId: "lm-studio", label: "LM Studio (local)", provider: "openai-compatible", needsKey: false, needsBaseUrl: true, defaultModel: "local-model", defaultBaseUrl: "http://localhost:1234/v1" },
  { providerId: "custom", label: "Custom OpenAI-Compatible API", provider: "openai-compatible", needsKey: true, needsBaseUrl: true, defaultModel: "", defaultBaseUrl: "" },
];

export function AiProviderPanel() {
  const qc = useQueryClient();
  const [config, setConfig] = useState<AIConfig>({
    provider: "z-ai-sdk",
    providerId: "z-ai-sdk",
    apiKey: "",
    baseUrl: "",
    model: "",
    enabled: true,
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [showKey, setShowKey] = useState(false);

  // Load config from DB
  const { data } = useQuery({
    queryKey: ["ai-config"],
    queryFn: () => api.get<AIConfig & { _maskedKey?: string }>("/api/admin/ai/providers"),
  });

  useEffect(() => {
    if (data) {
      setConfig({
        provider: data.provider || "z-ai-sdk",
        providerId: data.providerId || "z-ai-sdk",
        apiKey: data.apiKey || "",
        baseUrl: data.baseUrl || "",
        model: data.model || "",
        enabled: data.enabled ?? true,
      });
    }
  }, [data]);

  const selectedProvider = PROVIDERS.find((p) => p.providerId === config.providerId);

  function updateField(field: keyof AIConfig, value: any) {
    setConfig((prev) => ({ ...prev, [field]: value }));
    setTestResult(null);
  }

  // Provider profiles — stores each provider's config separately so switching
  // back to a previously configured provider restores its settings automatically.
  const [profiles, setProfiles] = useState<Record<string, { apiKey: string; baseUrl: string; model: string }>>({});

  // Load profiles from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("pms_ai_profiles");
      if (stored) setProfiles(JSON.parse(stored));
    } catch {}
  }, []);

  // Save profiles to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem("pms_ai_profiles", JSON.stringify(profiles));
    } catch {}
  }, [profiles]);

  function selectProvider(providerId: string) {
    const p = PROVIDERS.find((x) => x.providerId === providerId);
    if (!p) return;

    // Save current provider's config to its profile before switching
    setProfiles((prev) => {
      const updated = { ...prev };
      // Only save if there's meaningful data (API key or model set)
      if (config.apiKey || config.model) {
        updated[config.providerId] = {
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          model: config.model,
        };
      }
      return updated;
    });

    // Load the newly selected provider's saved profile (if exists)
    const savedProfile = profiles[providerId];

    setConfig((prev) => ({
      ...prev,
      providerId: p.providerId,
      provider: p.provider,
      // Restore from saved profile, or use defaults
      apiKey: savedProfile?.apiKey || "",
      baseUrl: savedProfile?.baseUrl || p.defaultBaseUrl,
      model: savedProfile?.model || p.defaultModel,
    }));
    setTestResult(null);
  }

  async function save() {
    setSaving(true);
    const r = await run(
      () => api.put("/api/admin/ai/providers", { config }),
      { success: "AI configuration saved", error: "Save failed", silent: true }
    );
    setSaving(false);
    if (r) {
      // Also save the current provider's profile locally
      if (config.apiKey || config.model) {
        setProfiles((prev) => ({
          ...prev,
          [config.providerId]: {
            apiKey: config.apiKey,
            baseUrl: config.baseUrl,
            model: config.model,
          },
        }));
      }
      toast.success("AI configuration saved");
      qc.invalidateQueries({ queryKey: ["ai-config"] });
    }
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api.post<{ ok: boolean; message: string; model?: string }>("/api/admin/ai/providers/test", {
        provider: config.provider,
        providerId: config.providerId,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model,
      });
      setTestResult({ ok: r.ok, message: r.message });
      if (r.ok) {
        toast.success("Connection successful!", { description: r.message });
      } else {
        toast.error("Connection failed", { description: r.message });
      }
    } catch (e: any) {
      const msg = e?.message || "Test failed";
      setTestResult({ ok: false, message: msg });
      toast.error("Connection failed", { description: msg });
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="size-4 text-amber-600 dark:text-amber-400" /> AI Integration
        </CardTitle>
        <CardDescription>
          Configure the AI provider used for product generation, image search, and the customer health assistant.
          The Z.AI SDK works without an API key — perfect for testing before purchasing a commercial API.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Enable/Disable */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-amber-500" />
            <div>
              <p className="text-sm font-medium">AI Features {config.enabled ? "Enabled" : "Disabled"}</p>
              <p className="text-xs text-muted-foreground">Toggle to enable/disable all AI features</p>
            </div>
          </div>
          <Switch checked={config.enabled} onCheckedChange={(v) => updateField("enabled", v)} />
        </div>

        {/* Provider Selector */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium flex items-center gap-1">
            <Brain className="size-3" /> AI Provider
          </Label>
          <Select value={config.providerId} onValueChange={selectProvider}>
            <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
            <SelectContent>
              {PROVIDERS.map((p) => (
                <SelectItem key={p.providerId} value={p.providerId}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* API Key (if needed) */}
        {selectedProvider?.needsKey && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1">
              <Key className="size-3" /> API Key
            </Label>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                value={config.apiKey}
                onChange={(e) => updateField("apiKey", e.target.value)}
                placeholder="Enter your API key"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
        )}

        {/* Base URL (if needed) */}
        {selectedProvider?.needsBaseUrl && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1">
              <Globe className="size-3" /> Base URL
            </Label>
            <Input
              value={config.baseUrl}
              onChange={(e) => updateField("baseUrl", e.target.value)}
              placeholder={selectedProvider.defaultBaseUrl || "https://api.example.com/v1"}
            />
          </div>
        )}

        {/* Model Name */}
        {config.provider !== "z-ai-sdk" && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Model Name</Label>
            <Input
              value={config.model}
              onChange={(e) => updateField("model", e.target.value)}
              placeholder={selectedProvider?.defaultModel || "gpt-4o-mini"}
            />
          </div>
        )}

        {/* Test result */}
        {testResult && (
          <div className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
            testResult.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
          }`}>
            {testResult.ok ? <CheckCircle2 className="size-4 shrink-0" /> : <XCircle className="size-4 shrink-0" />}
            <span className="text-xs">{testResult.message}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={testConnection} disabled={testing || !config.enabled}>
            {testing ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Zap className="size-3.5 mr-1" />}
            {testing ? "Testing..." : "Test Connection"}
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Save className="size-3.5 mr-1" />}
            {saving ? "Saving..." : "Save Configuration"}
          </Button>
        </div>

        {/* Provider info */}
        {config.providerId === "z-ai-sdk" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30 p-3">
            <p className="text-xs text-amber-800 dark:text-amber-300">
              <strong>Z.AI SDK</strong> is the default provider — no API key required.
              It uses an embedded authentication token baked into the npm package.
              Perfect for testing on Vercel before purchasing a commercial API key.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
