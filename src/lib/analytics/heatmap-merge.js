import {
  HEATMAP_GRID_SIZE,
  buildHotspots,
  cellToPercent,
} from "./heatmap-grid.js";

/** @typedef {import('@/types/firestore').AnalyticsHeatmapRollupRecord} AnalyticsHeatmapRollupRecord */

/**
 * Recover click/scroll maps from rollups that were written with dotted
 * top-level field names (`"clicks.10_10"`, `"scrollBuckets.50"`) via
 * `set({ merge: true })`, which does not expand those keys into nested maps.
 *
 * @param {Record<string, unknown>} rollup
 * @returns {{
 *   clicks: Record<string, number>,
 *   scrollBuckets: Record<string, number>,
 *   sessions: number,
 * }}
 */
export function normalizeHeatmapRollupMaps(rollup) {
  /** @type {Record<string, number>} */
  const clicks = {};
  /** @type {Record<string, number>} */
  const scrollBuckets = {};

  const nestedClicks = rollup?.clicks;
  if (nestedClicks && typeof nestedClicks === "object" && !Array.isArray(nestedClicks)) {
    for (const [key, count] of Object.entries(nestedClicks)) {
      const num = Number(count);
      if (Number.isFinite(num) && num > 0) {
        clicks[key] = (clicks[key] || 0) + num;
      }
    }
  }

  const nestedScroll = rollup?.scrollBuckets;
  if (nestedScroll && typeof nestedScroll === "object" && !Array.isArray(nestedScroll)) {
    for (const [key, count] of Object.entries(nestedScroll)) {
      const num = Number(count);
      if (Number.isFinite(num) && num > 0) {
        scrollBuckets[key] = (scrollBuckets[key] || 0) + num;
      }
    }
  }

  if (rollup && typeof rollup === "object") {
    for (const [key, value] of Object.entries(rollup)) {
      const num = Number(value);
      if (!Number.isFinite(num) || num <= 0) continue;

      if (key.startsWith("clicks.")) {
        const cell = key.slice("clicks.".length);
        if (cell) clicks[cell] = (clicks[cell] || 0) + num;
        continue;
      }
      if (key.startsWith("scrollBuckets.")) {
        const bucket = key.slice("scrollBuckets.".length);
        if (bucket) scrollBuckets[bucket] = (scrollBuckets[bucket] || 0) + num;
      }
    }
  }

  const sessions = Number(rollup?.sessions);
  return {
    clicks,
    scrollBuckets,
    sessions: Number.isFinite(sessions) && sessions > 0 ? sessions : 0,
  };
}

/**
 * @param {AnalyticsHeatmapRollupRecord[]} rollups
 * @param {number} gridSize
 */
export function mergeHeatmapRollups(rollups, gridSize = HEATMAP_GRID_SIZE) {
  /** @type {Record<string, number>} */
  const clicks = {};
  /** @type {Record<string, number>} */
  const scrollBuckets = {};
  let totalSessions = 0;
  let totalClicks = 0;

  for (const rollup of rollups) {
    const normalized = normalizeHeatmapRollupMaps(
      /** @type {Record<string, unknown>} */ (rollup),
    );
    totalSessions += normalized.sessions;
    for (const [key, count] of Object.entries(normalized.clicks)) {
      clicks[key] = (clicks[key] || 0) + count;
      totalClicks += count;
    }
    for (const [key, count] of Object.entries(normalized.scrollBuckets)) {
      scrollBuckets[key] = (scrollBuckets[key] || 0) + count;
    }
  }

  const clickRows = Object.entries(clicks).map(([key, count]) => {
    const [row, col] = key.split("_").map(Number);
    const { xPercent, yPercent } = cellToPercent(row, col, gridSize);
    return { row, col, count, xPercent, yPercent };
  });

  const scrollBucketRows = Object.entries(scrollBuckets)
    .map(([depth, sessions]) => ({
      depthPercent: Number(depth),
      sessions,
    }))
    .sort((a, b) => a.depthPercent - b.depthPercent);

  return {
    gridSize,
    totalClicks,
    totalSessions,
    clicks: clickRows.sort((a, b) => b.count - a.count),
    scrollBuckets: scrollBucketRows,
    hotspots: buildHotspots(clicks, gridSize),
  };
}
