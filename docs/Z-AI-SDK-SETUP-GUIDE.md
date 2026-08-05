# Z.AI SDK Complete Setup Guide & Free AI API Alternatives

> **For:** PMS Pharmacy (Pradeep Medical Store)
> **Audience:** Beginners with no prior AI integration experience
> **Goal:** Get AI working on Vercel in under 10 minutes

---

## Part 1: Complete Z.AI SDK Setup Guide (Vercel)

---

### What is the Z.AI SDK?

The Z.AI SDK (`z-ai-web-dev-sdk`) is a JavaScript library that lets your application talk to Z.AI's AI servers. It powers these features in your pharmacy app:

| Feature | Where | What It Does |
|---------|-------|-------------|
| AI Health Assistant | Customer site (bottom-right widget) | Customers ask about medicines, get product suggestions |
| AI Product Generator | Admin → Products → Add → AI button | Auto-fills product name, composition, description |
| AI Marketing Generator | Admin → Marketing → AI Email Marketing | Generates email subject, body, and HTML |
| AI Push Notification Generator | Admin → App Notification Center | Generates notification title + message |
| AI Dashboard Insights | Admin → Dashboard | Business insights, sales forecast, inventory suggestions |
| AI Review Moderation | Admin → Reviews | Auto-flags spam/abuse in customer reviews |
| AI Review Reply | Admin → Reviews | Drafts professional replies to customer reviews |
| AI Product Image Search | Admin → Products → Gallery | Searches real product photos from pharmacy websites |

### How It Works (Simple Explanation)

```
Your App (Vercel)  →  Z.AI SDK  →  Z.AI Servers  →  AI Response  →  Your App
```

1. Your app calls `aiChatCompletion()` in `src/lib/ai-service.ts`
2. The SDK sends a request to `https://internal-api.z.ai/v1/chat/completions`
3. Z.AI servers process the request using AI models
4. The response comes back with generated text
5. Your app displays the result to the user

---

### Prerequisites

Before starting, you need:

