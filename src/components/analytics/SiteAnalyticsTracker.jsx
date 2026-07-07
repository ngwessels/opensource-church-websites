"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { EXCLUDED_PATH_PREFIXES, normalizePagePath } from "@/lib/analytics/schema";

const VISITOR_ID_KEY = "parish_analytics_visitor";
const SESSION_ID_KEY = "parish_analytics_session";
const SESSION_LAST_KEY = "parish_analytics_session_last";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * @param {string} path
 */
function isExcludedPath(path) {
  const normalized = normalizePagePath(path);
  return EXCLUDED_PATH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
}

function readUuid(storage, key) {
  try {
    const value = storage.getItem(key);
    if (value && /^[0-9a-f-]{36}$/i.test(value)) return value;
  } catch {
    // ignore
  }
  return null;
}

function writeUuid(storage, key, value) {
  try {
    storage.setItem(key, value);
  } catch {
    // ignore
  }
}

function getOrCreateVisitorId() {
  const existing = readUuid(localStorage, VISITOR_ID_KEY);
  if (existing) return { visitorId: existing, isNewVisitor: false };
  const visitorId = crypto.randomUUID();
  writeUuid(localStorage, VISITOR_ID_KEY, visitorId);
  return { visitorId, isNewVisitor: true };
}

function getOrCreateSessionId() {
  const now = Date.now();
  const lastActive = Number(sessionStorage.getItem(SESSION_LAST_KEY) || 0);
  const existing = readUuid(sessionStorage, SESSION_ID_KEY);
  if (existing && lastActive && now - lastActive < SESSION_TIMEOUT_MS) {
    sessionStorage.setItem(SESSION_LAST_KEY, String(now));
    return existing;
  }
  const sessionId = crypto.randomUUID();
  writeUuid(sessionStorage, SESSION_ID_KEY, sessionId);
  sessionStorage.setItem(SESSION_LAST_KEY, String(now));
  return sessionId;
}

/**
 * @param {Record<string, unknown>} payload
 */
function sendAnalytics(payload) {
  const body = JSON.stringify(payload);
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon("/api/analytics/collect", blob)) return;
  }
  fetch("/api/analytics/collect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
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
  }, [
    enabled,
    pagePath,
    pageTitleProp,
    pageId,
    pageType,
  ]);

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
