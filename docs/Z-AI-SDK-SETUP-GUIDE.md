# Z.AI SDK Integration — Setup Guide for Vercel Production

This guide explains how the Z.AI SDK is configured in the PMS Pharmacy project and how to ensure it works correctly in production on Vercel.

---

## How the AI Integration Works

The project uses the `z-ai-web-dev-sdk` package to power AI features:
- AI Health Assistant (customer chatbot)
- AI Product Generator (admin product creation)
- AI Marketing Generator (admin email marketing)
- AI Push Notification Generator
- AI Dashboard Insights (business analytics)
- AI Review Moderation + Reply

All AI calls go through a single entry point: `src/lib/ai-service.ts`.

---

## Configuration Priority (4 levels)

The SDK loads its configuration in this order. The first source that provides valid config wins:

| Priority | Source | Where it works | How to configure |
|----------|--------|---------------|-----------------|
| **1** | Environment variables | Vercel (recommended) | Set in Vercel Project Settings → Environment Variables |
| **2** | `.z-ai-config` file | Local dev / Docker | Place file at project root, home dir, or `/etc/` |
| **3** | Database settings | Anywhere | Admin Panel → Settings → AI tab |
| **4** | Hardcoded fallback | Anywhere (zero-config) | Already built into `ai-service.ts` |

### Priority 1: Environment Variables (RECOMMENDED for Vercel)

Set these in your Vercel project:

```
Z_AI_BASE_URL=https://internal-api.z.ai/v1
Z_AI_API_KEY=Z.ai
Z_AI_TOKEN=your-jwt-token-here
Z_AI_CHAT_ID=your-chat-id
Z_AI_USER_ID=your-user-id
```

**Where to set them:**
1. Go to your Vercel dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Add each variable above
5. Redeploy your project

### Priority 2: `.z-ai-config` File (for local development)

Create a file named `.z-ai-config` in your project root:

```json
{
  "baseUrl": "https://internal-api.z.ai/v1",
  "apiKey": "Z.ai",
  "chatId": "your-chat-id",
  "token": "your-jwt-token",
  "userId": "your-user-id"
}
```

The SDK looks for this file in 3 locations (in order):
1. Project root (`./.z-ai-config`)
2. Home directory (`~/.z-ai-config`)
3. System-wide (`/etc/.z-ai-config`)

**Important:** Add `.z-ai-config` to your `.gitignore` to avoid committing secrets.

### Priority 3: Database Settings

Configure via Admin Panel → Settings → AI tab:
- Set the provider to "Z.AI SDK"
- Enter the API key, base URL, chat ID, user ID, and token
- These are stored in the `Setting` table and loaded on every request

### Priority 4: Hardcoded Fallback (Zero-Config)

If none of the above are configured, the code falls back to hardcoded credentials built into `src/lib/ai-service.ts`. This includes:
- `baseUrl`: `https://internal-api.z.ai/v1`
- `apiKey`: `"Z.ai"` (identifier, not a real key)
- `chatId`: The sandbox chat session ID
- `userId`: The sandbox user ID
- `token`: The JWT auth token (required for API authentication)

**This fallback ensures AI works out-of-the-box on Vercel without any configuration.**

---

## The `token` Field (CRITICAL)

The `token` is a JWT (JSON Web Token) that authenticates requests to the Z.AI API. Without it, the API returns 401 Unauthorized.

- The `apiKey: "Z.ai"` is just an identifier string — it's NOT a real API key
- The `token` JWT is sent as the `X-Token` HTTP header by the SDK
- Without `token`, every AI request fails silently

**If you're using Priority 1 (env vars):** Make sure to set `Z_AI_TOKEN`.
**If you're using Priority 2 (file):** Make sure the JSON includes `"token"`.
**If you're using Priority 4 (fallback):** The token is already included.

---

## How to Verify AI is Working

### In Development

1. Start the dev server: `bun run dev`
2. Open the customer site and click the AI Health Assistant widget (bottom-right)
3. Send a message like "I have a fever"
4. If you get a response with product suggestions, AI is working

### In Production (Vercel)

1. Visit your deployed URL
2. Open the AI Health Assistant widget
3. Send a test message
4. Check Vercel function logs for any errors

### Admin AI Features

1. Login as admin
2. Go to Dashboard — check if "AI Business Insights" section shows insights
3. Go to Products → Add Product → try the AI Content Generator
4. Go to Marketing → AI Email Marketing → try generating content

---

## Common Errors and Solutions

### Error: "AI insights temporarily unavailable"

**Cause:** The Z.AI API call failed (likely missing `token`).
**Fix:** Ensure the `token` JWT is configured (Priority 1-4 above).

### Error: 401 Unauthorized

**Cause:** The `token` field is missing or expired.
**Fix:** Get a fresh token from your Z.AI dashboard and update the configuration.

### Error: "Failed to construct ZAI instance"

**Cause:** The SDK couldn't load any configuration.
**Fix:** Check that at least one priority source provides valid config.

### Error: Timeout / no response

**Cause:** The Z.AI API is slow or unreachable.
**Fix:** The code has a 30-second timeout for OpenAI-compatible calls. Z.AI SDK calls don't have a timeout — if the API hangs, the request will wait until Vercel's function timeout.

---

## Production Testing Checklist

- [ ] Environment variables set in Vercel (if using Priority 1)
- [ ] `.z-ai-config` file NOT committed to git (check `.gitignore`)
- [ ] AI Health Assistant responds to customer messages
- [ ] Admin Dashboard shows AI insights (not empty)
- [ ] AI Product Generator creates product content
- [ ] AI Marketing Generator creates email content
- [ ] AI Push Notification Generator creates notification drafts
- [ ] AI Review Moderation works on new reviews
- [ ] No 401 errors in Vercel function logs

---

## File Locations

| File | Purpose |
|------|---------|
| `src/lib/ai-service.ts` | Main AI service — config loading, SDK initialization, chat/image APIs |
| `src/lib/ai-knowledge-layer.ts` | Pharmacy knowledge base for the health assistant |
| `src/app/api/health-assistant/route.ts` | Customer AI chatbot endpoint |
| `src/app/api/admin/ai/generate-product/route.ts` | Admin AI product generator |
| `src/app/api/admin/ai/generate-marketing/route.ts` | Admin AI marketing generator |
| `src/app/api/admin/dashboard/ai-insights/route.ts` | AI dashboard insights |
| `src/app/api/admin/app-notifs/generate/route.ts` | AI push notification generator |
| `src/app/api/admin/reviews/[id]/ai-moderate/route.ts` | AI review moderation |
| `src/app/api/admin/reviews/[id]/ai-reply/route.ts` | AI review reply generator |
| `.z-ai-config.example` | Template for the `.z-ai-config` file |
| `docs/Z-AI-SDK-SETUP-GUIDE.md` | This file |
