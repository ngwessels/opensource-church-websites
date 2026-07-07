import "server-only";

import { createHash } from "node:crypto";

import { FieldValue } from "firebase-admin/firestore";

import { getSiteConfigAdmin } from "@/lib/cms/site";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { normalizeSiteTimezone } from "@/lib/site/timezone";

import { getDateInTimezone } from "./schema.js";
import {
  HEATMAP_GRID_SIZE,
  cellKey,
  coordsToCell,
  scrollDepthToBucket,
} from "./heatmap-grid.js";

/** @typedef {import('./schema.js').HeatmapPoint} HeatmapPoint */
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

  /** @type {Record<string, unknown>} */
  const increments = {
    updatedAt: new Date().toISOString(),
  };

  let clickCount = 0;
  for (const point of payload.points) {
    if (point.kind === "click") {
      const { row, col } = coordsToCell(point.x, point.y, HEATMAP_GRID_SIZE);
      increments[`clicks.${cellKey(row, col)}`] = FieldValue.increment(1);
      clickCount += 1;
      continue;
    }
    const bucket = String(scrollDepthToBucket(point.depth));
    increments[`scrollBuckets.${bucket}`] = FieldValue.increment(1);
  }

  const sessionDocId = heatmapSessionId(
    date,
    payload.pagePath,
    payload.deviceType,
    payload.sessionId,
  );
  const sessionRef = db.collection(COLLECTIONS.analyticsHeatmapSessions).doc(sessionDocId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) {
    await sessionRef.set({
      date,
      pagePath: payload.pagePath,
      deviceType: payload.deviceType,
      sessionId: payload.sessionId,
      createdAt: new Date().toISOString(),
    });
    increments.sessions = FieldValue.increment(1);
  }

  const baseFields = {
    date,
    pagePath: payload.pagePath,
    deviceType: payload.deviceType,
    gridSize: HEATMAP_GRID_SIZE,
  };
  if (payload.pageId) baseFields.pageId = payload.pageId;

  if (clickCount > 0 || Object.keys(increments).some((key) => key.startsWith("scrollBuckets."))) {
    await rollupRef.set(
      {
        ...baseFields,
        ...increments,
      },
      { merge: true },
    );
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
