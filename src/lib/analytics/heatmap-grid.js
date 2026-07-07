export const HEATMAP_GRID_SIZE = 40;

/** @typedef {'mobile' | 'tablet' | 'desktop'} HeatmapDeviceType */

export const HEATMAP_DEVICE_TYPES = /** @type {const} */ (["mobile", "tablet", "desktop"]);

/**
 * @param {number} innerWidth
 * @returns {HeatmapDeviceType}
 */
export function getViewportBucket(innerWidth) {
  if (innerWidth < 768) return "mobile";
  if (innerWidth < 1024) return "tablet";
  return "desktop";
}

/**
 * @param {number} x 0–1
 * @param {number} y 0–1
 * @param {number} [gridSize]
 */
export function coordsToCell(x, y, gridSize = HEATMAP_GRID_SIZE) {
  const clampedX = Math.min(1, Math.max(0, x));
  const clampedY = Math.min(1, Math.max(0, y));
  const col = Math.min(gridSize - 1, Math.floor(clampedX * gridSize));
  const row = Math.min(gridSize - 1, Math.floor(clampedY * gridSize));
  return { row, col };
}

/**
 * @param {number} row
 * @param {number} col
 * @param {number} [gridSize]
 */
export function cellToPercent(row, col, gridSize = HEATMAP_GRID_SIZE) {
  return {
    xPercent: Math.round(((col + 0.5) / gridSize) * 100),
    yPercent: Math.round(((row + 0.5) / gridSize) * 100),
  };
}

/**
 * @param {number} row
 * @param {number} col
 */
export function cellKey(row, col) {
  return `${row}_${col}`;
}

/**
 * @param {number} depth 0–1
 */
export function scrollDepthToBucket(depth) {
  const clamped = Math.min(1, Math.max(0, depth));
  return Math.min(100, Math.floor(clamped * 10) * 10);
}

/**
 * @param {number} xPercent
 * @param {number} yPercent
 */
export function positionLabel(xPercent, yPercent) {
  const vertical =
    yPercent < 33 ? "upper" : yPercent < 67 ? "middle" : "lower";
  const horizontal =
    xPercent < 33 ? "left" : xPercent < 67 ? "center" : "right";
  if (horizontal === "center" && vertical === "middle") return "center";
  return `${vertical}-${horizontal}`;
}

/**
 * @param {Record<string, number>} clicksMap
 * @param {number} [gridSize]
 * @param {number} [limit]
 */
export function buildHotspots(clicksMap, gridSize = HEATMAP_GRID_SIZE, limit = 10) {
  const entries = Object.entries(clicksMap || {})
    .map(([key, count]) => {
      const [row, col] = key.split("_").map(Number);
      if (!Number.isFinite(row) || !Number.isFinite(col)) return null;
      const { xPercent, yPercent } = cellToPercent(row, col, gridSize);
      return {
        row,
        col,
        count,
        xPercent,
        yPercent,
        label: positionLabel(xPercent, yPercent),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  return entries;
}
