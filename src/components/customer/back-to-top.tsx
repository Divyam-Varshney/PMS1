// ============================================================================
// File: src/components/customer/back-to-top.tsx
// Purpose: Floating "scroll to top" button with a circular scroll-progress
//          ring. Appears after the user scrolls down > 400px. The ring fills
//          clockwise to show how far down the page the user has scrolled.
//          Smooth-scrolls to the top on click.
//
//  Phase 40.1 optimizations:
//    • Removed framer-motion (was ~100KB in initial bundle for a simple
//      show/hide animation). Replaced with CSS transition + conditional render.
//    • Wrapped in React.memo so it doesn't re-render when CustomerLayout's
//      settings/customer queries refetch.
//
// POSITIONING NOTE:
//   This button is anchored to the LEFT side of the viewport to avoid
//   colliding with the PMS Assistant widget (bottom-right) and to keep it
//   clear of the mobile bottom-nav's leftmost "Home" button when scrolling.
//   - Mobile:  left-4  bottom-20  (clears the 64px bottom nav)
//   - sm+:     left-6  bottom-24  (clears the right-side Assistant button)
//   - lg+:     left-6  bottom-6   (no mobile nav on desktop)
// Role: Quality-of-life affordance on long customer pages (shop, product, etc).
// ============================================================================

"use client";

import { memo, useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export const BackToTop = memo(function BackToTop() {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0); // 0-100 scroll progress

  useEffect(() => {
    const onScroll = () => {
      const scrollY = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight > 0 ? Math.min(100, Math.round((scrollY / docHeight) * 100)) : 0;
      setProgress(pct);
      setVisible(scrollY > 400);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Circular progress ring geometry.
  const size = 48;
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (progress / 100) * circumference;

  if (!visible) return null;

  return (
    <button
      onClick={scrollToTop}
      aria-label="Back to top"
      title="Back to top"
      className="fixed bottom-20 left-4 z-40 flex size-12 animate-in fade-in zoom-in-95 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/30 ring-1 ring-emerald-500/40 transition-all hover:scale-110 hover:from-emerald-700 hover:to-teal-700 active:scale-95 sm:bottom-24 sm:left-6 lg:bottom-6 lg:left-6"
      style={{ animationDuration: "200ms" }}
    >
      {/* Circular scroll-progress ring */}
      <svg
        className="absolute inset-0 -rotate-90"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="white"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 0.15s ease-out" }}
        />
      </svg>
      <ArrowUp className="size-5" />
    </button>
  );
});
