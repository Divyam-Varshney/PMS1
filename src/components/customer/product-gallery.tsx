// ============================================================================
// File: src/components/customer/product-gallery.tsx
// Purpose: Amazon-style product gallery for the customer-facing ProductView.
//          Collects [primaryImage, ...galleryImages] (deduped, nulled-out
//          entries dropped) and exposes:
//            • Main image with click-to-zoom (Dialog)
//            • Left / right nav arrows (hidden when only 1 image)
//            • Thumbnail strip — vertical on desktop, horizontal on mobile
//            • Touch-swipe navigation via framer-motion drag
//            • Graceful fallback to ProductImage (brand initial) when no real
//              images exist
// Role: Replaces the single ProductImage that used to live on the product
//       detail page. The shared <ProductImage /> (used in cards, cart, wishlist)
//       still renders only the primary image — this gallery is detail-page only.
//
// MOBILE RESPONSIVENESS STRATEGY (CRITICAL):
//   The #1 cause of layout overflow on mobile is the thumbnail strip. Each
//   thumbnail button is `shrink-0 size-16` (64px), so 11 thumbnails + gaps =
//   ~784px. Without an explicit width constraint, this content stretches every
//   flex/grid ancestor up to the viewport — causing horizontal scroll AND
//   blowing up the main image to 784×784px.
//
//   The fix has THREE layers (all required):
//     1. `min-w-0` on every flex/grid item from the gallery root down to the
//        thumbnails strip — this overrides the default `min-width: auto`
//        behavior that prevents flex/grid items from shrinking below their
//        content's intrinsic min-size.
//     2. `w-full` (mobile) + `sm:w-20 lg:w-24` (desktop) on the thumbnails
//        container — this caps the strip's width to its parent on mobile so
//        the `overflow-x-auto` actually creates a horizontal scroller (rather
//        than expanding the parent).
//     3. `overflow-hidden` on the gallery root as a safety net so that even
//        if a descendant somehow overflows, the page itself never gains a
//        horizontal scrollbar.
// ============================================================================

"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ZoomIn, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ProductImage } from "@/components/shared/product-image";
import { cn } from "@/lib/utils";

/** Parse legacy galleryImages JSON string into URL array. */
function parseGallery(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((s): s is string => typeof s === "string" && s.length > 0);
  } catch { return []; }
}

// ----------------------------------------------------------------------------
// ZoomableImage — used inside the fullscreen Dialog. Supports:
//   • Pinch-to-zoom (2-finger gesture) on touch devices
//   • Double-tap to toggle zoom (1× ↔ 2.5×)
//   • Mouse wheel zoom on desktop
//   • Drag to pan when zoomed in (mouse + touch)
//   • Auto-resets zoom when the source image changes (navigating prev/next)
//
// Implementation notes:
//   - We track touch state manually via React refs (no external gesture lib).
//   - `touch-action: none` is set on the image so the browser doesn't try to
//     scroll/zoom the page — we handle the gesture ourselves.
//   - The image is wrapped in a flex centering container; the transform
//     (scale + translate) is applied to the <img> itself.
// ----------------------------------------------------------------------------
interface ZoomableImageProps {
  src: string;
  alt: string;
}

