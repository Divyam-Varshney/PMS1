# AI Features Audit — PMS (Pradeep Medical Store)

## Currently Integrated AI Features (4)

### 1. AI Health Assistant (Customer Chatbot)
**What it does**: AI-powered chatbot that answers customer questions about medicines, health topics, store services, and delivery. Includes medical disclaimers.

**Where it's used**: Customer portal — floating chat widget on every customer page

**How it works**:
1. Customer types a question in the chat widget
2. Frontend sends `POST /api/health-assistant` with messages
3. API calls `aiChatCompletion()` from `src/lib/ai-service.ts`
4. The centralized service routes to the active AI provider (default: Z.AI SDK)
5. System prompt configures the AI as "PMS Assistant" with store details + medical disclaimers
6. Response returned to the chat widget

**AI Provider**: Configurable via Admin → Settings → AI tab (default: Z.AI SDK, no API key needed)

### 2. Search Product Images (Admin)
**What it does**: Searches trusted pharmacy websites (Amazon, Apollo, 1mg, PharmEasy, Netmeds, Google) for REAL product packaging photos. Auto-reads the product title from the form.

**Where it's used**: Admin → Products → Add/Edit → Gallery tab

**How it works**:
1. Product title is auto-detected from the form
2. Admin selects a source (or uses default: Google all sources)
3. API calls `searchProductImages()` from `src/lib/ai-service.ts`
4. Z.AI SDK's `images.search.create()` searches the web
5. Results filtered to only include images from the selected source
6. Results displayed grouped by source website
7. Admin selects images → uploaded to product gallery

**AI Provider**: Z.AI SDK (image search API — only provider that supports this)

### 3. AI Product Generator (Admin)
**What it does**: Given just a product title, generates ALL product fields automatically using AI. Auto-creates brand and category if they don't exist.

**Where it's used**: Admin → Products → Add/Edit → Basic Info tab → "Generate with AI" button

**How it works**:
1. Admin enters product title (e.g., "Glyxambi 25mg/5mg Tablet")
2. Clicks "Generate with AI"
3. API fetches existing brands + categories from DB
4. AI is prompted with the title + existing brands/categories list
5. AI returns structured JSON with: slug, SKU, HSN, description, composition, generic name, manufacturer, brand, category, unit, pack size, MRP, selling price, prescription flag, generic flag, SEO fields
6. If suggested brand exists → auto-selected. If not → auto-created.
7. If suggested category exists → auto-selected. If not → auto-created.
8. All fields applied to the form for admin review

**AI Provider**: Configurable (default: Z.AI SDK)

### 4. AI Provider Management (Admin Settings)
**What it does**: Centralized AI provider configuration. Admin can select from 11 providers, enter API key, test connection, and save.

**Where it's used**: Admin → Settings → AI tab

**Supported providers**:
1. Z.AI SDK (default — no API key needed, embedded token)
2. OpenAI (gpt-4o-mini)
3. Google Gemini (gemini-1.5-flash)
4. Anthropic Claude (claude-3-haiku)
5. Groq (llama-3.1-8b-instant)
6. OpenRouter (multi-model)
7. DeepSeek (deepseek-chat)
8. Mistral (mistral-tiny)
9. Ollama (self-hosted, no API key)
10. LM Studio (local, no API key)
11. Custom OpenAI-compatible API

**How it works**:
- Configuration stored in DB (Setting key "ai.config")
- API keys masked in GET responses (security)
- "Test Connection" sends a simple chat completion to verify connectivity
- All AI features automatically use the selected provider

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│              src/lib/ai-service.ts                   │
│  ┌──────────────────────────────────────────────┐    │
│  │  aiChatCompletion()                          │    │
│  │  ├── Z.AI SDK (default, no API key)          │    │
│  │  └── OpenAI-compatible (10 providers)        │    │
│  ├──────────────────────────────────────────────┤    │
│  │  searchProductImages()                       │    │
│  │  └── Z.AI SDK images.search.create()         │    │
│  ├──────────────────────────────────────────────┤    │
│  │  getAIConfig() / saveAIConfig()              │    │
│  │  └── DB Setting "ai.config"                  │    │
│  └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
         ↑                    ↑                    ↑
         │                    │                    │
