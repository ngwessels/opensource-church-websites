"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

const MIN_SCALE = 1;
const MAX_SCALE = 4;

function getTouchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

/**
 * Touch pinch-to-zoom wrapper for mobile lightboxes.
 * Resets when `resetKey` changes (e.g. new image or close).
 */
export function PinchZoom({ children, className, resetKey }) {
  const surfaceRef = useRef(null);
  const contentRef = useRef(null);
  const transformRef = useRef({ scale: 1, x: 0, y: 0 });
  const pinchRef = useRef(null);
  const panRef = useRef(null);

  useEffect(() => {
    transformRef.current = { scale: 1, x: 0, y: 0 };
    pinchRef.current = null;
    panRef.current = null;
    if (contentRef.current) {
      contentRef.current.style.transform = "";
    }
  }, [resetKey]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;

    const applyTransform = () => {
      const content = contentRef.current;
      if (!content) return;
      const { scale, x, y } = transformRef.current;
      content.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    };

    const onTouchStart = (event) => {
      if (event.touches.length === 2) {
        event.preventDefault();
        pinchRef.current = {
          startDistance: getTouchDistance(event.touches),
          startScale: transformRef.current.scale,
        };
        panRef.current = null;
        return;
      }

      if (event.touches.length === 1 && transformRef.current.scale > 1) {
        panRef.current = {
          startX: event.touches[0].clientX,
          startY: event.touches[0].clientY,
          startTranslateX: transformRef.current.x,
          startTranslateY: transformRef.current.y,
        };
      }
    };

    const onTouchMove = (event) => {
      if (event.touches.length === 2 && pinchRef.current) {
        event.preventDefault();
        const distance = getTouchDistance(event.touches);
        const nextScale = Math.min(
          MAX_SCALE,
          Math.max(MIN_SCALE, pinchRef.current.startScale * (distance / pinchRef.current.startDistance)),
        );
        transformRef.current.scale = nextScale;
        if (nextScale <= 1) {
          transformRef.current.x = 0;
          transformRef.current.y = 0;
        }
        applyTransform();
        return;
      }

      if (event.touches.length === 1 && panRef.current && transformRef.current.scale > 1) {
        event.preventDefault();
        const dx = event.touches[0].clientX - panRef.current.startX;
        const dy = event.touches[0].clientY - panRef.current.startY;
        transformRef.current.x = panRef.current.startTranslateX + dx;
        transformRef.current.y = panRef.current.startTranslateY + dy;
        applyTransform();
      }
    };

    const onTouchEnd = (event) => {
      if (event.touches.length < 2) {
        pinchRef.current = null;
      }
      if (event.touches.length === 0) {
        panRef.current = null;
      }
      if (transformRef.current.scale <= 1) {
        transformRef.current = { scale: 1, x: 0, y: 0 };
        applyTransform();
      }
    };

    surface.addEventListener("touchstart", onTouchStart, { passive: false });
    surface.addEventListener("touchmove", onTouchMove, { passive: false });
    surface.addEventListener("touchend", onTouchEnd);
    surface.addEventListener("touchcancel", onTouchEnd);

    return () => {
      surface.removeEventListener("touchstart", onTouchStart);
      surface.removeEventListener("touchmove", onTouchMove);
      surface.removeEventListener("touchend", onTouchEnd);
      surface.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  return (
    <div
      ref={surfaceRef}
      className={cn("touch-none overflow-hidden", className)}
    >
      <div ref={contentRef} className="origin-center will-change-transform">
        {children}
      </div>
    </div>
  );
}
