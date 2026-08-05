// ============================================================================
// File: src/app/api/admin/dashboard/ai-insights/route.ts
// Purpose: AI-powered business insights, inventory suggestions, profit
//          recommendations, sales forecast, and marketing recommendations.
//          Uses the Z.AI SDK via aiChatCompletion() with hardcoded fallback.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized } from "@/lib/api";
import { aiChatCompletion } from "@/lib/ai-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

let _cache: { data: any; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes (AI calls are expensive)

export async function GET() {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  if (_cache && Date.now() - _cache.ts < CACHE_TTL) return ok(_cache.data);

  try {
    // Gather business data for AI analysis
    const now = new Date();
    const startOfWeek = new Date(now); startOfWeek.setDate(startOfWeek.getDate() - 7);
    const startOfLastWeek = new Date(now); startOfLastWeek.setDate(startOfLastWeek.getDate() - 14);

    const [thisWeekOrders, lastWeekOrders, lowStockProducts, topProducts, allProducts] = await Promise.all([
      db.order.findMany({ where: { createdAt: { gte: startOfWeek }, paymentStatus: "paid" }, select: { grandTotal: true, createdAt: true, status: true, items: { select: { name: true, qty: true, sellingPrice: true } } } }),
      db.order.findMany({ where: { createdAt: { gte: startOfLastWeek, lt: startOfWeek }, paymentStatus: "paid" }, select: { grandTotal: true } }),
      db.product.findMany({ where: { stock: { lte: 10 }, status: "active" }, select: { name: true, stock: true, sellingPrice: true, costPrice: true }, take: 10 }),
      db.orderItem.groupBy({ by: ["name"], _sum: { qty: true }, orderBy: { _sum: { qty: "desc" } }, take: 10 }),
      db.product.findMany({ where: { status: "active" }, select: { name: true, sellingPrice: true, costPrice: true, stock: true }, take: 50 }),
    ]);

    const thisWeekRevenue = thisWeekOrders.reduce((s, o) => s + Number(o.grandTotal), 0);
    const lastWeekRevenue = lastWeekOrders.reduce((s, o) => s + Number(o.grandTotal), 0);
    const revenueChange = lastWeekRevenue > 0 ? Math.round(((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100) : 0;
    const cancellationRate = thisWeekOrders.length > 0 ? Math.round((thisWeekOrders.filter(o => o.status === "cancelled").length / thisWeekOrders.length) * 100) : 0;

    // Build summary for AI — use ₹ prefix so the AI knows this is Indian Rupees
    const businessSummary = JSON.stringify({
      thisWeekRevenue: `₹${thisWeekRevenue}`,
      lastWeekRevenue: `₹${lastWeekRevenue}`,
      revenueChange,
      totalOrders: thisWeekOrders.length,
      cancellationRate,
      lowStockProducts: lowStockProducts.map(p => ({ name: p.name, stock: p.stock })),
      topProducts: topProducts.map(p => ({ name: p.name, qty: p._sum.qty })),
      totalActiveProducts: allProducts.length,
      avgProfitMargin: allProducts.length > 0 ? Math.round(allProducts.filter(p => p.costPrice && p.sellingPrice).reduce((s, p) => s + ((Number(p.sellingPrice) - Number(p.costPrice)) / Number(p.sellingPrice)) * 100, 0) / allProducts.filter(p => p.costPrice && p.sellingPrice).length) : 0,
    });

    // Generate AI insights
    const insightPrompt = `You are a pharmacy business analyst. Analyze this data and provide 5 actionable business insights in clear, professional language. Each insight should be 1-2 sentences. Focus on trends, risks, and opportunities.

Business Data: ${businessSummary}

Return a JSON array of insights:
[
  {"type": "warning|success|info|danger", "title": "Short title", "message": "Detailed insight", "priority": "high|medium|low"}
]

Examples:
- {"type":"warning","title":"Low Stock Alert","message":"5 products are running low on stock and may sell out within 3 days.","priority":"high"}
- {"type":"success","title":"Revenue Growth","message":"Weekly revenue increased by 18% compared to last week.","priority":"medium"}
- {"type":"info","title":"Top Performer","message":"Dolo 650 is the best-selling product this week with 45 units sold.","priority":"low"}

Return ONLY the JSON array, no markdown.`;

    const response = await aiChatCompletion(
      [{ role: "system", content: "You are a pharmacy business analyst. Return only valid JSON." }, { role: "user", content: insightPrompt }],
      { temperature: 0.7, max_tokens: 800 }
    );

    let insights: any[] = [];
    try {
      const content = response.content.trim().replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      insights = JSON.parse(content);
      if (!Array.isArray(insights)) insights = [];
    } catch { insights = []; }

    // Generate smart alerts
    const alerts: any[] = [];
    if (lowStockProducts.length > 0) {
      alerts.push({ level: "warning", icon: "🟠", title: "Low Stock", message: `${lowStockProducts.length} products are running low on stock`, count: lowStockProducts.length });
    }
    const outOfStock = lowStockProducts.filter(p => p.stock === 0);
    if (outOfStock.length > 0) {
      alerts.push({ level: "danger", icon: "🔴", title: "Out of Stock", message: `${outOfStock.length} products are completely out of stock`, count: outOfStock.length });
    }
    if (revenueChange < 0) {
      alerts.push({ level: "danger", icon: "📉", title: "Revenue Decline", message: `Revenue dropped ${Math.abs(revenueChange)}% this week`, count: 1 });
    } else if (revenueChange > 10) {
      alerts.push({ level: "success", icon: "📈", title: "Revenue Milestone", message: `Revenue grew ${revenueChange}% this week!`, count: 1 });
    }

    // Sales forecast (simple moving average)
    const avgDailyRevenue = thisWeekRevenue / 7;
    const forecast = {
      tomorrow: Math.round(avgDailyRevenue),
      nextWeek: Math.round(avgDailyRevenue * 7),
      nextMonth: Math.round(avgDailyRevenue * 30),
      confidence: thisWeekOrders.length >= 10 ? "high" : thisWeekOrders.length >= 5 ? "medium" : "low",
    };

    // Inventory suggestions
    const inventorySuggestions: any[] = [];
    for (const p of lowStockProducts.slice(0, 5)) {
      inventorySuggestions.push({
        product: p.name,
        stock: p.stock,
        action: p.stock === 0 ? "Restock immediately" : `Restock soon (only ${p.stock} left)`,
        priority: p.stock === 0 ? "urgent" : "high",
      });
    }

    // Profit suggestions
    const profitSuggestions: any[] = [];
    const lowMarginProducts = allProducts.filter(p => p.costPrice && p.sellingPrice && (Number(p.sellingPrice) - Number(p.costPrice)) / Number(p.sellingPrice) < 0.15).slice(0, 5);
    for (const p of lowMarginProducts) {
      profitSuggestions.push({
        product: p.name,
        currentMargin: `${Math.round(((Number(p.sellingPrice) - Number(p.costPrice)) / Number(p.sellingPrice)) * 100)}%`,
        suggestion: "Consider increasing price or negotiating lower cost",
        priority: "medium",
      });
    }

    const data = { insights, alerts, forecast, inventorySuggestions, profitSuggestions };

    _cache = { data, ts: Date.now() };
    return ok(data);
  } catch (err: any) {
    console.error("[dashboard/ai-insights] error:", err?.message);
    return ok({ insights: [], alerts: [], forecast: { tomorrow: 0, nextWeek: 0, nextMonth: 0, confidence: "low" }, inventorySuggestions: [], profitSuggestions: [], error: "AI insights temporarily unavailable" });
  }
}