┌────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ /api/health-   │  │ /api/admin/ai/   │  │ /api/admin/ai/   │
│ assistant      │  │ search-product-  │  │ generate-product │
│                │  │ images           │  │                  │
│ Uses: chat     │  │ Uses: images     │  │ Uses: chat       │
└────────────────┘  └──────────────────┘  └──────────────────┘
         ↑                    ↑                    ↑
         │                    │                    │
┌────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ health-        │  │ search-product-  │  │ ProductEditView  │
│ assistant-     │  │ images.tsx       │  │ (AI Generate     │
│ widget.tsx     │  │ (Gallery tab)    │  │  button)         │
└────────────────┘  └──────────────────┘  └──────────────────┘

Admin Settings:
┌──────────────────────────────────────────────────────┐
│ /api/admin/ai/providers (GET/PUT)                    │
│ /api/admin/ai/providers/test (POST)                  │
│ ┌──────────────────────────────────────────────────┐ │
│ │ ai-provider-panel.tsx (Settings → AI tab)        │ │
│ └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

**SDK Package**: `z-ai-web-dev-sdk@^0.0.18` (npm package, auto-installed via `bun install`)

---

## Recommended Additional AI Features (10)

### High Priority (Immediate Value)

1. **AI Product Description Generator**
   - **What**: Generate professional descriptions for existing products that have empty descriptions
   - **Where**: Admin → Products list → Bulk "Generate Descriptions" action
   - **Value**: Populate 300+ product descriptions in minutes

2. **AI SEO Meta Tags Generator**
   - **What**: Auto-generate SEO title, meta description, and keywords from product data
   - **Where**: Admin → Product Edit → SEO section → "Generate SEO" button
   - **Value**: Improves search engine rankings

3. **AI Customer Support Email Composer**
   - **What**: Generate professional response emails for customer inquiries
   - **Where**: Admin → Orders → Customer communication
   - **Value**: Faster, more professional customer support

### Medium Priority (Operational Efficiency)

4. **AI Prescription Verification Assistant**
   - **What**: Pre-screen uploaded prescriptions using VLM (Vision Language Model)
   - **Where**: Admin → Prescriptions → View prescription
   - **How**: Uses Z.AI VLM to analyze prescription images for completeness
   - **Value**: Reduces manual review time

5. **AI Order Anomaly Detection**
   - **What**: Flag unusual orders (very high quantity, duplicate addresses)
   - **Where**: Admin → Orders → Dashboard
   - **Value**: Prevents fraud and abuse

6. **AI Inventory Reorder Suggestions**
   - **What**: Predict which products need restocking based on sales velocity
   - **Where**: Admin → Dashboard → Inventory alerts
   - **Value**: Prevents stockouts, optimizes inventory

### Low Priority (Future Enhancement)

7. **AI Marketing Content Generator**
   - **What**: Generate social media posts, email campaigns, promotional banners
   - **Where**: Admin → Marketing → AI Marketing
   - **Value**: Automated marketing content creation

8. **AI Product Recommendations**
   - **What**: Suggest related products based on cart contents
   - **Where**: Customer → Product page → "Frequently bought together"
   - **Value**: Increases average order value

9. **AI Review Sentiment Analysis**
   - **What**: Automatically analyze customer reviews for sentiment
   - **Where**: Admin → Reviews → Review list
   - **Value**: Quick identification of problematic products

10. **AI Voice Search**
    - **What**: Allow customers to search products by voice
    - **Where**: Customer → Search bar → Microphone icon
    - **Value**: Better mobile experience, accessibility
