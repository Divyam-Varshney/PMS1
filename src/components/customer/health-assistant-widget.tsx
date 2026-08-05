"use client";

// ============================================================================
// File: src/components/customer/health-assistant-widget.tsx
// Purpose: Floating AI Health Assistant chat widget — fully integrated with
//          the PMS product catalog. Appears as a floating button (bottom-right)
//          on all customer pages. Opens a chat panel where customers can:
//            - Ask about medicines & health topics
//            - See product search results as clickable cards
//            - Get guided to the "Request a Medicine" flow when a product is
//              not in our catalog
//            - See relevant medical bundles
//            - Get instant FAQ answers (delivery, payments, etc.)
//
//          Powered by /api/health-assistant which returns:
//            { reply, products, suggestions, action, faqQuestion?, bundleIds? }
//
// Palette: emerald / teal / amber — NO indigo or blue (pharmacy theme).
// ============================================================================

import { useState, useRef, useEffect, useCallback, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle,
  X,
  Send,
  Bot,
  User,
  Loader2,
  Sparkles,
  PackageSearch,
  Truck,
  FileText,
  ClipboardList,
  ArrowRight,
  Pill,
  Tag,
  ChevronRight,
  Stethoscope,
  ShoppingBag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUI } from "@/lib/store";
import { formatCurrency } from "@/lib/format";
import { ProductImage } from "@/components/shared/product-image";

// ---------------------------------------------------------------------------
// Types — mirrors the API response shape in src/app/api/health-assistant/route.ts
// ---------------------------------------------------------------------------

interface ProductSearchResult {
  id: string;
  name: string;
  slug: string;
  genericName?: string | null;
  manufacturer?: string | null;
  shortDescription?: string | null;
  mrp: number;
  sellingPrice: number;
  stock: number;
  prescriptionRequired: boolean;
  primaryImage?: string | null;
  brandName?: string | null;
  image?: string | null;
}

type AssistantAction =
  | "product_results"
  | "medicine_request"
  | "bundle_results"
  | "faq_answer"
  | "general_info";

interface AssistantResponse {
  reply: string;
  products: ProductSearchResult[];
  suggestions: string[];
  action: AssistantAction;
  faqQuestion?: string;
  bundleIds?: string[];
}

interface Message {
  role: "user" | "assistant";
  content: string;
  ts: number;
  // Rich payload attached to assistant messages:
  products?: ProductSearchResult[];
  action?: AssistantAction;
  suggestions?: string[];
  bundleIds?: string[];
  faqQuestion?: string;
}

const WELCOME_MESSAGE: Message = {
  role: "assistant",
  content:
    "👋 Hi! I'm PMS Assistant — your AI pharmacy helper. Ask me to find a medicine, check delivery, or guide you to request a medicine we don't stock yet. How can I help?",
  ts: 0,
};

// Quick-action buttons shown above the input on first open. Each one either
// pre-fills a search query or navigates directly to a relevant view.
const QUICK_ACTIONS = [
  { label: "Search a medicine", icon: PackageSearch, query: "" },
  { label: "Track my order", icon: Truck, view: { name: "orders" as const } },
  { label: "Upload prescription", icon: FileText, view: { name: "prescription" as const } },
  { label: "Request a medicine", icon: ClipboardList, view: { name: "manual-request" as const } },
];

// Suggested starter prompts (shown alongside quick actions on first open).
const STARTER_PROMPTS = [
  "Paracetamol for fever",
  "Cough syrup for cold",
  "Vitamin C tablets",
  "Diabetes care products",
];