function ZoomableImage({ src, alt }: ZoomableImageProps) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  // `panning` is React state (not just a ref) so we can read it during render
  // to disable the CSS transition mid-gesture (avoids laggy panning).
  const [panning, setPanning] = useState(false);

  // Refs for ongoing gesture state (avoids re-renders during move).
  const pinchStartDist = useRef(0);
  const pinchStartScale = useRef(1);
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const lastTap = useRef(0);
  const imgRef = useRef<HTMLImageElement>(null);

  // NOTE: Zoom/pan auto-resets when the displayed image changes because the
  // parent passes `key={safeActive}` which forces a full remount of this
  // component. No effect needed.

  const clampScale = (s: number) => Math.min(Math.max(s, 1), 5);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Begin pinch — record starting distance and current scale.
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDist.current = Math.hypot(dx, dy);
      pinchStartScale.current = scale;
      panStart.current = null; // pinch cancels any in-progress pan
      setPanning(false);
    } else if (e.touches.length === 1) {
      // Begin pan (only meaningful when zoomed in) OR detect double-tap.
      const now = Date.now();
      if (now - lastTap.current < 300) {
        // Double-tap: toggle zoom between 1× and 2.5×.
        setScale((s) => (s > 1.1 ? 1 : 2.5));
        setTx(0);
        setTy(0);
      }
      lastTap.current = now;
      if (scale > 1) {
        panStart.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          tx,
          ty,
        };
        setPanning(true);
      }
    }
  }, [scale, tx, ty]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDist.current > 0) {
      e.preventDefault(); // prevent page scroll
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / pinchStartDist.current;
      setScale(clampScale(pinchStartScale.current * ratio));
    } else if (e.touches.length === 1 && panStart.current && scale > 1) {
      e.preventDefault(); // prevent page scroll while panning zoomed image
      const dx = e.touches[0].clientX - panStart.current.x;
      const dy = e.touches[0].clientY - panStart.current.y;
      setTx(panStart.current.tx + dx);
      setTy(panStart.current.ty + dy);
    }
  }, [scale]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchStartDist.current = 0;
    if (e.touches.length === 0) {
      panStart.current = null;
      setPanning(false);
    }
  }, []);

  // Mouse wheel zoom (desktop).
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    setScale((s) => clampScale(s + delta * s));
  }, []);

  // Mouse drag to pan (desktop) when zoomed in.
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale <= 1) return;
    panStart.current = { x: e.clientX, y: e.clientY, tx, ty };
    setPanning(true);
    const onMove = (ev: MouseEvent) => {
      if (!panStart.current) return;
      setTx(panStart.current.tx + (ev.clientX - panStart.current.x));
      setTy(panStart.current.ty + (ev.clientY - panStart.current.y));
    };
    const onUp = () => {
      panStart.current = null;
      setPanning(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [scale, tx, ty]);

  // Double-click to toggle zoom (desktop equivalent of double-tap).
  const handleDoubleClick = useCallback(() => {
    setScale((s) => (s > 1.1 ? 1 : 2.5));
    setTx(0);
    setTy(0);
  }, []);

  // When zoomed back to 1×, force pan offset to 0 so the image re-centers.
  // We use derived values (not an effect) to avoid the lint rule against
  // calling setState inside useEffect.
  const effectiveTx = scale > 1 ? tx : 0;
  const effectiveTy = scale > 1 ? ty : 0;

  return (
    <div className="flex size-full items-center justify-center overflow-hidden p-4 sm:p-8">
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className="max-h-full max-w-full select-none object-contain"
        style={{
          transform: `translate(${effectiveTx}px, ${effectiveTy}px) scale(${scale})`,
          transformOrigin: "center center",
          // Disable transition during active pan/pinch so the image follows the
          // finger exactly with no latency; re-enable for smooth snap-back.
          transition: panning ? "none" : "transform 0.15s ease-out",
          touchAction: "none",
          cursor: scale > 1 ? (panning ? "grabbing" : "grab") : "zoom-in",
        }}
        draggable={false}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
      />
    </div>
  );
}

interface ProductGalleryProps {
  /** Primary image URL (the one shown on cards/cart/wishlist). */
  primaryImage?: string | null;
  /** JSON-encoded string array of gallery image URLs (legacy — Prisma stores it as a string). */
  galleryImages?: string | null;
  /** New: ProductImage records from the dedicated ProductImage table. */
  productImages?: Array<{ imagePath: string; altText?: string | null; isPrimary?: boolean }>;
  /** Product name — used for alt text + fallback placeholder. */
  name: string;
  brandName?: string | null;
  /** Optional badges/overlays rendered in the top-left corner of the main image (e.g. discount %). */
  topLeftBadge?: React.ReactNode;
  /** Optional badges rendered in the top-right corner (e.g. Rx Required). */
  topRightBadge?: React.ReactNode;
  className?: string;
}

