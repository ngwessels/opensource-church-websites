"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { sendAnalytics } from "@/lib/analytics/analytics-client";
import { getOrCreateSessionId, getOrCreateVisitorId } from "@/lib/analytics/analytics-ids";
import { getViewportBucket } from "@/lib/analytics/heatmap-grid";
import { EXCLUDED_PATH_PREFIXES, normalizePagePath } from "@/lib/analytics/schema";

const FLUSH_INTERVAL_MS = 5000;
const MAX_BATCH_POINTS = 50;

/**
 * @param {string} path
 */
function isExcludedPath(path) {
  const normalized = normalizePagePath(path);
  return EXCLUDED_PATH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
}

/**
 * @returns {{ x: number, y: number } | null}
 */
function documentCoordsFromEvent(event) {
  const doc = document.documentElement;
  const width = Math.max(doc.scrollWidth, doc.clientWidth, 1);
  const height = Math.max(doc.scrollHeight, doc.clientHeight, 1);
  const x = (window.scrollX + event.clientX) / width;
  const y = (window.scrollY + event.clientY) / height;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
}

function currentScrollDepth() {
  const doc = document.documentElement;
  const height = Math.max(doc.scrollHeight - window.innerHeight, 1);
  return Math.min(1, Math.max(0, window.scrollY / height));
}

/**
 * @param {object} props
 * @param {string} [props.pagePath]
 * @param {string} [props.pageId]
 * @param {boolean} [props.enabled]
 */
export function PageHeatmapTracker({ pagePath: pagePathProp, pageId, enabled = true }) {
  const pathname = usePathname();
  const pagePath = normalizePagePath(pagePathProp || pathname || "/");
  const pointsRef = useRef(/** @type {Array<{ kind: string, x?: number, y?: number, depth?: number }>} */ ([]));
  const maxScrollRef = useRef(0);
  const idsRef = useRef({ visitorId: "", sessionId: "" });
  const flushTimerRef = useRef(/** @type {ReturnType<typeof setInterval> | null} */ (null));

  useEffect(() => {
    if (!enabled || isExcludedPath(pagePath)) return;

    const { visitorId } = getOrCreateVisitorId();
    const sessionId = getOrCreateSessionId();
    idsRef.current = { visitorId, sessionId };
    pointsRef.current = [];
    maxScrollRef.current = currentScrollDepth();

    function pushPoint(point) {
      pointsRef.current.push(point);
      if (pointsRef.current.length >= MAX_BATCH_POINTS) {
        flush();
      }
    }

    function flush() {
      const points = pointsRef.current.splice(0, MAX_BATCH_POINTS);
      const depth = maxScrollRef.current;
      if (depth > 0) {
        points.push({ kind: "scroll", depth });
      }
      if (points.length === 0) return;

      const { visitorId: vid, sessionId: sid } = idsRef.current;
      if (!vid || !sid) return;

      sendAnalytics({
        type: "heatmap_batch",
        pagePath,
        pageId,
        sessionId: sid,
        visitorId: vid,
        deviceType: getViewportBucket(window.innerWidth),
        points,
      });
      maxScrollRef.current = 0;
    }

    function onPointerUp(event) {
      if (event.button !== 0) return;
      const coords = documentCoordsFromEvent(event);
      if (!coords) return;
      pushPoint({ kind: "click", x: coords.x, y: coords.y });
    }

    function onScroll() {
      maxScrollRef.current = Math.max(maxScrollRef.current, currentScrollDepth());
    }

    function onVisibilityHidden() {
      if (document.visibilityState === "hidden") flush();
    }

    document.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityHidden);
    window.addEventListener("pagehide", flush);
    flushTimerRef.current = window.setInterval(flush, FLUSH_INTERVAL_MS);

    return () => {
      document.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibilityHidden);
      window.removeEventListener("pagehide", flush);
      if (flushTimerRef.current) window.clearInterval(flushTimerRef.current);
      flush();
    };
  }, [enabled, pagePath, pageId]);

  return null;
}