export function HealthAssistantWidget() {
  const navigate = useUI((s) => s.navigate);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new message / loading change.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, loading]);

  // Focus the input when the panel opens, clear the unread dot.
  useEffect(() => {
    if (open) {
      setUnread(false);
      const t = setTimeout(() => inputRef.current?.focus(), 220);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Broadcast a custom event whenever the panel opens — the WelcomePopup
  // listens for this so it can auto-dismiss if the user opens the assistant
  // themselves (instead of clicking the popup's "Chat Now" button).
  useEffect(() => {
    if (open) {
      window.dispatchEvent(new CustomEvent("pms:assistant-open"));
    }
  }, [open]);

  // Listen for open-requests from the WelcomePopup's "Chat Now" button.
  // This decouples the popup from the widget — no shared parent state needed.
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("pms:assistant-open-request", handler);
    return () => window.removeEventListener("pms:assistant-open-request", handler);
  }, []);

  // -------------------------------------------------------------------------
  // Send a message to the assistant API.
  // -------------------------------------------------------------------------
  const send = useCallback(
    async (text?: string) => {
      const content = (text ?? input).trim();
      if (!content || loading) return;

      const userMsg: Message = { role: "user", content, ts: Date.now() };
      const historyForApi = [...messages, userMsg]
        .filter((m) => m.ts !== 0) // exclude the static welcome
        .map((m) => ({ role: m.role, content: m.content }));

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);

      try {
        const res = await fetch("/api/health-assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: historyForApi }),
        });
        const data = await res.json();
        if (data?.ok && data.data) {
          const r = data.data as AssistantResponse;
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: r.reply,
              ts: Date.now(),
              products: r.products,
              action: r.action,
              suggestions: r.suggestions,
              bundleIds: r.bundleIds,
              faqQuestion: r.faqQuestion,
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: data?.error || "Sorry, I couldn't respond right now. Please try again later.",
              ts: Date.now(),
            },
          ]);
        }
        if (!open) setUnread(true);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "I'm having trouble connecting. Please try again in a moment.",
            ts: Date.now(),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [input, loading, messages, open]
  );

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    void send();
  };

  // Click a starter prompt / suggestion chip — send it immediately.
  const sendPrompt = (prompt: string) => {
    void send(prompt);
  };

  // Quick action: either navigate directly or focus the input.
  const handleQuickAction = (action: (typeof QUICK_ACTIONS)[number]) => {
    if (action.view) {
      navigate(action.view);
      setOpen(false);
    } else {
      // "Search a medicine" — focus the input so the user can type.
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  };

  // Click a product card → navigate to the product detail view.
  const viewProduct = (p: ProductSearchResult) => {
    navigate({ name: "product", productId: p.id, slug: p.slug });
    setOpen(false);
  };

  // "Request This Medicine" button — store the user's last query as a prefill
  // hint, then navigate to the manual-request view.
  const goToMedicineRequest = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser?.content) {
      try {
        window.localStorage.setItem("pms:medicine-request-prefill", lastUser.content);
      } catch {
        // localStorage may be unavailable (private mode) — silently ignore.
      }
    }
    navigate({ name: "manual-request" });
    setOpen(false);
  };

  const showQuickActions = messages.length === 1 && !loading;

  return (
    <>
      {/* Floating button */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1, type: "spring", stiffness: 260, damping: 20 }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close assistant" : "Open AI Health Assistant"}
        className={cn(
          "fixed bottom-20 right-4 z-50 flex size-14 items-center justify-center rounded-full shadow-lg shadow-emerald-600/30 transition-colors sm:bottom-6",
          "bg-gradient-to-br from-emerald-600 to-teal-600 text-white ring-4 ring-background",
          "hover:shadow-xl hover:shadow-emerald-600/40"
        )}
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.span
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X className="size-6" />
            </motion.span>
          ) : (
            <motion.span
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative"
            >
              <MessageCircle className="size-6" />
              {unread && (
                <span className="absolute -right-1 -top-1 flex size-3">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex size-3 rounded-full bg-rose-500" />
                </span>
              )}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className={cn(
              "fixed bottom-36 right-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-border/60 bg-background shadow-2xl shadow-emerald-900/10 sm:bottom-24",
              "h-[min(75vh,560px)]"
            )}
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-border/60 bg-gradient-to-r from-emerald-600 to-teal-600 p-3.5 text-white">
              <div className="flex size-9 items-center justify-center rounded-full bg-white/20 backdrop-blur">
                <Bot className="size-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold">PMS Assistant</span>
                  <Sparkles className="size-3.5 text-amber-200" />
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-50/90">
                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-300" />
                  AI-powered · Online
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="rounded-lg p-1.5 transition-colors hover:bg-white/20"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 space-y-3 overflow-y-auto bg-muted/20 p-3.5 [scrollbar-width:thin]"
            >
              {messages.map((m, i) => (
                <MessageBubble
                  key={i}
                  message={m}
                  onViewProduct={viewProduct}
                  onGoToMedicineRequest={goToMedicineRequest}
                  onSuggestionClick={sendPrompt}
                  onBrowseBundles={() => {
                    navigate({ name: "bundles" });
                    setOpen(false);
                  }}
                />
              ))}

              {/* Typing indicator */}
              <AnimatePresence>
                {loading && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="flex gap-2"
                  >
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 text-white ring-2 ring-background">
                      <Bot className="size-3.5" />
                    </div>
                    <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-background px-4 py-3 ring-1 ring-border/50">
                      <span className="size-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
                      <span className="size-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
                      <span className="size-2 animate-bounce rounded-full bg-muted-foreground/60" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Quick action buttons — shown on first open only */}
              <AnimatePresence>
                {showQuickActions && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ delay: 0.2 }}
                    className="space-y-2 pt-1"
                  >
                    <div className="grid grid-cols-2 gap-1.5">
                      {QUICK_ACTIONS.map((qa) => (
                        <button
                          key={qa.label}
                          onClick={() => handleQuickAction(qa)}
                          className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
                        >
                          <qa.icon className="size-3.5 shrink-0" />
                          <span className="truncate">{qa.label}</span>
                        </button>
                      ))}
                    </div>
                    {/* Starter prompts */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {STARTER_PROMPTS.map((p) => (
                        <button
                          key={p}
                          onClick={() => sendPrompt(p)}
                          className="rounded-full border border-border/60 bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Medical disclaimer */}
            <div className="border-t border-border/60 bg-amber-50/50 px-3.5 py-1.5 text-center text-[10px] leading-tight text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
              ⚕️ AI assistant — not a doctor. Always consult a licensed pharmacist for medical advice.
            </div>

            {/* Input */}
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 border-t border-border/60 bg-background p-2.5"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about medicines, health..."
                maxLength={1000}
                disabled={loading}
                className="flex-1 rounded-full border border-border/60 bg-muted/30 px-3.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-emerald-400 focus:bg-background focus:ring-2 focus:ring-emerald-400/20 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                aria-label="Send message"
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full text-white shadow-sm transition-all",
                  "bg-gradient-to-br from-emerald-600 to-teal-600",
                  "hover:shadow-md hover:shadow-emerald-600/30 active:scale-95",
                  "disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                )}
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ===========================================================================
// Sub-components
// ===========================================================================

interface MessageBubbleProps {
  message: Message;
  onViewProduct: (p: ProductSearchResult) => void;
  onGoToMedicineRequest: () => void;
  onSuggestionClick: (s: string) => void;
  onBrowseBundles: () => void;
}

function MessageBubble({
  message,
  onViewProduct,
  onGoToMedicineRequest,
  onSuggestionClick,
  onBrowseBundles,
}: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn("flex gap-2", isUser ? "flex-row-reverse" : "flex-row")}
    >
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full ring-2 ring-background",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-gradient-to-br from-emerald-600 to-teal-600 text-white"
        )}
      >
        {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
      </div>

      <div className={cn("flex max-w-[85%] flex-col gap-2", isUser && "items-end")}>
        {/* Text bubble */}
        <div
          className={cn(
            "max-w-full rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm",
            isUser
              ? "rounded-tr-sm bg-primary text-primary-foreground"
              : "rounded-tl-sm bg-background text-foreground ring-1 ring-border/50"
          )}
        >
          {message.faqQuestion && !isUser && (
            <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              <Sparkles className="size-3" />
              Quick Answer
            </div>
          )}
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>

        {/* Product results — clickable cards */}
        {!isUser && message.products && message.products.length > 0 && (
          <div className="space-y-1.5">
            {message.products.map((p) => (
              <ProductResultCard key={p.id} product={p} onClick={() => onViewProduct(p)} />
            ))}
          </div>
        )}

        {/* Bundle results CTA */}
        {!isUser && message.bundleIds && message.bundleIds.length > 0 && (
          <button
            onClick={onBrowseBundles}
            className="flex items-center gap-2 self-start rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-medium text-teal-700 transition-colors hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-300 dark:hover:bg-teal-900/40"
          >
            <ShoppingBag className="size-3.5" />
            Browse health bundles
            <ChevronRight className="size-3.5" />
          </button>
        )}

        {/* "Request This Medicine" button */}
        {!isUser && message.action === "medicine_request" && (
          <button
            onClick={onGoToMedicineRequest}
            className="flex items-center gap-2 self-start rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:shadow-md hover:shadow-emerald-600/30 active:scale-95"
          >
            <ClipboardList className="size-3.5" />
            Request This Medicine
            <ArrowRight className="size-3.5" />
          </button>
        )}

        {/* Suggestion chips */}
        {!isUser && message.suggestions && message.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.suggestions.map((s, idx) => (
              <button
                key={`${s}-${idx}`}
                onClick={() => onSuggestionClick(s)}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Product result card — shown inline in the chat when the API returns matches.
// ---------------------------------------------------------------------------

interface ProductResultCardProps {
  product: ProductSearchResult;
  onClick: () => void;
}

function ProductResultCard({ product, onClick }: ProductResultCardProps) {
  const inStock = (Number(product.stock) || 0) > 0;
  const discountPct =
    product.mrp > product.sellingPrice
      ? Math.round(((product.mrp - product.sellingPrice) / product.mrp) * 100)
      : 0;

  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-2.5 rounded-xl border border-border/60 bg-background p-2 text-left transition-all hover:border-emerald-300 hover:shadow-md hover:shadow-emerald-600/5"
    >
      {/* Image */}
      <div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-accent/30">
        <ProductImage
          name={product.name}
          brandName={product.brandName}
          primaryImage={product.primaryImage ?? product.image}
          size="sm"
          className="!h-full !w-full"
        />
        {!inStock && (
          <div className="absolute inset-0 bg-foreground/40 backdrop-grayscale backdrop-blur-[1px]" />
        )}
      </div>

      {/* Details */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-foreground">{product.name}</p>
        {product.genericName && (
          <p className="truncate text-[10px] text-muted-foreground">{product.genericName}</p>
        )}
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
            {formatCurrency(product.sellingPrice)}
          </span>
          {discountPct > 0 && (
            <span className="text-[10px] text-muted-foreground line-through">
              {formatCurrency(product.mrp)}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1">
          {product.prescriptionRequired ? (
            <span className="inline-flex items-center gap-0.5 rounded bg-rose-100 px-1 py-0.5 text-[9px] font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
              <Stethoscope className="size-2.5" /> Rx
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 rounded bg-emerald-100 px-1 py-0.5 text-[9px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
              <Pill className="size-2.5" /> OTC
            </span>
          )}
          {!inStock ? (
            <span className="text-[9px] font-medium text-rose-600">Out of stock</span>
          ) : (
            <span className="text-[9px] font-medium text-emerald-600">In stock</span>
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="flex shrink-0 items-center gap-0.5 self-stretch rounded-md bg-emerald-50 px-1.5 text-emerald-700 transition-colors group-hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:group-hover:bg-emerald-900/40">
        <Tag className="hidden size-3 sm:block" />
        <span className="text-[10px] font-semibold">View</span>
        <ChevronRight className="size-3 transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  );
}
