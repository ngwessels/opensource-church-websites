import {
  HEATMAP_GRID_SIZE,
  buildHotspots,
  cellToPercent,
} from "./heatmap-grid.js";

/** @typedef {import('@/types/firestore').AnalyticsHeatmapRollupRecord} AnalyticsHeatmapRollupRecord */

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
    totalSessions += rollup.sessions || 0;
    for (const [key, count] of Object.entries(rollup.clicks || {})) {
      clicks[key] = (clicks[key] || 0) + count;
      totalClicks += count;
    }
    for (const [key, count] of Object.entries(rollup.scrollBuckets || {})) {
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