export function ProductGallery({
  primaryImage,
  galleryImages,
  productImages,
  name,
  brandName,
  topLeftBadge,
  topRightBadge,
  className,
}: ProductGalleryProps) {
  // Build the full image list — prefer ProductImage records, fall back to legacy.
  const images = useMemo(() => {
    // New system: use productImages array
    if (productImages && productImages.length > 0) {
      // Sort: primary first, then by displayOrder (already sorted from API but ensure)
      const sorted = [...productImages].sort((a, b) => {
        if (a.isPrimary && !b.isPrimary) return -1;
        if (!a.isPrimary && b.isPrimary) return 1;
        return 0;
      });
      return Array.from(new Set(sorted.map((i) => i.imagePath)));
    }
    // Legacy: parse galleryImages JSON string
    const gallery = parseGallery(galleryImages);
    const merged = primaryImage ? [primaryImage, ...gallery] : gallery;
    return Array.from(new Set(merged));
  }, [primaryImage, galleryImages, productImages]);

  const [active, setActive] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);

  // Clamp the active index into a valid range for THIS render. We intentionally
  // do NOT call setState here — `go(delta)` uses the functional form of
  // setActive so it always operates on the latest state, and the parent
  // passes a `key={product.id}` prop so the gallery auto-remounts (and
  // resets to active=0) when navigating to a different product.
  const safeActive = images.length === 0 ? 0 : Math.min(active, images.length - 1);

  const hasMultiple = images.length > 1;

  function go(delta: number) {
    if (!hasMultiple) return;
    setActive((cur) => (cur + delta + images.length) % images.length);
  }

  // ----- No real images: render the gradient placeholder via ProductImage.
  if (images.length === 0) {
    return (
      <div
        className={cn(
          // `min-w-0` + `overflow-hidden` + `max-w-full` ensure this placeholder
          // can NEVER cause its parent grid cell to overflow, regardless of how
          // the parent flex/grid is configured.
          "relative aspect-square w-full max-w-full overflow-hidden rounded-lg border bg-accent/20",
          "min-w-0",
          className
        )}
      >
        <ProductImage
          name={name}
          brandName={brandName}
          size="xl"
          className="!h-full !w-full !text-8xl"
        />
        {topLeftBadge}
        {topRightBadge}
      </div>
    );
  }

  return (
    // ---- Gallery root ----
    // `min-w-0` (critical): overrides the default `min-width: auto` so this flex
    //   item can shrink below its content's intrinsic size.
    // `overflow-hidden`: safety net — even if a descendant overflows, the page
    //   itself never gains a horizontal scrollbar.
    <div className={cn("flex min-w-0 flex-col gap-3 overflow-hidden", className)}>
      {/* Desktop layout: vertical thumbnails on the left, big image on the right.
          Mobile layout: big image on top, horizontal thumbnails below. */}
      <div className="flex min-w-0 flex-col-reverse gap-3 sm:flex-row">
        {/* ---- Thumbnails ---- (hidden when only 1 image) */}
        {hasMultiple && (
          <div
            className={cn(
              // Mobile: `w-full` caps the strip width to its parent so the
              //   `overflow-x-auto` creates a real horizontal scroller. Without
              //   this, the strip would stretch its parent to ~784px wide.
              // Desktop: `sm:w-20 lg:w-24` sets a fixed sidebar width, and
              //   `sm:overflow-y-auto sm:max-h-[520px]` makes it vertically
              //   scrollable when there are many images.
              "no-scrollbar flex w-full gap-2 overflow-x-auto",
              "sm:flex-col sm:w-20 sm:max-h-[520px] sm:overflow-x-visible sm:overflow-y-auto",
              "lg:w-24"
            )}
          >
            {images.map((src, i) => (
              <button
                key={src + i}
                onClick={() => setActive(i)}
                aria-label={`View image ${i + 1}`}
                className={cn(
                  "relative size-16 shrink-0 overflow-hidden rounded-md border-2 bg-accent/20 transition",
                  "sm:size-20 lg:size-24",
                  i === safeActive
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-transparent hover:border-muted-foreground/40"
                )}
              >
                <img
                  src={src}
                  alt={`${name} thumbnail ${i + 1}`}
                  className="size-full object-contain p-1"
                  loading="lazy"
                  draggable={false}
                />
              </button>
            ))}
          </div>
        )}

        {/* ---- Main image ----
            `min-w-0` (critical): allows this flex item to shrink below its
            content's intrinsic size, so it doesn't push the thumbnails strip
            off-screen on mobile or stretch on desktop.
            `flex-1` lets it grow to fill remaining space (desktop sidebar layout). */}
        <div className="relative min-w-0 flex-1">
          {/* `aspect-square w-full` — width = parent width, height = width.
              `overflow-hidden` + `max-w-full` — image can never escape this box.
              The container is the sizing authority; the <img> inside is told to
              `size-full object-contain` so it fits within while preserving
              aspect ratio. */}
          <div className="relative aspect-square w-full max-w-full overflow-hidden rounded-lg border bg-accent/20">
            <motion.img
              key={safeActive}
              src={images[safeActive]}
              alt={`${name} — image ${safeActive + 1}`}
              className="size-full object-contain"
              drag={hasMultiple ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (!hasMultiple) return;
                // Swipe threshold: 50px horizontal drag advances the image.
                if (info.offset.x < -50) go(1);
                else if (info.offset.x > 50) go(-1);
              }}
              onClick={() => setZoomOpen(true)}
              initial={{ opacity: 0.5, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              style={{ cursor: "zoom-in" }}
              draggable={false}
            />

            {/* Top-left / top-right badges (discount %, Rx Required, etc.) */}
            {topLeftBadge && (
              <div className="absolute left-3 top-3 z-10 max-w-[60%]">{topLeftBadge}</div>
            )}
            {topRightBadge && (
              <div className="absolute right-3 top-3 z-10 max-w-[60%]">{topRightBadge}</div>
            )}

            {/* Nav arrows (hidden when only 1 image) */}
            {hasMultiple && (
              <>
                <button
                  onClick={() => go(-1)}
                  aria-label="Previous image"
                  className="absolute left-2 top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-foreground shadow-md transition hover:bg-white hover:scale-105"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  onClick={() => go(1)}
                  aria-label="Next image"
                  className="absolute right-2 top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-foreground shadow-md transition hover:bg-white hover:scale-105"
                >
                  <ChevronRight className="size-5" />
                </button>

                {/* Position indicator (e.g. 2 / 5) */}
                <div className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
                  {safeActive + 1} / {images.length}
                </div>
              </>
            )}

            {/* Zoom hint (only when zoomable, i.e. always for now since we have an image) */}
            <div className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-medium text-white opacity-80">
              <ZoomIn className="size-3" /> Click to zoom
            </div>
          </div>
        </div>
      </div>

      {/* ---- Zoom dialog ---- (fullscreen image with prev/next + close) */}
      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent
          className="h-[95vh] w-[95vw] max-w-none overflow-hidden rounded-lg border-0 bg-black/95 p-0 sm:h-[90vh] sm:w-[90vw]"
          showCloseButton={false}
        >
          {/* Accessibility: give the dialog a title (visually hidden). */}
          <DialogTitle className="sr-only">{name} — zoomed image</DialogTitle>

          {/* Close button */}
          <button
            onClick={() => setZoomOpen(false)}
            aria-label="Close zoom"
            className="absolute right-3 top-3 z-20 flex size-9 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
          >
            <X className="size-5" />
          </button>

          {/* Prev / Next in zoom view (only when multiple images) */}
          {hasMultiple && (
            <>
              <button
                onClick={() => go(-1)}
                aria-label="Previous image"
                className="absolute left-3 top-1/2 z-20 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
              >
                <ChevronLeft className="size-6" />
              </button>
              <button
                onClick={() => go(1)}
                aria-label="Next image"
                className="absolute right-3 top-1/2 z-20 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
              >
                <ChevronRight className="size-6" />
              </button>
            </>
          )}

          {/* The zoomed image — fills the dialog with pinch-zoom + pan support.
              `key={safeActive}` forces remount on image change so ZoomableImage's
              internal zoom/pan state resets cleanly between images. */}
          <ZoomableImage
            key={safeActive}
            src={images[safeActive]}
            alt={`${name} — zoomed image ${safeActive + 1}`}
          />

          {/* Thumbnail strip at the bottom of the zoom view (when multiple) */}
          {hasMultiple && (
            <div className="no-scrollbar absolute bottom-3 left-1/2 flex max-w-[90%] -translate-x-1/2 gap-2 overflow-x-auto p-2">
              {images.map((src, i) => (
                <button
                  key={src + i}
                  onClick={() => setActive(i)}
                  aria-label={`Jump to image ${i + 1}`}
                  className={cn(
                    "relative size-14 shrink-0 overflow-hidden rounded-md border-2 bg-white/10 transition",
                    i === safeActive ? "border-white" : "border-transparent opacity-60 hover:opacity-100"
                  )}
                >
                  <img
                    src={src}
                    alt=""
                    className="size-full object-contain p-1"
                    loading="lazy"
                    draggable={false}
                  />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
