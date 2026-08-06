# Z.AI SDK — Production Setup Guide

## Can Z.AI SDK Be Used in Production on Vercel?

**No, not directly.** Here's the honest, technical explanation:

### The Problem

The Z.AI SDK uses the endpoint `https://internal-api.z.ai/v1`. This domain resolves to **private IP addresses** (172.25.x.x) that are only reachable from within the Z.AI sandbox network.

```
DNS lookup: internal-api.z.ai → 172.25.136.213, 172.25.150.234
```

These are RFC 1918 private IPs. Vercel's servers (and any public internet server) **cannot connect to them**. The connection times out after 10 seconds with:

```
ConnectTimeoutError: Connect Timeout Error
(attempted addresses: 172.25.150.234:443, 172.25.136.213:443, timeout: 10000ms)
```

The name "internal-api" is literal — it's an internal API accessible only from the Z.AI platform's own network.

### What This Means

- **Local development (in the Z.AI sandbox):** Z.AI SDK works perfectly — the sandbox is on the same network.
- **Production (Vercel, or any public server):** Z.AI SDK fails — the endpoint is unreachable.

### Recommended Production Solution

Use a **publicly accessible AI provider** for production. The project supports any OpenAI-compatible provider:

#### Option 1: Groq (Free, Recommended)

1. Go to https://console.groq.com → Create account → API Keys → Create Key
2. Copy your API key (starts with `gsk_`)
3. In your Vercel project, add environment variables:
   - `OPENAI_API_KEY` = your Groq API key
   - `OPENAI_BASE_URL` = `https://api.groq.com/openai/v1`
   - `OPENAI_MODEL` = `llama-3.1-8b-instant`
4. Deploy

#### Option 2: Google Gemini (Free)

1. Go to https://aistudio.google.com/apikey → Create API key
2. Copy your API key (starts with `AIza...`)
3. In your Vercel project, add environment variables:
   - `OPENAI_API_KEY` = your Gemini API key
   - `OPENAI_BASE_URL` = `https://generativelanguage.googleapis.com/v1beta/openai`
   - `OPENAI_MODEL` = `gemini-1.5-flash`
4. Deploy

**Note:** Gemini may not work from all geographic regions. If you get "User location is not supported," use Groq instead.

#### Option 3: OpenAI (Paid)

1. Go to https://platform.openai.com → API Keys → Create new key
2. Copy your API key (starts with `sk-`)
3. In your Vercel project, add:
   - `OPENAI_API_KEY` = your OpenAI API key
   - `OPENAI_MODEL` = `gpt-4o-mini` (or `gpt-3.5-turbo` for lower cost)
4. Deploy

### Alternative: Configure via Admin Panel

Instead of environment variables, you can configure the AI provider after deployment:

1. Visit your deployed app → `/admin` → Login
2. Go to Settings → AI Integration
3. Select your provider (Groq, Gemini, OpenAI, etc.)
4. Enter your API key
5. Select your model
6. Click "Test Connection" → should show "Connected successfully"
7. Click "Save Configuration"

### How to Verify AI is Working

1. Open your deployed app
2. Click the AI Health Assistant widget (bottom-right corner)
3. Send a message like "I have a fever"
4. If you get a response with medicine suggestions → AI is working

### Provider Profiles (Smart Switching)

The admin panel now saves each provider's configuration separately. When you switch between providers (e.g., from Groq to Gemini and back), the previously saved API key, model, and settings are automatically restored. You never need to re-enter credentials.

### Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| "Connect Timeout Error" | Z.AI internal API not reachable from Vercel | Use Groq or Gemini instead |
| "403 Forbidden" | Invalid or expired API key | Generate a new key from the provider's dashboard |
| "User location is not supported" | Gemini doesn't support your region | Use Groq instead (works globally) |
| "Model not found" | Invalid model name | Use a valid model name (e.g., `llama-3.1-8b-instant` for Groq) |
| "Rate limit exceeded" | Too many requests per minute | Wait 60 seconds, then retry |

### Summary

| Environment | Recommended Provider | Why |
|-------------|---------------------|-----|
| **Local dev (sandbox)** | Z.AI SDK | Works via internal network, zero config |
| **Production (Vercel)** | Groq | Free, fast, works globally |
| **Production (Vercel)** | Gemini | Free, excellent quality (if region supported) |
| **Production (Vercel)** | OpenAI | Paid, highest quality |

The code automatically handles provider switching. All 8 AI features (Health Assistant, Product Generator, Image Search, Marketing, Notifications, Dashboard Insights, Review Moderation, Review Reply) use the centralized `aiChatCompletion()` function, which routes to the correct provider based on your settings.
