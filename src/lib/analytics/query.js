import "server-only";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firestore/paths";

import { aggregateAnalyticsEvents } from "./aggregate.js";
import { parseReportDate } from "./schema.js";

/** @typedef {import('@/types/firestore').AnalyticsEventRecord} AnalyticsEventRecord */

/**
 * @typedef {object} SiteAnalyticsQuery
 * @property {string} dateFrom
 * @property {string} dateTo
 * @property {string} [pagePath]
 * @property {string} [pageId]
 */

/**
 * @param {SiteAnalyticsQuery} query
 */
export async function getSiteAnalyticsReport(query) {
  const dateFrom = parseReportDate(query.dateFrom);
  const dateTo = parseReportDate(query.dateTo);
  if (dateFrom > dateTo) {
    throw new Error("dateFrom must be on or before dateTo");
  }

  const db = getFirebaseAdminFirestore();
  if (!db) throw new Error("Firebase Admin is not configured");

  const snap = await db
    .collection(COLLECTIONS.analyticsEvents)
    .where("date", ">=", dateFrom)
    .where("date", "<=", dateTo)
    .orderBy("date")
    .get();

  const events = snap.docs.map((doc) => /** @type {AnalyticsEventRecord} */ (doc.data()));

  return aggregateAnalyticsEvents(events, {
    dateFrom,
    dateTo,
    pagePath: query.pagePath,
    pageId: query.pageId,
  });
}

export { aggregateAnalyticsEvents } from "./aggregate.js";
