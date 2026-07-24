import {
  HEATMAP_GRID_SIZE,
  cellKey,
  coordsToCell,
  scrollDepthToBucket,
} from "./heatmap-grid.js";

/**
 * Build dotted Firestore field paths for heatmap click/scroll increments.
 * These paths must be applied with `update()` (not `set({ merge: true })`),
 * because set-merge stores dotted keys as literal top-level field names.
 *
 * @param {Array<{ kind: string, x?: number, y?: number, depth?: number }>} points
 * @returns {{
 *   paths: string[],
 *   clickCount: number,
 *   scrollCount: number,
 * }}
 */
export function buildHeatmapIncrementPaths(points) {
  /** @type {string[]} */
  const paths = [];
  let clickCount = 0;
  let scrollCount = 0;

  for (const point of points) {
    if (point.kind === "click") {
      const { row, col } = coordsToCell(point.x, point.y, HEATMAP_GRID_SIZE);
      paths.push(`clicks.${cellKey(row, col)}`);
      clickCount += 1;
      continue;
    }
    if (point.kind === "scroll") {
      const bucket = String(scrollDepthToBucket(point.depth));
      paths.push(`scrollBuckets.${bucket}`);
      scrollCount += 1;
    }
  }

  return { paths, clickCount, scrollCount };
}
