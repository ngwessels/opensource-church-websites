/** @typedef {import('@/types/firestore').AnalyticsEventRecord} AnalyticsEventRecord */

/**
 * @typedef {object} SiteAnalyticsQuery
 * @property {string} dateFrom
 * @property {string} dateTo
 * @property {string} [pagePath]
 * @property {string} [pageId]
 */

import { normalizePagePath } from "./schema.js";

/**
 * @param {string} referrer
 */
function referrerHost(referrer) {
  if (!referrer) return "direct";
  try {
    const url = new URL(referrer);
    if (!url.hostname) return "direct";
    return url.hostname.replace(/^www\./, "");
  } catch {
    return "direct";
  }
}

/**
 * @param {AnalyticsEventRecord} event
 */
function trafficSource(event) {
  if (event.utmSource) return "campaign";
  if (event.referrer) return "referral";
  return "direct";
}

/**
 * @param {AnalyticsEventRecord[]} events
 * @param {SiteAnalyticsQuery} query
 */
export function aggregateAnalyticsEvents(events, query) {
  const normalizedPagePath = query.pagePath ? normalizePagePath(query.pagePath) : null;

  const filtered = events.filter((event) => {
    if (normalizedPagePath && event.pagePath !== normalizedPagePath) return false;
    if (query.pageId && event.pageId !== query.pageId) return false;
    return true;
  });

  const pageViews = filtered.filter((event) => event.type === "page_view");
  const engagementEvents = filtered.filter(
    (event) => event.type === "engagement" || (event.engagementMs && event.engagementMs > 0),
  );

  const sessions = new Set(pageViews.map((event) => event.sessionId));
  const visitors = new Set(pageViews.map((event) => event.visitorId));
  const newVisitors = new Set(
    pageViews.filter((event) => event.isNewVisitor).map((event) => event.visitorId),
  );

  /** @type {Map<string, number>} */
  const sessionPageCounts = new Map();
  for (const event of pageViews) {
    sessionPageCounts.set(event.sessionId, (sessionPageCounts.get(event.sessionId) || 0) + 1);
  }
  const bouncedSessions = [...sessionPageCounts.values()].filter((count) => count === 1).length;

  const engagementValues = engagementEvents
    .map((event) => event.engagementMs || 0)
    .filter((ms) => ms > 0);
  const avgEngagementMs = engagementValues.length
    ? Math.round(engagementValues.reduce((sum, ms) => sum + ms, 0) / engagementValues.length)
    : 0;

  /** @type {Map<string, { pagePath: string, pageTitle: string, pageViews: number, visitors: Set<string>, sessions: Set<string> }>} */
  const pagesMap = new Map();
  /** @type {Map<string, number>} */
  const referrers = new Map();
  /** @type {Map<string, number>} */
  const trafficSources = new Map();
  /** @type {Map<string, number>} */
  const devices = new Map();
  /** @type {Map<string, number>} */
  const browsers = new Map();
  /** @type {Map<string, number>} */
  const countries = new Map();
  /** @type {Map<string, { pageViews: number, sessions: Set<string>, visitors: Set<string> }>} */
  const daily = new Map();

  for (const event of pageViews) {
    const pageKey = event.pagePath;
    if (!pagesMap.has(pageKey)) {
      pagesMap.set(pageKey, {
        pagePath: event.pagePath,
        pageTitle: event.pageTitle || event.pagePath,
        pageViews: 0,
        visitors: new Set(),
        sessions: new Set(),
      });
    }
    const pageEntry = pagesMap.get(pageKey);
    pageEntry.pageViews += 1;
    pageEntry.visitors.add(event.visitorId);
    pageEntry.sessions.add(event.sessionId);
    if (event.pageTitle) pageEntry.pageTitle = event.pageTitle;

    const refHost = referrerHost(event.referrer || "");
    referrers.set(refHost, (referrers.get(refHost) || 0) + 1);

    const source = trafficSource(event);
    trafficSources.set(source, (trafficSources.get(source) || 0) + 1);

    if (event.deviceType) {
      devices.set(event.deviceType, (devices.get(event.deviceType) || 0) + 1);
    }
    if (event.browser) {
      browsers.set(event.browser, (browsers.get(event.browser) || 0) + 1);
    }
    if (event.country) {
      countries.set(event.country, (countries.get(event.country) || 0) + 1);
    }

    if (!daily.has(event.date)) {
      daily.set(event.date, {
        pageViews: 0,
        sessions: new Set(),
        visitors: new Set(),
      });
    }
    const day = daily.get(event.date);
    day.pageViews += 1;
    day.sessions.add(event.sessionId);
    day.visitors.add(event.visitorId);
  }

  const topPages = [...pagesMap.values()]
    .map((entry) => ({
      pagePath: entry.pagePath,
      pageTitle: entry.pageTitle,
      pageViews: entry.pageViews,
      visitors: entry.visitors.size,
      sessions: entry.sessions.size,
    }))
    .sort((a, b) => b.pageViews - a.pageViews);

  const toSortedRows = (map) =>
    [...map.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);

  const dailyTrend = [...daily.entries()]
    .map(([date, stats]) => ({
      date,
      pageViews: stats.pageViews,
      sessions: stats.sessions.size,
      visitors: stats.visitors.size,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const sessionCount = sessions.size;
  const visitorCount = visitors.size;

  return {
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    pagePath: normalizedPagePath,
    pageId: query.pageId || null,
    summary: {
      pageViews: pageViews.length,
      sessions: sessionCount,
      visitors: visitorCount,
      newVisitors: newVisitors.size,
      pagesPerSession: sessionCount ? Number((pageViews.length / sessionCount).toFixed(2)) : 0,
      bounceRate: sessionCount ? Number((bouncedSessions / sessionCount).toFixed(4)) : 0,
      avgEngagementMs,
    },
    dailyTrend,
    topPages,
    referrers: toSortedRows(referrers),
    trafficSources: toSortedRows(trafficSources),
    devices: toSortedRows(devices),
    browsers: toSortedRows(browsers),
    countries: toSortedRows(countries),
  };
}
