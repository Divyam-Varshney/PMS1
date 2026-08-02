// ============================================================================
// File: src/app/api/file/[bucket]/[...key]/route.ts
// Purpose: Authenticated proxy for serving private-bucket files (prescriptions,
//          payment screenshots). In cloud mode, generates a short-lived signed
//          URL and redirects. In dev mode, streams the local file directly.
//
// Auth: Requires a valid customer OR admin session. Ownership of the specific
//       prescription/order is enforced by the data-layer endpoints that return
//       these image URLs — if a caller can see the URL, they're authorized.
// ============================================================================

import { NextResponse } from "next/server";
import { getCustomerFromRequest, getAdminFromRequest } from "@/lib/auth";
import { readPrivateFile, StorageBucket } from "@/lib/storage";

const PRIVATE_BUCKETS = new Set<StorageBucket>(["prescriptions", "payments"]);

type Ctx = { params: Promise<{ bucket: string; key: string[] }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { bucket, key } = await params;
  const bucketName = bucket as StorageBucket;
  const objectKey = key.join("/");

  // Only allow access to private buckets through this proxy. Public buckets
  // are served directly from the CDN (or /public in dev).
  if (!PRIVATE_BUCKETS.has(bucketName)) {
    return NextResponse.json(
      { ok: false, error: "Bucket not served via proxy" },
      { status: 400 }
    );
  }

  // Auth check — must be a logged-in customer or admin.
  const [customer, admin] = await Promise.all([
    getCustomerFromRequest(),
    getAdminFromRequest(),
  ]);
  if (!customer && !admin) {
    return NextResponse.json(
      { ok: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  try {
    const result = await readPrivateFile(bucketName, objectKey);

    if (result.type === "redirect") {
      // Cloud mode — redirect to the signed URL.
      return NextResponse.redirect(result.url, { status: 302 });
    }

    // Dev mode — stream the file buffer with the correct content type.
    // Convert Buffer to Uint8Array for NextResponse BodyInit compatibility.
    return new NextResponse(new Uint8Array(result.data), {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": "private, max-age=300",
        "Content-Length": String(result.data.length),
      },
    });
  } catch (e: any) {
    // File not found / signed-URL generation failed.
    return NextResponse.json(
      { ok: false, error: "File not found" },
      { status: 404 }
    );
  }
}
