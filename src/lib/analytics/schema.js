/** @typedef {import('@/types/firestore').AnalyticsEventType} AnalyticsEventType */
/** @typedef {import('@/types/firestore').PageType} PageType */

export const ANALYTICS_EVENT_TYPES = ["page_view", "engagement"];

export const EXCLUDED_PATH_PREFIXES = ["/builder", "/login", "/dashboard"];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PAGE_TYPES = new Set(["content", "bulletins", "donation"]);

/**
 * @param {string} path
 */
export function normalizePagePath(path) {
  if (typeof path !== "string" || !path.trim()) return "/";
  const trimmed = path.trim();
  if (trimmed === "/") return "/";
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

/**
 * @param {string} path
 */
export function isExcludedAnalyticsPath(path) {
  const normalized = normalizePagePath(path);
  return EXCLUDED_PATH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
}

/**
 * @param {unknown} value
 */
function optionalString(value, maxLen = 500) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLen);
}

/**
 * @param {unknown} value
 */
function optionalUuid(value) {
  const str = optionalString(value, 64);
  if (!str || !UUID_PATTERN.test(str)) return undefined;
  return str;
}

/**
 * @param {unknown} value
 */
function requireUuid(value, fieldName) {
  const str = optionalString(value, 64);
  if (!str || !UUID_PATTERN.test(str)) {
    throw new Error(`${fieldName} is required`);
  }
  return str;
}

/**
 * @param {unknown} value
 */
function optionalPositiveInt(value, max = 100000) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return undefined;
  return Math.min(Math.round(num), max);
}

/**
 * @param {Date | string} date
 * @param {string} timezone
 */
export function getDateInTimezone(date, timezone) {
  const value = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

/**
 * @param {string | null | undefined} dateValue
 */
export function parseReportDate(dateValue) {
  if (typeof dateValue !== "string" || !dateValue.trim()) {
    throw new Error("Date is required");
  }
  const trimmed = dateValue.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date");
  }
  return getDateInTimezone(parsed, "UTC");
}

/**
 * @param {unknown} body
 * @returns {{
 *   type: AnalyticsEventType,
 *   pagePath: string,
 *   pageTitle?: string,
 *   pageId?: string,
 *   pageType?: PageType,
 *   sessionId: string,
 *   visitorId: string,
 *   isNewVisitor?: boolean,
 *   referrer?: string,
 *   utmSource?: string,
 *   utmMedium?: string,
 *   utmCampaign?: string,
 *   utmTerm?: string,
 *   utmContent?: string,
 *   language?: string,
 *   screenWidth?: number,
 *   screenHeight?: number,
 *   engagementMs?: number,
 * }}
 */
export function validateCollectPayload(body) {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid payload");
  }

  const type = optionalString(body.type, 32) || "page_view";
  if (!ANALYTICS_EVENT_TYPES.includes(type)) {
    throw new Error("Invalid event type");
  }

  const pagePath = normalizePagePath(
    typeof body.pagePath === "string" ? body.pagePath : "",
  );
  if (isExcludedAnalyticsPath(pagePath)) {
    throw new Error("Path is not tracked");
  }

  const sessionId = requireUuid(body.sessionId, "sessionId");
  const visitorId = requireUuid(body.visitorId, "visitorId");

  const pageType = optionalString(body.pageType, 32);
  if (pageType && !PAGE_TYPES.has(pageType)) {
    throw new Error("Invalid pageType");
  }

  const engagementMs = optionalPositiveInt(body.engagementMs, 86_400_000);

  if (type === "engagement") {
    if (!engagementMs || engagementMs < 1) {
      throw new Error("engagementMs is required for engagement events");
    }
  }

  return {
    type,
    pagePath,
    pageTitle: optionalString(body.pageTitle, 300),
    pageId: optionalUuid(body.pageId),
    pageType: /** @type {PageType | undefined} */ (pageType),
    sessionId,
    visitorId,
    isNewVisitor: body.isNewVisitor === true,
    referrer: optionalString(body.referrer, 2000),
    utmSource: optionalString(body.utmSource, 200),
    utmMedium: optionalString(body.utmMedium, 200),
    utmCampaign: optionalString(body.utmCampaign, 200),
    utmTerm: optionalString(body.utmTerm, 200),
    utmContent: optionalString(body.utmContent, 200),
    language: optionalString(body.language, 32),
    screenWidth: optionalPositiveInt(body.screenWidth, 10000),
    screenHeight: optionalPositiveInt(body.screenHeight, 10000),
    engagementMs,
  };
}

/**
 * @param {Headers} headers
 */
export function getCountryFromHeaders(headers) {
  const country =
    headers.get("x-vercel-ip-country") ||
    headers.get("cf-ipcountry") ||
    headers.get("x-country-code");
  if (!country || country === "XX") return undefined;
  return country.slice(0, 2).toUpperCase();
}
