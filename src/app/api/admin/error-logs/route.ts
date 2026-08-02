// ============================================================================
// File: src/app/api/admin/error-logs/route.ts
// Purpose: List + create error logs. Admin-only for GET; POST is open to
//          capture client-side errors from any authenticated user.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest, getCustomerFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, parseBody } from "@/lib/api";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET — List error logs with filtering, sorting, pagination
// ---------------------------------------------------------------------------
export async function GET(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
  const severity = url.searchParams.get("severity") || undefined;
  const status = url.searchParams.get("status") || undefined;
  const moduleFilter = url.searchParams.get("module") || undefined;
  const search = url.searchParams.get("search") || undefined;
  const startDate = url.searchParams.get("startDate") || undefined;
  const endDate = url.searchParams.get("endDate") || undefined;

  const where: any = {};
  if (severity) where.severity = severity;
  if (status) where.status = status;
  if (moduleFilter) where.module = { contains: moduleFilter, mode: "insensitive" };
  if (search) {
    where.OR = [
      { message: { contains: search, mode: "insensitive" } },
      { endpoint: { contains: search, mode: "insensitive" } },
      { requestUrl: { contains: search, mode: "insensitive" } },
      { userEmail: { contains: search, mode: "insensitive" } },
    ];
  }
  if (startDate || endDate) {
    where.timestamp = {};
    if (startDate) where.timestamp.gte = new Date(startDate);
    if (endDate) where.timestamp.lte = new Date(endDate + "T23:59:59");
  }

  const [items, total] = await Promise.all([
    db.errorLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.errorLog.count({ where }),
  ]);

  // Get summary stats
  const [openCount, criticalCount, todayCount] = await Promise.all([
    db.errorLog.count({ where: { status: "open" } }),
    db.errorLog.count({ where: { severity: "critical", status: "open" } }),
    db.errorLog.count({
      where: { timestamp: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    }),
  ]);

  return ok({
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    stats: { openCount, criticalCount, todayCount },
  });
}

// ---------------------------------------------------------------------------
// POST — Create an error log (called by client-side error capture + API errors)
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  // Accept from admins OR customers (client-side error capture)
  const [admin, customer] = await Promise.all([
    getAdminFromRequest(),
    getCustomerFromRequest(),
  ]);
  // Allow unauthenticated too — client errors can happen before login
  const user = admin || customer;

  const body = await parseBody<{
    severity?: string;
    module?: string;
    endpoint?: string;
    method?: string;
    message: string;
    stack?: string;
    userAgent?: string;
    requestUrl?: string;
    statusCode?: number;
  }>(req);

  if (!body?.message) return err("Message is required", 400);

  const userAgent = body.userAgent || req.headers.get("user-agent") || null;
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0] ||
    req.headers.get("x-real-ip") ||
    null;

  const log = await db.errorLog.create({
    data: {
      severity: body.severity || "error",
      module: body.module || null,
      endpoint: body.endpoint || null,
      method: body.method || null,
      message: body.message,
      stack: process.env.NODE_ENV === "production" ? null : (body.stack || null),
      userAgent: userAgent?.slice(0, 500),
      ipAddress,
      userId: user?.id || null,
      userEmail: (admin?.email || customer?.email) || null,
      requestUrl: body.requestUrl?.slice(0, 500) || null,
      statusCode: body.statusCode || null,
    },
  });

  return ok(log, 201);
}

// ---------------------------------------------------------------------------
// DELETE — Clear all logs (admin only)
// ---------------------------------------------------------------------------
export async function DELETE(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const url = new URL(req.url);
  const clearAll = url.searchParams.get("all") === "1";
  const ids = url.searchParams.getAll("ids");

  if (clearAll) {
    const result = await db.errorLog.deleteMany({});
    return ok({ deleted: result.count });
  }

  if (ids.length > 0) {
    const result = await db.errorLog.deleteMany({
      where: { id: { in: ids } },
    });
    return ok({ deleted: result.count });
  }

  return err("Specify ?all=1 or ?ids=xxx to delete", 400);
}
