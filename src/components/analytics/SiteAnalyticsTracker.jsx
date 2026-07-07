"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { sendAnalytics } from "@/lib/analytics/analytics-client";
import { getOrCreateSessionId, getOrCreateVisitorId } from "@/lib/analytics/analytics-ids";
import { EXCLUDED_PATH_PREFIXES, normalizePagePath } from "@/lib/analytics/schema";

/**
 * @param {string} path
 */
function isExcludedPath(path) {
  const normalized = normalizePagePath(path);
  return EXCLUDED_PATH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
}

function getUtmParams() {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  return {
    utmSource: params.get("utm_source") || undefined,
    utmMedium: params.get("utm_medium") || undefined,
    utmCampaign: params.get("utm_campaign") || undefined,
    utmTerm: params.get("utm_term") || undefined,
    utmContent: params.get("utm_content") || undefined,
  };
}

/**
 * @param {object} props
 * @param {string} [props.pagePath]
 * @param {string} [props.pageTitle]
 * @param {string} [props.pageId]
 * @param {string} [props.pageType]
 * @param {boolean} [props.enabled]
 */
export function SiteAnalyticsTracker({
  pagePath: pagePathProp,
  pageTitle: pageTitleProp,
  pageId,
  pageType,
  enabled = true,
}) {
  const pathname = usePathname();
  const pagePath = normalizePagePath(pagePathProp || pathname || "/");
  const pageStartRef = useRef(0);
  const activePathRef = useRef("");
  const idsRef = useRef({ visitorId: "", sessionId: "", isNewVisitor: false });

  useEffect(() => {
    if (!enabled || isExcludedPath(pagePath)) return;

    const { visitorId, isNewVisitor } = getOrCreateVisitorId();
    const sessionId = getOrCreateSessionId();
    idsRef.current = { visitorId, sessionId, isNewVisitor };

    const previousPath = activePathRef.current;
    if (previousPath && previousPath !== pagePath && pageStartRef.current > 0) {
      const engagementMs = Math.max(0, Date.now() - pageStartRef.current);
      if (engagementMs >= 1000) {
        sendAnalytics({
          type: "engagement",
          pagePath: previousPath,
          sessionId,
          visitorId,
          engagementMs,
        });
      }
    }

    activePathRef.current = pagePath;
    pageStartRef.current = Date.now();

    const utm = getUtmParams();

    sendAnalytics({
      type: "page_view",
      pagePath,
      pageTitle: pageTitleProp || (typeof document !== "undefined" ? document.title : undefined),
      pageId,
      pageType,
      sessionId,
      visitorId,
      isNewVisitor,
      referrer: typeof document !== "undefined" ? document.referrer : undefined,
      ...utm,
      language: typeof navigator !== "undefined" ? navigator.language : undefined,
      screenWidth: typeof window !== "undefined" ? window.screen?.width : undefined,
      screenHeight: typeof window !== "undefined" ? window.screen?.height : undefined,
    });
  }, [enabled, pagePath, pageTitleProp, pageId, pageType]);

  useEffect(() => {
    if (!enabled || isExcludedPath(pagePath)) return;

    function sendEngagement() {
      const elapsed = Date.now() - pageStartRef.current;
      if (elapsed < 1000) return;
      const { sessionId, visitorId } = idsRef.current;
      if (!sessionId || !visitorId) return;
      sendAnalytics({
        type: "engagement",
        pagePath: activePathRef.current || pagePath,
        sessionId,
        visitorId,
        engagementMs: elapsed,
      });
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        sendEngagement();
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", sendEngagement);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", sendEngagement);
    };
  }, [enabled, pagePath]);

  return null;
}
