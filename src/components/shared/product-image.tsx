// ============================================================================
// File: src/components/shared/product-image.tsx
// Purpose: Deterministic placeholder image for products. Renders a styled
//          gradient div with the product's first letter + a Pill icon and the
//          brand name. Used everywhere a product image is shown.
// Role: Avoids needing real product images in V1; gives the pharmacy a
//       premium, branded look. Uses inline-style gradients so it always
//       renders correctly regardless of Tailwind class detection.
//
// Cache-busting: image filenames already contain a unique UUID hash (e.g.,
//   `product-name-8f1048cd.jpg`), so every upload gets a unique URL. When
//   an admin replaces an image, the URL changes and the browser fetches the
//   new one automatically. The `key={imageUrl}` prop forces a clean re-mount
//   when the URL changes (no stale img element). The `onError` handler falls
//   back to the branded placeholder if the image 404s (e.g., deleted from R2).
// ============================================================================

import { Pill } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

interface ProductImageProps {
  name: string;
  brandName?: string | null;
  primaryImage?: string | null;
  /** New: ProductImage records — if present, uses the primary image from this array. */
  images?: Array<{ imagePath: string; isPrimary?: boolean }>;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

// Deterministic color pairs (emerald/teal medical palette). Used as inline
// styles so Tailwind's JIT cannot purge them.
const PALETTE: Array<[string, string]> = [
  ["#34d399", "#0d9488"], // emerald-400 -> teal-600
  ["#2dd4bf", "#0891b2"], // teal-400 -> cyan-600
  ["#4ade80", "#059669"], // green-400 -> emerald-600
  ["#a3e635", "#16a34a"], // lime-400 -> green-600
  ["#10b981", "#047857"], // emerald-500 -> emerald-700
  ["#14b8a6", "#0f766e"], // teal-500 -> teal-700
  ["#22d3ee", "#0e7490"], // cyan-400 -> cyan-700
  ["#86efac", "#15803d"], // green-300 -> green-700
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function ProductImage({
  name,
  brandName,
  primaryImage,
  images,
  className,
  size = "md",
}: ProductImageProps) {
  const sizes: Record<string, string> = {
    sm: "h-12 w-12 text-base",
    md: "h-20 w-20 text-2xl",
    lg: "h-32 w-32 text-4xl",
    xl: "h-56 w-56 text-6xl",
  };

  // Resolve the image URL: prefer ProductImage records (new system),
  // fall back to legacy primaryImage field.
  const imageUrl = images?.find((i) => i.isPrimary)?.imagePath
    || images?.[0]?.imagePath
    || primaryImage;

  // Track image load errors so we can fall back to the branded placeholder.
  // Resets when the URL changes (via the key prop on the <img>).
  const [errored, setErrored] = useState(false);
  useEffect(() => { setErrored(false); }, [imageUrl]);

  // If a real image URL exists AND it hasn't errored, render it inside a
  // fixed aspect-ratio container so all product images display consistently
  // regardless of source dimensions.
  if (imageUrl && !errored) {
    return (
      <div className={cn("relative overflow-hidden bg-accent/20", className)}>
        <img
          key={imageUrl}
          src={imageUrl}
          alt={name}
          className="absolute inset-0 h-full w-full object-contain"
          loading="lazy"
          onError={() => setErrored(true)}
        />
      </div>
    );
  }

  const idx = hashString(name || "P") % PALETTE.length;
  const [from, to] = PALETTE[idx];
  const initial = name?.[0]?.toUpperCase() || "P";
  const iconSize =
    size === "xl" ? "8rem" : size === "lg" ? "4rem" : size === "md" ? "2.5rem" : "1.5rem";

  return (
    <div
      className={cn(
        "relative flex items-center justify-center font-bold text-white overflow-hidden",
        sizes[size],
        className
      )}
      style={{
        background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
      }}
    >
      {/* Subtle pill watermark */}
      <Pill
        className="absolute text-white/20"
        style={{ width: iconSize, height: iconSize }}
        strokeWidth={1.5}
      />
      {/* shine */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.45) 0%, transparent 50%)",
        }}
      />
      <span className="relative z-10 drop-shadow-sm">{initial}</span>
      {brandName && (
        <span className="absolute bottom-1 left-1 right-1 z-10 truncate text-[9px] font-semibold uppercase tracking-wide text-white/85 text-center">
          {brandName}
        </span>
      )}
    </div>
  );
}
