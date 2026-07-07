import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  HEATMAP_GRID_SIZE,
  buildHotspots,
  cellKey,
  cellToPercent,
  coordsToCell,
  getViewportBucket,
  positionLabel,
  scrollDepthToBucket,
} from "./heatmap-grid.js";

describe("analytics/heatmap-grid", () => {
  it("maps normalized coordinates to grid cells", () => {
    const cell = coordsToCell(0.5, 0.5, 40);
    assert.equal(cell.row, 20);
    assert.equal(cell.col, 20);
    assert.equal(cellKey(cell.row, cell.col), "20_20");
  });

  it("clamps coordinates at edges", () => {
    const cell = coordsToCell(1.5, -0.2, 40);
    assert.equal(cell.col, 39);
    assert.equal(cell.row, 0);
  });

  it("converts cells to percent centers", () => {
    const { xPercent, yPercent } = cellToPercent(0, 0, 40);
    assert.equal(xPercent, 1);
    assert.equal(yPercent, 1);
  });

  it("buckets scroll depth", () => {
    assert.equal(scrollDepthToBucket(0.05), 0);
    assert.equal(scrollDepthToBucket(0.95), 90);
    assert.equal(scrollDepthToBucket(1), 100);
  });

  it("labels positions", () => {
    assert.equal(positionLabel(10, 10), "upper-left");
    assert.equal(positionLabel(50, 50), "center");
  });

  it("builds hotspot summaries", () => {
    const hotspots = buildHotspots({ "5_10": 4, "5_11": 9 }, HEATMAP_GRID_SIZE, 2);
    assert.equal(hotspots.length, 2);
    assert.equal(hotspots[0].count, 9);
  });

  it("detects viewport buckets", () => {
    assert.equal(getViewportBucket(390), "mobile");
    assert.equal(getViewportBucket(800), "tablet");
    assert.equal(getViewportBucket(1280), "desktop");
  });
});
