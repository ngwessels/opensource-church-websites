import "server-only";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { getPageAdmin } from "@/lib/cms/pages";
import { COLLECTIONS } from "@/lib/firestore/paths";

import {
  HEATMAP_GRID_SIZE,
  HEATMAP_DEVICE_TYPES,
} from "./heatmap-grid.js";
import { mergeHeatmapRollups } from "./heatmap-merge.js";
import { normalizePagePath, parseReportDate } from "./schema.js";

/** @typedef {import('@/types/firestore').AnalyticsHeatmapRollupRecord} AnalyticsHeatmapRollupRecord */
/** @typedef {import('@/types/firestore').HeatmapDeviceType} HeatmapDeviceType */

/**
 * @param {string} dateFrom
 * @param {string} dateTo
 */
function listDatesInRange(dateFrom, dateTo) {
  const dates = [];
  const cursor = new Date(`${dateFrom}T12:00:00.000Z`);
  const end = new Date(`${dateTo}T12:00:00.000Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/**
 * @param {{
 *   dateFrom: string,
 *   dateTo: string,
 *   pagePath?: string,
 *   pageId?: string,
 *   deviceType?: HeatmapDeviceType,
 * }} query
 */
export async function getPageHeatmapReport(query) {
  const dateFrom = parseReportDate(query.dateFrom);
  const dateTo = parseReportDate(query.dateTo);
  if (dateFrom > dateTo) {
    throw new Error("dateFrom must be on or before dateTo");
  }

  let pagePath = query.pagePath ? normalizePagePath(query.pagePath) : null;
  let pageId = query.pageId || null;

  if (!pagePath && pageId) {
    const page = await getPageAdmin({ pageId });
    pagePath = normalizePagePath(page.slug || "/");
    pageId = page.id;
  }

  if (!pagePath) {
    throw new Error("pagePath or pageId is required");
  }

  const db = getFirebaseAdminFirestore();
  if (!db) throw new Error("Firebase Admin is not configured");

  const snap = await db
    .collection(COLLECTIONS.analyticsHeatmapRollups)
    .where("date", ">=", dateFrom)
    .where("date", "<=", dateTo)
    .get();

  const deviceTypes = query.deviceType ? [query.deviceType] : [...HEATMAP_DEVICE_TYPES];

  const rollups = snap.docs
    .map((doc) => /** @type {AnalyticsHeatmapRollupRecord} */ (doc.data()))
    .filter((rollup) => normalizePagePath(rollup.pagePath) === pagePath)
    .filter((rollup) => deviceTypes.includes(rollup.deviceType));

  const merged = mergeHeatmapRollups(rollups, HEATMAP_GRID_SIZE);

  return {
    pagePath,
    pageId,
    deviceType: query.deviceType || "all",
    dateFrom,
    dateTo,
    datesInRange: listDatesInRange(dateFrom, dateTo),
    ...merged,
  };
}
