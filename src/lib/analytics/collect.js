import "server-only";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { generateId } from "@/lib/sitemap/tree";
import { getSiteConfigAdmin } from "@/lib/cms/site";
import { normalizeSiteTimezone } from "@/lib/site/timezone";

import { getDateInTimezone, getCountryFromHeaders, validateCollectPayload } from "./schema.js";
import { isBotUserAgent, parseUserAgent } from "./user-agent.js";

/** @typedef {import('@/types/firestore').AnalyticsEventRecord} AnalyticsEventRecord */

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 120;

/** @type {Map<string, { count: number, resetAt: number }>} */
const rateLimitBuckets = new Map();

/**
 * @param {string} key
 */
function checkRateLimit(key) {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_MAX) return false;
  bucket.count += 1;
  return true;
}

/**
 * @param {Request} request
 * @param {unknown} body
 */
export async function collectAnalyticsEvent(request, body) {
  const userAgent = request.headers.get("user-agent");
  if (isBotUserAgent(userAgent)) {
    return { ok: true, skipped: "bot" };
  }

  const rateKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(rateKey)) {
    throw new Error("Rate limit exceeded");
  }

  const payload = validateCollectPayload(body);
  const parsedUa = parseUserAgent(userAgent);
  const country = getCountryFromHeaders(request.headers);
  const timestamp = new Date().toISOString();

  const siteConfig = await getSiteConfigAdmin();
  const timezone = normalizeSiteTimezone(siteConfig?.timezone);
  const date = getDateInTimezone(timestamp, timezone);

  /** @type {AnalyticsEventRecord} */
  const record = {
    type: payload.type,
    timestamp,
    date,
    pagePath: payload.pagePath,
    sessionId: payload.sessionId,
    visitorId: payload.visitorId,
    deviceType: parsedUa.deviceType,
    browser: parsedUa.browser,
    os: parsedUa.os,
  };

  if (payload.pageTitle) record.pageTitle = payload.pageTitle;
  if (payload.pageId) record.pageId = payload.pageId;
  if (payload.pageType) record.pageType = payload.pageType;
  if (payload.isNewVisitor) record.isNewVisitor = true;
  if (payload.referrer) record.referrer = payload.referrer;
  if (payload.utmSource) record.utmSource = payload.utmSource;
  if (payload.utmMedium) record.utmMedium = payload.utmMedium;
  if (payload.utmCampaign) record.utmCampaign = payload.utmCampaign;
  if (payload.utmTerm) record.utmTerm = payload.utmTerm;
  if (payload.utmContent) record.utmContent = payload.utmContent;
  if (payload.language) record.language = payload.language;
  if (payload.screenWidth) record.screenWidth = payload.screenWidth;
  if (payload.screenHeight) record.screenHeight = payload.screenHeight;
  if (payload.engagementMs) record.engagementMs = payload.engagementMs;
  if (country) record.country = country;

  const db = getFirebaseAdminFirestore();
  if (!db) throw new Error("Firebase Admin is not configured");

  const eventId = `evt_${generateId()}`;
  await db.collection(COLLECTIONS.analyticsEvents).doc(eventId).set(record);

  return { ok: true, eventId };
}
