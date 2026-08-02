// ============================================================================
// File: src/app/p/[slug]/page.tsx
// Purpose: SEO-friendly product URL route — /p/<slug>
//
//          This route renders rich Open Graph + Twitter Card metadata for
//          crawlers (WhatsApp, Facebook, X, Telegram, Google) and then
//          redirects human visitors to the SPA product view using a
//          hash-based route (#v=product&productId=…&slug=…).
//
// METADATA:
//   - og:title        — product name (with site suffix)
//   - og:description  — short description (or generated fallback)
//   - og:image        — absolute product image URL (crawlers need absolute)
//   - og:url          — absolute canonical /p/<slug> URL
//   - og:type         — "product" (richer than "website" for e-commerce)
//   - og:siteName     — Pradeep Medical Store
//   - og:locale       — en_IN
//   - twitter:card    — summary_large_image
//   - twitter:title   — same as og:title
//   - twitter:description — same as og:description
//   - twitter:image   — same as og:image
//   - alternates.canonical — /p/<slug>
// ============================================================================

import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function findProduct(slug: string) {
  const select = {
    id: true, name: true, slug: true, shortDescription: true,
    composition: true, genericName: true, manufacturer: true,
    mrp: true, sellingPrice: true, prescriptionRequired: true,
    status: true, primaryImage: true,
    brand: { select: { name: true } },
    category: { select: { name: true } },
    images: { where: { isPrimary: true }, take: 1, select: { imagePath: true, altText: true } },
  };
  let product = await db.product.findUnique({ where: { slug }, select });
  if (product) return product;
  // Fallback: try as ID
  return await db.product.findUnique({ where: { id: slug }, select });
}

/** Resolve the absolute site origin from the incoming request headers.
 *  Falls back to localhost for dev when no host header is present
 *  (e.g. during generateMetadata in some edge cases). Crawlers always
 *  arrive with a real Host header. */
async function getSiteOrigin(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host");
    const proto = h.get("x-forwarded-proto") || (host?.startsWith("localhost") ? "http" : "https");
    if (host) return `${proto}://${host}`;
  } catch {
    // headers() not available in this context — fall through.
  }
  return "http://localhost:3000";
}

/** Normalize a (possibly relative) image path into an absolute URL. */
function toAbsoluteUrl(imagePath: string | undefined | null, origin: string): string | undefined {
  if (!imagePath) return undefined;
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) return imagePath;
  if (imagePath.startsWith("//")) return `https:${imagePath}`;
  // Leading slash or relative — join with origin
  return imagePath.startsWith("/")
    ? `${origin}${imagePath}`
    : `${origin}/${imagePath}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const [product, origin] = await Promise.all([findProduct(slug), getSiteOrigin()]);

  if (!product) {
    return {
      title: "Product Not Found — Pradeep Medical Store",
      robots: { index: false },
      openGraph: {
        title: "Product Not Found — Pradeep Medical Store",
        siteName: "Pradeep Medical Store",
        url: `${origin}/p/${slug}`,
      },
    };
  }

  // Clean the product name for the SEO title — cut at marketing separators
  // (|, —, :, and commas in long names) to keep only the core product name.
  let cleanName = product.name.split(/\s*[|—:]\s*/)[0].trim();
  // If still very long (> 60 chars), also cut at the first comma
  if (cleanName.length > 60 && cleanName.includes(",")) {
    cleanName = cleanName.split(",")[0].trim();
  }
  const title = `${cleanName} — Buy Online | Pradeep Medical Store`;
  const description = product.shortDescription ||
    `Buy ${cleanName} online at Pradeep Medical Store. ${product.composition ? `Contains ${product.composition}. ` : ""}Genuine medicine, fast delivery in Mathura.`;

  const canonicalPath = `/p/${product.slug}`;
  const canonicalUrl = `${origin}${canonicalPath}`;
  const rawImage = product.images[0]?.imagePath || product.primaryImage || undefined;
  const imageUrl = toAbsoluteUrl(rawImage, origin);
  const imageAlt = product.images[0]?.altText || cleanName;

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    metadataBase: new URL(origin),
    openGraph: {
      title,
      description,
      // NOTE: Next.js's Metadata type only accepts the OG core types
      // (article, profile, website, book, music.*, video.*). "product"
      // is a valid OG type per ogp.me but not yet in Next's typings, so
      // we use "website" and rely on the rich title/description/image
      // for crawler presentation (WhatsApp, Facebook, X, Telegram).
      type: "website",
      siteName: "Pradeep Medical Store",
      locale: "en_IN",
      url: canonicalUrl,
      images: imageUrl
        ? [{ url: imageUrl, width: 1200, height: 1200, alt: imageAlt }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await findProduct(slug);
  if (!product || product.status !== "active") notFound();
  const hash = `#v=product&productId=${product.id}&slug=${encodeURIComponent(product.slug)}`;
  return (
    <html lang="en">
      <head>
        <meta httpEquiv="refresh" content={`0; url=/${hash}`} />
        <script dangerouslySetInnerHTML={{ __html: `window.location.replace('/${hash}');` }} />
      </head>
      <body>
        <noscript><p>Redirecting to <a href={`/${hash}`}>{product.name}</a>...</p></noscript>
      </body>
    </html>
  );
}
