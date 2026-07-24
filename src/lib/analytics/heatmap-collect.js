import "server-only";

import { createHash } from "node:crypto";

import { FieldValue } from "firebase-admin/firestore";

import { getSiteConfigAdmin } from "@/lib/cms/site";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { normalizeSiteTimezone } from "@/lib/site/timezone";

import { getDateInTimezone } from "./schema.js";
import { HEATMAP_GRID_SIZE } from "./heatmap-grid.js";
import { buildHeatmapIncrementPaths } from "./heatmap-increments.js";

/** @typedef {ReturnType<import('./schema.js').validateHeatmapBatchPayload>} HeatmapBatchPayload */

/**
 * @param {string} pagePath
 */
export function pagePathHash(pagePath) {
  return createHash("sha256").update(pagePath).digest("hex").slice(0, 8);
}

/**
 * @param {string} date
 * @param {string} path
 * @param {string} deviceType
 */
export function heatmapRollupId(date, path, deviceType) {
  return `${date}_${pagePathHash(path)}_${deviceType}`;
}

/**
 * @param {string} date
 * @param {string} path
 * @param {string} deviceType
 * @param {string} sessionId
 */
export function heatmapSessionId(date, path, deviceType, sessionId) {
  return `${date}_${pagePathHash(path)}_${deviceType}_${sessionId}`;
}

/**
 * @param {HeatmapBatchPayload} payload
 * @param {string} date
 */
export async function collectHeatmapBatch(payload, date) {
  const db = getFirebaseAdminFirestore();
  if (!db) throw new Error("Firebase Admin is not configured");

  const rollupId = heatmapRollupId(date, payload.pagePath, payload.deviceType);
  const rollupRef = db.collection(COLLECTIONS.analyticsHeatmapRollups).doc(rollupId);

  const { paths, clickCount, scrollCount } = buildHeatmapIncrementPaths(payload.points);

  const sessionDocId = heatmapSessionId(
    date,
    payload.pagePath,
    payload.deviceType,
    payload.sessionId,
  );
  const sessionRef = db.collection(COLLECTIONS.analyticsHeatmapSessions).doc(sessionDocId);
  const sessionSnap = await sessionRef.get();
  let isNewSession = false;
  if (!sessionSnap.exists) {
    await sessionRef.set({
      date,
      pagePath: payload.pagePath,
      deviceType: payload.deviceType,
      sessionId: payload.sessionId,
      createdAt: new Date().toISOString(),
    });
    isNewSession = true;
  }

  const baseFields = {
    date,
    pagePath: payload.pagePath,
    deviceType: payload.deviceType,
    gridSize: HEATMAP_GRID_SIZE,
    updatedAt: new Date().toISOString(),
  };
  if (payload.pageId) baseFields.pageId = payload.pageId;

  if (clickCount > 0 || scrollCount > 0) {
    // Ensure the document exists, then apply dotted-path increments via update().
    // set({ merge: true }) with keys like "scrollBuckets.50" stores literal
    // top-level fields and breaks admin reads of nested scrollBuckets/clicks maps.
    await rollupRef.set(baseFields, { merge: true });

    /** @type {Record<string, unknown>} */
    const updatePayload = {
      updatedAt: baseFields.updatedAt,
    };
    for (const path of paths) {
      updatePayload[path] = FieldValue.increment(1);
    }
    if (isNewSession) updatePayload.sessions = FieldValue.increment(1);

    await rollupRef.update(updatePayload);
  }

  return { ok: true, rollupId, points: payload.points.length };
}

/**
 * @param {Request} request
 * @param {HeatmapBatchPayload} payload
 */
export async function ingestHeatmapBatch(request, payload) {
  const timestamp = new Date().toISOString();
  const siteConfig = await getSiteConfigAdmin();
  const timezone = normalizeSiteTimezone(siteConfig?.timezone);
  const date = getDateInTimezone(timestamp, timezone);
  return collectHeatmapBatch(payload, date);
}