1. **A Vercel account** (free at https://vercel.com)
2. **Your project deployed on Vercel** (see `pmsss.md` Section 7 for deployment guide)
3. **Access to Vercel Project Settings** (Settings → Environment Variables)

That's it. No API keys to purchase, no accounts to create on Z.AI.

---

### The 4-Level Configuration System

Your project loads AI configuration in this order. **The first source with valid config wins:**

```
Priority 1: Environment Variables (Z_AI_*)    ← Recommended for Vercel
    ↓ (if not set)
Priority 2: .z-ai-config file                 ← For local development
    ↓ (if not found)
Priority 3: Database Settings (Admin Panel)   ← Configure via UI
    ↓ (if not set)
Priority 4: Hardcoded Fallback                ← Already built into your code
```

**Important:** Priority 4 (hardcoded fallback) is **already configured** in your code. This means AI works out-of-the-box on Vercel **without any setup**. The steps below are for making it more explicit and maintainable.

---

### Step-by-Step Setup for Vercel

#### Step 1: Open Your Vercel Project Settings

1. Go to https://vercel.com and log in
2. Click on your project (PMS Pharmacy)
3. Click the **Settings** tab at the top
4. In the left sidebar, click **Environment Variables**

#### Step 2: Add Environment Variables

Add these 5 variables one by one. For each:
- Type the **Name** in the first box
- Paste the **Value** in the second box
- Select **Production** environment
- Click **Add**

| Name | Value |
|------|-------|
| `Z_AI_BASE_URL` | `https://internal-api.z.ai/v1` |
| `Z_AI_API_KEY` | `Z.ai` |
| `Z_AI_TOKEN` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiOWE3YmJkYmMtMGM5Zi00ODY5LWJiMGItNWI4OWE3MDc1MDVmIiwiY2hhdF9pZCI6ImNoYXQtYjM5MTY3MGYtYmRkYS00OGE0LWJmNWMtY2I2YWFmYzFiYzIwIiwicGxhdGZvcm0iOiJ6YWkifQ.ftfH1SXcnHwDgoSefRQBhBcDJWhX-ARMrhFy27sTNUk` |
| `Z_AI_CHAT_ID` | `chat-b391670f-bdda-48a4-bf5c-cb6aafc1bc20` |
| `Z_AI_USER_ID` | `9a7bbdbc-0c9f-4869-bb0b-5b89a707505f` |

> **What each variable does:**
> - `Z_AI_BASE_URL` — The Z.AI server address your app talks to
> - `Z_AI_API_KEY` — An identifier string (literally "Z.ai", not a secret key)
> - `Z_AI_TOKEN` — A JWT (JSON Web Token) that authenticates your requests. **This is the actual credential.** Without it, the Z.AI API returns 401 Unauthorized.
> - `Z_AI_CHAT_ID` — Identifies which chat session to use
> - `Z_AI_USER_ID` — Identifies your user account on Z.AI

#### Step 3: Redeploy Your Project

1. Go to the **Deployments** tab
2. Click the **three dots (...)** next to your latest deployment
3. Click **Redeploy**
4. Wait for the build to complete (usually 1-2 minutes)

#### Step 4: Verify AI is Working

1. Visit your deployed URL (e.g., `https://your-app.vercel.app`)
2. Click the **AI Health Assistant** widget (green button, bottom-right corner)
3. Type: `I have a fever`
4. Press Enter

**If you get a response** with medicine suggestions (like Calpol 500, Crocin) — AI is working! ✅

**If you get an error** — see the Troubleshooting section below.

#### Step 5: Verify Admin AI Features

1. Go to `https://your-app.vercel.app/admin`
2. Login with `admin@pradeepmedical.com` / `admin123`
3. Check the **Dashboard** — you should see "AI Business Insights" with 5 insights
4. Go to **Products** → **Add Product** → click the **AI** button — it should generate product content

---

### What If I Don't Configure Anything?

If you skip Steps 2-3 entirely, **AI will still work** because of Priority 4 (hardcoded fallback). The fallback includes the same token, chatId, and userId. The code in `src/lib/ai-service.ts` has all credentials built in.

Additionally, if the Z.AI SDK itself fails to initialize (e.g., ESM import issues on Vercel), the code automatically falls back to a **direct `fetch()` call** that bypasses the SDK and constructs the HTTP request manually. This dual-fallback system ensures AI works reliably in production.

---

### Common Errors and How to Fix Them

#### Error: "Failed to parse URL from Z.ai/chat/completions"

**Cause:** The Z.AI SDK failed to initialize, and the code couldn't load a valid `baseUrl`.

**Fix:** This is already fixed in your code. The `zaiChat()` function has a try/catch that falls back to a direct `fetch()` call. If you still see this error:
1. Check that `Z_AI_BASE_URL` is set to `https://internal-api.z.ai/v1` (not just `Z.ai`)
2. Redeploy after adding the env vars

#### Error: "AI insights temporarily unavailable"

**Cause:** The Z.AI API call failed (usually missing `token`).

**Fix:**
1. Ensure `Z_AI_TOKEN` is set in Vercel env vars
2. The token value is the long `eyJhbGci...` string
3. Redeploy

#### Error: 401 Unauthorized

**Cause:** The `token` JWT is missing, expired, or invalid.

**Fix:**
1. Verify `Z_AI_TOKEN` env var is set
2. The token starts with `eyJ` and is very long
3. If expired, you'll need to get a fresh token from the Z.AI platform

#### Error: Timeout / no response after 30 seconds

**Cause:** Z.AI servers are slow or unreachable.

**Fix:**
1. Try again in a few minutes
2. Check Vercel function logs for details
3. The code has a 30-second timeout — if Z.AI is slow, the request will fail gracefully

#### Error: "AI service is disabled"

**Cause:** The AI provider was disabled in the admin panel.

**Fix:**
1. Login to admin panel
2. Go to Settings → AI tab
3. Ensure "Enabled" toggle is ON
4. Ensure provider is "Z.AI SDK (Default)"

---

### Best Practices for Production

1. **Always set env vars on Vercel** (Priority 1) — don't rely solely on the hardcoded fallback
2. **Monitor Vercel function logs** — check for AI errors after each deployment
3. **Test AI after every deployment** — send a test message to the Health Assistant
4. **Don't commit `.z-ai-config` to git** — it's in `.gitignore` for security
5. **The token JWT may expire** — if AI stops working after months, the token might need refreshing
6. **Vercel function timeout** — AI calls can take 3-10 seconds. Set `maxDuration = 60` on AI routes (already done in your code)

---

### Troubleshooting Tips

| Problem | What to Check |
|---------|--------------|
| AI not responding | Vercel logs → look for `[ai-service]` errors |
| 401 errors | `Z_AI_TOKEN` env var is set and starts with `eyJ` |
| Empty AI insights | Dashboard AI insights route has a 5-minute cache — wait or use `?refresh=1` |
| Health Assistant shows error | Check browser console for fetch errors |
| Product generator fails | Check Vercel function timeout (should be 60s) |
| All AI features broken | Verify `Z_AI_BASE_URL` = `https://internal-api.z.ai/v1` |

---

## Part 2: Free AI API Alternatives

If you want to use a different AI provider instead of Z.AI, your project supports **OpenAI-compatible APIs** via the Admin Panel → Settings → AI tab. Here are the best free options:

---

### 1. Google Gemini (Free Tier) — ⭐ Best Overall

| Feature | Details |
|---------|---------|
| **Free tier** | Yes — generous free tier |
| **API key required** | Yes (free to get) |
| **Free limits** | 15 requests/minute, 1500 requests/day (Gemini 1.5 Flash) |
| **Models** | Gemini 1.5 Flash (fast), Gemini 1.5 Pro (powerful), Gemini 2.0 Flash |
| **Ease of integration** | Very easy — your project already supports it |
| **Documentation** | Excellent — https://ai.google.dev/docs |
| **Works with Vercel** | Yes — fully compatible |
| **Setup time** | 5 minutes |

**How to set up in your project:**

1. Get a free API key at https://aistudio.google.com/apikey
2. Login to Admin Panel → Settings → AI tab
3. Change provider to "Google Gemini (OpenAI-compatible)"
4. Enter your API key
5. Set base URL to `https://generativelanguage.googleapis.com/v1beta/openai`
6. Set model to `gemini-1.5-flash`
7. Save

**Advantages:**
- Completely free for development and small production
- Very fast responses (1-3 seconds)
- Excellent quality for pharmacy/medical questions
- No credit card required to start

**Limitations:**
- 15 requests/minute rate limit (sufficient for most pharmacies)
- Free tier may change in the future

---

### 2. Groq (Free Tier) — ⭐ Fastest

| Feature | Details |
|---------|---------|
| **Free tier** | Yes — free developer tier |
| **API key required** | Yes (free to get) |
| **Free limits** | 30 requests/minute, 14,400 requests/day |
| **Models** | Llama 3.1 8B, Llama 3.1 70B, Mixtral 8x7B, Gemma 2 9B |
| **Ease of integration** | Very easy — OpenAI-compatible |
| **Documentation** | Good — https://docs.groq.com |
| **Works with Vercel** | Yes |
| **Setup time** | 3 minutes |

**How to set up:**

1. Get a free API key at https://console.groq.com
2. Admin Panel → Settings → AI tab
3. Provider: "Groq"
4. API key: your Groq key
5. Base URL: `https://api.groq.com/openai/v1`
6. Model: `llama-3.1-8b-instant`
7. Save

**Advantages:**
- Extremely fast (responses in 0.5-1 second)
- Generous free limits
- Multiple open-source models
- No credit card required

**Limitations:**
- Smaller models than GPT-4 (but sufficient for pharmacy use)
- Rate limits may apply during peak hours

---

### 3. Z.AI SDK (Built-in) — ⭐ Zero Setup

| Feature | Details |
|---------|---------|
| **Free tier** | Yes — completely free (uses the Z.AI platform) |
| **API key required** | No — hardcoded fallback works without any keys |
| **Free limits** | Based on Z.AI platform quota |
| **Models** | Z.AI's internal models |
| **Ease of integration** | Already integrated — zero setup needed |
| **Documentation** | This guide |
| **Works with Vercel** | Yes — with direct fetch fallback |
| **Setup time** | 0 minutes (already configured) |

**Advantages:**
- Zero configuration needed
- Already integrated with all 8 AI features
- Dual fallback system (SDK + direct fetch)
- No API key to manage

**Limitations:**
- Token JWT may expire (unknown expiry time)
- Dependent on Z.AI platform availability
- No control over model selection

---

### 4. Cloudflare Workers AI (Free Tier)

| Feature | Details |
|---------|---------|
| **Free tier** | Yes — 10,000 neurons/day free |
| **API key required** | Yes (Cloudflare account) |
| **Free limits** | 10,000 neurons/day (roughly 1000-2000 requests) |
| **Models** | Llama 2, Mistral 7B, Gemma 7B, and more |
| **Ease of integration** | Medium — requires Cloudflare account setup |
| **Documentation** | Good — https://developers.cloudflare.com/workers-ai/ |
| **Works with Vercel** | Yes (via REST API) |

**How to set up:**

1. Create a free Cloudflare account at https://dash.cloudflare.com
2. Go to Workers & Pages → AI → Get API token
3. Admin Panel → Settings → AI tab
4. Provider: "OpenAI-compatible"
5. API key: your Cloudflare token
6. Base URL: `https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/v1`
7. Model: `@cf/meta/llama-3.1-8b-instruct`
8. Save

**Advantages:**
- Generous free tier
- Multiple models
- Global edge network (fast everywhere)

**Limitations:**
- More complex setup (need account ID in URL)
- Models are smaller than GPT-4

---

### 5. Ollama (Self-hosted, Completely Free)

| Feature | Details |
|---------|---------|
| **Free tier** | Yes — 100% free, runs on your own machine |
| **API key required** | No |
| **Free limits** | Unlimited (limited by your hardware) |
| **Models** | Llama 3.1, Mistral, Phi-3, Gemma, and 100+ more |
| **Ease of integration** | Medium — requires running Ollama on a server |
| **Documentation** | Excellent — https://ollama.com |
| **Works with Vercel** | No (needs a server with GPU/CPU) — works on VPS/Docker |

**How to set up (on a VPS):**

1. Install Ollama on your server: `curl -fsSL https://ollama.com/install.sh | sh`
2. Pull a model: `ollama pull llama3.1`
3. Admin Panel → Settings → AI tab
4. Provider: "Ollama (self-hosted)"
5. Base URL: `http://your-server-ip:11434/v1`
6. Model: `llama3.1`
7. Save

**Advantages:**
- Completely free, no limits
- Full privacy (data never leaves your server)
- Choose from 100+ models
- No rate limits

**Limitations:**
- Requires a server (VPS, Docker, or local machine)
- Slower than cloud APIs (depends on your hardware)
- Not compatible with Vercel (needs a running server)
- Uses significant RAM (4-8GB for 8B models)

---

### 6. Hugging Face Inference API (Free Tier)

| Feature | Details |
|---------|---------|
| **Free tier** | Yes — limited free tier |
| **API key required** | Yes (free to get) |
| **Free limits** | ~1000 requests/day (varies by model) |
| **Models** | 100,000+ open-source models |
| **Ease of integration** | Medium — not fully OpenAI-compatible (needs adapter) |
| **Documentation** | Good — https://huggingface.co/docs/api-inference |
| **Works with Vercel** | Yes |

**Advantages:**
- Massive model selection
- Free tier available
- Great for experimentation

**Limitations:**
- Not natively OpenAI-compatible (would need code changes in your project)
- Free tier can be slow (cold starts)
- Rate limited

---

### Comparison Table

| Provider | Free? | Speed | Quality | Setup | Vercel? | Best For |
|----------|-------|-------|---------|-------|---------|----------|
| **Z.AI SDK** | ✅ | Medium | Good | 0 min | ✅ | Zero-config default |
| **Google Gemini** | ✅ | Fast | Excellent | 5 min | ✅ | Best free option |
| **Groq** | ✅ | Very Fast | Good | 3 min | ✅ | Speed-critical apps |
| **Cloudflare AI** | ✅ | Fast | Good | 10 min | ✅ | Edge computing |
| **Ollama** | ✅ | Slow-Med | Good | 15 min | ❌ | Privacy + unlimited |
| **Hugging Face** | ✅ | Slow | Variable | 15 min | ✅ | Experimentation |

---

### Recommendation for Your Pharmacy Project

1. **Start with Z.AI SDK** (already configured) — zero setup, works immediately
2. **If you need more reliability**, switch to **Google Gemini** — free, fast, excellent quality
3. **If you need maximum speed**, switch to **Groq** — fastest free option
4. **If you need full control**, set up **Ollama** on a VPS

To switch providers, simply go to **Admin Panel → Settings → AI tab** and change the provider. No code changes needed (except for Hugging Face, which would need a custom adapter).

---

## Quick Setup Summary

### Option A: Z.AI SDK (Default — No Setup Needed)

```
✅ Already configured in your code
✅ Works on Vercel out of the box
✅ Zero configuration required
```

### Option B: Google Gemini (5-Minute Setup)

```
1. Get API key: https://aistudio.google.com/apikey
2. Admin → Settings → AI → Provider: "Google Gemini"
3. Enter API key, base URL, model
4. Save → Done!
```

### Option C: Groq (3-Minute Setup)

```
1. Get API key: https://console.groq.com
2. Admin → Settings → AI → Provider: "Groq"
3. Enter API key, base URL, model
4. Save → Done!
```

---

*This guide is based on the actual implementation of the PMS Pharmacy project. For code-level details, see `src/lib/ai-service.ts`. For deployment instructions, see `pmsss.md`.*
