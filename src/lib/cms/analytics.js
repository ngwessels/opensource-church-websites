import "server-only";

import { getSiteAnalyticsReport } from "@/lib/analytics/query";
import { getPageHeatmapReport } from "@/lib/analytics/heatmap-query";

/**
 * @param {{ dateFrom: string, dateTo: string, pagePath?: string, pageId?: string }} args
 */
export async function getSiteAnalyticsAdmin(args) {
  return getSiteAnalyticsReport(args);
}

/**
 * @param {{ dateFrom: string, dateTo: string, pagePath?: string, pageId?: string }} args
 */
export async function getPageAnalyticsAdmin(args) {
  if (!args.pagePath && !args.pageId) {
    throw new Error("pagePath or pageId is required");
  }
  return getSiteAnalyticsReport(args);
}

/**
 * @param {{
 *   dateFrom: string,
 *   dateTo: string,
 *   pagePath?: string,
 *   pageId?: string,
 *   deviceType?: 'mobile' | 'tablet' | 'desktop',
 * }} args
 */
export async function getPageHeatmapAdmin(args) {
  if (!args.pagePath && !args.pageId) {
    throw new Error("pagePath or pageId is required");
  }
  return getPageHeatmapReport(args);
}
